import test from 'node:test';import assert from 'node:assert/strict';
import {MARKETS,MARKET_FEATURE_NAMES,createMarketHistoryIndex,predictMarketTable,countGrid,marketProbability,settleAsian,asianProbabilities} from '../dist/market-model.mjs';
import {trainGbdtModel} from '../dist/gbdt-training.mjs';
const DAY=86400000,start=Date.UTC(2024,0,1),iso=t=>new Date(t).toISOString(),target={id:'target',date:iso(start+80*DAY),home:{id:1},away:{id:2},leagueId:1};
function fixtures(n=20){return Array.from({length:n},(_,i)=>({id:String(i),date:iso(start+i*DAY),finished:true,leagueId:1,home:{id:1},away:{id:2},homeScore:1,awayScore:0,
 stats:{corners:{values:[6,3]},yellow_cards:{values:[2,1]},red_cards:{values:[0,0]},total_shots:{values:[15,8]},ShotsOnTarget:{values:[5,2]}}}));}
test('long team-perspective runs exceed form windows and unavailable metrics break consecutive runs',()=>{
 const rows=fixtures(12);rows[0].homeScore=0;rows[0].awayScore=1;
 let c=createMarketHistoryIndex(rows).features(target);assert.equal(c.summaries.home.win.streak,11);assert.equal(c.summaries.home.win.state,true);
 assert.equal(c.summaries.away.win.state,false);assert.equal(c.summaries.home.totalUnder2_5,undefined);
 assert.equal(c.summaries.home['totalUnder2.5'].streak,12);assert.equal(c.summaries.home['totalUnder2.5'].rightCensored,true);
 assert.equal(c.home.length,MARKET_FEATURE_NAMES.length);assert.ok(c.home.every(Number.isFinite));assert.equal(MARKET_FEATURE_NAMES.length,120);
 rows[9].stats={};c=createMarketHistoryIndex(rows).features(target);assert.equal(c.summaries.home['cornersOver8.5'].streak,2);assert.equal(c.summaries.home['cornersOver8.5'].known,11);
 assert.equal(c.summaries.home['totalUnder2.5'].streak,12,'missing corners never deletes known score facts');
});
test('target, future, unfinished, concurrent-unavailable and conflicting fixtures cannot change market features',()=>{
 const rows=fixtures(),index=createMarketHistoryIndex(rows),before=index.features(target);
 const invalid=[{...rows[0],id:'target',date:target.date,homeScore:99},{...rows[0],id:'future',date:iso(start+81*DAY)},
  {...rows[0],id:'not-complete',finished:false},{...rows[0],id:'unfinished-at-cutoff',date:iso(Date.parse(target.date)-3600000)},
  {...rows[0],id:'friendly',leagueId:489}];
 assert.deepEqual(createMarketHistoryIndex([...rows,...invalid]).features(target),before);
 assert.ok(Date.parse(before.evidence.maxAvailableAt)<Date.parse(target.date));assert.ok(!before.evidence.matchIds.includes('target'));
 const duplicate=[...rows,{...rows[0],homeScore:7}],c=createMarketHistoryIndex(duplicate).features(target);assert.equal(c.histories.home.length,rows.length-1);
});
test('market projections share score-grid probabilities while unsupported statistics remain unknown',()=>{
 const context=createMarketHistoryIndex(fixtures()).features(target),grid=countGrid(1.6,.9),table=predictMarketTable(context,grid),lookup=id=>table.rows.find(r=>r.id===id);
 assert.ok(Math.abs(lookup('totalOver2.5').probability+lookup('totalUnder2.5').probability-1)<1e-12);
 assert.ok(Math.abs(lookup('win').probability+lookup('draw').probability+lookup('loss').probability-1)<1e-12);
 assert.equal(lookup('foulsOver19.5').probability,null);assert.equal(lookup('cornersOver8.5').method,'stat-poisson-unvalidated');
 assert.equal(lookup('win').probabilityAway,lookup('loss').probability);assert.ok(table.unavailable.some(s=>s.includes('İlk yarı')));
 assert.equal(marketProbability(MARKETS.find(m=>m.id==='correct1:0'),[{home:1,away:0,probability:1}]),1);
});
test('Asian quarter lines separate full/half win, push and loss without counting a push as success',()=>{
 assert.deepEqual(settleAsian(1,0,-.75),{win:.5,push:.5,loss:0});
 assert.deepEqual(settleAsian(0,0,-.25),{win:0,push:.5,loss:.5});
 assert.deepEqual(settleAsian(2,0,2.25,{kind:'total',under:true}),{win:.5,push:.5,loss:0});
 assert.deepEqual(settleAsian(3,0,2.75,{kind:'total',under:true}),{win:0,push:.5,loss:.5});
 const p=asianProbabilities(countGrid(1.6,.9),-.25);assert.ok(Math.abs(p.fullWin+p.halfWin+p.fullPush+p.halfLoss+p.fullLoss-1)<1e-12);
 assert.ok(Math.abs(p.win+p.push+p.loss-1)<1e-12);assert.throws(()=>settleAsian(1,0,.1));
});
test('GBDT can learn a pre-match market-run signal while future runs and test labels cannot select trees',()=>{
 const rows=Array.from({length:240},(_,i)=>{const date=start+i*DAY,high=i%3===0,market=Array(120).fill(0);market[0]=high?1:-1;
  return {id:String(i),date:iso(date),availableAt:iso(date+10800000),featureCutoff:iso(date),featureMaxAvailableAt:iso(date-DAY),formCount:10,leagueId:1,
   homeBase:2,awayBase:2,homeFeatures:[1,1,0,0,0,0,0,0,1,0],awayFeatures:[1,0,0,0,0,0,0,0,1,0],homeScore:high?4:1,awayScore:1,
   homeMarketFeatures:market,awayMarketFeatures:market,marketFeatureMaxAvailableAt:iso(date-DAY)};});
 const options={cutoff:iso(start+300*DAY),targetId:'target',formCount:10,leagueId:1},m=trainGbdtModel(rows,options);
 assert.equal(m.accepted,true);assert.ok(m.featureImportance.some(f=>f.feature.startsWith('market.')&&f.gain>0));
 const changed=rows.map(r=>Date.parse(r.date)>=Date.parse(m.ranges.test.firstDate)?{...r,homeScore:20,awayScore:19}:r),n=trainGbdtModel(changed,options);
 assert.deepEqual(m.report.selection,n.report.selection);assert.deepEqual(m.report.lockedTrees,n.report.lockedTrees);
 const future=rows.map(r=>({...r,marketFeatureMaxAvailableAt:r.date})),absent=rows.map(r=>({...r,marketFeatureMaxAvailableAt:null}));
 assert.deepEqual(trainGbdtModel(future,options).trees,trainGbdtModel(absent,options).trees);
});
