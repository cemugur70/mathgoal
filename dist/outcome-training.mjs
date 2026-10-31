// Historical outcome training. No ambient state, randomness, network or target-result access.
export const OUTCOME_FEATURE_NAMES=Object.freeze(['intercept','homeIndicator','logBase','finishingLogRatio',
  'opponentConcedingLogRatio','pointsDifference','shotsLogRatio','sotLogRatio','historyFraction','missingFraction']);
const D=OUTCOME_FEATURE_NAMES.length;
const LOG_FACTOR_BOUND=Math.log(2);
const RIDGES=[.01,.1,1,10],SHAPES=[null,2,5,10,30,100];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const timestamp=x=>typeof x==='number'?x:Date.parse(x);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const zero=(length=D)=>Array(length).fill(0);
const featureVector=(x,length=D)=>Array.isArray(x)&&x.length===length&&x.every(v=>finite(v)&&Math.abs(v)<=3);
const softMean=x=>finite(x)&&x>=0?x:null;

/** Fixed, bounded inputs computed exclusively from a pre-match model result. */
export function outcomeFeatures(profiles,network,side,rawMean){
  const own=profiles?.[side]??{},opp=profiles?.[side==='home'?'away':'home']??{};
  let missing=0,total=0;
  const observed=v=>{total++;const n=softMean(v);if(n===null)missing++;return n;};
  const gf=observed(own.gf),ga=observed(opp.ga),xg=observed(own.xg),xga=observed(opp.xga);
  const points=observed(own.points),oppPoints=observed(opp.points),shots=observed(own.shots),oppShots=observed(opp.shots);
  const sot=observed(own.shotsOnTarget),oppSot=observed(opp.shotsOnTarget),history=observed(own.historyCount);
  const ratio=(a,b)=>a===null||b===null?0:clamp(Math.log((a+.5)/(b+.5)),-2,2);
  // Missing xG ratios contribute neutrally; missingFraction preserves the distinction
  // from observed equality. No missing measurement is presented as an actual zero.
  return [1,side==='home'?1:0,finite(rawMean)&&rawMean>0?clamp(Math.log(rawMean),-2,2):0,
    ratio(gf,xg),ratio(ga,xga),points===null||oppPoints===null?0:clamp((points-oppPoints)/3,-1,1),
    ratio(shots,oppShots),ratio(sot,oppSot),history===null?0:clamp(history/10,0,1),total?missing/total:1];
}

// Lanczos log-gamma supports Poisson and negative-binomial likelihoods directly,
// without underflow from multiplying tiny score probabilities.
function logGamma(z){
  const p=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,
    12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
  z-=1;let x=.99999999999980993;for(let i=0;i<p.length;i++)x+=p[i]/(z+i+1);
  const t=z+p.length-.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
}
export function countNll(y,mean,shape=null){
  if(mean===0)return y===0?0:Infinity;
  if(shape===null)return mean-y*Math.log(mean)+logGamma(y+1);
  return -logGamma(y+shape)+logGamma(shape)+logGamma(y+1)-shape*Math.log(shape/(shape+mean))-y*Math.log(mean/(shape+mean));
}

/** Exact P(goals=k), k=0..max; unretained upper-tail mass is NOT renormalized. */
export function goalProbabilities(mean,max,shape=null){
  if(!finite(mean)||mean<0||!Number.isInteger(max)||max<0||max>2000||
    (shape!==null&&(!finite(shape)||shape<=0)))throw new Error('Geçerli ortalama, üst gol sınırı ve dağılım şekli gerekli.');
  const out=Array(max+1).fill(0);if(mean===0){out[0]=1;return out;}
  // Log evaluation also works when P(0) is too small for recurrence arithmetic.
  for(let y=0;y<=max;y++)out[y]=Math.exp(-countNll(y,mean,shape));
  return out;
}

