import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);let c=await readFile(new URL('scripts/collect.mjs',root),'utf8');
const anchor="await writeFile(path.join(root,'dist/data/bundle.json.tmp'),JSON.stringify(bundle));";
if(!c.includes("dist/data/matches"))c=c.replace(anchor,"await mkdir(path.join(root,'dist/data/matches'),{recursive:true});\nawait writeFile(path.join(root,'dist/data/matches',matchId+'.json.tmp'),JSON.stringify(bundle));\nawait rename(path.join(root,'dist/data/matches',matchId+'.json.tmp'),path.join(root,'dist/data/matches',matchId+'.json'));\n"+anchor);await writeFile(new URL('scripts/collect.mjs',root),c);
let s=await readFile(new URL('dist/app.mjs',root),'utf8');s=s.replace('await load();status.textContent=', 'await load(id);status.textContent=');
const a=s.indexOf('async function load(){'),b=s.indexOf('load().then(',a);if(a>=0&&b>a)s=s.slice(0,a)+`async function load(requestedId=new URLSearchParams(location.search).get('match')){
 const id=/^\\d{4,12}$/.test(requestedId||'')?requestedId:null;
 let r=await fetch((id?'/data/matches/'+id+'.json':'/data/bundle.json')+'?t='+Date.now(),{cache:'no-store'});
 if(id&&!r.ok)throw Error('Bu maç henüz kaydedilmedi. FotMob bağlantısıyla Maçı analiz et düğmesini kullanın.');
 if(!r.ok)throw Error('Veri arşivi yüklenemedi.');
 bundle=await r.json();if(id&&String(bundle.target.id)!==id)throw Error('Maç kimliği veri arşiviyle eşleşmiyor.');
 const url=new URL(location.href);url.searchParams.set('match',String(bundle.target.id));window.history.replaceState(null,'',url);
 $('#match-url').value=bundle.target.url;selectedTeam=String(bundle.target.home.id);active=titles[location.hash.slice(1)]?location.hash.slice(1):'overview';testRun=null;recalc();$('#loading').classList.add('hidden');$('#app').classList.remove('hidden');
}
`+s.slice(b);await writeFile(new URL('dist/app.mjs',root),s);
await mkdir(new URL('dist/data/matches/',root),{recursive:true});const data=JSON.parse(await readFile(new URL('dist/data/bundle.json',root),'utf8'));await copyFile(new URL('dist/data/bundle.json',root),new URL('dist/data/matches/'+data.target.id+'.json',root));
for(const p of ['dist/app.mjs','dist/player-ui.mjs','dist/model.mjs','dist/worker.mjs','dist/release.mjs','dist/index.html']){const f=new URL(p,root);await writeFile(f,(await readFile(f,'utf8')).replaceAll('2026-10-26.6','2026-10-26.7'));}
console.log('Maç bazlı arşiv ve kalıcı analiz bağlantıları hazır.');
