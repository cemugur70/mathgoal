// Streams a TJK race video through ffmpeg and reads the running-order strip and sectional box on every sampled frame.
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import {FRAME,readStrip,readClock} from '../dist/horse-video.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
/** TJK city ids used in the video file names. */
export const VIDEO_CITY={adana:1,izmir:2,istanbul:3,bursa:4,ankara:5,sanliurfa:6,elazig:7,dbakir:8,kocaeli:9,antalya:10};
/** "2026-11-02", "bursa", 1 → https://video-cdn.tjk.org/videoftp/2026/11/26110241_m.mp4 (the month folder has no leading zero). */
export function videoUrl(date,city,number){
 const [y,m,d]=date.split('-');return `https://video-cdn.tjk.org/videoftp/${y}/${Number(m)}/${y.slice(2)}${m}${d}${VIDEO_CITY[city]}${number}_m.mp4`;
}
let templates=null;
/** Frames as {t, order, clock}; `order` is null when the strip could not be read, [] when no strip is shown. */
export async function readRaceVideo(url,{fps=2,timeoutMs=180000,onFrame=null}={}){
 templates??=JSON.parse(await readFile(path.join(root,'dist/horse-video-glyphs.json'),'utf8'));
 const size=FRAME.width*FRAME.height*3,frames=[];
 return new Promise((resolve,reject)=>{
  const p=spawn(ffmpeg,['-v','error','-i',url,'-vf',`fps=${fps},scale=${FRAME.width}:${FRAME.height}`,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true});
  const timer=setTimeout(()=>p.kill(),timeoutMs);let buf=Buffer.alloc(0),err='';
  p.stdout.on('data',chunk=>{
   buf=Buffer.concat([buf,chunk]);
   while(buf.length>=size){const f=buf.subarray(0,size);onFrame?.(f,frames.length/fps);frames.push({t:+(frames.length/fps).toFixed(2),order:readStrip(f,templates),clock:readClock(f,templates)});buf=buf.subarray(size);}
  });
  p.stderr.on('data',d=>{err+=d;});
  p.on('error',reject);
  p.on('close',code=>{clearTimeout(timer);code===0?resolve(frames):reject(Object.assign(Error(`ffmpeg ${code}: ${err.trim().split('\n').at(-1)}`),{notFound:/404|not found/i.test(err)}));});
 });
}
