// Horse-racing refresh: collects newly settled race days, rebuilds the database when they arrive, then republishes the page data
// (which refetches today's and, once published, tomorrow's programme). Run by the server's scheduler in production.
// Usage: node scripts/horse-daily.mjs
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,appendFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse');
const stateFile=path.join(dir,'daily-state.json'),logFile=path.join(dir,'daily.log');
const day=t=>new Date(t).toISOString().slice(0,10),yesterday=day(Date.now()-86400000);
const log=line=>appendFile(logFile,`${new Date().toISOString()} ${line}\n`);
const state=await readFile(stateFile,'utf8').then(JSON.parse).catch(()=>({}));
// Each step runs in its own process with a capped heap; the container shares 1 GB with the web server and football training.
function run(script,args=[]){
 const r=spawnSync(process.execPath,['--no-warnings','--max-old-space-size=320',path.join(root,'scripts',script),...args],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30*60000});
 if(r.status!==0)throw Error(`${script} ${r.status??r.signal}: ${(r.stderr||r.stdout||'').trim().split('\n').slice(-3).join(' | ')}`);
 return (r.stdout||'').trim().split('\n').at(-1);
}
const started=Date.now();
try{
 await access(path.join(dir,'horse-model.json'));
 if(state.collectedTo!==yesterday){
  // Closed before the rebuild, which replaces the file.
  const last=await access(path.join(dir,'horses.db')).then(()=>{const db=new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true});try{return db.prepare('SELECT max(date) d FROM races').get().d;}finally{db.close();}},()=>null);
  // Re-read two days before the archive end so pages first cached on their own race day pick up their final results.
  const from=last?day(Date.parse(last)-2*86400000):'2021-01-01';
  await log(`collect ${from} → ${yesterday}`);run('collect-horses.mjs',['--from',from,'--to',yesterday]);
  await log(`db ${run('build-horse-db.mjs')}`);state.collectedTo=yesterday;
 }
 await log(`publish ${run('publish-horse-ui.mjs')}`);
 Object.assign(state,{lastRun:new Date().toISOString(),ok:true,error:null,durationMs:Date.now()-started});
}catch(error){
 Object.assign(state,{lastRun:new Date().toISOString(),ok:false,error:String(error.message).slice(0,500),durationMs:Date.now()-started});
 await log(`HATA ${state.error}`);process.exitCode=1;
}
await writeFile(stateFile,JSON.stringify(state,null,1));
