// Per-runner features and the "Obsidian" blend: a conditional-logit (softmax within a race) over network rating, preferences,
// weight, official ratings, form and the pre-race AGF market. Pure.
import {distanceBucket} from './horse-rating.mjs';
import {speedProfile} from './horse-speed.mjs';
export const FEATURE_NAMES=['net','rated','kg','handicap','handicapMissing','point','surfaceAffinity','distanceAffinity','form','daysOff','speedAvg','speedBest','speedMissing','agf','apprentice','jockey','trainer','distanceChange','agfOpen','netOpen','rules','gallopBest','gallopAvg','gallopCount','gallopDays','gallopMissing','jockeyEdge','jockeyBreed','surfaceWin','surfaceTop3','surfaceStarts','surfaceGap','surfaceSwitch','switchAffinity','sireSurface'];
/** Features added with the surprise study: jockey / trainer form, distance change since the last run, and the market and network
 * signals again inside surprise-prone races (handicaps and fields of 11+), where the weight can differ. */
export const CONNECTION_FEATURES=['jockey','trainer','distanceChange','agfOpen','netOpen'];
/** Jockey edge over the AGF share of the mount, overall and per breed (relative to the overall edge). */
export const JOCKEY_FEATURES=['jockeyEdge','jockeyBreed'];
/** Career record on the race surface (win / top-3 rate against the horse's own, starts there, gap to its best other surface), a
 * surface switch since the last start (alone and times the surface preference) and the sire's offspring preference for the surface. */
export const SURFACE_FEATURES=['surfaceWin','surfaceTop3','surfaceStarts','surfaceGap','surfaceSwitch','switchAffinity','sireSurface'];
/** Workout (galop) features: best and recent score against par, workouts in the last 45 days, days since the last one. */
export const GALLOP_FEATURES=['gallopBest','gallopAvg','gallopCount','gallopDays','gallopMissing'];
/** Handicaps and big fields: the races where the favourite loses most often. */
export const surpriseProne=(race,field)=>race.family==='HAND'||field>=11;
/** Feature subsets compared in the walk-forward report; "obsidian" is the full blend. "rules" is the backtest-gated rule signal, which
 * uses the AGF order for "favourite", so it is market information and stays out of the market-free set. */
export const MODEL_SETS={
 handikap:['handicap','handicapMissing'],
 ag:['net','rated'],
 agTercih:['net','rated','surfaceAffinity','distanceAffinity','kg'],
 hiz:['speedAvg','speedBest','speedMissing'],
 // Same blends without the speed figures, to measure what they add.
 piyasasizHizsiz:FEATURE_NAMES.filter(f=>!/^speed|^agf|^rules$/.test(f)),
 obsidianHizsiz:FEATURE_NAMES.filter(f=>!/^speed|^rules$/.test(f)),
 piyasasiz:FEATURE_NAMES.filter(f=>!/^agf|^rules$/.test(f)),
 agf:['agf'],
 obsidianKuralsiz:FEATURE_NAMES.filter(f=>f!=='rules'),
 obsidianEski:FEATURE_NAMES.filter(f=>f!=='rules'&&!CONNECTION_FEATURES.includes(f)&&!GALLOP_FEATURES.includes(f)&&!JOCKEY_FEATURES.includes(f)&&!SURFACE_FEATURES.includes(f)),
 obsidianPistsiz:FEATURE_NAMES.filter(f=>!SURFACE_FEATURES.includes(f)),
 obsidianJokeysiz:FEATURE_NAMES.filter(f=>!JOCKEY_FEATURES.includes(f)),
 obsidianGalopsuz:FEATURE_NAMES.filter(f=>!GALLOP_FEATURES.includes(f)),
 obsidian:FEATURE_NAMES,
};
/** Fewer past starts than this: too little to know the horse from, shown as "az veri" on the card. Display only, not a model input. */
export const thinData=starts=>starts<3;
const placeScore=p=>p>0?1/p:0,PRIOR=3;
/** DIRT (kum), TURF (çim) or AWT (sentetik, Tapeta included). */
export const surfaceGroup=s=>s==='TAPETA'?'AWT':s==='DIRT'||s==='TURF'||s==='AWT'?s:null;
/**
 * Career preference from the horse's own previous starts on every track (program "last runs", strictly before the race date):
 * shrunk mean place score (1/place) on this surface / distance bucket minus the horse's overall mean. Positive = likes it.
 */
