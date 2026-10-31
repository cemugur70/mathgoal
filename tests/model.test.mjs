import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,backtest,history} from '../dist/model.mjs';
const teams=[1,2,3,4,5,6].map(id=>({id,name:`Team ${id}`}));
function fixture(id,day,h,a,hg=1,ag=0,withStats=true) {
  return {id,date:new Date(Date.UTC(2026,0,day)).toISOString(),home:teams[h-1],away:teams[a-1],
    homeScore:hg,awayScore:ag,leagueId:47,stats:withStats?{
      expected_goals:{values:[hg+.3,ag+.4]},total_shots:{values:[12,9]},
      ShotsOnTarget:{values:[4,3]},BallPossesion:{values:[55,45]},corners:{values:[5,3]},
      big_chance:{values:[2,1]},touches_opp_box:{values:[22,17]}
    }:{}};
}
function data() {
  const matches=[];let id=1;
  for(let d=1;d<=20;d++) {
    matches.push(fixture(id++,d,1,d%2?3:4,d%3,1));
    matches.push(fixture(id++,d,2,d%2?5:6,1,d%3));
    matches.push(fixture(id++,d,3,5,2,1));
    matches.push(fixture(id++,d,4,6,1,1));
  }
  return {target:fixture(999,22,1,2,8,8),matches,teams:Object.fromEntries(teams.map(t=>[t.id,t]))};
}
test('pre-match leakage: future, same-time and target observations never affect output',()=>{
  const bundle=data(),a=analyze(bundle);
  const changed={...bundle,target:{...bundle.target,homeScore:99,awayScore:99,stats:{expected_goals:{values:[99,99]}}},
    matches:[...bundle.matches,fixture(998,22,1,2,50,50),fixture(997,23,1,2,50,50),bundle.target]};
  assert.deepEqual(a.prediction,analyze(changed).prediction);
  assert.equal(a.coverage.matchCount,bundle.matches.length);
});

