import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

/** Tracks the horse-racing section predicts and evaluates; URL slug → liderform track_code. */
export const CITIES={istanbul:'ISTANBUL',ankara:'ANKARA',izmir:'IZMIR',bursa:'BURSA',adana:'ADANA'};
/** Every domestic track collected; the others only feed the opponent network and ratings. "KARMA" is a pooled bet card, not a track. */
export const TRACKS={...CITIES,kocaeli:'KOCAELI',elazig:'ELAZIG',antalya:'ANTALYA',sanliurfa:'SANLIURFA',dbakir:'DBAKIR'};
const LIVE_TTL=600000;

/** Reads the public Next.js SSR payload (`__NEXT_DATA__`) of a liderform page; null when the page carries none. */
export function extractPageProps(html){
 const m=String(html).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
 return m?JSON.parse(m[1]).props?.pageProps??null:null;
}
// Only race-relevant parts are cached; coupons, footer and settings are page chrome.
const keep=p=>p&&{raceLocationsData:(p.raceLocationsData||[]).filter(l=>!l.is_foreign).map(({id,track_code,track_original_code,name,city,race_time})=>({id,track_code,track_original_code,name,city,race_time})),
 raceTimeList:p.raceTimeList||[],raceData:p.raceData||[]};

/**
 * Cached client for public liderform program pages (llms.txt allows use; robots.txt only disallows query strings, which are never sent).
 * Pages dated before `today` and fetched after their day ended are settled and never refetched; a past page fetched on its own
 * race day (before the last results) is fetched once more. Today/future pages expire after 10 minutes.
 * The site's private data API and its client-embedded token are deliberately not used.
 */
export function createLiderformClient({cache,today=new Date().toISOString().slice(0,10),throttleMs=300,sources=[]}){
 return async function program(date,city=null,race=null,{refresh=false}={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(city!==null&&!(city in TRACKS))||(race!==null&&!/^\d{1,2}$/.test(String(race))))throw Error('Geçersiz liderform program seçimi');
  const parts=['program',date,city,race].filter(v=>v!==null),file=path.join(cache,parts.join('-')+'.json.gz'),settled=date<today;
  if(!refresh)try{const info=await stat(file);if((settled&&info.mtimeMs>=Date.parse(date)+86400000)||Date.now()-info.mtimeMs<LIVE_TTL)return JSON.parse(gunzipSync(await readFile(file)));}catch(error){if(error.code!=='ENOENT')throw error;}
  const url='https://liderform.com.tr/'+parts.join('/');let data;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'user-agent':'Mozilla/5.0 (MathGoal at yarisi arsivi)',accept:'text/html'}});
    if(response.status===404)data={notFound:true};
    else if(!response.ok)throw Object.assign(Error(`HTTP ${response.status}`),{status:response.status});
    else data=keep(extractPageProps(await response.text()))??{notFound:true};
    break;
   }catch(error){if(attempt===2)throw error;await delay((error.status===429?30000:2000)*(attempt+1));}
  }
  data.url=url;data.observedAt=new Date().toISOString();
  await mkdir(cache,{recursive:true});await writeFile(file,gzipSync(JSON.stringify(data)));sources.push({url,observedAt:data.observedAt});
  // Politeness pause after a real request only.
  if(throttleMs>0)await delay(throttleMs);
  return data;
 };
}
