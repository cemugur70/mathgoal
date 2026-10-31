import test from 'node:test';import assert from 'node:assert/strict';import {normalizeMatchPlayers,normalizeTargetLineup,parsePlayerPage} from '../dist/player-data.mjs';
test('individual metrics preserve zero, missing values, totals and starter identity',()=>{
 const map=new Map(),raw={content:{lineup:{homeTeam:{id:1,starters:[{id:687681,usualPlayingPositionId:3}]}},playerStats:{x:{id:687681,teamId:1,name:'Victor Osimhen',stats:[{title:'Attack',stats:{Goals:{key:'goals',stat:{value:0,type:'integer'}},xG:{key:'expected_goals',stat:{type:'double'}},Passes:{key:'accurate_passes',stat:{value:7,total:11,type:'fraction'}}}}]}}}};
 const p=normalizeMatchPlayers(raw,map)[0];assert.equal(p.stats.goals,0);assert.equal(p.stats.expected_goals,null);assert.equal(p.statTotals.accurate_passes,11);assert.equal(p.position,3);assert.equal(p.starter,true);assert.equal(map.size,3);
});
test('a finished target cannot authorize use of its post-match lineup',()=>{
 const raw={content:{lineup:{lineupType:'lastStarting11',homeTeam:{id:1,starters:[]},awayTeam:{id:2,starters:[]}}}};
 const context={target:{id:'12345',date:'2026-10-26T18:30:00Z',finished:true},collectedAt:'2026-10-27T10:00:00Z'};assert.equal(normalizeTargetLineup(raw,context).eligibleForModel,false);
 context.target.finished=false;context.collectedAt='2026-10-26T10:00:00Z';assert.equal(normalizeTargetLineup(raw,context).eligibleForModel,true);
});
test('public profile JSON is parsed as data and checked against selected player id',()=>{
 const html='<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{data:{id:687681,name:'Victor Osimhen'}}}})+'</script>';assert.equal(parsePlayerPage(html,687681).name,'Victor Osimhen');assert.throws(()=>parsePlayerPage(html,99999));
});
test('sparse legacy player records may contain null metric groups and entries',()=>{const raw={content:{playerStats:{p:{id:12345,teamId:1,name:'Player',stats:[null,{title:'Stats',stats:{Missing:null,Goal:{key:'goals',stat:{value:1,type:'integer'}}}}]}}}};assert.equal(normalizeMatchPlayers(raw)[0].stats.goals,1);});
