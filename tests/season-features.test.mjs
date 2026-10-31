import test from 'node:test';import assert from 'node:assert/strict';
import {createSeasonFeatureIndex,SEASON_FEATURE_NAMES,SEASON_POLICY,seasonKey,detectCalendarLeagues} from '../dist/season-features.mjs';
import {selectSeasonModel} from '../dist/season-selection.mjs';
import {gbdtRow,GBDT_FEATURE_NAMES,SEASON_GBDT_FEATURE_NAMES,BASE_GBDT_FEATURE_NAMES} from '../dist/gbdt-training.mjs';
import {STARTER_FEATURE_NAMES} from '../dist/starter-features.mjs';
import {MARKET_FEATURE_NAMES} from '../dist/market-model.mjs';
import {MARKET_NETWORK_FEATURE_NAMES} from '../dist/market-network.mjs';
const DAY=86400000,H=3600000,iso=t=>new Date(t).toISOString(),team=id=>({id,name:'T'+id}),I=Object.fromEntries(SEASON_FEATURE_NAMES.map((n,i)=>[n.slice(7),i]));
function fixture(id,date,home,away,hs,as,extra={}){return {id:String(id),date:iso(date),home:team(home),away:team(away),homeScore:hs,awayScore:as,leagueId:71,finished:true,completedAt:iso(date+2*H),
 stats:{expected_goals:{values:[1.2,.8]},total_shots:{values:[12,8]},ShotsOnTarget:{values:[5,2]}},...extra};}
/** Eight-team league from 10 August 2026: team 1 beats everyone 2–0, team 8 loses to everyone, others draw 1–1. */
function league(){const rows=[];let id=1;const start=Date.UTC(2026,7,10);
 for(let round=0;round<8;round++)for(let a=1;a<=8;a++)for(let b=a+1;b<=8;b++){if((a+b+round)%8!==0)continue;const date=start+round*7*DAY+((a*3+b)%5)*H;
  const score=a===1?[2,0]:b===8?[2,0]:[1,1];rows.push(fixture(id++,date,a,b,score[0],score[1]));}
 return rows;}
