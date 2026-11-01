// Production scheduler for the horse-racing page: runs scripts/horse-daily.mjs every 30 minutes between 08:00 and 24:00
// Istanbul time (programmes, AGF and results change through the race day), one run at a time.
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const istanbulHour=()=>Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Europe/Istanbul'}).format(new Date()));
export function startHorseScheduler({root,intervalMs=30*60000,firstDelayMs=120000}){
 let running=false;
 const tick=()=>{
  if(running||istanbulHour()<8)return;running=true;
  const child=spawn(process.execPath,[path.join(root,'scripts/horse-daily.mjs')],{cwd:root,stdio:'ignore',windowsHide:true});
  child.on('error',()=>{running=false;});child.on('close',()=>{running=false;});
 };
 setTimeout(tick,firstDelayMs).unref();setInterval(tick,intervalMs).unref();
}
/** Last refresh outcome for /api/health; null before the first run. */
export const horseState=root=>readFile(path.join(root,'data/horse/daily-state.json'),'utf8').then(JSON.parse).catch(()=>null);
