import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePlayers} from '../dist/player-model.mjs';
import {analyze} from '../dist/model.mjs';
import * as playerHistory from '../dist/player-history.mjs';
import {team,player,match,bundle,forecastBundle} from './helpers.mjs';

function appearanceBundle() {
  const matches=[];
  for(let day=1;day<=7;day++)matches.push(match(day,`2026-10-0${day}T12:00:00Z`,team(1),team(2),
    day%2?[player(11,1),player(21,2)]:[player(12,1),player(21,2)]));
  return bundle(matches,{playerHistoryMatches:[match('former','2026-09-30T12:00:00Z',team(9,'Former club'),team(8),[player(11,9)])]});
}

test('personal last five appearances extend beyond the team window and retain former club identity',()=>{
  const result=analyzePlayers(appearanceBundle(),{formCount:5});
  const p=result.teams['1'].players.find(p=>p.playerId==='11');
  assert.equal(p.matches.length,5);
  assert.deepEqual(p.matches.map(m=>m.matchId),['7','5','3','1','former']);
  assert.equal(p.matches.at(-1).playedForTeam.id,9);
  assert.equal(p.teamContribution.games,3);
  assert.equal(p.historyCoverage.status,'archive-only');
});

test('a missing latest selected detail remains a slot instead of being replaced by an older match',()=>{
  const b=appearanceBundle();
  const missing=match('missing','2026-10-09T12:00:00Z',team(1),team(2));
  b.playerHistories={'11':{playerId:'11',cutoff:b.analysisAt,requested:10,status:'partial',reason:'detail-unavailable',sourceExhausted:false,
    matches:[{...missing,teamId:1,teamName:'Team 1',minutes:20,detailStatus:'unavailable',reason:'HTTP 503'},
      ...b.matches.filter(m=>m.players.some(p=>p.id===11)).map(m=>({...m,teamId:1,minutes:90,detailStatus:'available'}))]}};
  const p=analyzePlayers(b,{formCount:5}).byId['11'];
  assert.deepEqual(p.matches.map(m=>m.matchId),['missing','7','5','3','1']);
  assert.equal(p.matches[0].detailStatus,'unavailable');
  assert.deepEqual(p.matches[0].stats,{});
  assert.equal(p.matches[0].minutes,20);
  assert.equal(p.minutes,380,'known appearance minutes must include the missing-detail slot');
  assert.equal(p.metrics.expected_goals.games,4);
  assert.equal(p.metrics.expected_goals.minutesCovered,360);
  assert.equal(p.historyCoverage.withDetails,4);
});

test('target roster retains zero-history, unused and unknown-minute bench identities without inventing appearances',()=>{
  const b=appearanceBundle();
  b.targetLineup={matchId:b.target.id,type:'lastStarting11',home:{starters:[{id:11,name:'Starter',position:3}],bench:[{id:999,name:'Unused',position:null},{id:998,name:'Unknown',position:null}],unavailable:[{id:999,name:'Unused',position:null,reason:'injury'}]},away:{starters:[],bench:[],unavailable:[]}};
  b.matches[0].players.push(player(999,1,0),player(998,1,null,{starter:false,stats:{}}));
  const a=analyzePlayers(b,{formCount:5}),unused=a.teams['1'].players.find(p=>p.playerId==='999'),unknown=a.byId['998'];
  assert.ok(unused);
  assert.deepEqual(unused.rosterGroups,['bench','unavailable']);
  assert.equal(unused.games,0);
  assert.equal(unused.minutes,0);
  assert.equal(unused.position,null);
  assert.deepEqual(unused.metrics,{});
  assert.equal(unknown.games,0);
  assert.equal(unknown.position,null);
});