function corrected(base,features,beta){return base*Math.exp(clamp(dot(features,beta),-LOG_FACTOR_BOUND,LOG_FACTOR_BOUND));}
export function applyOutcomeModel(model,{homeBase,awayBase,homeFeatures,awayFeatures}){
  if(![homeBase,awayBase].every(v=>finite(v)&&v>=0))throw new Error('Geçerli taban gol ortalamaları gerekli.');
  const size=model?.featureNames?.length??D;
  const tree=model?.kind==='poisson-gbdt'&&Array.isArray(model.trees)&&finite(model.learningRate);
  const usable=model?.accepted===true&&size>=1&&size<=512&&(tree||Array.isArray(model.coefficients)&&model.coefficients.length===size&&model.coefficients.every(finite))&&featureVector(homeFeatures,size)&&featureVector(awayFeatures,size);
  const factor=x=>{if(!tree)return dot(x,model.coefficients);let sum=0;for(let node of model.trees){while(node.feature!=null)node=x[node.feature]<=node.threshold?node.left:node.right;sum+=model.learningRate*node.value;}return sum;};
  const h=usable?homeBase*Math.exp(clamp(factor(homeFeatures),-LOG_FACTOR_BOUND,LOG_FACTOR_BOUND)):homeBase;
  const a=usable?awayBase*Math.exp(clamp(factor(awayFeatures),-LOG_FACTOR_BOUND,LOG_FACTOR_BOUND)):awayBase;
  return {home:h,away:a,homeFactor:homeBase?h/homeBase:1,awayFactor:awayBase?a/awayBase:1,
    shape:usable?(model.shape??null):null,used:usable,status:usable?'applied':model?.status??'unavailable'};
}