test('unplayed target uses the observation cutoff instead of future kickoff',()=>{
  const bundle={...data(),analysisAt:'2026-01-18T12:00:00Z'};
  const result=analyze(bundle);
  const injected={...bundle,matches:[...bundle.matches,fixture(12345,19,1,2,99,99)]};
  assert.deepEqual(result.prediction,analyze(injected).prediction);
  assert.ok(result.homeForm.every(m=>new Date(m.date)<new Date(bundle.analysisAt)));
  const altered={...bundle,target:{...bundle.target,homeScore:0,awayScore:0,finished:false}};
  assert.deepEqual(result.prediction,analyze(altered).prediction);
});
test('an earlier kickoff does not imply its final statistics were already available',()=>{
  const bundle=data(),a=analyze(bundle);
  const overlapping={...fixture(555,22,1,2,50,50),date:'2026-01-21T23:30:00.000Z',finished:true};
  assert.deepEqual(a.prediction,analyze({...bundle,matches:[...bundle.matches,overlapping]}).prediction);
  assert.equal(history([overlapping],1,'2026-01-22T00:00:00Z').length,0);
  assert.equal(history([{...overlapping,completedAt:'2026-01-21T23:59:00Z'}],1,'2026-01-22T00:00:00Z').length,1);
});
test('missing metrics are absent; scores keep their orientation',()=>{
  const match=fixture(1,1,1,2,2,4,false);
  const rows=history([match],2,'2026-01-02',5);
  assert.equal(rows[0].gf,4);assert.equal(rows[0].ga,2);assert.equal(rows[0].venue,'away');
  assert.equal(rows[0].stats.xg,null);assert.equal(rows[0].result,'W');
  const bundle={...data(),matches:data().matches.map(m=>({...m,stats:{}}))};
  const result=analyze(bundle);
  assert.equal(result.profiles.home.xg,null);
  assert.equal(result.profiles.home.metricCoverage.xg,0);
  assert.ok(result.prediction);
  assert.ok(result.neighbors.every(n=>n.exact===false));
});
test('probabilities and tails are finite, normalized and bounded',()=>{
  const result=analyze(data()),p=result.prediction;
  assert.ok(Math.abs(p.heatmap.reduce((s,c)=>s+c.probability,0)-1)<1e-12);
  assert.ok(Math.abs(Object.values(p.outcomes).reduce((s,c)=>s+c,0)-1)<1e-12);
  for(const value of [...Object.values(p.outcomes),p.over25,p.btts,p.tailMass]) assert.ok(value>=0&&value<=1);
  assert.equal(p.heatmap.length,81);assert.ok(p.homeXg>0);assert.ok(p.awayXg>0);
});
test('network cycles and duplicate fixtures never multiply games',()=>{
  const bundle=data();bundle.matches.push(bundle.matches[0],bundle.matches[1]);
  const r=analyze(bundle,{depth:3});
  assert.equal(r.coverage.matchCount,80);
  assert.equal(new Set(r.graph.nodes.map(n=>n.id)).size,r.graph.nodes.length);
  assert.equal(new Set(r.graph.matchIds).size,r.graph.matchIds.length);
  for(const edge of r.graph.edges) assert.equal(new Set(edge.matches.map(m=>m.id)).size,edge.matches.length);
  assert.ok(Object.values(r.network.ratings).every(r=>Number.isFinite(r.attack)&&Number.isFinite(r.defense)));
});
test('similar fixtures compare histories, never the fixture own post-match stats',()=>{
  const bundle=data(),a=analyze(bundle);
  const chosen=a.neighbors[0];assert.ok(chosen);
  const earlier=bundle.matches.filter(m=>new Date(m.date)<new Date(chosen.date));
  const historical={...bundle,target:{...bundle.matches.find(m=>m.id===chosen.id)},matches:earlier};
  const p=analyze(historical).profiles;
  assert.equal(chosen.profiles.home.gf,p.home.gf);
  assert.equal(chosen.profiles.away.xg,p.away.xg);
  assert.equal(chosen.comparable.length,24);
});
test('insufficient histories suppress predictions and friendlies are excluded',()=>{
  const bundle=data();bundle.matches=bundle.matches.slice(0,4);
  assert.equal(analyze(bundle).prediction,null);
  const f=fixture(100,21,1,2,20,20);f.leagueId=489;
  const complete=data();assert.deepEqual(analyze(complete).prediction,analyze({...complete,matches:[...complete.matches,f]}).prediction);
});
test('walk-forward diagnostics use strict past data and report baseline',()=>{
  const b=data(),r=backtest(b,{limit:8});
  assert.equal(r.rows.length,8);assert.equal(r.summary.sampleSize,8);
  assert.equal(r.summary.baselineLogLoss,Math.log(3));
  for(const row of r.rows) {
    assert.equal(row.trainingMatches,b.matches.filter(m=>new Date(m.date)<new Date(row.date)).length);
    assert.ok(row.homeHistory>=3&&row.awayHistory>=3);
  }
  const truncated={...b,matches:b.matches.filter(m=>new Date(m.date)<=new Date(r.rows[0].date))};
  const first=backtest(truncated,{limit:200}).rows.find(x=>x.id===r.rows[0].id);
  assert.deepEqual(first.probabilities,r.rows[0].probabilities);
});
test('an explicit backtest cutoff cannot override each evaluated fixture cutoff',()=>{
  const b=data();
  assert.deepEqual(backtest(b,{limit:3}).rows,backtest(b,{limit:3,cutoff:b.target.date}).rows);
});

test('five and ten match windows change profiles, graph and prediction without leaking outcomes',()=>{
 const b=data(),five=analyze(b,{formCount:5}),ten=analyze(b,{formCount:10});
 assert.equal(five.homeForm.length,5);assert.equal(ten.homeForm.length,10);assert.equal(ten.awayForm.length,10);
 assert.equal(ten.profiles.home.gf,ten.homeForm.reduce((n,m)=>n+m.gf,0)/10);
 assert.notDeepEqual(ten.prediction,five.prediction);
 assert.ok(ten.graph.matchIds.length>five.graph.matchIds.length);
 const candidate=ten.neighbors[0];assert.ok(candidate);
 const historical=analyze({...b,target:b.matches.find(m=>m.id===candidate.id)},{formCount:10});
 assert.equal(candidate.profiles.home.gf,historical.profiles.home.gf);
 assert.equal(candidate.profiles.away.ga,historical.profiles.away.ga);
 const injected={...b,matches:[...b.matches,fixture(9999,23,1,2,99,99)]};
 assert.deepEqual(analyze(injected,{formCount:10}).prediction,ten.prediction);
 assert.deepEqual(analyze(b,{formCount:5}).prediction,five.prediction);
});