export function careerProfile(runs,race){
 const past=(runs||[]).filter(r=>r.date<race.date&&r.place>0).sort((a,b)=>b.date.localeCompare(a.date));
 const all=past.length?past.reduce((a,r)=>a+placeScore(r.place),0)/past.length:null,b=distanceBucket(race.distance);
 const aff=list=>{if(all===null||!list.length)return {value:0,n:list.length};const s=list.reduce((a,r)=>a+placeScore(r.place),0);return {value:(s+PRIOR*all)/(list.length+PRIOR)-all,n:list.length};};
 const surface=aff(past.filter(r=>r.surface===race.surface)),distance=aff(past.filter(r=>distanceBucket(r.distance)===b));
 const last3=past.slice(0,3),top3At=past.findIndex(r=>r.place<=3);
 // Record per surface (Tapeta counted as synthetic with AWT).
 const surfaces={};for(const r of past){const s=surfaceGroup(r.surface);if(!s)continue;const o=surfaces[s]??={starts:0,wins:0,top3:0,score:0};o.starts++;o.wins+=r.place===1;o.top3+=r.place<=3;o.score+=placeScore(r.place);}
 // On the race surface: win and top-3 rates shrunk (3 starts) to the horse's own overall rates, minus those rates; the gap from
 // its best other surface (2+ starts, mean place score); whether its last start was on another surface.
 const here=surfaceGroup(race.surface),on=surfaces[here]??{starts:0,wins:0,top3:0,score:0},n=past.length;
 const rel=(k,all)=>(k+3*all)/(on.starts+3)-all,others=Object.entries(surfaces).filter(([s,o])=>s!==here&&o.starts>=2).map(([,o])=>o.score/o.starts);
 const surfaceRecord={win:n?rel(on.wins,past.filter(r=>r.place===1).length/n):null,top3:n?rel(on.top3,past.filter(r=>r.place<=3).length/n):null,starts:on.starts,
  gap:others.length&&on.starts?Math.max(...others)-on.score/on.starts:null,switched:n&&here?(surfaceGroup(past[0].surface)!==here?1:0):0};
 // Starts since the last top-three finish (all starts when it never had one).
 return {starts:past.length,sinceTop3:top3At<0?past.length:top3At,everTop3:top3At>=0,overall:all,surface,distance,surfaces:Object.fromEntries(Object.entries(surfaces).map(([s,{score,...o}])=>[s,o])),surfaceRecord,lastDistance:past[0]?.distance??null,form:last3.length?last3.reduce((a,r)=>a+placeScore(r.place),0)/last3.length:null,lastPlaces:past.slice(0,5).map(r=>r.place)};
}
const mean=v=>v.length?v.reduce((a,x)=>a+x,0)/v.length:0;
/** Race-centred feature matrix for the runners of one race; `ratings` are engine predictions keyed by program number, `rules` the rule signals. */
export function raceFeatures(race,entries,{ratings,runsByHorse,rules=null,connections=null,pedigree=null}){
 const rs=entries.filter(e=>e.status!=='NONRUNNER'),rate=new Map(ratings.map(r=>[r.number,r])),open=surpriseProne(race,rs.length)?1:0;
 const raw=rs.map(e=>{
  const r=rate.get(e.number),p=careerProfile(runsByHorse.get(e.horseId),race),sp=speedProfile(runsByHorse.get(e.horseId),race);
  const rule=rules?.get(e.number)??{score:0,rules:[]},cn=connections?.get(race,e)??{jockey:0,trainer:0,jockeyEdge:0,jockeyBreed:0},lastRun=p.lastDistance,gp=e.gallop;
  return {number:e.number,horseId:e.horseId,name:e.name,profile:p,speed:sp,rating:r,rule,
   v:{net:r?r.base+r.surface+r.distance:0,rated:Math.min(r?.starts??0,10)/10,kg:e.kg>0?e.kg:null,handicap:e.handicap>0?e.handicap/10:null,handicapMissing:e.handicap>0?0:1,
    point:e.point>0?e.point/50:null,surfaceAffinity:p.surface.value,distanceAffinity:p.distance.value,form:p.form,daysOff:e.daysOff>=0?Math.log1p(e.daysOff):null,
    speedAvg:sp.avg,speedBest:sp.best,speedMissing:sp.n?0:1,
    agf:e.agf1>0?Math.log(e.agf1):null,apprentice:e.apprentice?1:0,jockey:cn.jockey,trainer:cn.trainer,
    distanceChange:lastRun>0?Math.log(race.distance/lastRun):null,agfOpen:null,netOpen:null,rules:rule.score,
    gallopBest:gp?.best!=null?gp.best/5:null,gallopAvg:gp?.avg!=null?gp.avg/5:null,gallopCount:gp?Math.log1p(gp.n):null,gallopDays:gp?.days!=null?Math.log1p(gp.days):null,gallopMissing:gp?.scored?0:1,jockeyEdge:cn.jockeyEdge,jockeyBreed:cn.jockeyBreed,
    surfaceWin:p.surfaceRecord.win,surfaceTop3:p.surfaceRecord.top3,surfaceStarts:Math.log1p(p.surfaceRecord.starts),surfaceGap:p.surfaceRecord.gap,
    surfaceSwitch:p.surfaceRecord.switched,switchAffinity:p.surfaceRecord.switched*p.surface.value,sireSurface:pedigree?.get(race.date,e.sire,race.surface)??0}};
 });
 // Centre each feature on the race; a missing value takes the race mean (neutral) except AGF, where a horse without a share is the weakest.
 for(const f of FEATURE_NAMES.filter(f=>!f.endsWith('Open'))){
  const known=raw.map(x=>x.v[f]).filter(v=>v!==null&&Number.isFinite(v)),m=mean(known),floor=known.length?Math.min(...known):0;
  for(const x of raw){const v=x.v[f];x.v[f]=(v===null||!Number.isFinite(v)?(f==='agf'?floor:m):v)-m;}
 }
 // The race-centred market and network signals once more in surprise-prone races (zero elsewhere).
 for(const x of raw){x.v.agfOpen=open*x.v.agf;x.v.netOpen=open*x.v.net;}
 return raw.map(x=>({...x,open,x:FEATURE_NAMES.map(f=>x.v[f])}));
}
/** Softmax probabilities for one race given weights over FEATURE_NAMES (missing weights = 0). */
export function raceProbabilities(rows,weights){
 const s=rows.map(r=>r.x.reduce((a,v,i)=>a+v*(weights[i]||0),0)),m=Math.max(...s),ex=s.map(v=>Math.exp(v-m)),z=ex.reduce((a,v)=>a+v,0);
 return ex.map(v=>v/z);
}
/**
 * Fits a conditional logit on races with a known winner by full-batch Adam on the mean winner log-likelihood with L2.
 * `races` = [{rows, winners:[number]}]; only features listed in `use` get a weight.
 * With `scale`, the L2 penalty applies to weights per standard deviation of each (race-centred) feature, so a feature on a narrow
 * scale (a place-score difference) is not shrunk harder than one on a wide scale; the returned weights are in raw feature units.
 * Rows go into flat typed arrays up front and each pass touches only the features in `use`: 4–12× faster than walking the row objects.
 */
