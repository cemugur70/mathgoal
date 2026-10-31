import test from 'node:test';import assert from 'node:assert/strict';
import {createMarketNetworkIndex,MARKET_NETWORK_FEATURE_NAMES} from '../dist/market-network.mjs';
import {selectMarketNetworkModel} from '../dist/market-network-selection.mjs';
import {trainGbdtModel,gbdtRow,GBDT_FEATURE_NAMES,BASE_GBDT_FEATURE_NAMES} from '../dist/gbdt-training.mjs';
const DAY=86400000,start=Date.UTC(2024,0,1),iso=t=>new Date(t).toISOString();
function profile(group,reverse=false){return Array.from({length:40},(_,j)=>{const v=(j<20?group:-group)*(reverse?-1:1);return [v*.3,v*.6,1];}).flat();}
function fixtures(count=200){return Array.from({length:count},(_,i)=>{const date=start+i*DAY,group=i%3===0?1:-1;return {id:String(i),date:iso(date),availableAt:iso(date+10800000),formCount:10,leagueId:1,
 homeTeam:{id:1+i%20,name:'Team '+i%20},awayTeam:{id:100+i%20,name:'Other '+i%20},homeBase:1.4,awayBase:1,homeScore:group===1?3:1,awayScore:group===1?0:1,
 homeFeatures:[1,1,.3,0,0,0,0,0,1,0],awayFeatures:[1,0,0,0,0,0,0,0,1,0],featureCutoff:iso(date),featureMaxAvailableAt:iso(date-DAY),marketFeatureMaxAvailableAt:iso(date-DAY),
 homeMarketFeatures:profile(group),awayMarketFeatures:profile(group,true),marketHistoryCounts:{home:20,away:20}};});}
