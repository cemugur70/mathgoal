import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerGraphFeatureIndex,PLAYER_GRAPH_FEATURE_NAMES} from '../dist/player-graph-features.mjs';
const team=id=>({id,name:`Team ${id}`});
function roster(teamId,{xg=.15,xgot=.20,xa=.08,defense=6,gp=.1,base=teamId*100}={}){
 return Array.from({length:11},(_,i)=>({id:base+i,teamId,name:`Player ${base+i}`,position:i===0?0:i<=4?1:i<=7?2:3,
  isGoalkeeper:i===0,starter:true,minutes:90,stats:{minutes_played:90,expected_goals:i===0?0:xg,
   expected_goals_on_target_variant:i===0?0:xgot,expected_assists:i===0?0:xa,chances_created:1,
   defensive_actions:defense,'matchstats.headers.tackles':2,interceptions:1,goals_prevented:i===0?gp:null}}));
}
function match(id,day,h,a,options={}){
 return {id:String(id),date:`2026-10-${String(day).padStart(2,'0')}T12:00:00Z`,home:team(h),away:team(a),leagueId:71,
  homeScore:2,awayScore:1,finished:true,players:[...roster(h),...roster(a)],...options};
}
function fixture(){
 const matches=[match(1,1,1,3),match(2,2,2,4),match(3,4,1,4),match(4,5,2,3),
  match(5,7,1,3),match(6,8,2,4),match(7,9,3,5),match(8,10,4,6)];
 const target={id:'target',date:'2026-10-15T18:00:00Z',home:team(1),away:team(2),leagueId:71};
 return {matches,target};
}
test('graph feature extraction is deterministic, bounded and explicitly reports history, coverage and evidence timing',()=>{
 const {matches,target}=fixture(),before=JSON.stringify(matches),index=createPlayerGraphFeatureIndex(matches),a=index.features(target),b=index.features(target);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(matches),before);assert.equal(a.home.length,12);assert.equal(a.away.length,12);
 assert.deepEqual(a.featureNames,PLAYER_GRAPH_FEATURE_NAMES);
 assert.ok([...a.home,...a.away].every(v=>Number.isFinite(v)&&v>=-2&&v<=2));
 assert.equal(a.coverage.home.historyGames,3);assert.ok(a.home[10]>0&&a.home[10]<1);
 assert.ok(Date.parse(a.evidence.maxAvailableAt)<Date.parse(target.date));assert.ok(a.evidence.matchIds.includes('7'));
 assert.equal(a.evidence.home.relationship,'confirmed-opponent-team-co-appearance');
 assert.equal(a.evidence.home.unknownFutureLineup,true);
});
test('target labels/statistics/actual lineup and future additions cannot influence pre-match graph features',()=>{
 const f=fixture(),initial=createPlayerGraphFeatureIndex([...f.matches,match('target',15,1,2)]).features(f.target);
 const alteredTarget={...f.target,homeScore:99,awayScore:99,stats:{expected_goals:{values:[99,99]}},
  targetLineup:{home:{starters:[{id:99999}]}},players:roster(1,{xg:99})};
 const targetRow=match('target',15,1,2,{homeScore:99,awayScore:99,players:roster(1,{xg:99})});
 const future=match('future',16,1,3,{players:[...roster(1,{xg:99}),...roster(3,{xg:99})]});
 const altered=createPlayerGraphFeatureIndex([...f.matches,targetRow,future]).features(alteredTarget);
 assert.deepEqual(initial,altered);assert.ok(!altered.evidence.matchIds.includes('target'));assert.ok(!altered.evidence.matchIds.includes('future'));
});
test('second-hop opponent performances in other matches change graph inputs with no invented duel links',()=>{
 const f=fixture(),before=createPlayerGraphFeatureIndex(f.matches).features(f.target);
 const altered=structuredClone(f.matches);const m=altered.find(m=>m.id==='7');
 for(const p of m.players.filter(p=>p.teamId===3)){p.stats.expected_goals=3;p.stats.expected_assists=1;p.stats.defensive_actions=30;}
 const after=createPlayerGraphFeatureIndex(altered).features(f.target);
 assert.ok(after.home[7]>before.home[7],'past encountered players have richer attack evidence from their other fixture');
 assert.ok(after.home[8]>before.home[8],'their other fixture also alters second-hop defensive profiles');
 assert.ok(!after.evidence.home.teamMatchIds.includes('7'),'the changed match is outside the root team window');
 assert.ok(after.evidence.matchIds.includes('7'),'the other match is genuinely traversed through co-appearance players');
});
test('cup and friendly appearances cannot contaminate the target league cohort or historical player pool',()=>{
 const f=fixture(),initial=createPlayerGraphFeatureIndex(f.matches).features(f.target);
 const cup=match('cup',12,1,3,{leagueId:99,players:[...roster(1,{xg:90,gp:90}),...roster(3,{xg:90,gp:90})]});
 const altered=createPlayerGraphFeatureIndex([...f.matches,cup,match('friendly',13,1,3,{leagueId:489}),match('national',13,1,3,{leagueId:114})]).features(f.target);
 assert.deepEqual(initial,altered);assert.ok(!altered.evidence.matchIds.includes('cup'));
});
test('global player identities retain former-club observations without counting a fixture or player twice',()=>{
 const f=fixture(),transferred=match('transfer',11,5,6);
 transferred.players[1]={...transferred.players[1],id:103,teamId:5,stats:{...transferred.players[1].stats,expected_goals:2}};
 const unique=createPlayerGraphFeatureIndex([...f.matches,transferred]).features(f.target);
 const duplicate=structuredClone(transferred);duplicate.players.push(duplicate.players[1]);
 const deduplicated=createPlayerGraphFeatureIndex([...f.matches,duplicate,duplicate]).features(f.target);
 assert.deepEqual(unique,deduplicated);
 const noTransfer=createPlayerGraphFeatureIndex(f.matches).features(f.target);
 assert.ok(unique.home[0]>noTransfer.home[0],'a global player’s earlier completed same-league observation at another club enters his profile');
 assert.ok(unique.evidence.matchIds.includes('transfer'));
});
test('unknown metrics stay null in evidence and neutral in vectors; observed zero remains distinguishable',()=>{
 const f=fixture(),missing=structuredClone(f.matches);
 for(const m of missing)for(const p of m.players)p.stats={minutes_played:90};
 const result=createPlayerGraphFeatureIndex(missing).features(f.target);
 assert.equal(result.home[0],0);assert.equal(result.evidence.home.metricValues.poolXg,null);
 assert.equal(result.coverage.home.features.poolXg,0);assert.ok(result.home[11]>.5);
 for(const m of missing)for(const p of m.players)p.stats.expected_goals=0;
 const zero=createPlayerGraphFeatureIndex(missing).features(f.target);
 assert.equal(zero.home[0],0);assert.equal(zero.evidence.home.metricValues.poolXg,0);
 assert.ok(zero.coverage.home.features.poolXg>0);assert.ok(zero.home[11]<result.home[11]);
});
test('unfinished, awarded, cancelled, overlapping and zero-minute evidence cannot enter the graph',()=>{
 const f=fixture(),initial=createPlayerGraphFeatureIndex(f.matches).features(f.target);
 const clone=match('unused',12,1,3);
 const extras=[{...clone,id:'award',awarded:true},{...clone,id:'cancelled',cancelled:true},{...clone,id:'unfinished',finished:false},
  {...clone,id:'overlap',date:'2026-10-15T17:30:00Z'}];
 const modified=structuredClone(f.matches);modified[0].players.push({...roster(1,{xg:99})[1],id:9991,minutes:0,stats:{expected_goals:99}});
 modified[0].players.push({...roster(1,{xg:99})[1],id:9992,minutes:null,stats:{minutes_played:null,expected_goals:99}});
 modified[0].players.push({...roster(1,{xg:99})[1],id:9993,teamId:999,minutes:90});
 assert.deepEqual(initial,createPlayerGraphFeatureIndex([...modified,...extras]).features(f.target));
});
test('second-hop expansion is capped at 24 actual opponents and early cutoffs never read later appearances',()=>{
 const matches=[];for(let day=1;day<=10;day++)matches.push(match(day,day,1,day+10));
 const target={id:'next',date:'2026-10-15T18:00:00Z',home:team(1),away:team(30),leagueId:71};
 const index=createPlayerGraphFeatureIndex(matches),later=index.features(target,{formCount:10}),earlier=index.features(target,{cutoff:'2026-10-05T18:00:00Z',formCount:5});
 assert.equal(later.evidence.home.secondHopPlayerIds.length,24);assert.equal(later.coverage.home.historyGames,10);
 assert.equal(earlier.coverage.home.historyGames,5);assert.ok(Date.parse(earlier.evidence.maxAvailableAt)<Date.parse(earlier.cutoff));
 assert.ok(earlier.evidence.matchIds.every(id=>Number(id)<=5));
 const isolated=index.features({...target,home:team(99),away:team(98)});
 assert.equal(isolated.evidence.maxAvailableAt,null);assert.ok(isolated.home.every((v,i)=>i===11?v===1:v===0));
});
test('small-minute outliers are shrunk and old appearances decay rather than dominating an unknown future lineup',()=>{
 const {target}=fixture(),recent=match('cameo',10,1,3);
 for(const p of recent.players)p.stats.expected_goals=0;
 const cameo=recent.players.find(p=>p.teamId===1&&p.position===3);cameo.minutes=10;cameo.stats.minutes_played=10;cameo.stats.expected_goals=1.5;
 const fresh=createPlayerGraphFeatureIndex([recent]).features(target);
 const old=structuredClone(recent);old.date='2026-05-10T12:00:00Z';
 const stale=createPlayerGraphFeatureIndex([old]).features(target);
 assert.ok(fresh.home[0]>0&&fresh.home[0]<.05,'a 13.5 xG/90 cameo cannot dominate the player pool');
 assert.ok(stale.home[0]<fresh.home[0]);assert.ok(stale.home[10]<fresh.home[10]);
 assert.equal(fresh.evidence.priorMinutes,270);assert.equal(fresh.evidence.halfLifeDays,120);
});