export function fitConditionalLogit(races,use,{l2=.01,iterations=400,rate=.05,scale=true}={}){
 const idx=use.map(f=>FEATURE_NAMES.indexOf(f)),K=idx.length,out=new Array(FEATURE_NAMES.length).fill(0),data=races.filter(r=>r.rows.length>1&&r.rows.some(x=>r.winners.includes(x.number)));
 if(!data.length)return out;
 let N=0,field=0;for(const r of data){N+=r.rows.length;field=Math.max(field,r.rows.length);}
 // X: one row per runner, K columns. Y: the runner's share of the win (dead heats split it). start: first row of each race.
 const X=new Float64Array(N*K),Y=new Float64Array(N),start=new Int32Array(data.length+1);let row=0;
 data.forEach((r,ri)=>{start[ri]=row;const winners=r.winners.filter(n=>r.rows.some(y=>y.number===n)).length;for(const x of r.rows){for(let k=0;k<K;k++)X[row*K+k]=x.x[idx[k]];Y[row]=r.winners.includes(x.number)?1/winners:0;row++;}});
 start[data.length]=row;
 const sd=new Float64Array(K).fill(1);
 if(scale)for(let k=0;k<K;k++){let s=0;for(let i=0;i<N;i++)s+=X[i*K+k]**2;sd[k]=Math.sqrt(s/N)||1;}
 const w=new Float64Array(K),u=new Float64Array(K),m=new Float64Array(K),v=new Float64Array(K),g=new Float64Array(K),ex=new Float64Array(field);
 for(let t=1;t<=iterations;t++){
  g.fill(0);
  for(let ri=0;ri<data.length;ri++){
   const a=start[ri],b=start[ri+1];let top=-Infinity,z=0;
   for(let i=a;i<b;i++){let s=0;const at=i*K;for(let k=0;k<K;k++)s+=X[at+k]*w[k];ex[i-a]=s;if(s>top)top=s;}
   for(let i=a;i<b;i++){const e=Math.exp(ex[i-a]-top);ex[i-a]=e;z+=e;}
   for(let i=a;i<b;i++){const d=Y[i]-ex[i-a]/z,at=i*K;for(let k=0;k<K;k++)g[k]+=d*X[at+k];}
  }
  // Adam on the scaled weight u = w·sd (gradient g/sd), then back to raw units.
  const c1=1-.9**t,c2=1-.999**t;
  for(let k=0;k<K;k++){const gi=g[k]/data.length/sd[k]-l2*u[k];m[k]=.9*m[k]+.1*gi;v[k]=.999*v[k]+.001*gi*gi;u[k]+=rate*(m[k]/c1)/(Math.sqrt(v[k]/c2)+1e-8);w[k]=u[k]/sd[k];}
 }
 for(let k=0;k<K;k++)out[idx[k]]=w[k];
 return out;
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