const cutoffDate=Date.UTC(2026,9,20,18),cutoff=iso(cutoffDate),target={id:'target',date:cutoff,leagueId:71,home:team(1),away:team(8)};
test('season boundary is 1 July, 1 January for calendar leagues; calendar leagues come from the list or a May–July continuation',()=>{
 assert.equal(seasonKey(71,'2026-06-30T23:00:00Z'),'71:2025');assert.equal(seasonKey(71,'2026-07-01T00:00:00Z'),'71:2026');assert.equal(seasonKey(71,'2026-06-30T23:00:00Z',true),'71:2026');
 assert.equal(seasonKey(null,'2026-07-01T00:00:00Z'),null);
 const found=detectCalendarLeagues([{leagueId:999,date:'2026-05-30T00:00:00Z'},{leagueId:999,date:'2026-07-05T00:00:00Z'},{leagueId:998,date:'2026-05-25T00:00:00Z'},{leagueId:998,date:'2026-08-15T00:00:00Z'}]);
 assert.ok(found.has(59));assert.ok(found.has(999));assert.ok(!found.has(998));assert.ok(!found.has(71));
});
test('season-to-date vectors are bounded, oriented and ranked; the target, future and late-completed fixtures never enter',()=>{
 const rows=league(),index=createSeasonFeatureIndex(rows),f=index.features(target,{cutoff});
 assert.equal(f.home.length,SEASON_FEATURE_NAMES.length);assert.ok([...f.home,...f.away].every(v=>Number.isFinite(v)&&Math.abs(v)<=1));
 assert.equal(f.coverage.status,'ready');assert.equal(f.season,'71:2026');assert.ok(f.summaries.home.matches>=3&&f.summaries.away.matches>=3);
 assert.ok(f.home[I.ppg]>f.away[I.ppg]);assert.ok(f.home[I.gfPerGame]>f.home[I.gaPerGame]);assert.ok(f.away[I.gfPerGame]<f.away[I.gaPerGame]);
 assert.equal(f.home[I.rank],1);assert.equal(f.away[I.rank],-1);assert.equal(f.summaries.home.rank,1);assert.equal(f.summaries.away.rank,8);
 assert.equal(f.home[I.played],f.summaries.home.matches/SEASON_POLICY.maxMatches);assert.equal(f.home[I.missingFraction],0);
 assert.ok(Date.parse(f.evidence.maxAvailableAt)<cutoffDate);assert.ok(!f.evidence.matchIds.includes('target'));assert.equal(f.evidence.usesTargetOutcome,false);
 const leaky=[...rows,fixture('target',cutoffDate,1,8,9,9),fixture('future',cutoffDate+DAY,1,8,9,9),fixture('late',cutoffDate-H,1,8,9,9,{completedAt:iso(cutoffDate+H)}),fixture('unfinished',cutoffDate-2*H,1,8,9,9,{completedAt:null})];
 const g=createSeasonFeatureIndex(leaky).features(target,{cutoff});
 assert.deepEqual(g.home,f.home);assert.deepEqual(g.away,f.away);assert.ok(!g.evidence.matchIds.some(id=>['target','future','late','unfinished'].includes(id)));
 const earlier=createSeasonFeatureIndex([...leaky,fixture('ok',cutoffDate-5*H,1,8,0,1,{completedAt:null})]).features(target,{cutoff});
 assert.ok(earlier.summaries.home.matches===f.summaries.home.matches+1,'kickoff+3h availability counts a fixture without a finish timestamp');
});
test('season start is neutral; cup matches, previous seasons and other leagues only touch rest days; duplicates conflict',()=>{
 const rows=league(),index=createSeasonFeatureIndex(rows),fresh=index.features(target,{cutoff:'2026-08-01T00:00:00Z'});
 assert.equal(fresh.coverage.status,'insufficient');assert.equal(fresh.home[I.missingFraction],1);assert.ok(fresh.home.slice(0,-1).every(v=>v===0));assert.equal(fresh.evidence.maxAvailableAt,null);
 const cup=fixture('cup',cutoffDate-2*DAY,1,8,3,3,{leagueId:42}),previous=fixture('prev',Date.UTC(2026,4,20),1,8,0,5),base=index.features(target,{cutoff});
 const other=createSeasonFeatureIndex([...rows,cup,previous]).features(target,{cutoff});
 assert.equal(other.summaries.home.matches,base.summaries.home.matches);assert.equal(other.summaries.home.goalsAgainst,base.summaries.home.goalsAgainst);
 assert.notEqual(other.home[I.restDays],base.home[I.restDays]);assert.ok(other.evidence.matchIds.includes('cup'));assert.ok(!other.evidence.matchIds.includes('prev'));
 const conflict=createSeasonFeatureIndex([...rows,{...rows[0],homeScore:9}]);assert.equal(conflict.size,rows.length-1);
});
test('mirrored targets keep team-level values and only venue changes; unknown league is neutral',()=>{
 const index=createSeasonFeatureIndex(league()),a=index.features(target,{cutoff}),b=index.features({...target,id:'mirror',home:team(8),away:team(1)},{cutoff});
 for(const name of ['ppg','gfPerGame','gaPerGame','xgFor','finishing','rank','shotsPerGame','played'])assert.equal(a.home[I[name]],b.away[I[name]],name);
 assert.notEqual(a.home[I.venuePpg],b.away[I.venuePpg]);
 const none=index.features({...target,id:'none',leagueId:null},{cutoff});assert.equal(none.coverage.status,'insufficient');assert.ok(none.home.slice(1,-2).every(v=>v===0));assert.ok(none.home[I.missingFraction]>=11/12);
});
function row(extra={}){const date=Date.UTC(2026,9,1),before=iso(date-DAY),zeros=n=>Array(n).fill(0);
 return {id:'r',date:iso(date),availableAt:iso(date+3*H),formCount:10,leagueId:71,homeBase:1.4,awayBase:1,homeScore:1,awayScore:0,
  homeFeatures:zeros(10),awayFeatures:zeros(10),featureCutoff:iso(date),featureMaxAvailableAt:before,
  homeGraphFeatures:zeros(12),awayGraphFeatures:zeros(12),graphFeatureMaxAvailableAt:before,
  homeStarterFeatures:zeros(STARTER_FEATURE_NAMES.length),awayStarterFeatures:zeros(STARTER_FEATURE_NAMES.length),starterFeatureMaxAvailableAt:before,
  homeMarketFeatures:zeros(MARKET_FEATURE_NAMES.length),awayMarketFeatures:zeros(MARKET_FEATURE_NAMES.length),marketFeatureMaxAvailableAt:before,
  homeMarketNetworkFeatures:zeros(MARKET_NETWORK_FEATURE_NAMES.length),awayMarketNetworkFeatures:zeros(MARKET_NETWORK_FEATURE_NAMES.length),marketNetworkFeatureMaxAvailableAt:before,marketNetworkCoverage:{status:'ready'},
  homeSeasonFeatures:SEASON_FEATURE_NAMES.map(()=>.5),awaySeasonFeatures:SEASON_FEATURE_NAMES.map(()=>-.5),seasonFeatureMaxAvailableAt:before,seasonCoverage:{status:'ready'},...extra};}
