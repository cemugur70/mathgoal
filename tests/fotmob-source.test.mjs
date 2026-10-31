import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,utimes,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createFotMobClient,isSettledMatch,SETTLED_AFTER_KICKOFF_MS} from '../scripts/fotmob-source.mjs';
const H=3600000,DAY=24*H,kickoff=Date.UTC(2026,9,1,18);
const raw=(extra={})=>({general:{matchId:1,matchTimeUTCDate:new Date(kickoff).toISOString(),finished:true,...extra.general},header:{status:{cancelled:false,...extra.status}},content:{stats:{v:extra.v??1}}});
async function withCache(fn){const dir=await mkdtemp(path.join(tmpdir(),'fotmob-cache-'));const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return new Response(JSON.stringify(raw({v:2})),{status:200});};
 try{await fn(dir,calls);}finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}}
async function cached(dir,name,data,mtime){const file=path.join(dir,name);await writeFile(file,JSON.stringify(data));await utimes(file,new Date(mtime),new Date(mtime));return file;}
test('settled means finished, not cancelled and captured at least 48 hours after kickoff',()=>{
 assert.equal(isSettledMatch(raw(),kickoff+SETTLED_AFTER_KICKOFF_MS),true);
 assert.equal(isSettledMatch(raw(),kickoff+SETTLED_AFTER_KICKOFF_MS-1),false,'stats may still change shortly after the final whistle');
 assert.equal(isSettledMatch(raw({general:{finished:false}}),kickoff+DAY),false);
 assert.equal(isSettledMatch(raw({status:{cancelled:true}}),kickoff+DAY),false);
 assert.equal(isSettledMatch(raw({general:{matchTimeUTCDate:null}}),kickoff+DAY),false);
 assert.equal(isSettledMatch(null,kickoff+DAY),false);
});
test('an expired settled match is reused without a request; unsettled, disabled and refresh paths still fetch',()=>withCache(async(dir,calls)=>{
 const old=Date.now()-3*DAY;
 await cached(dir,'matchDetails-11.json',raw(),old);
 await cached(dir,'matchDetails-12.json',raw(),kickoff+H);
 await cached(dir,'matchDetails-13.json',raw({general:{finished:false}}),old);
 await cached(dir,'matchDetails-14.json',raw(),old);
 await cached(dir,'teams-15.json',{details:{id:15}},old);
 const sources=[],get=createFotMobClient({cache:dir,sources,settled:true});
 assert.equal((await get('matchDetails',11)).content.stats.v,1);
 assert.equal((await get('matchDetails',12)).content.stats.v,2,'captured too soon after kickoff');
 assert.equal((await get('matchDetails',13)).content.stats.v,2,'unfinished match');
 assert.equal((await get('matchDetails',14,true)).content.stats.v,2,'explicit refresh always fetches');
 await get('teams',15);
 assert.deepEqual(calls.map(u=>u.match(/(?:matchId|id)=(\d+)/)[1]),['12','13','14','15']);
 const byId=Object.fromEntries(sources.map(x=>[x.url.match(/=(\d+)$/)[1],x]));
 assert.equal(byId[11].cached,true);assert.equal(byId[11].reuse,'settled');assert.equal(byId[11].refetch,null);
 assert.equal(byId[12].refetch,'expired');assert.equal(byId[12].wouldSettle,false);assert.equal(byId[14].refetch,'refresh');assert.equal(byId[15].refetch,'expired');
 assert.ok(sources.every(x=>Number.isInteger(x.ms)&&x.ms>=0));
 assert.equal(JSON.parse(await readFile(path.join(dir,'matchDetails-12.json'),'utf8')).content.stats.v,2,'fetched responses replace the cache file');
 const disabledSources=[],disabled=createFotMobClient({cache:dir,sources:disabledSources,settled:false});await cached(dir,'matchDetails-16.json',raw(),old);
 assert.equal((await disabled('matchDetails',16)).content.stats.v,2);assert.equal(disabledSources[0].wouldSettle,true,'baseline runs record the avoidable request');
}));
test('fresh entries keep the existing TTL and cacheOnly still never touches the network',()=>withCache(async(dir,calls)=>{
 await cached(dir,'matchDetails-21.json',raw({general:{finished:false}}),Date.now()-H);
 const sources=[],get=createFotMobClient({cache:dir,sources,settled:true});
 assert.equal((await get('matchDetails',21)).content.stats.v,1);assert.equal(sources[0].reuse,'fresh');
 await assert.rejects(get('matchDetails',22,false,{cacheOnly:true}),/cache unavailable/);assert.equal(calls.length,0);
}));
test('the politeness pause follows real requests only',()=>withCache(async dir=>{
 await cached(dir,'matchDetails-31.json',raw(),Date.now()-3*DAY);
 const get=createFotMobClient({cache:dir,sources:[],settled:true,throttleMs:120});
 let t=performance.now();await get('matchDetails',31);assert.ok(performance.now()-t<100,'settled cache read is not throttled');
 t=performance.now();await get('matchDetails',32);assert.ok(performance.now()-t>=110,'a network request is followed by the pause');
}));
