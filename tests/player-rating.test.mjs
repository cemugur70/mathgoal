import test from 'node:test';
import assert from 'node:assert/strict';
import {ratePlayerProfiles,buildLeagueRatings} from '../dist/player-rating.mjs';
import {analyzePlayers} from '../dist/player-model.mjs';

const forward=(id,value,extra={})=>({playerId:String(id),name:`Oyuncu ${id}`,position:3,games:3,minutes:270,xg90:value,goals90:value,shots90:value,keyPasses90:value,xa90:value,rating:6+value,...extra});
const cohort=()=>Array.from({length:5},(_,i)=>forward(i+1,i));

test('league percentiles share equal ranks and disclose each reference population',()=>{
 const result=ratePlayerProfiles(cohort());
 assert.equal(result.byId['1'].score,10);
 assert.equal(result.byId['5'].score,90);
 assert.equal(result.byId['3'].score,50);
 assert.equal(result.byId['5'].components.length,6);
 assert.ok(result.byId['5'].components.every(c=>c.referenceCount===5&&c.percentile===90));
 const tied=ratePlayerProfiles(cohort().map(p=>({...p,xg90:1,goals90:1,shots90:1,keyPasses90:1,xa90:1,rating:7})));
 assert.ok(Object.values(tied.byId).every(p=>p.score===50));
});

test('position populations remain separate and a lone observed metric cannot yield a league score',()=>{
 const lone=forward(20,100,{position:0,saves90:10,goalsPrevented90:2,passes90:30});
 const result=ratePlayerProfiles([...cohort(),lone]);
 assert.equal(result.byId['20'].score,null);
 assert.equal(result.byId['20'].reason,'insufficient-dimensions');
 assert.ok(result.byId['20'].components.every(c=>c.reason==='insufficient-reference'));
 assert.equal(result.byId['5'].score,90);
});

test('missing dimensions stay unknown and scores require three usable dimensions',()=>{
 const players=cohort().map(p=>({...p,xa90:null,rating:null}));
 const result=ratePlayerProfiles(players);
 assert.equal(result.byId['5'].metricCount,4);
 assert.equal(result.byId['5'].score,90);
 assert.equal(result.byId['5'].components.find(c=>c.key==='xa90').reason,'missing-metric');
 const tooFew=ratePlayerProfiles(players.map(p=>({...p,shots90:null,keyPasses90:null})));
 assert.equal(tooFew.byId['5'].score,null);
 assert.equal(tooFew.byId['5'].metricCount,2);
});

test('unplayed, insufficiently sampled and unknown-position players remain visible without scores',()=>{
 const players=[...cohort(),forward(6,20,{games:2}),forward(7,20,{minutes:90}),forward(8,20,{games:0,minutes:0}),forward(9,20,{position:null})];
 const result=ratePlayerProfiles(players);
 for(const id of ['6','7','8']){
  assert.equal(result.byId[id].score,null);
  assert.equal(result.byId[id].reason,'insufficient-appearances');
 }
 assert.equal(result.byId['9'].reason,'unknown-position');
 assert.equal(result.byId['5'].score,90);
});

function leagueBundle(){
 const home={id:1,name:'Ev'},away={id:2,name:'Rakip'},date='2026-10-26T15:00:00Z';
 const matches=Array.from({length:3},(_,i)=>({id:String(i+100),date:`2026-10-${10+i}T12:00:00Z`,finished:true,leagueId:71,home,away,homeScore:1,awayScore:0,
  players:Array.from({length:5},(_,j)=>({id:j+10,teamId:j===4?2:1,name:`P${j}`,position:3,minutes:90,stats:{minutes_played:90,expected_goals:j/10,goals:j,total_shots:j+1,chances_created:j,expected_assists:j/10,rating_title:6+j/10}}))}));
 return {target:{id:'999',date,home,away,leagueId:71},analysisAt:date,matches,leagueCoverage:{leagueId:71,season:'2026/2027',cutoff:date,expectedMatchIds:matches.map(m=>m.id),acquiredMatchIds:matches.map(m=>m.id),playerStatsMatchIds:matches.map(m=>m.id)}};
}