function solve(matrix,rhs){
  const a=matrix.map((row,i)=>[...row,rhs[i]]),n=rhs.length;
  for(let j=0;j<n;j++){
    let pivot=j;for(let i=j+1;i<n;i++)if(Math.abs(a[i][j])>Math.abs(a[pivot][j]))pivot=i;
    if(Math.abs(a[pivot][j])<1e-12)return null;
    [a[j],a[pivot]]=[a[pivot],a[j]];const value=a[j][j];
    for(let k=j;k<=n;k++)a[j][k]/=value;
    for(let i=0;i<n;i++)if(i!==j){const f=a[i][j];for(let k=j;k<=n;k++)a[i][k]-=f*a[j][k];}
  }
  return a.map(row=>row[n]);
}
function fit(rows,ridge){
  const dimensions=rows[0]?.homeFeatures.length??D;
  const observations=rows.flatMap(r=>[[r.homeBase,r.homeFeatures,r.homeScore],[r.awayBase,r.awayFeatures,r.awayScore]]),n=observations.length;
  let beta=zero(dimensions);
  const objective=b=>observations.reduce((s,[base,x,y])=>{
    const eta=clamp(dot(x,b),-20,20);return s+base*Math.exp(eta)-y*(Math.log(base)+eta);
  },0)/n+ridge*dot(b,b)/2;
  let previous=objective(beta);
  for(let iteration=0;iteration<60;iteration++){
    const gradient=zero(dimensions),hessian=Array.from({length:dimensions},()=>zero(dimensions));
    for(const [base,x,y]of observations){
      const mu=base*Math.exp(clamp(dot(x,beta),-20,20));
      for(let i=0;i<dimensions;i++){
        gradient[i]+=(mu-y)*x[i]/n;
        for(let j=0;j<dimensions;j++)hessian[i][j]+=mu*x[i]*x[j]/n;
      }
    }
    for(let i=0;i<dimensions;i++){gradient[i]+=ridge*beta[i];hessian[i][i]+=ridge+1e-9;}
    const delta=solve(hessian,gradient);if(!delta||delta.some(x=>!finite(x)))break;
    let step=1,accepted=false;
    while(step>1e-7){
      const candidate=beta.map((b,i)=>b-step*delta[i]),loss=objective(candidate);
      if(finite(loss)&&loss<=previous+1e-12){beta=candidate;previous=loss;accepted=true;break;}
      step/=2;
    }
    if(!accepted||Math.max(...delta.map(d=>Math.abs(d*step)))<1e-7)break;
  }
  return beta;
}
function pairedNll(rows,beta,shape){
  return rows.reduce((s,r)=>s+countNll(r.homeScore,corrected(r.homeBase,r.homeFeatures,beta),shape)+
    countNll(r.awayScore,corrected(r.awayBase,r.awayFeatures,beta),shape),0)/rows.length;
}
function outcomeProbabilities(h,a,shape){
  const limit=m=>Math.min(2000,Math.max(25,Math.ceil(m+14*Math.sqrt(m+(shape===null?0:m*m/shape)))));
  const max=Math.max(limit(h),limit(a)),ph=goalProbabilities(h,max,shape),pa=goalProbabilities(a,max,shape);
  const sh=ph.reduce((s,p)=>s+p,0),sa=pa.reduce((s,p)=>s+p,0),mass=sh*sa;
  let home=0,draw=0,cdf=0;
  for(let i=0;i<ph.length;i++){home+=ph[i]*cdf;draw+=ph[i]*pa[i];cdf+=pa[i];}
  const argmax=xs=>xs.reduce((best,v,i)=>v>xs[best]?i:best,0);
  return {home:home/mass,draw:draw/mass,away:Math.max(0,1-(home+draw)/mass),
    homeMode:argmax(ph),awayMode:argmax(pa),tailMass:Math.max(0,1-mass)};
}
export function evaluate(rows,beta,shape,predict=null){
  if(!rows.length)return null;
  let nll=0,logLoss=0,brier=0,exact=0,correct=0,mae=0,tail=0;
  for(const r of rows){
    const h=predict?predict(r.homeBase,r.homeFeatures):corrected(r.homeBase,r.homeFeatures,beta),a=predict?predict(r.awayBase,r.awayFeatures):corrected(r.awayBase,r.awayFeatures,beta),p=outcomeProbabilities(h,a,shape);
    const truth=r.homeScore>r.awayScore?'home':r.homeScore<r.awayScore?'away':'draw';
    const predicted=['home','draw','away'].reduce((best,k)=>p[k]>p[best]?k:best,'home');
    nll+=countNll(r.homeScore,h,shape)+countNll(r.awayScore,a,shape);
    logLoss-=Math.log(Math.max(1e-15,p[truth]));
    brier+=['home','draw','away'].reduce((s,k)=>s+(p[k]-(k===truth?1:0))**2,0);
    exact+=Number(p.homeMode===r.homeScore&&p.awayMode===r.awayScore);correct+=Number(predicted===truth);
    mae+=(Math.abs(h-r.homeScore)+Math.abs(a-r.awayScore))/2;tail+=p.tailMass;
  }
  const n=rows.length;return {sampleSize:n,nll:nll/n,pairedCountNll:nll/n,logLoss:logLoss/n,brier:brier/n,
    exactScoreAccuracy:exact/n,accuracy:correct/n,mae:mae/n,goalMAE:mae/n,meanExcludedOutcomeTailMass:tail/n};
}
const range=rows=>({count:rows.length,firstDate:rows[0]?.date??null,lastDate:rows.at(-1)?.date??null});
function groupedSplit(rows){
  const groups=[];for(const r of rows){const last=groups.at(-1);if(last&&timestamp(last[0].date)===timestamp(r.date))last.push(r);else groups.push([r]);}
  let accumulated=0,trainEnd=0,validationEnd=0;
  for(let i=0;i<groups.length;i++){
    accumulated+=groups[i].length;
    if(!trainEnd&&accumulated>=Math.ceil(rows.length*.7))trainEnd=i+1;
    if(!validationEnd&&accumulated>=Math.ceil(rows.length*.85))validationEnd=i+1;
  }
  const rawTrain=groups.slice(0,trainEnd).flat(),rawValidation=groups.slice(trainEnd,validationEnd).flat(),test=groups.slice(validationEnd).flat();
  const validationStart=timestamp(rawValidation[0]?.date),testStart=timestamp(test[0]?.date);
  const train=rawTrain.filter(r=>timestamp(r.availableAt)<validationStart),validation=rawValidation.filter(r=>timestamp(r.availableAt)<testStart);
  return {train,validation,test,purgedTrain:rawTrain.length-train.length,purgedValidation:rawValidation.length-validation.length,
    kickoffGroups:groups.length};
}

