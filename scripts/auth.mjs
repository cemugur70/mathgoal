// Membership: accounts, approval and sessions in SQLite (data/auth/users.db). Anyone can apply; an admin approves before the site opens.
// Passwords are scrypt-hashed, session and one-time link tokens are stored only as SHA-256 hashes. No e-mail is sent: a forgotten
// password is reset with a one-time link the admin creates, and the first admin comes from a one-time link (scripts/auth-admin.mjs).
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scrypt as scryptCb,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {promisify} from 'node:util';
import path from 'node:path';
const scrypt=promisify(scryptCb);
const SCRYPT={N:2**15,r:8,p:1,maxmem:64*1024*1024},COOKIE='mg_session',DAY=86400000,SESSION_DAYS=30,RESET_DAYS=3,MAX_BODY=8192;
const ATTEMPTS=20,ATTEMPT_WINDOW=15*60000;
const sha=t=>createHash('sha256').update(t).digest('hex'),newToken=()=>randomBytes(32).toString('base64url');
export async function hashPassword(password,salt=randomBytes(16)){
 const key=await scrypt(password,salt,32,SCRYPT);
 return `scrypt$${SCRYPT.N}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export async function verifyPassword(password,stored){
 const [,,salt,key]=String(stored).split('$');if(!salt||!key)return false;
 const a=Buffer.from(key,'base64url'),b=await scrypt(password,Buffer.from(salt,'base64url'),a.length,SCRYPT);
 return timingSafeEqual(a,b);
}
const DUMMY_HASH=await hashPassword(newToken());
const validEmail=e=>typeof e==='string'&&e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validPassword=p=>typeof p==='string'&&p.length>=8&&p.length<=200;
const cleanEmail=e=>typeof e==='string'?e.trim().toLocaleLowerCase('en-US'):e;

/** Account store; the HTTP layer and the admin command line share it. */
export function openUsers(file){
 mkdirSync(path.dirname(file),{recursive:true});
 const db=new DatabaseSync(file);
 db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,hash TEXT NOT NULL,status TEXT NOT NULL,admin INT NOT NULL DEFAULT 0,created_at TEXT NOT NULL,decided_at TEXT,last_login TEXT);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id INT NOT NULL,expires INT NOT NULL);
 CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY,kind TEXT NOT NULL,user_id INT,expires INT NOT NULL);`);
 const now=()=>new Date().toISOString();
 const q=Object.fromEntries(Object.entries({
  byEmail:'SELECT * FROM users WHERE email=?',byId:'SELECT * FROM users WHERE id=?',
  insert:'INSERT INTO users(email,hash,status,admin,created_at,decided_at) VALUES(?,?,?,?,?,?)',
  session:'SELECT u.id,u.email,u.admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>? AND u.status=\'approved\'',
  addSession:'INSERT INTO sessions VALUES(?,?,?)',dropSession:'DELETE FROM sessions WHERE hash=?',dropUserSessions:'DELETE FROM sessions WHERE user_id=?',
  purge:'DELETE FROM sessions WHERE expires<=?',purgeTokens:'DELETE FROM tokens WHERE expires<=?',
  addToken:'INSERT INTO tokens VALUES(?,?,?,?)',token:'SELECT * FROM tokens WHERE hash=? AND kind=? AND expires>?',dropToken:'DELETE FROM tokens WHERE hash=?',
  setStatus:'UPDATE users SET status=?,decided_at=? WHERE id=?',setHash:'UPDATE users SET hash=? WHERE id=?',setLogin:'UPDATE users SET last_login=? WHERE id=?',
  promote:'UPDATE users SET hash=?,status=\'approved\',admin=1,decided_at=? WHERE id=?',remove:'DELETE FROM users WHERE id=?',
  list:'SELECT id,email,status,admin,created_at,decided_at,last_login FROM users ORDER BY status=\'pending\' DESC,created_at DESC',pending:'SELECT count(*) n FROM users WHERE status=\'pending\'',
 }).map(([k,s])=>[k,db.prepare(s)]));
 const issue=(kind,userId,days)=>{const t=newToken();q.purgeTokens.run(Date.now());q.addToken.run(sha(t),kind,userId??null,Date.now()+days*DAY);return t;};
 return {
  now,byEmail:e=>q.byEmail.get(e),byId:id=>q.byId.get(id),list:()=>q.list.all(),pending:()=>q.pending.get().n,
  add:(email,hash,status='pending',admin=0)=>q.insert.run(email,hash,status,admin,now(),status==='pending'?null:now()),
  promote:(id,hash)=>q.promote.run(hash,now(),id),setHash:(id,hash)=>{q.setHash.run(hash,id);q.dropUserSessions.run(id);},
  setStatus:(id,status)=>{q.setStatus.run(status,now(),id);if(status!=='approved')q.dropUserSessions.run(id);},
  remove:id=>{q.dropUserSessions.run(id);q.remove.run(id);},
  startSession:id=>{const t=newToken();q.purge.run(Date.now());q.addSession.run(sha(t),id,Date.now()+SESSION_DAYS*DAY);q.setLogin.run(now(),id);return t;},
  sessionUser:t=>q.session.get(sha(t),Date.now())??null,endSession:t=>q.dropSession.run(sha(t)),
  setupLink:(hours=24)=>issue('setup',null,hours/24),resetLink:id=>issue('reset',id,RESET_DAYS),
  /** Consumes a one-time token; returns its row, or null when it is unknown, used or expired. */
  takeToken:(t,kind)=>{if(typeof t!=='string'||!t)return null;const row=q.token.get(sha(t),kind,Date.now());if(row)q.dropToken.run(sha(t));return row??null;},
  checkToken:(t,kind)=>typeof t==='string'&&!!t&&!!q.token.get(sha(t),kind,Date.now()),
  close:()=>db.close(),
 };
}