test('personal history excludes target, future, unfinished, awarded and friendly records and deduplicates matches',()=>{
  const b=appearanceBundle();
  const valid=match('duplicate','2026-10-10T12:00:00Z',team(1),team(2),[player(11,1),player(11,1)]);
  b.playerHistoryMatches=[valid,valid,
    match(b.target.id,'2026-10-20',team(1),team(2),[player(11,1)]),
    match('future','2026-11-02',team(1),team(2),[player(11,1)]),
    match('unfinished','2026-10-21',team(1),team(2),[player(11,1)],{finished:false}),
    match('awarded','2026-10-22',team(1),team(2),[player(11,1)],{awarded:true}),
    match('friendly','2026-10-23',team(1),team(2),[player(11,1)],{leagueId:489}),
    match('too-recent','2026-11-01T16:00:00Z',team(1),team(2),[player(11,1)])];
  const p=analyzePlayers(b,{formCount:10}).byId['11'];
  assert.equal(p.matches.filter(m=>m.matchId==='duplicate').length,1);
  assert.equal(p.matches.length,5);
  assert.ok(!p.matches.some(m=>['future','unfinished','awarded','friendly','too-recent',b.target.id].includes(m.matchId)));
});

test('opponent links contain only the opposing players who actually played in that exact match',()=>{
  const b=appearanceBundle();
  b.matches.at(-1).players.push(player(22,2,0),player(23,2,null,{starter:false,stats:{}}),player(24,2,15),player(13,1,15));
  const a=analyzePlayers(b,{formCount:5});
  const row=a.byId['11'].matches.find(m=>m.matchId==='7');
  assert.deepEqual(row.opponentPlayers.map(p=>String(p.playerId)).sort(),['21','24']);
  assert.ok(a.byId['24']);
  assert.ok(a.playerEdges.some(e=>e.relation==='opponent-player'&&e.playerId==='24'));
  const nodes=new Set(a.playerNodes.map(n=>n.id));
  for(const edge of a.playerEdges){assert.ok(nodes.has(edge.source),edge.source);assert.ok(nodes.has(edge.target),edge.target);}
  assert.equal(a.byKey['2:24'].playerId,'24');
});

test('one external opponent expansion preserves graph identity and transfer-safe lookup',()=>{
  const b=appearanceBundle();
  b.playerHistoryMatches[0].players.push(player(800,8,30));
  const a=analyzePlayers(b,{formCount:5,graph:{nodes:[team(1),team(2)]}});
  assert.equal(a.byKey['8:800'].teamId,8);
  assert.equal(a.teams['8'].external,true);
  const edge=a.playerEdges.find(e=>e.relation==='opponent-player'&&e.playerId==='800');
  assert.ok(edge);
  assert.ok(a.playerNodes.some(n=>n.id===edge.target));
  const played=a.playerEdges.find(e=>e.relation==='played'&&e.source==='player:1:11'&&e.target==='match:former');
  const faced=a.playerEdges.find(e=>e.relation==='faced'&&e.source==='match:former'&&e.target==='team:8');
  assert.equal(played.teamId,9,'performance affiliation is the former club, not the display club');
  assert.equal(faced.playerTeamId,9);
  assert.equal(played.relativeToTeamId,9);
  assert.equal(faced.relativeToTeamId,9);
});