test('gbdtRow appends the season block only for the season layer and neutralizes future or invalid season evidence',()=>{
 assert.equal(SEASON_GBDT_FEATURE_NAMES.length,GBDT_FEATURE_NAMES.length+SEASON_FEATURE_NAMES.length);assert.equal(BASE_GBDT_FEATURE_NAMES.length+MARKET_NETWORK_FEATURE_NAMES.length,GBDT_FEATURE_NAMES.length);
 const plain=gbdtRow(row()),season=gbdtRow(row(),{seasonLayer:true});
 assert.equal(plain.homeFeatures.length,GBDT_FEATURE_NAMES.length);assert.equal(season.homeFeatures.length,SEASON_GBDT_FEATURE_NAMES.length);assert.equal(season.seasonUsable,true);
 assert.deepEqual(season.homeFeatures.slice(-SEASON_FEATURE_NAMES.length),SEASON_FEATURE_NAMES.map(()=>.5));assert.equal(plain.seasonUsable,false);
 const neutral=SEASON_FEATURE_NAMES.map(n=>n.endsWith('missingFraction')?1:0);
 const future=gbdtRow(row({seasonFeatureMaxAvailableAt:iso(Date.UTC(2026,9,1))}),{seasonLayer:true});assert.deepEqual(future.homeFeatures.slice(-SEASON_FEATURE_NAMES.length),neutral);assert.equal(future.seasonUsable,false);
 const invalid=gbdtRow(row({homeSeasonFeatures:[1,2]}),{seasonLayer:true});assert.deepEqual(invalid.homeFeatures.slice(-SEASON_FEATURE_NAMES.length),neutral);assert.equal(invalid.seasonUsable,false);
 assert.equal(season.featureMaxAvailableAt,row().seasonFeatureMaxAvailableAt);
});
test('season selection follows the validation gate and never consults test labels',()=>{
 const ref={ranges:{a:1},report:{validation:{selected:{pairedCountNll:3,exactScoreAccuracy:.1}},test:{selected:{pairedCountNll:3,exactScoreAccuracy:.1}}},marketNetwork:{active:true},gbdt:{validated:true,reason:'önce'}};
 const candidate={...ref,accepted:true,counts:{train:100},training:{seasonCoveredTrain:90,seasonLayer:true},featureNames:SEASON_GBDT_FEATURE_NAMES,trees:[{value:0}],
  report:{validation:{selected:{pairedCountNll:2.9,exactScoreAccuracy:.2}},test:{selected:{pairedCountNll:99,exactScoreAccuracy:0}}}};
 const ready={coverage:{status:'ready'}},poor={coverage:{status:'insufficient'}};
 const auto=selectSeasonModel(candidate,ref,ready,{mode:'auto'});assert.equal(auto.season.active,true);assert.equal(auto.season.validated,true);assert.equal(auto.gbdt.featureCount,SEASON_GBDT_FEATURE_NAMES.length);assert.equal(auto.season.testUsedForSelection,false);
 assert.equal(selectSeasonModel(candidate,ref,poor,{mode:'market-graph'}).season.active,false);
 assert.equal(selectSeasonModel(candidate,ref,ready,{mode:'gbdt'}).season.active,false);
 const worse={...candidate,report:{...candidate.report,validation:{selected:{pairedCountNll:3.1,exactScoreAccuracy:.1}}}};
 assert.equal(selectSeasonModel(worse,ref,ready,{mode:'auto'}).season.active,false);
 const forced=selectSeasonModel(worse,ref,ready,{mode:'market-graph'});assert.equal(forced.season.experimental,true);assert.equal(forced.gbdt.experimental,true);
 const lowCoverage={...candidate,training:{seasonCoveredTrain:10,seasonLayer:true}};assert.equal(selectSeasonModel(lowCoverage,ref,ready,{mode:'auto'}).season.active,false);
 assert.equal(selectSeasonModel(null,ref,ready,{mode:'auto'}).season.active,false);
});
