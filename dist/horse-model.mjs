// Per-runner features and the "Obsidian" blend: a conditional-logit (softmax within a race) over network rating, preferences,
// weight, official ratings, form and the pre-race AGF market. Pure.
import {distanceBucket} from './horse-rating.mjs';
import {speedProfile} from './horse-speed.mjs';
export const FEATURE_NAMES=['net','rated','kg','handicap','handicapMissing','point','surfaceAffinity','distanceAffinity','form','daysOff','speedAvg','speedBest','speedMissing','agf','apprentice','rules'];
/** Feature subsets compared in the walk-forward report; "obsidian" is the full blend. "rules" is the backtest-gated rule signal, which
 * uses the AGF order for "favourite", so it is market information and stays out of the market-free set. */
export const MODEL_SETS={
 handikap:['handicap','handicapMissing'],
 ag:['net','rated'],
 agTercih:['net','rated','surfaceAffinity','distanceAffinity','kg'],
 hiz:['speedAvg','speedBest','speedMissing'],
 // Same blends without the speed figures, to measure what they add.
 piyasasizHizsiz:FEATURE_NAMES.filter(f=>!/^speed|^agf$|^rules$/.test(f)),
 obsidianHizsiz:FEATURE_NAMES.filter(f=>!/^speed|^rules$/.test(f)),
 piyasasiz:FEATURE_NAMES.filter(f=>f!=='agf'&&f!=='rules'),
 agf:['agf'],
 obsidianKuralsiz:FEATURE_NAMES.filter(f=>f!=='rules'),
 obsidian:FEATURE_NAMES,
};
const placeScore=p=>p>0?1/p:0,PRIOR=3;
/**
 * Career preference from the horse's own previous starts on every track (program "last runs", strictly before the race date):
 * shrunk mean place score (1/place) on this surface / distance bucket minus the horse's overall mean. Positive = likes it.
 */
export function careerProfile(runs,race){
 const past=(runs||[]).filter(r=>r.date<race.date&&r.place>0).sort((a,b)=>b.date.localeCompare(a.date));
 const all=past.length?past.reduce((a,r)=>a+placeScore(r.place),0)/past.length:null,b=distanceBucket(race.distance);
 const aff=list=>{if(all===null||!list.length)return {value:0,n:list.length};const s=list.reduce((a,r)=>a+placeScore(r.place),0);return {value:(s+PRIOR*all)/(list.length+PRIOR)-all,n:list.length};};
 const surface=aff(past.filter(r=>r.surface===race.surface)),distance=aff(past.filter(r=>distanceBucket(r.distance)===b));
 const last3=past.slice(0,3);
 return {starts:past.length,overall:all,surface,distance,form:last3.length?last3.reduce((a,r)=>a+placeScore(r.place),0)/last3.length:null,lastPlaces:past.slice(0,5).map(r=>r.place)};
}
const mean=v=>v.length?v.reduce((a,x)=>a+x,0)/v.length:0;
/** Race-centred feature matrix for the runners of one race; `ratings` are engine predictions keyed by program number, `rules` the rule signals. */
export function raceFeatures(race,entries,{ratings,runsByHorse,rules=null}){
 const rs=entries.filter(e=>e.status!=='NONRUNNER'),rate=new Map(ratings.map(r=>[r.number,r]));
 const raw=rs.map(e=>{
  const r=rate.get(e.number),p=careerProfile(runsByHorse.get(e.horseId),race),sp=speedProfile(runsByHorse.get(e.horseId),race);
  const rule=rules?.get(e.number)??{score:0,rules:[]};
  return {number:e.number,horseId:e.horseId,name:e.name,profile:p,speed:sp,rating:r,rule,
   v:{net:r?r.base+r.surface+r.distance:0,rated:Math.min(r?.starts??0,10)/10,kg:e.kg>0?e.kg:null,handicap:e.handicap>0?e.handicap/10:null,handicapMissing:e.handicap>0?0:1,
    point:e.point>0?e.point/50:null,surfaceAffinity:p.surface.value,distanceAffinity:p.distance.value,form:p.form,daysOff:e.daysOff>=0?Math.log1p(e.daysOff):null,
    speedAvg:sp.avg,speedBest:sp.best,speedMissing:sp.n?0:1,
    agf:e.agf1>0?Math.log(e.agf1):null,apprentice:e.apprentice?1:0,rules:rule.score}};
 });
 // Centre each feature on the race; a missing value takes the race mean (neutral) except AGF, where a horse without a share is the weakest.
 for(const f of FEATURE_NAMES){
  const known=raw.map(x=>x.v[f]).filter(v=>v!==null&&Number.isFinite(v)),m=mean(known),floor=known.length?Math.min(...known):0;
  for(const x of raw){const v=x.v[f];x.v[f]=(v===null||!Number.isFinite(v)?(f==='agf'?floor:m):v)-m;}
 }
 return raw.map(x=>({...x,x:FEATURE_NAMES.map(f=>x.v[f])}));
}
/** Softmax probabilities for one race given weights over FEATURE_NAMES (missing weights = 0). */
export function raceProbabilities(rows,weights){
 const s=rows.map(r=>r.x.reduce((a,v,i)=>a+v*(weights[i]||0),0)),m=Math.max(...s),ex=s.map(v=>Math.exp(v-m)),z=ex.reduce((a,v)=>a+v,0);
 return ex.map(v=>v/z);
}
/**
 * Fits a conditional logit on races with a known winner by full-batch Adam on the mean winner log-likelihood with L2.
 * `races` = [{rows, winners:[number]}]; only features listed in `use` get a weight.
 */