const target={id:'target',date:iso(start+250*DAY),leagueId:1,home:{id:1001,name:'Home'},away:{id:1002,name:'Away'}};
const query={home:profile(1),away:profile(1,true),formCount:10,includeGraph:true};
test('market graph uses real shared-pattern paths and normalized multihop outcome weights',()=>{
 const n=createMarketNetworkIndex(fixtures()).features(target,query);
 assert.equal(n.coverage.status,'ready');assert.equal(n.home.length,MARKET_NETWORK_FEATURE_NAMES.length);assert.ok(n.home.every(v=>Number.isFinite(v)&&Math.abs(v)<=3));
 assert.ok(Math.abs(n.neighbors.reduce((s,r)=>s+r.weight,0)-1)<1e-12);assert.ok(n.neighbors.some(r=>Math.abs(r.weight-r.directWeight)>1e-6));
 assert.ok(n.graph.nodes.some(r=>r.type==='pattern'));assert.ok(n.graph.nodes.some(r=>r.type==='team'));assert.ok(n.graph.links.some(l=>l.type==='shared-pattern'));
 const ids=new Set(n.graph.nodes.map(r=>r.id));assert.ok(n.graph.links.every(l=>ids.has(l.source)&&ids.has(l.target)));
 assert.ok(!n.evidence.matchIds.includes('target'));assert.ok(Date.parse(n.evidence.maxAvailableAt)<Date.parse(target.date));assert.equal(n.evidence.rankingUsesOutcomes,false);
 assert.ok(Math.abs(n.home[2]-n.away[3])<1e-12,'attack/against residuals reverse consistently');
});
test('outcomes never choose graph edges or weights; target, future and unverifiable profiles cannot leak',()=>{
 const rows=fixtures(),a=createMarketNetworkIndex(rows).features(target,query),changed=rows.map(r=>({...r,homeScore:r.homeScore+3}));
 const b=createMarketNetworkIndex(changed).features(target,query);
 assert.deepEqual(a.neighbors.map(r=>[r.id,r.distance,r.weight]),b.neighbors.map(r=>[r.id,r.distance,r.weight]));assert.notDeepEqual(a.home,b.home);
 const invalid=[{...rows[0],id:'target',date:target.date,homeScore:99},{...rows[0],id:'future',date:iso(start+251*DAY),availableAt:iso(start+252*DAY)},
  {...rows[0],id:'timing-unverified',marketFeatureMaxAvailableAt:rows[0].date},{...rows[0],id:'unfinished-at-cutoff',date:iso(start+249.99*DAY),availableAt:iso(start+251*DAY)}];
 assert.deepEqual(createMarketNetworkIndex([...rows,...invalid]).features(target,query),a);
 const duplicate=[...rows,{...rows[0],homeScore:99}];assert.equal(createMarketNetworkIndex(duplicate).size,rows.length-1);
});
test('reversed venues retain oriented actual score while insufficient evidence cannot activate a graph model',()=>{
 const row=fixtures(1)[0],n=createMarketNetworkIndex([row]).features(target,{...query,home:row.awayMarketFeatures,away:row.homeMarketFeatures});
 assert.equal(n.neighbors[0].reversed,true);assert.equal(n.neighbors[0].homeScore,row.awayScore);assert.equal(n.neighbors[0].awayScore,row.homeScore);assert.equal(n.coverage.status,'insufficient');
 const ref={ranges:{},report:{validation:{selected:{pairedCountNll:3,exactScoreAccuracy:.1}},test:{selected:{pairedCountNll:3,exactScoreAccuracy:.1}}}},candidate={...ref,accepted:true,counts:{train:100},training:{networkCoveredTrain:90},featureNames:GBDT_FEATURE_NAMES,trees:[]};
 candidate.report={validation:{selected:{pairedCountNll:2.9,exactScoreAccuracy:.2}},test:{selected:{pairedCountNll:99,exactScoreAccuracy:0}}};
 const ready={...n,coverage:{status:'ready'}};
 assert.equal(selectMarketNetworkModel(candidate,ref,ready,{mode:'auto'}).marketNetwork.active,true,'poor test labels cannot select/reject a frozen validation choice');
 assert.equal(selectMarketNetworkModel(candidate,ref,n,{mode:'market-graph'}).marketNetwork.active,false);
 const worse={...candidate,report:{...candidate.report,validation:{selected:{pairedCountNll:3.1,exactScoreAccuracy:.1}}}};
 assert.equal(selectMarketNetworkModel(worse,ref,ready,{mode:'auto'}).marketNetwork.active,false);assert.equal(selectMarketNetworkModel(worse,ref,ready,{mode:'market-graph'}).marketNetwork.experimental,true);
});
function enriched(rows){const index=createMarketNetworkIndex(rows);return rows.map(r=>{const n=index.features({id:r.id,date:r.date,leagueId:r.leagueId,home:r.homeTeam,away:r.awayTeam},{home:r.homeMarketFeatures,away:r.awayMarketFeatures,formCount:r.formCount});
 return {...r,homeMarketNetworkFeatures:n.home,awayMarketNetworkFeatures:n.away,marketNetworkFeatureMaxAvailableAt:n.evidence.maxAvailableAt,marketNetworkCoverage:n.coverage};});}
test('rolling graph features and GBDT selection remain isolated from target and future test labels',()=>{
 const rows=fixtures(),data=enriched(rows),options={cutoff:target.date,targetId:target.id,formCount:10,leagueId:1},m=trainGbdtModel(data,options);
 assert.equal(m.featureNames.length,255);assert.equal(BASE_GBDT_FEATURE_NAMES.length,243);assert.ok(m.training.networkCoveredTrain>70);
 const firstTest=Date.parse(m.ranges.test.firstDate),changed=enriched(rows.map(r=>Date.parse(r.date)>=firstTest?{...r,homeScore:9,awayScore:8}:r));
 for(let i=0;i<rows.length;i++)if(Date.parse(rows[i].date)<firstTest)assert.deepEqual(data[i].homeMarketNetworkFeatures,changed[i].homeMarketNetworkFeatures);
 const n=trainGbdtModel(changed,options);assert.deepEqual(m.report.selection,n.report.selection);assert.deepEqual(m.report.lockedTrees,n.report.lockedTrees);
 const invalid=gbdtRow({...data.at(-1),marketNetworkFeatureMaxAvailableAt:data.at(-1).date,homeMarketNetworkFeatures:Array(12).fill(3)}),absent=gbdtRow({...data.at(-1),marketNetworkFeatureMaxAvailableAt:null});
 assert.deepEqual(invalid.homeFeatures,absent.homeFeatures);assert.equal(trainGbdtModel(data,{...options,networkLayer:false}).featureNames.length,243);
});
