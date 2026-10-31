import {prepareOutcomeRows,countNll,evaluate} from './outcome-training.mjs';
import {graphRow,GRAPH_OUTCOME_FEATURE_NAMES} from './player-graph-training.mjs';
import {STARTER_FEATURE_NAMES} from './starter-features.mjs';
import {MARKET_FEATURE_NAMES} from './market-model.mjs';
import {MARKET_NETWORK_FEATURE_NAMES} from './market-network.mjs';
import {SEASON_FEATURE_NAMES} from './season-features.mjs';
import {MATCHUP_FEATURE_NAMES,matchupVector,neutralMatchup} from './matchup-features.mjs';
import {PI_FEATURE_NAMES} from './pi-ratings.mjs';
export const BASE_GBDT_FEATURE_NAMES=Object.freeze([...GRAPH_OUTCOME_FEATURE_NAMES,...STARTER_FEATURE_NAMES,...MARKET_FEATURE_NAMES]);
export const GBDT_FEATURE_NAMES=Object.freeze([...BASE_GBDT_FEATURE_NAMES,...MARKET_NETWORK_FEATURE_NAMES.map(n=>'marketNetwork.'+n)]);
export const SEASON_GBDT_FEATURE_NAMES=Object.freeze([...GBDT_FEATURE_NAMES,...SEASON_FEATURE_NAMES]);
export const MATCHUP_GBDT_FEATURE_NAMES=Object.freeze([...SEASON_GBDT_FEATURE_NAMES,...MATCHUP_FEATURE_NAMES]);
export const PI_GBDT_FEATURE_NAMES=Object.freeze([...SEASON_GBDT_FEATURE_NAMES,...PI_FEATURE_NAMES]);
/** Confidence thresholds reported for the 1X2 pick (maximum of home / draw / away probability). */
export const CONFIDENCE_THRESHOLDS=Object.freeze([.45,.5,.55,.6,.65,.7,.75,.8]);
export const CONFIDENCE_POLICY=Object.freeze({targetAccuracy:.8,minimumValidationMatches:20,note:'Eşik yalnız ayar doğrulamasında seçilir; ayrı test yalnız raporlanır.'});
const clamp=v=>Math.max(-Math.log(2),Math.min(Math.log(2),v));
const valid=v=>Array.isArray(v)&&v.length===STARTER_FEATURE_NAMES.length&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=3);
const neutral=()=>STARTER_FEATURE_NAMES.map(n=>n.endsWith('.missing')||n==='xi.historyFraction'?n==='xi.historyFraction'?0:1:n.endsWith('.position')?-1:0);
export function gbdtRow(row,{networkLayer=true,seasonLayer=false,matchupLayer=false,piLayer=false}={}){
 if(!row||typeof row!=='object')return row;
 const base=graphRow(row),t=Date.parse(row.starterFeatureMaxAvailableAt),temporal=Number.isFinite(t)&&t<Date.parse(row.date);
 const mt=Date.parse(row.marketFeatureMaxAvailableAt),marketTime=Number.isFinite(mt)&&mt<Date.parse(row.date),marketValid=v=>Array.isArray(v)&&v.length===MARKET_FEATURE_NAMES.length&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=3);
 const nt=Date.parse(row.marketNetworkFeatureMaxAvailableAt),networkTime=Number.isFinite(nt)&&nt<Date.parse(row.date),networkValid=v=>Array.isArray(v)&&v.length===MARKET_NETWORK_FEATURE_NAMES.length&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=3);
 const networkNeutral=()=>MARKET_NETWORK_FEATURE_NAMES.map(n=>n==='missingFraction'?1:0);
 const networkUsable=networkLayer&&networkTime&&networkValid(row.homeMarketNetworkFeatures)&&networkValid(row.awayMarketNetworkFeatures)&&row.marketNetworkCoverage?.status==='ready';
 const st=Date.parse(row.seasonFeatureMaxAvailableAt),seasonTime=Number.isFinite(st)&&st<Date.parse(row.date),seasonValid=v=>Array.isArray(v)&&v.length===SEASON_FEATURE_NAMES.length&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=3);
 const seasonNeutral=()=>SEASON_FEATURE_NAMES.map(n=>n.endsWith('missingFraction')?1:0);
 const matchupUsable=matchupLayer&&temporal&&valid(row.homeStarterFeatures)&&valid(row.awayStarterFeatures);
 const pt=Date.parse(row.piFeatureMaxAvailableAt),piTime=!row.piFeatureMaxAvailableAt||Number.isFinite(pt)&&pt<Date.parse(row.date),piValid=v=>Array.isArray(v)&&v.length===PI_FEATURE_NAMES.length&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=3);
 const piNeutral=()=>PI_FEATURE_NAMES.map(n=>n.endsWith('missingFraction')?1:0),piUsable=piLayer&&piTime&&piValid(row.homePiFeatures)&&piValid(row.awayPiFeatures)&&row.piCoverage?.status==='ready';
 const seasonUsable=seasonLayer&&seasonTime&&seasonValid(row.homeSeasonFeatures)&&seasonValid(row.awaySeasonFeatures)&&row.seasonCoverage?.status==='ready';
 const extra=side=>[...(temporal&&valid(row[side+'StarterFeatures'])?row[side+'StarterFeatures']:neutral()),...(marketTime&&marketValid(row[side+'MarketFeatures'])?row[side+'MarketFeatures']:Array(MARKET_FEATURE_NAMES.length).fill(0)),
  ...(networkLayer?(networkTime&&networkValid(row[side+'MarketNetworkFeatures'])?row[side+'MarketNetworkFeatures']:networkNeutral()):[]),
  ...(seasonLayer?(seasonTime&&seasonValid(row[side+'SeasonFeatures'])?row[side+'SeasonFeatures']:seasonNeutral()):[]),
  ...(matchupLayer?(matchupUsable?matchupVector(row[side+'StarterFeatures'],row[(side==='home'?'away':'home')+'StarterFeatures']):neutralMatchup()):[]),
  ...(piLayer?(piTime&&piValid(row[side+'PiFeatures'])?row[side+'PiFeatures']:piNeutral()):[])];
 return {...base,homeFeatures:Array.isArray(base.homeFeatures)?[...base.homeFeatures,...extra('home')]:null,
  awayFeatures:Array.isArray(base.awayFeatures)?[...base.awayFeatures,...extra('away')]:null,
  marketNetworkUsable:networkUsable,seasonUsable,matchupUsable,piUsable,
  featureMaxAvailableAt:Number.isFinite(Date.parse(base.featureMaxAvailableAt))?new Date(Math.max(Date.parse(base.featureMaxAvailableAt),temporal?t:-Infinity,marketTime?mt:-Infinity,networkLayer&&networkTime?nt:-Infinity,seasonLayer&&seasonTime?st:-Infinity,piLayer&&piTime&&Number.isFinite(pt)?pt:-Infinity)).toISOString():base.featureMaxAvailableAt};
}
export function treeValue(node,x){while(node.feature!=null)node=x[node.feature]<=node.threshold?node.left:node.right;return node.value;}
export function predictGbdt(model,base,x){return base*Math.exp(clamp(model.trees.reduce((s,t)=>s+model.learningRate*treeValue(t,x),0)));}
function binsFor(obs,dimensions){return Array.from({length:dimensions},(_,j)=>{
 const values=[...new Set(obs.map(o=>o.x[j]))].sort((a,b)=>a-b);if(values.length<2)return [];
 const thresholds=[];for(let k=1;k<=16;k++){const i=Math.min(values.length-2,Math.floor(k*values.length/17));const t=(values[i]+values[i+1])/2;if(thresholds.at(-1)!==t)thresholds.push(t);}return thresholds;
});}
function fit(rows,params,{validation=null,maxTrees=64}={}){
 const obs=rows.flatMap(r=>[{base:r.homeBase,x:r.homeFeatures,y:r.homeScore},{base:r.awayBase,x:r.awayFeatures,y:r.awayScore}]);
 const dimensions=obs[0].x.length,bins=binsFor(obs,dimensions),binned=Array.from({length:dimensions},(_,j)=>Uint8Array.from(obs.map(o=>{
  let b=0;while(b<bins[j].length&&o.x[j]>bins[j][b])b++;return b;
 }))),eta=new Float64Array(obs.length),gradient=new Float64Array(obs.length),hessian=new Float64Array(obs.length);
 const model={kind:'poisson-gbdt',learningRate:params.learningRate,trees:[]},importance=Array(dimensions).fill(0),checkpoints=[];
 let bestLoss=Infinity,bestCount=0;
 function grow(ids,depth){
  let g=0,h=0;for(const i of ids){g+=gradient[i];h+=hessian[i];}
  const leaf={value:Math.max(-1,Math.min(1,-g/(h+params.lambda)))};
  if(depth>=params.depth||ids.length<2*params.minLeaf)return leaf;
  let best=null,bestGain=.01;
  for(let j=0;j<dimensions;j++){
   if(!bins[j].length)continue;const n=bins[j].length+1,gs=new Float64Array(n),hs=new Float64Array(n),ns=new Uint32Array(n),bj=binned[j];
   for(const i of ids){const b=bj[i];gs[b]+=gradient[i];hs[b]+=hessian[i];ns[b]++;}
   let gl=0,hl=0,nl=0;for(let b=0;b<n-1;b++){
    gl+=gs[b];hl+=hs[b];nl+=ns[b];if(nl<params.minLeaf||ids.length-nl<params.minLeaf)continue;
    const gain=.5*(gl*gl/(hl+params.lambda)+(g-gl)**2/(h-hl+params.lambda)-g*g/(h+params.lambda));
    if(gain>bestGain){bestGain=gain;best={j,b,threshold:bins[j][b]};}
   }
  }
  if(!best)return leaf;const left=[],right=[];for(const i of ids)(binned[best.j][i]<=best.b?left:right).push(i);
  importance[best.j]+=bestGain;return {feature:best.j,threshold:best.threshold,gain:bestGain,left:grow(left,depth+1),right:grow(right,depth+1)};
 }
 for(let iteration=1;iteration<=maxTrees;iteration++){
  for(let i=0;i<obs.length;i++){const mu=obs[i].base*Math.exp(clamp(eta[i]));gradient[i]=mu-obs[i].y;hessian[i]=mu;}
  const tree=grow(Array.from({length:obs.length},(_,i)=>i),0);model.trees.push(tree);
  for(let i=0;i<obs.length;i++)eta[i]+=model.learningRate*treeValue(tree,obs[i].x);
  if(validation&&(iteration%8===0||iteration===maxTrees)){
   const loss=paired(validation,model,null);checkpoints.push({treeCount:iteration,validationNll:loss});
   if(loss<bestLoss-1e-8){bestLoss=loss;bestCount=iteration;}
   if(iteration-bestCount>=24)break;
  }
 }
 if(validation)model.trees=model.trees.slice(0,bestCount);
 // Recompute importance for the retained trees only.
 importance.fill(0);const visit=n=>{if(n.feature!=null){importance[n.feature]+=n.gain;visit(n.left);visit(n.right);}};model.trees.forEach(visit);
 return {...model,importance,checkpoints};
}
const paired=(rows,model,shape)=>rows.reduce((s,r)=>s+countNll(r.homeScore,predictGbdt(model,r.homeBase,r.homeFeatures),shape)+countNll(r.awayScore,predictGbdt(model,r.awayBase,r.awayFeatures),shape),0)/rows.length;
export function trainGbdtModel(inputRows,options={}){
 const piLayer=options.piLayer===true,matchupLayer=!piLayer&&options.matchupLayer===true,seasonLayer=piLayer||matchupLayer||options.seasonLayer===true,networkLayer=seasonLayer||options.networkLayer!==false,featureNames=piLayer?PI_GBDT_FEATURE_NAMES:matchupLayer?MATCHUP_GBDT_FEATURE_NAMES:seasonLayer?SEASON_GBDT_FEATURE_NAMES:networkLayer?GBDT_FEATURE_NAMES:BASE_GBDT_FEATURE_NAMES;
 const prepared=prepareOutcomeRows((inputRows??[]).map(r=>gbdtRow(r,{networkLayer,seasonLayer,matchupLayer,piLayer})),{...options,featureNames});
 const {rows,split,scope,counts,ranges}=prepared;
 const result={kind:'poisson-gbdt',version:piLayer?'poisson-gbdt-pi-v6':matchupLayer?'poisson-gbdt-matchup-v5':seasonLayer?'poisson-gbdt-season-v4':networkLayer?'poisson-gbdt-market-network-v3':'poisson-gbdt-xi-markets-v2',accepted:false,status:'insufficient',featureNames:[...featureNames],
  scope,counts,ranges,cutoff:options.cutoff,trees:[],learningRate:.08,shape:null,report:null,
  training:{method:'histogram-newton-poisson-GBDT-log-offset',factorBounds:[.5,2],finalRefitCount:0,networkLayer,networkCoveredTrain:split.train.filter(r=>r.marketNetworkUsable).length,seasonLayer,seasonCoveredTrain:split.train.filter(r=>r.seasonUsable).length,matchupLayer,matchupCoveredTrain:split.train.filter(r=>r.matchupUsable).length,piLayer,piCoveredTrain:split.train.filter(r=>r.piUsable).length}};
 if(rows.length<120||split.train.length<70||split.validation.length<15||split.test.length<15){result.reason='GBDT için yeterli zaman sıralı eğitim / doğrulama / test maçı yok.';return result;}
 const configs=[{depth:2,minLeaf:30,lambda:10,learningRate:.08},{depth:2,minLeaf:60,lambda:30,learningRate:.08},{depth:3,minLeaf:40,lambda:30,learningRate:.05}];
 const candidates=configs.map(params=>{const model=fit(split.train,params,{validation:split.validation});return {params,model,nll:paired(split.validation,model,null)};});
 let selected=candidates[0];for(const c of candidates)if(c.nll<selected.nll-1e-8)selected=c;
 const shapes=[null,2,5,10,30,100].map(shape=>({shape,nll:paired(split.validation,selected.model,shape)}));
 let bestShape=shapes[0];for(const s of shapes)if(s.nll<bestShape.nll-1e-8)bestShape=s;
 const zeros=Array(featureNames.length).fill(0),raw=evaluate(split.validation,zeros,null);
 const accepted=bestShape.nll<raw.pairedCountNll-1e-6;
 const locked=selected.model,shape=bestShape.shape,predict=(base,x)=>predictGbdt(locked,base,x);
 result.accepted=accepted;result.status=accepted?'trained':'baseline-retained';result.shape=accepted?shape:null;result.learningRate=selected.params.learningRate;
 result.reason=accepted?'İlk 11 ve rakip ağı girdileriyle GBDT eğitildi; doğrulama skor kaybı ham tabana göre azaldı.':'GBDT doğrulamada ham tabanı iyileştirmedi; gol tabanı korundu.';
 result.report={type:'internal-chronological-out-of-sample',splitFractions:[.7,.15,.15],selectionMetric:'mean-paired-count-negative-log-likelihood',testUsedForSelection:false,
  validation:{baseline:raw,selected:evaluate(split.validation,zeros,accepted?shape:null,accepted?predict:null)},
  test:{baseline:evaluate(split.test,zeros,null),selected:evaluate(split.test,zeros,accepted?shape:null,accepted?predict:null)},
  selection:{params:selected.params,treeCount:locked.trees.length,shape,selectedValidationNll:bestShape.nll,
   candidates:candidates.map(c=>({params:c.params,treeCount:c.model.trees.length,validationPoissonNll:c.nll,checkpoints:c.model.checkpoints})),shapeCandidates:shapes},
  lockedTrees:locked.trees,lockedShape:shape,note:'Eşikler ve ağaçlar yalnız eğitimde kurulur. Derinlik, ağaç sayısı ve dağılım yalnız doğrulamada seçilir. Ayrı test seçimde kullanılmaz.'};
 if(accepted){const final=fit(rows,selected.params,{maxTrees:locked.trees.length});result.trees=final.trees;
  const sum=final.importance.reduce((s,v)=>s+v,0);result.featureImportance=final.importance.map((gain,i)=>({feature:featureNames[i],gain,fraction:sum?gain/sum:0})).filter(x=>x.gain>0).sort((a,b)=>b.gain-a.gain);
  result.training={...result.training,...selected.params,treeCount:final.trees.length,binCount:16,finalRefitCount:rows.length,finalRefitIncludesTest:true,finalRefitRange:ranges.eligible};}
 return result;
}
export function selectGbdtModel(candidate,reference,{mode='auto',starters=null}={}){
 const before=reference.report?.validation.selected,after=candidate.report?.validation.selected;
 const aligned=JSON.stringify(reference.ranges)===JSON.stringify(candidate.ranges);
 const gain=before&&after?before.pairedCountNll-after.pairedCountNll:null;
 const validated=!!(candidate.accepted&&aligned&&gain>=.003&&after.exactScoreAccuracy+1e-12>=before.exactScoreAccuracy);
 const active=!!(candidate.accepted&&(mode==='gbdt'||mode==='auto'&&validated));
 const chosen=active?candidate:reference;
 const reason=mode==='baseline'||mode==='graph'?'GBDT kapalı; seçilen takım / oyuncu ağı modeli kullanılıyor.':active?(validated?'GBDT, doğrulamada mevcut modeli iyileştirdi; tam skor isabeti düşmedi.':'GBDT kullanıcı seçimiyle etkin; mevcut modele üstünlüğü otomatik seçim eşiğini karşılamadı.'):
  candidate.accepted?'GBDT karşılaştırması mevcut modeli değiştirme eşiğini aşmadı.':'GBDT için iyileşme / eğitim kapsamı yetersiz; mevcut model korundu.';
 return {...chosen,gbdt:{active,validated,experimental:active&&!validated,mode,reason,alignedCohorts:aligned,validationNllGain:gain,
  testUsedForSelection:false,comparison:{validation:{reference:before??null,gbdt:after??null},test:{reference:reference.report?.test.selected??null,gbdt:candidate.report?.test.selected??null}},
  featureCount:candidate.featureNames.length,featureImportance:candidate.featureImportance??[],treeCount:candidate.trees.length,parameters:candidate.training,
  starters,policy:'Zaman sıralı doğrulamada en az 0,003 skor kaybı kazancı ve tam skor isabetinde düşüş olmaması; test model seçmez.'}};
}