export function createAuth({file,secure=false}){
 const users=openUsers(file),attempts=new Map();
 const send=(res,status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body));};
 const cookieOf=req=>{for(const part of String(req.headers.cookie||'').split(';')){const [k,...v]=part.trim().split('=');if(k===COOKIE)return v.join('=');}return null;};
 const cookie=(value,maxAge)=>`${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;
 const opened=t=>({'set-cookie':cookie(t,SESSION_DAYS*86400)});
 // The proxy appends the real client address last, so an address the client sends itself cannot hide it.
 const clientIp=req=>String(req.headers['x-forwarded-for']||'').split(',').map(s=>s.trim()).filter(Boolean).at(-1)||req.socket.remoteAddress||'?';
 function throttled(req){
  const ip=clientIp(req),t=Date.now();if(attempts.size>10000)for(const [k,v] of attempts)if(v.until<=t)attempts.delete(k);
  const a=attempts.get(ip);if(!a||a.until<=t){attempts.set(ip,{n:1,until:t+ATTEMPT_WINDOW});return false;}
  a.n++;return a.n>ATTEMPTS;
 }
 const sameOrigin=req=>{const o=req.headers.origin;return req.headers['sec-fetch-site']!=='cross-site'&&(!o||o===`http://${req.headers.host}`||o===`https://${req.headers.host}`);};
 const readJson=req=>new Promise((resolve,reject)=>{let size=0;const parts=[];req.on('data',c=>{size+=c.length;if(size>MAX_BODY){reject(Error('big'));req.destroy();}else parts.push(c);});
  req.on('end',()=>{try{const v=JSON.parse(Buffer.concat(parts).toString('utf8'));resolve(v&&typeof v==='object'?v:{});}catch{resolve({});}});req.on('error',reject);});
 const user=req=>{const t=cookieOf(req);return t?users.sessionUser(t):null;};
 const summary=u=>({id:u.id,email:u.email,status:u.status,admin:!!u.admin,createdAt:u.created_at,decidedAt:u.decided_at,lastLogin:u.last_login});
 const PASSWORD_ERROR='Şifre en az 8 karakter olmalı.';

 async function register(req,res,b){
  const email=cleanEmail(b.email);
  if(!validEmail(email))return send(res,400,{error:'Geçerli bir e-posta adresi girin.'});
  if(!validPassword(b.password))return send(res,400,{error:PASSWORD_ERROR});
  const hash=await hashPassword(b.password),existing=users.byEmail(email);
  if(b.setup!==undefined){
   if(!users.takeToken(b.setup,'setup'))return send(res,400,{error:'Bu kurulum bağlantısı geçersiz veya kullanılmış.'});
   let id=existing?.id;if(existing)users.promote(id,hash);else id=Number(users.add(email,hash,'approved',1).lastInsertRowid);
   return send(res,200,{status:'approved'},opened(users.startSession(id)));
  }
  // The same answer for a known address, so the form does not reveal who has applied.
  if(!existing)users.add(email,hash);
  send(res,200,{status:'pending'});
 }
 async function login(req,res,b){
  const email=cleanEmail(b.email),u=typeof email==='string'?users.byEmail(email):null;
  // A missing account costs the same hash as a wrong password.
  const ok=await verifyPassword(String(b.password??'').slice(0,200),u?.hash??DUMMY_HASH);
  if(!u||!ok)return send(res,401,{error:'E-posta veya şifre hatalı.'});
  if(u.status==='pending')return send(res,403,{status:'pending',error:'Başvurun yönetici onayı bekliyor.'});
  if(u.status!=='approved')return send(res,403,{status:u.status,error:'Bu hesaba erişim açılmadı.'});
  attempts.delete(clientIp(req));
  send(res,200,{status:'approved'},opened(users.startSession(u.id)));
 }
 async function reset(req,res,b){
  if(!validPassword(b.password))return send(res,400,{error:PASSWORD_ERROR});
  const hash=await hashPassword(b.password),row=users.takeToken(b.token,'reset'),u=row&&users.byId(row.user_id);
  if(!u)return send(res,400,{error:'Bu şifre bağlantısı geçersiz veya kullanılmış.'});
  users.setHash(u.id,hash);send(res,200,{ok:true});
 }
 function adminAction(res,me,id,action){
  const target=users.byId(id);if(!target)return send(res,404,{error:'Üye bulunamadı.'});
  if(action==='reset')return send(res,200,{link:`/giris.html?sifirla=${users.resetLink(id)}`});
  if(target.id===me.id)return send(res,400,{error:'Kendi hesabında bu işlem yapılamaz.'});
  if(action==='approve')users.setStatus(id,'approved');else if(action==='reject')users.setStatus(id,'rejected');else if(action==='delete')users.remove(id);else return send(res,404,{error:'Bilinmeyen işlem.'});
  send(res,200,{ok:true});
 }
 /** Serves /api/auth/*. */
 async function handle(req,res,url){
  const route=url.pathname.slice('/api/auth/'.length);
  if(req.method==='GET'){
   const me=user(req);
   if(route==='me')return me?send(res,200,{email:me.email,admin:!!me.admin,pending:me.admin?users.pending():0}):send(res,401,{error:'Giriş gerekli.'});
   if(route==='link'){const kind=url.searchParams.get('tur');return send(res,200,{valid:(kind==='setup'||kind==='reset')&&users.checkToken(url.searchParams.get('kod'),kind)});}
   if(route==='users'){if(!me?.admin)return send(res,403,{error:'Yetki yok.'});return send(res,200,{users:users.list().map(summary),me:me.id});}
   return send(res,404,{error:'Bulunamadı.'});
  }
  if(req.method!=='POST')return send(res,405,{error:'İzin verilmiyor.'});
  if(!sameOrigin(req))return send(res,403,{error:'İzin verilmiyor.'});
  if(route==='logout'){const t=cookieOf(req);if(t)users.endSession(t);return send(res,200,{ok:true},{'set-cookie':cookie('',0)});}
  const action=route.match(/^users\/(\d+)\/([a-z]+)$/);
  if(action){const me=user(req);if(!me?.admin)return send(res,403,{error:'Yetki yok.'});return adminAction(res,me,Number(action[1]),action[2]);}
  if(!['register','login','reset'].includes(route))return send(res,404,{error:'Bulunamadı.'});
  if(throttled(req))return send(res,429,{error:'Çok fazla deneme. Biraz sonra tekrar deneyin.'});
  const body=await readJson(req).catch(()=>null);if(!body)return send(res,413,{error:'İstek çok büyük.'});
  return route==='register'?register(req,res,body):route==='login'?login(req,res,body):reset(req,res,body);
 }
 /** Answers a request without a session: pages go to the sign-in page, everything else gets 401. */
 function deny(req,res,url){
  if(req.method==='GET'&&(url.pathname==='/'||url.pathname.endsWith('.html'))){
   const next=url.pathname==='/'?'':`?sonra=${encodeURIComponent(url.pathname+url.search)}`;
   res.writeHead(302,{location:`/giris.html${next}`,'cache-control':'no-store'});return res.end();
  }
  send(res,401,{error:'Giriş gerekli.'});
 }
 return {handle,deny,user,users};
}
