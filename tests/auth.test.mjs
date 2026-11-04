import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),dir=mkdtempSync(path.join(tmpdir(),'mg-auth-')),db=path.join(dir,'users.db'),port=4300+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
const env={...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',AUTH_DB:db};
const server=spawn(process.execPath,['--no-warnings',path.join(root,'scripts/server.mjs')],{env,stdio:'ignore'});
const cleanup=()=>{server.kill();try{rmSync(dir,{recursive:true,force:true});}catch{}};
test.after(cleanup);
const get=(p,cookie,opts={})=>fetch(base+p,{redirect:'manual',headers:cookie?{cookie}:{},...opts});
const post=(p,body,cookie)=>fetch(base+p,{method:'POST',redirect:'manual',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body??{})});
const cookieOf=r=>r.headers.get('set-cookie')?.split(';')[0]??null;
const admin=(...args)=>execFileSync(process.execPath,['--no-warnings',path.join(root,'scripts/auth-admin.mjs'),...args],{env,encoding:'utf8'}).trim();

test('the site is closed without an approved session; approval, sign-out and one-time links work',async()=>{
 for(let i=0;;i++){try{if((await get('/api/health')).ok)break;}catch{}if(i>100)throw Error('server did not start');await new Promise(r=>setTimeout(r,100));}
 // Closed: pages redirect, data and APIs answer 401; the sign-in page and its assets stay open.
 const home=await get('/');assert.equal(home.status,302);assert.equal(home.headers.get('location'),'/giris.html');
 const horse=await get('/at-yarisi.html?x=1');assert.equal(horse.status,302);assert.match(horse.headers.get('location'),/sonra=%2Fat-yarisi\.html/);
 for(const p of ['/app.mjs','/data/bundle.json','/api/raw?id=5904782','/api/player?id=12345','/%61pp.mjs','/account.mjs','/yonetim.mjs','/api/auth/users','/api/auth/me'])assert.equal((await get(p)).status,p==='/api/auth/users'?403:401,p);
 assert.equal((await post('/api/collect?id=5904782')).status,401);
 for(const p of ['/giris.html','/giris.mjs','/auth.css','/style.css','/favicon.svg','/api/health'])assert.equal((await get(p)).status,200,p);

 // Application stays out until approved; a wrong password and an unknown address look alike; a repeat application looks the same.
 assert.equal((await post('/api/auth/register',{email:'uye@example.com',password:'kisa'})).status,400);
 const applied=await post('/api/auth/register',{email:' Uye@Example.com ',password:'uzun-sifre-1'});assert.equal(applied.status,200);assert.equal(cookieOf(applied),null);
 assert.deepEqual(await (await post('/api/auth/register',{email:'uye@example.com',password:'baska-sifre-2'})).json(),{status:'pending'});
 const waiting=await post('/api/auth/login',{email:'uye@example.com',password:'uzun-sifre-1'});assert.equal(waiting.status,403);assert.equal(cookieOf(waiting),null);
 assert.equal((await post('/api/auth/login',{email:'uye@example.com',password:'yanlis-sifre'})).status,401);
 assert.equal((await post('/api/auth/login',{email:'yok@example.com',password:'yanlis-sifre'})).status,401);

 // First admin from a one-time link, which then stops working.
 const code=new URL(admin('setup-link')).searchParams.get('kurulum');
 assert.equal((await (await get(`/api/auth/link?tur=setup&kod=${code}`)).json()).valid,true);
 assert.equal((await post('/api/auth/register',{email:'yonetici@example.com',password:'yonetici-sifre',setup:'yanlis'})).status,400);
 const created=await post('/api/auth/register',{email:'yonetici@example.com',password:'yonetici-sifre',setup:code});assert.equal(created.status,200);
 const adminCookie=cookieOf(created);assert.ok(adminCookie);assert.match(created.headers.get('set-cookie'),/HttpOnly/);assert.match(created.headers.get('set-cookie'),/SameSite=Lax/);
 assert.equal((await post('/api/auth/register',{email:'ikinci@example.com',password:'ikinci-sifre',setup:code})).status,400);
 const me=await (await get('/api/auth/me',adminCookie)).json();assert.deepEqual(me,{email:'yonetici@example.com',admin:true,pending:1});
 assert.equal((await get('/',adminCookie)).status,200);assert.equal((await get('/yonetim.html',adminCookie)).status,200);

 // Approval opens the site for the member, not the admin pages.
 const {users}=await (await get('/api/auth/users',adminCookie)).json(),member=users.find(u=>u.email==='uye@example.com');assert.equal(member.status,'pending');assert.ok(!('hash' in member));
 assert.equal((await post(`/api/auth/users/${member.id}/approve`,{})).status,403);
 assert.equal((await post(`/api/auth/users/${member.id}/approve`,{},adminCookie)).status,200);
 const signed=await post('/api/auth/login',{email:'uye@example.com',password:'uzun-sifre-1'});assert.equal(signed.status,200);const memberCookie=cookieOf(signed);
 assert.equal((await get('/',memberCookie)).status,200);assert.equal((await get('/app.mjs',memberCookie)).status,200);
 assert.equal((await get('/yonetim.html',memberCookie)).status,302);assert.equal((await get('/api/auth/users',memberCookie)).status,403);
 assert.equal((await post(`/api/auth/users/${member.id}/delete`,{},memberCookie)).status,403);
 assert.equal((await post('/api/auth/login',{email:'uye@example.com',password:'uzun-sifre-1'},memberCookie)).status,200);

 // Another site cannot post with the member's cookie.
 const cross=await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie:memberCookie,origin:'https://evil.example'}});assert.equal(cross.status,403);

 // A one-time password link replaces the password and ends the sessions.
 const reset=await (await post(`/api/auth/users/${member.id}/reset`,{},adminCookie)).json(),token=new URLSearchParams(reset.link.split('?')[1]).get('sifirla');
 assert.equal((await post('/api/auth/reset',{token,password:'yeni-sifre-3'})).status,200);assert.equal((await post('/api/auth/reset',{token,password:'yeni-sifre-4'})).status,400);
 assert.equal((await get('/',memberCookie)).status,302);
 assert.equal((await post('/api/auth/login',{email:'uye@example.com',password:'uzun-sifre-1'})).status,401);
 const again=await post('/api/auth/login',{email:'uye@example.com',password:'yeni-sifre-3'});assert.equal(again.status,200);const fresh=cookieOf(again);

 // Sign-out ends the session; closing access ends it too; the admin cannot lock itself out.
 assert.equal((await post('/api/auth/logout',{},fresh)).status,200);assert.equal((await get('/',fresh)).status,302);
 const third=cookieOf(await post('/api/auth/login',{email:'uye@example.com',password:'yeni-sifre-3'}));
 assert.equal((await post(`/api/auth/users/${member.id}/reject`,{},adminCookie)).status,200);assert.equal((await get('/',third)).status,302);
 assert.equal((await post('/api/auth/login',{email:'uye@example.com',password:'yeni-sifre-3'})).status,403);
 const adminId=users.find(u=>u.email==='yonetici@example.com').id;assert.equal((await post(`/api/auth/users/${adminId}/delete`,{},adminCookie)).status,400);
});
