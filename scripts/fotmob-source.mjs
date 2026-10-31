import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const DAY=86400000,TEAM_TTL=1800000;
/** A finished match whose cached response was written at least this long after kickoff is treated as settled and never refetched.
 * A 25-match comparison on 31 Oct 2026 found xG / pass / card revisions in captures 6–8.3 h after kickoff and none beyond 8.8 h; 48 h keeps a wide margin. */
export const SETTLED_AFTER_KICKOFF_MS=48*3600000;
/** Settled reuse can be disabled for measurement or recovery with FOTMOB_SETTLED_CACHE=0. */
export const settledCacheEnabled=()=>process.env.FOTMOB_SETTLED_CACHE!=='0';
/** True when a raw matchDetails response is a finished, non-cancelled fixture captured late enough after kickoff. */
export function isSettledMatch(data,cachedAtMs){
 const kickoff=Date.parse(data?.general?.matchTimeUTCDate);
 return data?.general?.finished===true&&data?.header?.status?.cancelled!==true&&Number.isFinite(kickoff)&&Number.isFinite(cachedAtMs)&&cachedAtMs>=kickoff+SETTLED_AFTER_KICKOFF_MS;
}

// Shared raw-response cache for full collection and targeted archive enrichment.
export function createFotMobClient({cache,sources=[],settled=settledCacheEnabled(),throttleMs=0}) {
  return async function get(kind,id,refresh=false,{signal,cacheOnly=false}={}) {
    if(!['matchDetails','teams','leagues'].includes(kind)||!/^\d{1,12}$/.test(String(id)))throw Error('Invalid FotMob source selection');
    signal?.throwIfAborted();
    const started=performance.now(),file=path.join(cache,`${kind}-${id}.json`);let bytes,cached=false,cachedAt=null,reuse=null,refetch=refresh?'refresh':'missing',wouldSettle=false;
    try {
      const info=await stat(file);
      if(!refresh&&(cacheOnly||Date.now()-info.mtimeMs<(kind==='matchDetails'?DAY:TEAM_TTL))) {
        bytes=await readFile(file,{encoding:'utf8',signal});cached=true;cachedAt=info.mtime.toISOString();reuse='fresh';
      } else if(!refresh&&kind==='matchDetails') {
        // Finished fixtures do not change after they settle; an expired timestamp alone is no reason to download them again.
        const text=await readFile(file,{encoding:'utf8',signal});refetch='expired';
        try {if(isSettledMatch(JSON.parse(text),info.mtimeMs)){wouldSettle=true;if(settled){bytes=text;cached=true;cachedAt=info.mtime.toISOString();reuse='settled';}}} catch {}
      } else if(!refresh)refetch='expired';
    } catch(error) {if(signal?.aborted)throw signal.reason;if(error.code!=='ENOENT')throw error;}
    const url=`https://www.fotmob.com/api/data/${kind}?${kind==='matchDetails'?'matchId':'id'}=${id}`;
    if(!cached&&cacheOnly)throw Error(`FotMob cache unavailable: ${kind}-${id}`);
    if(!cached)for(let attempt=0;attempt<3;attempt++) {
      signal?.throwIfAborted();
      try {
        const deadline=AbortSignal.timeout(25000);
        const response=await fetch(url,{signal:signal?AbortSignal.any([signal,deadline]):deadline,headers:{accept:'application/json'}});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        bytes=await response.text();JSON.parse(bytes);signal?.throwIfAborted();
        await mkdir(cache,{recursive:true});await writeFile(file,bytes);
        // Politeness pause after a real request only; cache reads are not throttled.
        if(throttleMs>0)await delay(throttleMs,undefined,{signal});break;
      } catch(error) {
        if(signal?.aborted)throw signal.reason;
        if(attempt===2)throw error;
        await delay(1000*(attempt+1),undefined,{signal});
      }
    }
    signal?.throwIfAborted();
    const data=JSON.parse(bytes);
    sources.push({url,cached,cachedAt,observedAt:cached?null:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:Buffer.byteLength(bytes),
     ms:Math.round(performance.now()-started),reuse,refetch:cached?null:refetch,wouldSettle:cached?undefined:wouldSettle});
    return data;
  };
}
