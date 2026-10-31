import {analyzePlayers} from './player-model.mjs?v=2026-10-31.1';
import {analyzeH2H} from './h2h-model.mjs?v=2026-10-31.1';
import {trainOutcomeModel,applyOutcomeModel,outcomeFeatures,goalProbabilities} from './outcome-training.mjs?v=2026-10-31.1';
import {createPlayerGraphFeatureIndex,PLAYER_GRAPH_FEATURE_NAMES} from './player-graph-features.mjs?v=2026-10-31.1';
import {trainPlayerGraphModels,selectPlayerGraphModel} from './player-graph-training.mjs?v=2026-10-31.1';
import {createStarterFeatureIndex,STARTER_FEATURE_NAMES} from './starter-features.mjs';
import {trainGbdtModel,selectGbdtModel} from './gbdt-training.mjs';
import {createMarketHistoryIndex,predictMarketTable,MARKET_FEATURE_NAMES} from './market-model.mjs';
import {playerContributionReport,optimizeAbsenceReplacements} from './player-contribution.mjs';
import {createMarketNetworkIndex,MARKET_NETWORK_FEATURE_NAMES} from './market-network.mjs';
import {selectMarketNetworkModel} from './market-network-selection.mjs';
import {createSeasonFeatureIndex,SEASON_FEATURE_NAMES,SEASON_POLICY} from './season-features.mjs';
import {selectSeasonModel} from './season-selection.mjs';
import {selectPiModel} from './pi-selection.mjs';
import {PI_FEATURE_NAMES,PI_POLICY} from './pi-ratings.mjs';
// Deterministic, dependency-free pre-match model. Scores are probabilities, not guarantees.
const DAY = 86400000;
const COMPLETION_LAG = 3 * 60 * 60 * 1000;
const PREMATCH_CACHE = Symbol('strict-past-profile-cache');
const TRAINING_CACHE=new WeakMap();
const PLAYER_GRAPH_CACHE=new WeakMap();
const STARTER_CACHE=new WeakMap();
const MARKET_CACHE=new WeakMap();
const MARKET_NETWORK_CACHE=new WeakMap();
const SEASON_CACHE=new WeakMap();
function targetSeason(bundle,target){let index=SEASON_CACHE.get(bundle);if(!index){index=createSeasonFeatureIndex([...(bundle.matches??[]),...(bundle.playerHistoryMatches??[])]);SEASON_CACHE.set(bundle,index);}return index.features(target,{cutoff:target.date});}
const piSchemaOf=data=>data?.schemaVersion===6&&JSON.stringify(data.piFeatureNames)===JSON.stringify(PI_FEATURE_NAMES)&&data.piPolicy?.version===PI_POLICY.version;
// Target pi ratings are computed at collection time from the full archive; they apply only to the same policy and analysis cutoff.
function targetPi(bundle,target){const p=bundle.piRatings;if(!p||p.policy!==PI_POLICY.version||Date.parse(p.cutoff)!==Date.parse(target.date)||JSON.stringify(p.featureNames)!==JSON.stringify(PI_FEATURE_NAMES))return null;
 const ok=v=>Array.isArray(v)&&v.length===PI_FEATURE_NAMES.length&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=3);return ok(p.home)&&ok(p.away)?p:null;}
function targetMarketNetwork(bundle,target,options,markets){const data=bundle.trainingData;if(![5,6].includes(data?.schemaVersion)||!markets)return null;
 let index=MARKET_NETWORK_CACHE.get(data);if(!index){index=createMarketNetworkIndex(data.rows);MARKET_NETWORK_CACHE.set(data,index);}
 return index.features(target,{cutoff:target.date,formCount:options.formCount,home:markets.home,away:markets.away,
  historyCounts:{home:markets.histories.home.length,away:markets.histories.away.length},includeGraph:true});}