test('an analysis-scoped resolver opens an evidenced deeper opponent without changing forecast facts',()=>{
  const b=bundle([
    match('root','2026-10-10',team(1),team(2),[player(11,1),player(21,2)]),
    match('first','2026-10-09',team(9),team(8),[player(11,9),player(800,8)]),
    match('second','2026-10-08',team(8),team(7),[player(800,8),player(700,7)])
  ]);
  const a=analyzePlayers(b,{formCount:5,graph:{nodes:[team(1),team(2)]}});
  assert.equal(a.byKey['7:700'],undefined,'deeper opponents are not eagerly expanded');
  const reference=structuredClone(a.reference),adjustments=structuredClone(a.adjustments);
  assert.equal(typeof a.resolvePlayer,'function');
  const deeper=a.resolvePlayer('700','7',{name:'Caller display name',position:1});
  assert.equal(deeper.playerId,'700');assert.equal(deeper.teamId,7);
  assert.equal(deeper.name,'Player 700','the source identity owns the name');
  assert.deepEqual(deeper.matches.map(m=>m.matchId),['second']);
  assert.equal(deeper.teamContribution.games,1);
  assert.equal(deeper.historyCoverage.status,'archive-only');
  assert.equal(a.byKey['7:700'],deeper);
  assert.equal(a.teams['7'].players.find(p=>p.playerId==='700'),deeper);
  assert.equal(a.resolvePlayer('700','7'),deeper,'subsequent lookups use this result cache');
  assert.equal(a.resolvePlayer('700','1'),null,'an unrelated team cannot inherit the byId representation');
  assert.equal(a.resolvePlayer('999999','7',{name:'Invented'}),null);
  assert.deepEqual(a.reference,reference);assert.deepEqual(a.adjustments,adjustments);
});

test('a full-sized but incompletely paged appearance selection stays partial',()=>{
  const b=appearanceBundle();
  const rows=[...b.matches,...b.playerHistoryMatches].filter(m=>m.players.some(p=>p.id===11));
  b.playerHistories={'11':{playerId:'11',cutoff:b.analysisAt,requested:5,status:'complete',selectionComplete:false,reason:'page-unavailable',sourceExhausted:false,
    matches:rows.map(m=>({...m,teamId:m.players.find(p=>p.id===11).teamId,minutes:90,detailStatus:'available'}))}};
  const p=analyzePlayers(b,{formCount:5}).byId['11'];
  assert.equal(p.matches.length,5);
  assert.equal(p.historyCoverage.status,'partial');
  assert.equal(p.historyCoverage.reason,'page-unavailable');
});

test('retained prior evidence is labeled only for selected appearances and cannot hide a fresh failure',()=>{
  const b=appearanceBundle();
  b.matches.push(match('8','2026-10-08',team(1),team(2),[player(11,1)]));
  const rows=[...b.matches,...b.playerHistoryMatches].filter(m=>m.players.some(p=>p.id===11));
  const retained=new Set(['5','3','1','former','not-selected']);
  b.playerHistories={'11':{playerId:'11',cutoff:b.analysisAt,requested:10,status:'partial',selectionComplete:false,
    reason:'profile-unavailable',sourceExhausted:true,retainedFromPrevious:true,retainedMatchIds:[...retained],
    matches:rows.map(m=>({...m,teamId:m.players.find(p=>p.id===11).teamId,minutes:90,playedInMatch:true,
      detailStatus:'available',retainedFromPrevious:retained.has(m.id)}))}};
  const p=analyzePlayers(b,{formCount:5}).byId['11'];
  assert.deepEqual(p.matches.map(m=>m.matchId),['8','7','5','3','1']);
  assert.equal(p.historyCoverage.retainedFromPrevious,true);
  assert.deepEqual(p.historyCoverage.retainedMatchIds,['5','3','1']);
  assert.equal(p.historyCoverage.status,'partial');
  assert.equal(p.historyCoverage.reason,'profile-unavailable');
});

