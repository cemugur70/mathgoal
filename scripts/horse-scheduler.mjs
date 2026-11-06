// Production scheduler for the horse-racing page: runs scripts/horse-daily.mjs at :20 and :50 between 08:00 and 24:00
// Istanbul time (programmes, AGF and results change through the race day), one run at a time. Races mostly go off at :00 and :30,
// so the last read before the off holds a price about nine minutes old, whenever the server last restarted.
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const istanbulHour=()=>Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Europe/Istanbul'}).format(new Date()));
/** Milliseconds to the next :20 or :50 of the clock. Istanbul is a whole number of hours from GMT, so the minutes are the same. */
export const msToNextSlot=(now,intervalMs=30*60000,offsetMs=20*60000)=>(((offsetMs-now)%intervalMs)+intervalMs)%intervalMs||intervalMs;
export function startHorseScheduler({root,intervalMs=30*60000,firstDelayMs=120000}){
 let running=false;
 const tick=()=>{
  if(running||istanbulHour()<8)return;running=true;
  const child=spawn(process.execPath,[path.join(root,'scripts/horse-daily.mjs')],{cwd:root,stdio:'ignore',windowsHide:true});
  child.on('error',()=>{running=false;});child.on('close',()=>{running=false;});
 };
 setTimeout(tick,firstDelayMs).unref();setTimeout(()=>{tick();setInterval(tick,intervalMs).unref();},msToNextSlot(Date.now(),intervalMs)).unref();
}
/** Last refresh outcome for /api/health; null before the first run. */
export const horseState=root=>readFile(path.join(root,'data/horse/daily-state.json'),'utf8').then(JSON.parse).catch(()=>null);