function targetMarkets(bundle,target){let index=MARKET_CACHE.get(bundle);if(!index){index=createMarketHistoryIndex([...(bundle.matches??[]),...(bundle.playerHistoryMatches??[])]);MARKET_CACHE.set(bundle,index);}return index.features(target,{cutoff:target.date});}
export async function warmTraining(bundle,options={}){
 const data=bundle.trainingData;if(![5,6].includes(data?.schemaVersion)||typeof Worker==='undefined')return;
 const target={...bundle.target,date:options.cutoff??bundle.analysisAt??bundle.target.date},count=options.formCount??10;
 const key=`${target.id}:${target.date}:${count}:${target.leagueId}`;
 let cache=TRAINING_CACHE.get(data);if(!cache){cache=new Map();TRAINING_CACHE.set(data,cache);}if(cache.has(key))return;
 const value=await new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./training-worker.mjs',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data);};worker.onerror=e=>{worker.terminate();reject(Error(e.message));};
  worker.postMessage({rows:data.rows,pi:piSchemaOf(data),options:{cutoff:target.date,targetId:target.id,formCount:count,leagueId:target.leagueId}});
 });cache.set(key,value);
}
function targetStarters(bundle,target,options){
 let index=STARTER_CACHE.get(bundle);if(!index){index=createStarterFeatureIndex([...(bundle.matches??[]),...(bundle.playerHistoryMatches??[])]);STARTER_CACHE.set(bundle,index);}
 return index.features(target,{cutoff:target.date,formCount:options.formCount,lineup:bundle.targetLineup,analysisAt:bundle.analysisAt,playerScenarios:options.playerScenarios});
}
function targetPlayerGraph(bundle,target,options,enabled){
 if(!enabled||![2,3,4,5,6].includes(bundle.trainingData?.schemaVersion)||target.leagueId==null)return null;
 let index=PLAYER_GRAPH_CACHE.get(bundle);
 if(!index){index=createPlayerGraphFeatureIndex([...(bundle.matches??[]),...(bundle.playerHistoryMatches??[])]);PLAYER_GRAPH_CACHE.set(bundle,index);}
 return index.features(target,{cutoff:target.date,formCount:options.formCount});
}
function learnedModel(bundle,target,options,enabled,graphFeatures=null,starters=null,marketNetwork=null,season=null,pi=null){
 const data=bundle.trainingData;
 if(!enabled||!data?.rows||![1,2,3,4,5,6].includes(data.schemaVersion)||data.baseVersion!=='network-v1.2.0')return {status:enabled?'unavailable':'disabled',accepted:false,report:null};
 const graphSchema=[2,3,4,5,6].includes(data.schemaVersion)&&JSON.stringify(data.graphFeatureNames)===JSON.stringify(PLAYER_GRAPH_FEATURE_NAMES);
 const treeSchema=graphSchema&&[4,5,6].includes(data.schemaVersion)&&data.starterPolicy==='previous-official-xi-availability-position-v3'&&JSON.stringify(data.starterFeatureNames)===JSON.stringify(STARTER_FEATURE_NAMES)&&JSON.stringify(data.marketFeatureNames)===JSON.stringify(MARKET_FEATURE_NAMES);
 const networkSchema=treeSchema&&[5,6].includes(data.schemaVersion)&&JSON.stringify(data.marketNetworkFeatureNames)===JSON.stringify(MARKET_NETWORK_FEATURE_NAMES);
 const seasonSchema=networkSchema&&data.schemaVersion===6&&JSON.stringify(data.seasonFeatureNames)===JSON.stringify(SEASON_FEATURE_NAMES)&&data.seasonPolicy?.version===SEASON_POLICY.version;
 const piSchema=seasonSchema&&piSchemaOf(data);
 let cache=TRAINING_CACHE.get(data);if(!cache){cache=new Map();TRAINING_CACHE.set(data,cache);}
 const key=`${target.id}:${target.date}:${options.formCount}:${target.leagueId}`;
 if(!cache.has(key)){
  if(cache.size>=16)cache.clear();
  const opts={cutoff:target.date,targetId:target.id,formCount:options.formCount,leagueId:target.leagueId};
  cache.set(key,{linear:graphSchema?trainPlayerGraphModels(data.rows,opts):trainOutcomeModel(data.rows,opts),gbdt:treeSchema?trainGbdtModel(data.rows,{...opts,networkLayer:false}):null,
   marketNetwork:networkSchema?trainGbdtModel(data.rows,{...opts,networkLayer:true}):null,season:seasonSchema?trainGbdtModel(data.rows,{...opts,networkLayer:true,seasonLayer:true}):null,pi:piSchema?trainGbdtModel(data.rows,{...opts,piLayer:true}):null});
 }
 const mode=options.playerLayer===false?'baseline':options.playerGraphMode;
 const cached=cache.get(key),reference=graphSchema?selectPlayerGraphModel(cached.linear,graphFeatures,{mode}):cached.linear;
 let trained=cached.gbdt?selectGbdtModel(cached.gbdt,reference,{mode:mode==='market-graph'?'auto':mode,starters}):reference;
 if(networkSchema)trained=selectMarketNetworkModel(cached.marketNetwork,trained,marketNetwork,{mode,starters});
 if(seasonSchema)trained=selectSeasonModel(cached.season,trained,season,{mode,starters});
 // The pi layer extends the season inputs, so it is only compared once the season layer itself is active.
 if(piSchema&&trained.training?.seasonLayer)trained=selectPiModel(cached.pi,trained,pi,{mode,starters});
 return {...trained,dataId:data.id,sourceMatchCount:data.sourceMatchCount};
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const mean = values => { const xs = values.filter(finite); return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null; };
const same = (a,b) => String(a) === String(b);
const time = value => new Date(value).getTime();
const metricSpec = {
  xg: ['expected_goals'],
  shots: ['total_shots','shots'],
  shotsOnTarget: ['ShotsOnTarget','shots_on_target'],
  possession: ['BallPossesion','ball_possession'],
  corners: ['corners','corner_kicks'],
  bigChances: ['big_chance','big_chances'],
  passes: ['accurate_passes'],
  tackles: ['matchstats.headers.tackles','won_tackle','tackles_succeeded','tackles'],
  yellowCards: ['yellow_cards'],
  redCards: ['red_cards'],
  touchesBox: ['touches_opp_box'],
  saves: ['keeper_saves','saves']
};
const FEATURES = [
  ['gf',1.7],['ga',1.7],['xg',1.4],['xga',1.4],['shots',8],
  ['shotsAgainst',8],['shotsOnTarget',4],['possession',20],['corners',4],
  ['bigChances',3],['points',1.2],['touchesBox',15]
];
export const MODEL_VERSION = '1.7.0';

function stat(match, metric, side) {
  for (const key of metricSpec[metric] ?? [metric]) {
    const item = match.stats?.[key];
    const value = item?.values?.[side];
    if (finite(value)) return value;
  }
  return null;
}
function eligible(match, cutoff, excluded) {
  const recordedEnd=time(match.completedAt??match.finishedAt??match.endDate);
  // Current "finished" status does not establish that a game had ended at an earlier cutoff.
  const availableAt=Number.isFinite(recordedEnd)?recordedEnd:time(match.date)+COMPLETION_LAG;
  return !same(match.id,excluded) && time(match.date) < cutoff && availableAt < cutoff &&
    Number(match.leagueId) !== 489 && match.finished !== false &&
    !match.cancelled && finite(match.homeScore) && finite(match.awayScore);
}
export function history(matches, teamId, cutoff, count=5, excluded=null) {
  return matches.filter(m => eligible(m,time(cutoff),excluded) &&
    (same(m.home.id,teamId)||same(m.away.id,teamId)))
    .sort((a,b)=>time(b.date)-time(a.date)||String(a.id).localeCompare(String(b.id)))
    .slice(0,count).map(match => {
      const home = same(match.home.id,teamId), side = home ? 0 : 1;
      const gf = home ? match.homeScore : match.awayScore;
      const ga = home ? match.awayScore : match.homeScore;
      const stats = Object.fromEntries(Object.keys(metricSpec).map(key=>[key,stat(match,key,side)]));
      stats.xga=stat(match,'xg',1-side);
      stats.shotsAgainst=stat(match,'shots',1-side);
      return {id:match.id,date:match.date,opponent:home?match.away:match.home,
        venue:home?'home':'away',gf,ga,result:gf>ga?'W':gf<ga?'L':'D',
        points:gf>ga?3:gf===ga?1:0,stats,match};
    });
}
function profile(rows) {
  const metrics = ['gf','ga','points',...Object.keys(metricSpec),'xga','shotsAgainst'];
  const result = {historyCount:rows.length,metricCoverage:{},wins:0,draws:0,losses:0};
  for (const key of metrics) {
    const values = rows.map(row=>key in row?row[key]:row.stats[key]);
    result[key]=mean(values);
    result.metricCoverage[key]=values.filter(finite).length;
  }
  for(const row of rows) result[row.result==='W'?'wins':row.result==='D'?'draws':'losses']++;
  result.goalsFor=rows.reduce((n,r)=>n+r.gf,0);
  result.goalsAgainst=rows.reduce((n,r)=>n+r.ga,0);
  return result;
}
function graphFor(matches,target,options) {
  const nodes=new Map(), edges=new Map(), matchIds=new Set();
  const roots=[target.home,target.away];
  roots.forEach(team=>nodes.set(String(team.id),{...team,depth:0,root:true}));
  let frontier=roots;
  for(let d=0;d<options.depth;d++) {
    const next=[];
    for(const team of frontier) for(const row of history(matches,team.id,target.date,options.formCount,target.id)) {
      const m=row.match; matchIds.add(String(m.id));
      const opponent=row.opponent, key=String(opponent.id);
      if(!nodes.has(key)) {nodes.set(key,{...opponent,depth:d+1,root:false});next.push(opponent);}
      const edgeKey=[String(m.home.id),String(m.away.id)].sort().join(':');
      if(!edges.has(edgeKey)) edges.set(edgeKey,{source:m.home.id,target:m.away.id,matches:[],weight:0});
      const edge=edges.get(edgeKey);
      if(!edge.matches.some(x=>same(x.id,m.id))) {
        edge.matches.push({id:m.id,date:m.date,home:m.home,away:m.away,homeScore:m.homeScore,awayScore:m.awayScore});
        edge.weight++;
      }
    }
    frontier=next;
  }
  return {nodes:[...nodes.values()],edges:[...edges.values()],matchIds:[...matchIds],
    depth:options.depth,scope:'Her düğümün başlama saatinden önceki son maçları; tekrarlanan maçlar tekilleştirilir.'};
}
const offense = (m,side) => {
  const goals=side===0?m.homeScore:m.awayScore, xg=stat(m,'xg',side);
  return finite(xg) ? .7*xg+.3*goals : goals;
};
function fitNetwork(matches,graph,target,options) {
  const ids=new Set(graph.nodes.map(n=>String(n.id)));
  // Only games acquired through the selected network depth enter this fit.
  const selected=new Set(graph.matchIds);
  const train=matches.filter(m=>selected.has(String(m.id))&&ids.has(String(m.home.id))&&ids.has(String(m.away.id)));
  const homeAvg=mean(train.map(m=>offense(m,0)))??1.45;
  const awayAvg=mean(train.map(m=>offense(m,1)))??1.2;
  const base=Math.max(.45,(homeAvg+awayAvg)/2);
  // Shrink the home effect because a small graph cannot identify it reliably.
  const homeFactor=clamp(Math.exp(.5*Math.log((homeAvg+.3)/(awayAvg+.3))),.85,1.25);
  const ratings=Object.fromEntries([...ids].map(id=>[id,{attack:1,defense:1,games:0}]));
  const pseudo=5; // Five league-average games regularize each team.
  for(let iter=0;iter<28;iter++) {
    const accum=Object.fromEntries([...ids].map(id=>[id,{a:pseudo,d:pseudo,w:pseudo,games:0}]));
    for(const m of train) {
      const h=String(m.home.id),a=String(m.away.id);
      const w=Math.pow(.5,Math.max(0,(time(target.date)-time(m.date))/DAY)/options.halfLife);
      const hg=offense(m,0),ag=offense(m,1),ah=accum[h],aa=accum[a];
      ah.a+=w*hg/(base*homeFactor*Math.max(.4,ratings[a].defense));
      aa.a+=w*ag/(base/homeFactor*Math.max(.4,ratings[h].defense));
      ah.d+=w*ag/(base/homeFactor*Math.max(.4,ratings[a].attack));
      aa.d+=w*hg/(base*homeFactor*Math.max(.4,ratings[h].attack));
      ah.w+=w;aa.w+=w;ah.games++;aa.games++;
    }
    for(const id of ids) {
      const acc=accum[id],r=ratings[id];
      r.attack=.55*r.attack+.45*clamp(acc.a/acc.w,.4,2.1);
      r.defense=.55*r.defense+.45*clamp(acc.d/acc.w,.4,2.1);
      r.games=acc.games;
    }
  }
  return {base,homeFactor,ratings,matchCount:train.length,iterations:28,regularization:pseudo,
    label:'Rakip gücüne göre düzeltilmiş, ortalamaya çekilen hücum / gol yeme katsayıları'};
}
function comparisons(matches,target,profiles,options,cache=null) {
  const neighbors=[];
  const targetVector=[profiles.home,profiles.away].flatMap(p=>FEATURES.map(([key])=>p[key]));
  const fullCount=targetVector.length;
  for(const match of matches) {
    let cached=cache?.get(String(match.id));
    if(!cached) {
      const homeRows=history(matches,match.home.id,match.date,options.formCount,match.id);
      const awayRows=history(matches,match.away.id,match.date,options.formCount,match.id);
      cached={hp:profile(homeRows),ap:profile(awayRows)};
    }
    const {hp,ap}=cached;
    if(hp.historyCount<3||ap.historyCount<3) continue;
    const vector=[hp,ap].flatMap(p=>FEATURES.map(([key])=>p[key]));
    let sum=0,count=0,exact=true;
    const comparable=[];
    for(let i=0;i<fullCount;i++) {
      if(!finite(targetVector[i])||!finite(vector[i])) {exact=false;continue;}
      const [key,scale]=FEATURES[i%FEATURES.length];
      const delta=(vector[i]-targetVector[i])/scale;
      sum+=delta*delta;count++;
      if(Math.abs(vector[i]-targetVector[i])>1e-9) exact=false;
      comparable.push({side:i<FEATURES.length?'home':'away',metric:key,
        target:targetVector[i],historical:vector[i]});
    }
    const coverage=count/fullCount;
    if(count<8||coverage<.5) continue;
    const distance=Math.sqrt(sum/count)+.2*(1-coverage);
    // A distant game is not a useful analogue merely because it is the nearest.
    if(distance>1.1) continue;
    const age=Math.max(0,(time(target.date)-time(match.date))/DAY);
    const weight=Math.exp(-distance*distance/.25)*Math.pow(.5,age/(options.halfLife*2));
    neighbors.push({id:match.id,date:match.date,home:match.home,away:match.away,
      homeScore:match.homeScore,awayScore:match.awayScore,score:`${match.homeScore}–${match.awayScore}`,
      distance,similarity:Math.exp(-distance*distance/.25),coverage,featureCount:count,
      exact:exact&&count===fullCount,weight,homeHistoryCount:hp.historyCount,
      awayHistoryCount:ap.historyCount,comparable,profiles:{home:hp,away:ap}});
  }
  return neighbors.sort((a,b)=>a.distance-b.distance||time(b.date)-time(a.date)).slice(0,options.neighbors);
}
function poisson(lambda,max=8) {
  const values=[Math.exp(-lambda)];
  for(let i=1;i<=max;i++) values.push(values[i-1]*lambda/i);
  return values;
}
function distribution(homeXg,awayXg,neighbors,requestedWeight,goalShape=null,adaptive=false) {
  const tailLimit=mean=>mean+8*Math.sqrt(mean+(goalShape?mean*mean/goalShape:0));
  const max=adaptive?Math.min(100,Math.max(12,Math.ceil(Math.max(tailLimit(homeXg),tailLimit(awayXg))))):goalShape?12:8;
  const ph=goalShape?goalProbabilities(homeXg,max,goalShape):poisson(homeXg,max),pa=goalShape?goalProbabilities(awayXg,max,goalShape):poisson(awayXg,max);
  const retained=ph.reduce((a,b)=>a+b,0)*pa.reduce((a,b)=>a+b,0);
  let cells=ph.flatMap((p,h)=>pa.map((q,a)=>({home:h,away:a,probability:p*q/retained})));
  const usable=neighbors.filter(n=>n.homeScore<=max&&n.awayScore<=max);
  const wsum=usable.reduce((s,n)=>s+n.weight,0);
  const ess=wsum ? wsum*wsum/usable.reduce((s,n)=>s+n.weight*n.weight,0):0;
  const mix=usable.length>=3&&ess>=2 ? requestedWeight*Math.min(1,ess/8):0;
  const empirical=new Map();
  for(const n of usable) empirical.set(`${n.homeScore}:${n.awayScore}`,(empirical.get(`${n.homeScore}:${n.awayScore}`)||0)+n.weight/wsum);
  cells=cells.map(c=>({...c,probability:(1-mix)*c.probability+mix*(empirical.get(`${c.home}:${c.away}`)||0)}));
  const sum=predicate=>cells.filter(predicate).reduce((s,c)=>s+c.probability,0);
  const outcomes={home:sum(c=>c.home>c.away),draw:sum(c=>c.home===c.away),away:sum(c=>c.home<c.away)};
  const topScores=[...cells].sort((a,b)=>b.probability-a.probability).slice(0,8);
  const expectedGoals={home:cells.reduce((s,c)=>s+c.home*c.probability,0),away:cells.reduce((s,c)=>s+c.away*c.probability,0)};
  return {homeXg:expectedGoals.home,awayXg:expectedGoals.away,expectedGoals,poissonMeans:{home:homeXg,away:awayXg},topScores,
    mostLikelyScore:topScores[0],outcomes,homeWin:outcomes.home,draw:outcomes.draw,awayWin:outcomes.away,
    over25:sum(c=>c.home+c.away>=3),under25:sum(c=>c.home+c.away<=2),btts:sum(c=>c.home>0&&c.away>0),
    heatmap:cells,tailMass:clamp(1-retained,0,1),similarityWeight:mix,effectiveNeighbors:ess,goalShape,scoreGridMaximum:max,distributionFamily:goalShape?'negative-binomial':'poisson',
    distributionNote:`0–${max} gol aralığı normalize edilir; dışarıda kalan kuyruk kütlesi ayrıca raporlanır. Eğitim etkinse gol dağılımı geçmiş sonuçlarla seçilir.`};
}
function optionsFor(opts={}) {
  return {depth:clamp(Math.round(opts.depth??2),1,3),halfLife:clamp(Number(opts.halfLife??60),7,365),
    neighbors:clamp(Math.round(opts.neighbors??12),3,40),formCount:clamp(Math.round(opts.formCount??5),3,10),playerLayer:opts.playerLayer!==false,playerScenarios:opts.playerScenarios??{},
    similarityWeight:clamp(Number(opts.similarityWeight??.25),0,.4),playerGraphMode:['auto','graph','baseline','gbdt','market-graph'].includes(opts.playerGraphMode)?opts.playerGraphMode:'market-graph',...('cutoff' in opts?{cutoff:opts.cutoff}:{}),excludeId:opts.excludeId};
}
export function analyze(bundle,opts={}) {
  const options=optionsFor(opts), target={...bundle.target,date:options.cutoff??bundle.analysisAt??bundle.target.date};
  if(!target.home?.id||!target.away?.id||!Number.isFinite(time(target.date))) throw new Error('Geçerli hedef maç ve başlama saati gerekli.');
  const matches=[...new Map((bundle.matches??[]).filter(m=>eligible(m,time(target.date),target.id)&&!same(m.id,options.excludeId)).map(m=>[String(m.id),m])).values()];
  const homeForm=history(matches,target.home.id,target.date,options.formCount,target.id);
  const awayForm=history(matches,target.away.id,target.date,options.formCount,target.id);
  const profiles={home:profile(homeForm),away:profile(awayForm)};
  const graph=graphFor(matches,target,options),network=fitNetwork(matches,graph,target,options);
  const rh=network.ratings[String(target.home.id)]??{attack:1,defense:1};
  const ra=network.ratings[String(target.away.id)]??{attack:1,defense:1};
  const formAttack=p=>finite(p.xg)?p.xg:(p.gf??network.base);
  const formDefense=p=>finite(p.xga)?p.xga:(p.ga??network.base);
  // A 25% short-form component preserves the last-five signal without overfitting it.
  const hNetwork=network.base*network.homeFactor*rh.attack*ra.defense;
  const aNetwork=network.base/network.homeFactor*ra.attack*rh.defense;
  const hForm=(formAttack(profiles.home)+formDefense(profiles.away))/2*network.homeFactor;
  const aForm=(formAttack(profiles.away)+formDefense(profiles.home))/2/network.homeFactor;
  const enough=homeForm.length>=3&&awayForm.length>=3;
  const rawHomeXg=clamp(.75*hNetwork+.25*hForm,.15,4.5);
  const rawAwayXg=clamp(.75*aNetwork+.25*aForm,.15,4.5);
  const playerGraphFeatures=targetPlayerGraph(bundle,target,options,enough&&opts.trainingLayer!==false);
  const starters=enough&&opts.trainingLayer!==false&&[4,5,6].includes(bundle.trainingData?.schemaVersion)?targetStarters(bundle,target,options):null;
  const markets=enough&&opts.trainingLayer!==false?targetMarkets(bundle,target):null;
  const marketNetwork=targetMarketNetwork(bundle,target,options,markets);
  const seasonFeatures=enough&&opts.trainingLayer!==false&&bundle.trainingData?.schemaVersion===6?targetSeason(bundle,target):null;
  const piFeatures=seasonFeatures?targetPi(bundle,target):null;
  const training=learnedModel(bundle,target,options,enough&&opts.trainingLayer!==false,playerGraphFeatures,starters,marketNetwork,seasonFeatures,piFeatures);
  const homeFeatures=outcomeFeatures(profiles,network,'home',rawHomeXg),awayFeatures=outcomeFeatures(profiles,network,'away',rawAwayXg);
  const graphReference=training.playerGraph?applyOutcomeModel(training.playerGraph.baselineReference,{homeBase:rawHomeXg,awayBase:rawAwayXg,homeFeatures,awayFeatures}):null;
  if(training.kind==='poisson-gbdt'){
   homeFeatures.push(...playerGraphFeatures.home,...starters.home,...markets.home);awayFeatures.push(...playerGraphFeatures.away,...starters.away,...markets.away);
   if(training.training?.networkLayer){homeFeatures.push(...marketNetwork.home);awayFeatures.push(...marketNetwork.away);}
   if(training.training?.seasonLayer){homeFeatures.push(...seasonFeatures.home);awayFeatures.push(...seasonFeatures.away);}
   if(training.training?.piLayer){homeFeatures.push(...piFeatures.home);awayFeatures.push(...piFeatures.away);}
   optimizeAbsenceReplacements(training,{homeBase:rawHomeXg,awayBase:rawAwayXg,homeFeatures,awayFeatures},starters);
   homeFeatures.splice(22,starters.home.length,...starters.home);awayFeatures.splice(22,starters.away.length,...starters.away);
  }else if(training.playerGraph?.active){homeFeatures.push(...playerGraphFeatures.home);awayFeatures.push(...playerGraphFeatures.away);}
  const trainedMeans=applyOutcomeModel(training,{homeBase:rawHomeXg,awayBase:rawAwayXg,
    homeFeatures,awayFeatures});
  if(training.gbdt?.active)training.gbdt.targetInput={homeBase:rawHomeXg,awayBase:rawAwayXg,homeFeatures,awayFeatures};
  if(training.gbdt?.active){training.gbdt.contributions=playerContributionReport(training,starters);training.gbdt.marketEvidence=markets.evidence;}
  if(graphReference)training.playerGraph.targetPrediction={baseline:{home:graphReference.home,away:graphReference.away},selected:{home:trainedMeans.home,away:trainedMeans.away},
    homeFactor:graphReference.home?trainedMeans.home/graphReference.home:1,awayFactor:graphReference.away?trainedMeans.away/graphReference.away:1};
  const homeXg=trainedMeans.home,awayXg=trainedMeans.away,goalShape=training.accepted?trainedMeans.shape:null;
  const distributionWeight=training.accepted?0:options.similarityWeight;
  const neighbors=enough&&!opts.skipComparisons?comparisons(matches,target,profiles,options,opts[PREMATCH_CACHE]):[];
  const playerAnalysis=opts.skipPlayerAnalysis?null:analyzePlayers({...bundle,matches,analysisAt:target.date},{...opts,...options,graph,network,cutoff:target.date});
  const baselinePrediction=enough?distribution(homeXg,awayXg,neighbors,distributionWeight,goalShape,training.accepted):null;
  const homePlayerFactor=training.gbdt?.active?1:playerAnalysis?.adjustments?.home?.factor??1,awayPlayerFactor=training.gbdt?.active?1:playerAnalysis?.adjustments?.away?.factor??1;
  const playerPrediction=!enough?null:homePlayerFactor===1&&awayPlayerFactor===1?baselinePrediction:distribution(homeXg*homePlayerFactor,awayXg*awayPlayerFactor,neighbors,distributionWeight,goalShape,training.accepted);
  const h2hAnalysis=analyzeH2H({...bundle,matches,analysisAt:target.date},{...opts,cutoff:target.date,homeBase:homeXg,awayBase:awayXg});
  const prediction=!enough?null:h2hAnalysis.factors.home===1&&h2hAnalysis.factors.away===1?playerPrediction:distribution(homeXg*homePlayerFactor*h2hAnalysis.factors.home,awayXg*awayPlayerFactor*h2hAnalysis.factors.away,neighbors,distributionWeight,goalShape,training.accepted);
  const dimensions=FEATURES.length*2;
  const observed=[profiles.home,profiles.away].flatMap(p=>FEATURES.map(([k])=>p[k])).filter(finite).length;
  return {version:MODEL_VERSION,target,options,homeForm,awayForm,profiles,graph,network,neighbors,prediction,baselinePrediction,playerPrediction,playerAnalysis,h2hAnalysis,training,
    marketAnalysis:markets&&prediction?predictMarketTable(markets,prediction.heatmap):null,marketNetwork,season:seasonFeatures,pi:piFeatures,
    untrainedMeans:{home:rawHomeXg,away:rawAwayXg},trainedMeans,
    coverage:{matchCount:matches.length,graphMatches:network.matchCount,teamCount:graph.nodes.length,
      homeHistory:homeForm.length,awayHistory:awayForm.length,observedDimensions:observed,totalDimensions:dimensions,
      featureCoverage:observed/dimensions,exactMatches:neighbors.filter(n=>n.exact).length,
      status:enough?'ready':'insufficient',confidence:training.accepted?'Geçmiş sonuçlarla eğitim · iç zaman testi':'Takım tabanı · bağımsız kalibrasyon yok',
      missingReason:enough?null:'Her takım için başlama saatinden önce en az üç tamamlanmış maç gerekli.'},
    methodNotes:[
      'Hedef maçın skoru, istatistikleri ve başlama saatinden sonraki maçlar hesaplamaya alınmaz.',
      'Gerçek bitiş saati yoksa bir maçın istatistikleri başlama saatinden üç saat sonra kullanılabilir sayılır; aynı anda oynanan maçların sonradan öğrenilen sonuçları dışlanır.',
      'Son maç formu tüm resmi turnuvaları içerir; hazırlık maçları hariçtir. Eksik istatistikler sıfır sayılmaz.',
      'Rakip ağı döngülerde tekilleştirilir; 28 sönümlü yineleme ve beş ortalama maçlık öncül ile düzenlenir.',
      'Benzerlik maç sonu istatistiklerini değil, her tarihî maçtan önce mevcut olan takım formunu karşılaştırır.',
      'Sabit özellik ölçekleri ve model ağırlıkları sezgiseldir; geniş, dış örneklem doğrulaması yapılmamıştır.',
      'Maç olasılıkları model çıktısıdır; doğruluk veya güven yüzdesi değildir.'
    ]};
}

export function backtest(bundle,opts={}) {
  const cutoff=time(opts.cutoff??bundle.analysisAt??bundle.target.date),limit=clamp(Math.round(opts.limit??60),1,200);
  const ordered=(bundle.matches??[]).filter(m=>eligible(m,cutoff,bundle.target.id)).sort((a,b)=>time(a.date)-time(b.date));
  // Cache only each fixture's strictly earlier history. Reusing this across later
  // evaluation cutoffs avoids repeated O(n²) scans without borrowing future data.
  const cache=new Map(),formCount=optionsFor(opts).formCount;
  for(const m of ordered) cache.set(String(m.id),{
    hp:profile(history(ordered,m.home.id,m.date,formCount,m.id)),
    ap:profile(history(ordered,m.away.id,m.date,formCount,m.id))
  });
  const rows=[],candidates=ordered.filter(m=>{
    const p=cache.get(String(m.id));return p.hp.historyCount>=3&&p.ap.historyCount>=3;
  }).slice(-limit);
  // Evaluate only fixtures where each team has three strictly earlier observations.
  for(const m of candidates) {
    const target={...m};
    const result=analyze({...bundle,target},{...opts,cutoff:m.date,skipPlayerAnalysis:true,playerScenarios:{},h2hLayer:false,trainingLayer:false,[PREMATCH_CACHE]:cache});
    if(!result.prediction)continue;
    const p=result.prediction.outcomes,truth=m.homeScore>m.awayScore?'home':m.homeScore<m.awayScore?'away':'draw';
    const predicted=Object.keys(p).sort((a,b)=>p[b]-p[a])[0];
    const logLoss=-Math.log(Math.max(1e-12,p[truth]));
    const brier=Object.keys(p).reduce((s,k)=>s+(p[k]-(k===truth?1:0))**2,0);
    const bestScore=result.prediction.topScores[0];
    const exactCorrect=bestScore.home===m.homeScore&&bestScore.away===m.awayScore;
    const scoreProbability=result.prediction.heatmap.find(c=>c.home===m.homeScore&&c.away===m.awayScore)?.probability??0;
    rows.push({id:m.id,date:m.date,home:m.home,away:m.away,score:`${m.homeScore}–${m.awayScore}`,
      truth,predicted,probabilities:p,correct:predicted===truth,logLoss,brier,
      predictedScore:`${bestScore.home}–${bestScore.away}`,exactCorrect,scoreLogLoss:-Math.log(Math.max(1e-12,scoreProbability)),
      trainingMatches:result.coverage.matchCount,neighbors:result.neighbors.length,
      homeHistory:result.homeForm.length,awayHistory:result.awayForm.length});
  }
  const selected=rows.slice(-limit),n=selected.length;
  const summary=n?{accuracy:selected.filter(r=>r.correct).length/n,logLoss:mean(selected.map(r=>r.logLoss)),
    exactScoreAccuracy:selected.filter(r=>r.exactCorrect).length/n,scoreLogLoss:mean(selected.map(r=>r.scoreLogLoss)),
    brier:mean(selected.map(r=>r.brier)),baselineLogLoss:Math.log(3),baselineBrier:2/3,
    sampleSize:n,firstDate:selected[0].date,lastDate:selected.at(-1).date}:null;
  return {rows:selected,summary,status:n?'diagnostic':'insufficient',
    note:'Zaman sıralı geçmiş kontrolü; her maç yalnızca kendi başlama saatinden önceki verilerle hesaplanır. Küçük ve seçilmiş ağ örneklemi, bağımsız doğruluk kanıtı veya kalibrasyon değildir.'};
}