for(const hasDetails of [true,false])test(`source-proven unknown-minute appearance remains a selected slot (${hasDetails?'with detail metrics':'missing detail'})`,()=>{
  const b=appearanceBundle(),latest=match('unknown-latest','2026-10-09',team(1),team(2),
    hasDetails?[player(11,1,null,{stats:{expected_goals:.9,minutes_played:null}})]:[]);
  if(hasDetails)b.playerHistoryMatches.push(latest);
  const prior=[...b.matches,...b.playerHistoryMatches].filter(m=>m.id!=='unknown-latest'&&m.players.some(p=>p.id===11));
  b.playerHistories={'11':{playerId:'11',cutoff:b.analysisAt,requested:10,status:'exhausted',reason:'missing-minutes',sourceExhausted:true,selectionComplete:true,
    matches:[{...latest,teamId:1,teamName:'Team 1',minutes:null,playedInMatch:true,detailStatus:hasDetails?'available':'unavailable'},
      ...prior.map(m=>({...m,teamId:m.players.find(p=>p.id===11).teamId,minutes:90,playedInMatch:true,detailStatus:'available'}))]}};
  const p=analyzePlayers(b,{formCount:5}).byId['11'];
  assert.deepEqual(p.matches.map(m=>m.matchId),['unknown-latest','7','5','3','1']);
  assert.equal(p.matches[0].minutes,null);
  assert.equal(p.minutes,360);
  assert.equal(p.missingMinutes,1);
  assert.equal(p.historyCoverage.status,'partial');
  assert.equal(p.historyCoverage.reason,'missing-minutes');
  assert.equal(p.metrics.expected_goals.games,hasDetails?5:4);
  assert.equal(p.metrics.expected_goals.minutesCovered,360);
  assert.equal(p.metrics.expected_goals.per90,.2);
});

test('a contradictory shared base record cannot override the selected appearance identity',()=>{
  const b=appearanceBundle(),expected=match('identity','2026-10-09',team(1),team(2));
  b.matches.push(match('identity','2026-10-09',team(3),team(2),[player(11,3,75,{stats:{expected_goals:9,minutes_played:75}})]));
  const prior=b.matches.filter(m=>m.id!=='identity'&&m.players.some(p=>p.id===11));
  b.playerHistories={'11':{playerId:'11',cutoff:b.analysisAt,requested:10,status:'exhausted',sourceExhausted:true,selectionComplete:true,
    matches:[{...expected,teamId:1,teamName:'Team 1',minutes:75,playedInMatch:true,detailStatus:'unavailable',reason:'match-identity-mismatch'},
      ...prior.map(m=>({...m,teamId:1,minutes:90,playedInMatch:true,detailStatus:'available'}))]}};
  const p=analyzePlayers(b,{formCount:5}).byId['11'];
  assert.deepEqual(p.matches.map(m=>m.matchId),['identity','7','5','3','1']);
  assert.equal(p.matches[0].playedForTeam.id,1);
  assert.equal(p.matches[0].detailStatus,'unavailable');
  assert.deepEqual(p.matches[0].stats,{});
  assert.equal(p.historyCoverage.status,'partial');
  assert.equal(p.historyCoverage.reason,'match-identity-mismatch');
  assert.equal(p.metrics.expected_goals.sum,.8);
});

test('national friendly appearances are excluded from personal history',()=>{
  const b=appearanceBundle();
  b.playerHistoryMatches.push(match('national-friendly','2026-10-20',team(1),team(2),[player(11,1)],{leagueId:114}));
  const p=analyzePlayers(b,{formCount:5}).byId['11'];
  assert.ok(!p.matches.some(m=>m.matchId==='national-friendly'));
});

test('canonical eligible-match selection preserves complete base evidence over incomplete enrichment duplicates',()=>{
  const complete=match('same','2026-10-01',team(1),team(2),[player(11,1)]);
  const incomplete={...complete,players:[]};
  const b=bundle([complete],{playerHistoryMatches:[incomplete]});
  assert.equal(typeof playerHistory.selectEligiblePlayerMatches,'function');
  const selected=playerHistory.selectEligiblePlayerMatches(b,Date.parse(b.analysisAt),b.target.id);
  assert.equal(selected.get('same'),complete);
  const index=playerHistory.buildPlayerHistoryIndex(b,Date.parse(b.analysisAt),b.target.id);
  assert.equal(index.matches.get('same'),complete);
  assert.equal(index.byPlayer.get('11').length,1);
});