export function fitConditionalLogit(races,use,{l2=.01,iterations=400,rate=.05}={}){
 const idx=use.map(f=>FEATURE_NAMES.indexOf(f)),w=new Array(FEATURE_NAMES.length).fill(0),m=w.slice(),v=w.slice(),data=races.filter(r=>r.rows.length>1&&r.rows.some(x=>r.winners.includes(x.number)));
 if(!data.length)return w;
 for(let t=1;t<=iterations;t++){
  const g=new Array(FEATURE_NAMES.length).fill(0);
  for(const r of data){
   const p=raceProbabilities(r.rows,w),wins=r.rows.map(x=>r.winners.includes(x.number)?1/r.winners.filter(n=>r.rows.some(y=>y.number===n)).length:0);
   for(const i of idx){let s=0;for(let k=0;k<r.rows.length;k++)s+=(wins[k]-p[k])*r.rows[k].x[i];g[i]+=s;}
  }
  for(const i of idx){const gi=g[i]/data.length-l2*w[i];m[i]=.9*m[i]+.1*gi;v[i]=.999*v[i]+.001*gi*gi;w[i]+=rate*(m[i]/(1-.9**t))/(Math.sqrt(v[i]/(1-.999**t))+1e-8);}
 }
 return w;
}
/**
 * Out-of-sample metrics for probability forecasts. ROI uses a 1 TL win stake at the official final ganyan (equal to the paid dividend):
 * "top" bets the most likely horse in every race; "value" bets every horse whose probability × final ganyan ≥ `edge`.
 */
export function scoreForecasts(items,{edge=1.2}={}){
 let n=0,top1=0,top3=0,ll=0,llUniform=0,topStake=0,topRet=0,valStake=0,valRet=0;
 for(const {probs,rows,winners} of items){
  if(!winners?.length||!rows.length)continue;const win=new Set(winners);n++;
  const order=rows.map((r,i)=>i).sort((a,b)=>probs[b]-probs[a]),pw=rows.reduce((a,r,i)=>a+(win.has(r.number)?probs[i]:0),0);
  top1+=win.has(rows[order[0]].number);top3+=order.slice(0,3).some(i=>win.has(rows[i].number));ll+=-Math.log(Math.max(pw,1e-9));llUniform+=Math.log(rows.length);
  const odds=i=>rows[i].odds;
  if(odds(order[0])>0){topStake++;topRet+=win.has(rows[order[0]].number)?odds(order[0]):0;}
  rows.forEach((r,i)=>{if(odds(i)>0&&probs[i]*odds(i)>=edge){valStake++;valRet+=win.has(r.number)?odds(i):0;}});
 }
 return {races:n,top1:n?top1/n:null,top3:n?top3/n:null,logLoss:n?ll/n:null,uniformLogLoss:n?llUniform/n:null,
  topRoi:topStake?topRet/topStake-1:null,valueBets:valStake,valueRoi:valStake?valRet/valStake-1:null};
}
