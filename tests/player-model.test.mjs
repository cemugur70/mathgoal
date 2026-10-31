import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePlayers,findComparablePlayers} from '../dist/player-model.mjs';
const team=id=>({id,name:`Takım ${id}`});
function player(teamId,index) {
  const pos=index===0?0:index<=4?1:index<=7?2:3;
  const mins=index===8?60:index===11?30:90;
  const xg=index===8?1.2:index===11?.05:pos===3?.15:.02;
  return {id:teamId*100+index,name:`Oyuncu ${teamId}-${index}`,teamId,position:pos,
    isGoalkeeper:pos===0,starter:index!==11,minutes:mins,
    stats:{minutes_played:mins,rating_title:7.5,goals:index===8?1:0,assists:0,
      expected_goals:xg,expected_assists:.07,total_shots:index===8?5:2,shots_on_target:1,
      chances_created:1,touches:45,touches_opp_box:5,accurate_passes:30,
      defensive_actions:pos===1?10:3,'matchstats.headers.tackles':pos===1?3:1,
      interceptions:pos===1?2:1,saves:pos===0?3:0,goals_prevented:pos===0?.2:null},
    statTotals:{accurate_passes:35}};
}
function fixture(id,day,h=1,a=2) {
  return {id,date:`2026-01-${String(day).padStart(2,'0')}T12:00:00Z`,home:team(h),away:team(a),
    homeScore:2,awayScore:1,leagueId:47,finished:true,
    players:[...Array.from({length:12},(_,i)=>player(h,i)),...Array.from({length:12},(_,i)=>player(a,i))]};
}
function bundle() {
  return {target:{id:999,date:'2026-01-20T18:00:00Z',home:team(1),away:team(2),finished:false,started:false},
    analysisAt:'2026-01-19T12:00:00Z',matches:Array.from({length:10},(_,i)=>fixture(i+1,i+1)),
    playerMetricInventory:[{key:'rating_title',title:'Rating',type:'double'},
      {key:'accurate_passes',title:'Pas',group:'Passing',type:'fractionWithPercentage'}],
    targetLineup:{matchId:999,type:'confirmed',eligibleForModel:true,observedAt:'2026-01-19T11:00:00Z',
      home:{starters:Array.from({length:11},(_,i)=>({id:100+i})),unavailable:[]},
      away:{starters:Array.from({length:11},(_,i)=>({id:200+i})),unavailable:[]}}};
}
test('last 5/10 team windows and observed-minute weighted player rates',()=>{
  const b=bundle(),ten=analyzePlayers(b),five=analyzePlayers(b,{formCount:5});
  assert.equal(ten.byId[108].games,10);assert.equal(five.byId[108].games,5);
  assert.equal(ten.byId[108].minutes,600);assert.equal(five.byId[108].minutes,300);
  assert.ok(Math.abs(ten.byId[108].xg90-1.8)<1e-12);
  assert.equal(ten.byId[100].rating,7.5);assert.equal(ten.byId[100].metrics.rating_title.per90,null);
  assert.equal(ten.byId[100].metrics.rating_title.sum,null);
  assert.equal(ten.byId[100].metrics.accurate_passes.per90,30);
  assert.equal(ten.byId[100].metrics.accurate_passes.ratio,30/35);
  assert.equal(ten.byId[108].metrics.expected_goals.minutesCovered,600);
  assert.equal(ten.teams[1].summary.historyCount,10);
});
test('missing statistics and unknown minutes never become zeros or enter per90 denominators',()=>{
  const b=bundle();b.matches=b.matches.slice(0,5);
  b.matches[0].players.find(p=>p.id===108).stats.expected_goals=null;
  b.matches[1].players.find(p=>p.id===108).minutes=null;
  b.matches[1].players.find(p=>p.id===108).stats.minutes_played=null;
  const r=analyzePlayers(b),personal=r.byId[108],p=personal.teamContribution;
  assert.equal(personal.metrics.expected_goals.games,3,'unproven personal appearances with unknown minutes are excluded');
  assert.equal(personal.historyCoverage.unknownMinuteRecords,1);
  assert.equal(p.metrics.expected_goals.games,4);
  assert.equal(p.metrics.expected_goals.minutesCovered,180);
  assert.ok(Math.abs(p.xg90-1.8)<1e-12);
  assert.equal(p.missingMinutes,1);
  for(const m of b.matches)for(const p of m.players)p.stats={rating_title:9,minutes_played:p.minutes};
  const empty=analyzePlayers(b);
  assert.equal(empty.byId[108].goals,null);assert.equal(empty.byId[108].xg90,null);
  assert.equal(empty.adjustments.home.factor,1);
});
test('per90 is total production divided by covered minutes, not a mean of match rates',()=>{
  const b=bundle();b.matches=b.matches.slice(0,2);
  const second=b.matches[1].players.find(p=>p.id===108);
  second.minutes=90;second.stats.minutes_played=90;second.stats.expected_goals=.1;
  const p=analyzePlayers(b).byId[108];
  assert.ok(Math.abs(p.xg90-(1.2+.1)*90/(60+90))<1e-12);
  assert.equal(p.metrics.expected_goals.minutesCovered,150);
});
test('target, future, overlapping final stats and current player snapshot totals cannot leak',()=>{
  const b=bundle(),a=analyzePlayers(b);
  const target={...fixture(999,20),date:b.target.date},future=fixture(1000,21);
  const overlap={...fixture(1001,19),date:'2026-01-19T11:30:00Z'};
  const altered={...b,matches:[...b.matches,target,future,overlap],
    playerSnapshots:{108:{goals:1000,expected_goals:1000}},teamSnapshots:{1:{xg:999}}};
  assert.deepEqual(a.byId[108],analyzePlayers(altered).byId[108]);
  assert.deepEqual(a.adjustments,analyzePlayers(altered).adjustments);
});
test('late, mismatched and retrospective lineups are descriptive only',()=>{
  const base=bundle();
  for(const transform of [b=>b.targetLineup.matchId=998,b=>b.target.finished=true,
    b=>b.targetLineup.observedAt='2026-01-19T13:00:00Z',b=>b.targetLineup.type='unconfirmed']) {
    const b=structuredClone(base);transform(b);const r=analyzePlayers(b);
    assert.equal(r.adjustments.home.factor,1);assert.equal(r.adjustments.away.factor,1);
    assert.ok(r.byId[108].games>0);
  }
});
test('composition correction has actual effect and switches preserve the team-only baseline',()=>{
  const b=bundle();delete b.targetLineup;
  const baseline=analyzePlayers(b),scenario=analyzePlayers(b,{playerScenarios:{108:'out'}}),disabled=analyzePlayers(b,{playerLayer:false,playerScenarios:{108:'out'}});
  assert.equal(baseline.adjustments.home.factor,1);assert.equal(disabled.adjustments.home.factor,1);
  assert.ok(scenario.adjustments.home.factor<1);
  assert.equal(scenario.adjustments.home.scenarios[0].source,'what-if');
  assert.ok(scenario.adjustments.home.factor>=.92&&scenario.adjustments.home.factor<=1.08);
  assert.ok(scenario.adjustments.away.factor>=.92&&scenario.adjustments.away.factor<=1.08);
  assert.equal(scenario.adjustments.home.factor,scenario.adjustments.home.attackFactor*scenario.adjustments.away.defenseFactor);
  const unknown=analyzePlayers(b,{playerScenarios:{999999:'out'}});
  assert.equal(unknown.adjustments.home.factor,1);
});
test('reference XI has weaker composition effect than confirmed XI',()=>{
  const b=bundle();b.targetLineup.home.starters=b.targetLineup.home.starters.map(p=>p.id===108?{id:111}:p);
  const confirmed=analyzePlayers(b);b.targetLineup.type='lastStarting11';const reference=analyzePlayers(b);
  assert.ok(confirmed.adjustments.home.attackFactor<1);
  assert.ok(reference.adjustments.home.attackFactor>confirmed.adjustments.home.attackFactor);
  assert.ok(reference.adjustments.home.attackFactor<1);
});
test('same-position analogues require observed features, minutes and actual underlying scores',()=>{
  const b=bundle(),r=analyzePlayers(b),similar=findComparablePlayers(r,108,20);
  assert.ok(similar.length>0);assert.ok(similar.some(p=>p.playerId==='208'));
  assert.ok(similar.every(p=>p.position===3&&p.metrics.length>=4&&p.minutes>=180&&p.games>=3));
  assert.ok(similar.every(p=>p.matches.length>0&&p.matches.every(m=>m.score==='2–1')));
  const sparse=structuredClone({byId:r.byId,profiles:r.profiles});sparse.byId[108].minutes=90;
  assert.deepEqual(findComparablePlayers(sparse,108),[]);
});
test('duplicate cycles and player records are deduplicated and zero-minute bench entries excluded',()=>{
  const b=bundle();b.matches.push(b.matches[0]);b.matches[0].players.push(b.matches[0].players[8]);
  b.matches[0].players.push({...player(1,13),minutes:0,stats:{minutes_played:0}});
  b.matches[0].players.push({...player(1,14),minutes:null,starter:false,stats:{}});
  const r=analyzePlayers(b,{depth:3});
  assert.equal(r.byId[108].games,10);assert.equal(r.byId[113],undefined);
  assert.equal(r.byId[114],undefined);
  assert.equal(new Set(r.playerNodes.map(n=>n.id)).size,r.playerNodes.length);
  assert.equal(new Set(r.playerEdges.map(e=>e.id)).size,r.playerEdges.length);
});
test('unavailable XI players are replaced within position; explicit in overrides source absence',()=>{
  const b=bundle();b.targetLineup.home.unavailable=[{id:108,name:'Star',reason:'injury'}];
  const out=analyzePlayers(b);const weights=out.adjustments.home.projectedWeights;
  assert.ok(weights);assert.equal(weights[108],undefined);
  assert.ok(Object.values(weights).every(w=>w<=1));
  assert.ok(Math.abs(Object.values(weights).reduce((s,w)=>s+w,0)-11)<1e-8);
  const inside=analyzePlayers(b,{playerScenarios:{108:'in'}});
  assert.ok(inside.adjustments.home.projectedWeights[108]>0);
});
test('opponent difficulty never reads a later opponent fixture',()=>{
  const b=bundle(),a=analyzePlayers(b),one=a.byId[108].matches.find(m=>m.matchId===5);
  b.matches.push({...fixture(500,18,2,3),homeScore:0,awayScore:30});
  const after=analyzePlayers(b).byId[108].matches.find(m=>m.matchId===5);
  assert.equal(one.opponentFactor,after.opponentFactor);
  assert.equal(one.opponentHistoryCount,after.opponentHistoryCount);
});