export function prepareOutcomeRows(inputRows,{cutoff,targetId,formCount=10,leagueId,featureNames=OUTCOME_FEATURE_NAMES}={}){
  if(!Array.isArray(featureNames)||featureNames.length<1||featureNames.length>512||new Set(featureNames).size!==featureNames.length)throw new Error('Geçerli özellik şeması gerekli.');
  const dimensions=featureNames.length;
  const before=timestamp(cutoff),excluded={},seen=new Set(),eligible=[];
  const reject=reason=>{excluded[reason]=(excluded[reason]??0)+1;};
  for(const r of inputRows??[]){
    if(r?.id==null){reject('missing-id');continue;}
    if(String(r.id)===String(targetId)){reject('target-match');continue;}
    if(Number(r.formCount)!==Number(formCount)){reject('form-window-mismatch');continue;}
    const date=timestamp(r.date),available=timestamp(r.availableAt),featureCutoff=timestamp(r.featureCutoff),featureMax=timestamp(r.featureMaxAvailableAt);
    if(!Number.isFinite(before)||!Number.isFinite(date)||!Number.isFinite(available)||date>=before||available>=before||available<date){reject('label-unavailable-at-cutoff');continue;}
    if(!Number.isFinite(featureCutoff)||!Number.isFinite(featureMax)||featureMax>=date||featureCutoff>date||featureMax>featureCutoff){reject('feature-timing-unverified');continue;}
    if(![r.homeBase,r.awayBase].every(v=>finite(v)&&v>0&&v<=100)||![r.homeScore,r.awayScore].every(v=>Number.isInteger(v)&&v>=0&&v<=100)||
      !featureVector(r.homeFeatures,dimensions)||!featureVector(r.awayFeatures,dimensions)){reject('invalid-model-observation');continue;}
    if(seen.has(String(r.id))){reject('duplicate-id');continue;}seen.add(String(r.id));eligible.push(r);
  }
  eligible.sort((a,b)=>timestamp(a.date)-timestamp(b.date)||String(a.id).localeCompare(String(b.id)));
  const sameLeague=leagueId==null?[]:eligible.filter(r=>String(r.leagueId)===String(leagueId));
  const specific=sameLeague.length>=180,rows=specific?sameLeague:eligible;
  const scope={type:specific?'league':'global',leagueId:specific?leagueId:null,requestedLeagueId:leagueId??null,
    eligibleSameLeague:sameLeague.length,eligibleGlobal:eligible.length,
    reason:specific?'at-least-180-same-league-fixtures':leagueId==null?'global-pool-requested':'same-league-sample-below-180-global-pool-used',formCount:Number(formCount)};
  const split=groupedSplit(rows),counts={input:inputRows?.length??0,eligible:rows.length,train:split.train.length,
    validation:split.validation.length,test:split.test.length,purgedTrain:split.purgedTrain,purgedValidation:split.purgedValidation,excluded};
  const ranges={eligible:range(rows),train:range(split.train),validation:range(split.validation),test:range(split.test)};
  return {rows,split,scope,counts,ranges,before,dimensions,featureNames};
}
export function trainOutcomeModel(inputRows,options={}){
  const {rows,split,scope,counts,ranges,before,dimensions,featureNames}=prepareOutcomeRows(inputRows,options);
  const result={version:'historical-outcome-ridge-v1',status:'insufficient',accepted:false,coefficients:zero(dimensions),shape:null,
    featureNames:[...featureNames],scope,counts,ranges,cutoff:Number.isFinite(before)?new Date(before).toISOString():null,
    training:{regularization:null,finalRefitCount:0,method:'ridge-poisson-log-offset',factorBounds:[.5,2]},report:null};
  if(rows.length<120||split.train.length<70||split.validation.length<15||split.test.length<15){
    result.reason='En az 120 uygun maç ve zaman arındırması sonrası 70 eğitim / 15 doğrulama / 15 test maçı gerekli.';return result;
  }
  const baseline=zero(dimensions),baselineValidationNll=pairedNll(split.validation,baseline,null),candidates=[{ridge:null,beta:baseline,nll:baselineValidationNll}];
  for(const ridge of RIDGES){const beta=fit(split.train,ridge);candidates.push({ridge,beta,nll:pairedNll(split.validation,beta,null)});}
  let selected=candidates[0];for(const candidate of candidates)if(candidate.nll<selected.nll-1e-8)selected=candidate;
  const shapeCandidates=SHAPES.map(shape=>({shape,nll:pairedNll(split.validation,selected.beta,shape)}));
  let selectedShape=shapeCandidates[0];for(const candidate of shapeCandidates)if(candidate.nll<selectedShape.nll-1e-8)selectedShape=candidate;
  const accepted=selectedShape.nll<baselineValidationNll-1e-6;
  const lockedBeta=accepted?selected.beta:baseline,lockedShape=accepted?selectedShape.shape:null;
  result.status=accepted?'trained':'baseline-retained';result.accepted=accepted;
  result.reason=accepted?'Doğrulama kaybı taban modele göre azaldı.':'Doğrulama kaybında iyileşme yok; taban Poisson modeli korundu.';
  result.report={type:'internal-chronological-out-of-sample',splitFractions:[.70,.15,.15],kickoffGroups:split.kickoffGroups,
    selectionMetric:'mean-paired-count-negative-log-likelihood',regularizationSelectionFamily:'poisson',
    validation:{baseline:evaluate(split.validation,baseline,null),selected:evaluate(split.validation,lockedBeta,lockedShape)},
    test:{baseline:evaluate(split.test,baseline,null),selected:evaluate(split.test,lockedBeta,lockedShape)},
    selection:{regularization:selected.ridge,shape:lockedShape,baselineValidationNll,
      selectedValidationNll:accepted?selectedShape.nll:baselineValidationNll,
      ridgeCandidates:candidates.map(c=>({regularization:c.ridge,validationPoissonNll:c.nll})),
      shapeCandidates:shapeCandidates.map(c=>({shape:c.shape,validationNll:c.nll}))},
    lockedCoefficients:[...lockedBeta],lockedShape,
    note:'İç zaman sıralı test; test etiketleri seçimde kullanılmaz. Dış veri doğrulaması ve olasılık kalibrasyonu değildir. Son üretim katsayıları rapordan sonra kesimden önceki tüm uygun maçlara yeniden uydurulur; test metrikleri yeniden uydurulan modele ait değildir.'};
  // Test results above belong to the frozen train/validation choice. Only now may
  // production coefficients incorporate all labels known before the cutoff.
  result.coefficients=accepted&&selected.ridge!==null?fit(rows,selected.ridge):zero(dimensions);
  result.shape=lockedShape;
  result.training={...result.training,regularization:accepted?selected.ridge:null,
    finalRefitCount:accepted&&selected.ridge!==null?rows.length:0,finalRefitIncludesTest:accepted&&selected.ridge!==null,
    finalRefitRange:accepted&&selected.ridge!==null?range(rows):null};
  return result;
}