test('an ineligible earlier duplicate does not hide a later eligible record',()=>{
  const valid=match('same','2026-10-01',team(1),team(2),[player(11,1)]);
  const b=bundle([{...valid,finished:false}],{playerHistoryMatches:[valid]});
  assert.equal(typeof playerHistory.selectEligiblePlayerMatches,'function');
  const selected=playerHistory.selectEligiblePlayerMatches(b,Date.parse(b.analysisAt),b.target.id);
  assert.equal(selected.size,1);
  assert.equal(selected.get('same'),valid);
});

test('analysis-scoped team history preserves completion gates, target exclusion and equal-date ordering',()=>{
  const rows=[
    match('20','2026-10-03T12:00:00Z',team(1),team(2),[],{completedAt:'2026-10-03T19:00:00Z'}),
    match('2','2026-10-02T12:00:00Z'),match('1','2026-10-02T12:00:00Z'),
    match('10','2026-10-03T12:00:00Z',team(1),team(2),[],{completedAt:'2026-10-03T13:00:00Z'}),
    match('future','2026-10-04T12:00:00Z'),
    match('awarded','2026-10-02',team(1),team(2),[],{awarded:true}),
    match('other-team','2026-10-02',team(7),team(8)),
    match('national','2026-10-01',team(1),team(2),[],{leagueId:114})
  ];
  assert.equal(typeof playerHistory.createTeamHistoryLookup,'function');
  const index=playerHistory.createTeamHistoryLookup(rows,{includeNationalFriendlies:true});
  const earlier=Date.parse('2026-10-03T14:00:00Z'),later=Date.parse('2026-10-04T14:00:00Z');
  assert.deepEqual(index.recent(1,earlier,10).map(m=>m.id),['10','1','2','national']);
  assert.deepEqual(index.recent(1,later,10).map(m=>m.id),['10','20','1','2','national']);
  assert.deepEqual(index.recent(1,earlier,2,'10').map(m=>m.id),['1','2']);
  assert.equal(index.recent(1,earlier,2),index.recent(1,earlier,2),'same analysis query is reused');
  const personal=playerHistory.createTeamHistoryLookup(rows);
  assert.deepEqual(personal.recent(1,earlier,10).map(m=>m.id),['10','1','2']);
  assert.notEqual(personal.recent(1,earlier,2),index.recent(1,earlier,2),'no result cache crosses analyses');
});

for(const scenario of [undefined,{'111':'out'}])test(`personal display enrichment preserves a non-neutral forecast and original reference population (${scenario?'what-if':'confirmed XI'})`,()=>{
  const b=forecastBundle(),opts={formCount:5,...(scenario?{playerScenarios:scenario}:{})};
  const original=analyze(b,opts);
  assert.notEqual(original.playerAnalysis.adjustments.home.factor,1,'fixture must exercise a non-neutral adjustment');
  // Frozen from the original live 2026-10-26.8 player model before the change.
  assert.equal(original.playerAnalysis.adjustments.home.factor,scenario?0.9899309418495438:1.0051568364541064);
  assert.equal(original.playerAnalysis.adjustments.away.factor,scenario?1.00230120492397:0.9988342093645155);
  const enriched=structuredClone(b);
  enriched.playerHistoryMatches=Array.from({length:8},(_,i)=>match(`extra-${i}`,`2026-09-${String(i+10).padStart(2,'0')}T12:00:00Z`,team(9),team(8),[player(111,9,90,{stats:{minutes_played:90,expected_goals:9,expected_assists:8,goals:4,assists:3,defensive_actions:99,tackles:50,interceptions:20}})]));
  const actual=analyze(enriched,opts);
  assert.deepEqual(actual.playerAnalysis.reference,original.playerAnalysis.reference);
  assert.deepEqual(actual.playerAnalysis.adjustments,original.playerAnalysis.adjustments);
  assert.deepEqual(actual.baselinePrediction,original.baselinePrediction);
  assert.deepEqual(actual.playerPrediction,original.playerPrediction);
  assert.deepEqual(actual.prediction,original.prediction);
});