test('season fixture identities include players outside the visible graph and exclude older seasons',()=>{
 const bundle=leagueBundle();
 bundle.matches.push({...bundle.matches[0],id:'old-season',date:'2025-10-10T12:00:00Z',players:[{id:777,teamId:1,position:3,minutes:90,stats:{goals:1000}}]});
 const result=buildLeagueRatings(bundle,{formCount:5});
 assert.equal(result.season,'2026/2027');
 assert.equal(result.byId['14'].score,90);
 assert.equal(result.byId['777'],undefined);
 assert.equal(result.coverage.status,'complete');
 assert.equal(result.coverage.expected,3);
 assert.equal(result.profiles.length,5);
});

test('missing season evidence suppresses ratings and partial data reports exact examined coverage',()=>{
 const bundle=leagueBundle();
 const old={...bundle};delete old.leagueCoverage;
 assert.equal(buildLeagueRatings(old,{formCount:5}).coverage.status,'unknown');
 assert.deepEqual(buildLeagueRatings(old,{formCount:5}).byId,{});
 bundle.leagueCoverage.expectedMatchIds.push('missing');
 const partial=buildLeagueRatings(bundle,{formCount:5});
 assert.equal(partial.coverage.status,'partial');
 assert.deepEqual(partial.coverage.missingMatchIds,['missing']);
 assert.equal(partial.byId['14'].score,90);
});

test('league references ignore target, future and non-playing records despite claimed acquisition',()=>{
 const bundle=leagueBundle();
 bundle.matches.push({...bundle.matches[0],id:'999',players:[{id:888,teamId:1,minutes:90,position:3,stats:{goals:1000}}]});
 bundle.matches.push({...bundle.matches[0],id:'future',date:'2026-11-01T12:00:00Z'});
 bundle.leagueCoverage.expectedMatchIds.push('999','future');
 for(const m of bundle.matches)m.players.push({id:9999,teamId:1,minutes:0,position:0,stats:{goals:1000}});
 const result=buildLeagueRatings(bundle,{formCount:5});
 assert.equal(result.byId['888'],undefined);
 assert.equal(result.byId['9999'],undefined);
 assert.equal(result.profiles[0].games,3);
 assert.equal(result.coverage.status,'partial');
});

test('a later requested cutoff and matching later metadata cannot admit post-target matches',()=>{
 const bundle=leagueBundle(),later='2026-10-27T15:00:00Z';
 bundle.leagueCoverage.cutoff=later;
 bundle.matches.push({...bundle.matches[0],id:'after-target',date:'2026-10-26T18:00:00Z'});
 bundle.leagueCoverage.expectedMatchIds.push('after-target');
 const result=buildLeagueRatings(bundle,{cutoff:later,formCount:5});
 assert.equal(result.coverage.status,'unknown');
 assert.equal(result.coverage.reason,'coverage-cutoff-mismatch');
 assert.deepEqual(result.byId,{});
});

test('player analysis exposes league ratings without changing forecast composition',()=>{
 const bundle=leagueBundle(),without={...bundle};delete without.leagueCoverage;
 const before=analyzePlayers(without,{formCount:5}),after=analyzePlayers(bundle,{formCount:5});
 assert.equal(after.leagueRatings.byId['14'].score,90);
 assert.deepEqual(after.adjustments,before.adjustments);
 assert.deepEqual(after.reference,before.reference);
});

test('an incomplete personal-history duplicate cannot replace an existing match in league references',()=>{
 const bundle=leagueBundle();bundle.playerHistoryMatches=[{...bundle.matches[0],players:[]}];
 const result=buildLeagueRatings(bundle,{formCount:5});
 assert.equal(result.byId['14'].games,3);
 assert.equal(result.byId['14'].score,90);
 assert.equal(result.coverage.status,'complete');
});
