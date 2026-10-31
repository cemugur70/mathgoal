// Background training queue: collect.mjs marks training as pending and starts this detached; one worker drains the queue at a time.
// The published dist/data/training.json is only replaced by train.mjs after a complete, valid build, so analyses keep using the previous file meanwhile.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {open,readFile,writeFile,rm} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
export const LOCK=new URL('../data/training.lock',import.meta.url),PENDING=new URL('../data/training.pending',import.meta.url),STATUS=new URL('../data/training-status.json',import.meta.url);
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
const exists=async url=>{try{await readFile(url);return true;}catch{return false;}};
async function acquire(){
 try{const handle=await open(LOCK,'wx');await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await handle.close();return true;}
 catch(e){if(e.code!=='EEXIST')throw e;}
 // A lock left by a crashed worker is taken over; a live worker will see the pending flag itself.
 let owner=null;try{owner=JSON.parse(await readFile(LOCK,'utf8'));}catch{}
 if(owner?.pid&&alive(owner.pid))return false;
 await rm(LOCK,{force:true});return acquire();
}
const status=async value=>writeFile(STATUS,JSON.stringify({...value,updatedAt:new Date().toISOString()}));
const train=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[fileURLToPath(new URL('train.mjs',import.meta.url))],{cwd:root,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('close',resolve);});
export async function drain(){
 while(await exists(PENDING)){
  if(!await acquire())return;
  try{
   while(await exists(PENDING)){
    const request=await readFile(PENDING,'utf8').catch(()=>'');await rm(PENDING,{force:true});
    const startedAt=Date.now();await status({state:'running',request,startedAt:new Date(startedAt).toISOString()});
    const code=await train();
    await status({state:code===0?'published':'failed',request,exitCode:code,durationMs:Date.now()-startedAt});
    console.log('EĞİTİM_KUYRUĞU '+JSON.stringify({request,exitCode:code,durationMs:Date.now()-startedAt}));
   }
  }finally{await rm(LOCK,{force:true});}
 }
}
export async function trainingState(){
 let owner=null,last=null;try{owner=JSON.parse(await readFile(LOCK,'utf8'));}catch{}
 try{last=JSON.parse(await readFile(STATUS,'utf8'));}catch{}
 return {running:!!(owner?.pid&&alive(owner.pid)),pending:await exists(PENDING),last};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await drain();
