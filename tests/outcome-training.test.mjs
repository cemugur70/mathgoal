import test from 'node:test';
import assert from 'node:assert/strict';
import {OUTCOME_FEATURE_NAMES,outcomeFeatures,trainOutcomeModel,applyOutcomeModel,goalProbabilities} from '../dist/outcome-training.mjs';
const DAY=86400000,start=Date.UTC(2024,0,1),iso=n=>new Date(n).toISOString();
const features=(home=true,base=1)=>[1,home?1:0,Math.log(base),0,0,0,0,0,1,0];
function rows(n=240,{neutral=false,dispersed=false,leagueId=87}={}){
 return Array.from({length:n},(_,i)=>{
  const date=start+i*DAY,base=dispersed?1.125:neutral?1:.8,awayBase=dispersed?1.125:neutral?1:.6;
  return {id:String(i+1),date:iso(date),availableAt:iso(date+3*3600000),leagueId,formCount:10,
   homeBase:base,awayBase,homeFeatures:features(true,base),awayFeatures:features(false,awayBase),
   homeScore:dispersed?[0,0,0,0,0,0,3,6][i%8]:neutral?1:[1,2,2,3,2,1,3,2][i%8],
   awayScore:dispersed?[6,0,0,0,0,0,0,3][i%8]:neutral?1:[0,1,2,1,1,2,1,2][i%8],
   featureCutoff:iso(date),featureMaxAvailableAt:iso(date-DAY)};
 });
}
const opts={cutoff:'2027-01-01T00:00:00Z',targetId:'target',formCount:10,leagueId:87};

test('fixed bounded features distinguish missing evidence from observed equality',()=>{
 const profiles={home:{gf:2,xg:1,points:2,shots:15,shotsOnTarget:6,historyCount:10},away:{ga:1,xga:1,points:1,shots:8,shotsOnTarget:2,historyCount:5}};
 const before=JSON.stringify(profiles),v=outcomeFeatures(profiles,{},'home',2);
 assert.equal(v.length,OUTCOME_FEATURE_NAMES.length);assert.ok(v.every(x=>Number.isFinite(x)&&Math.abs(x)<=2));
 assert.equal(v[0],1);assert.equal(v[1],1);assert.ok(v[3]>0);assert.equal(v[4],0);assert.equal(v[9],0);
 profiles.home.xg=null;const missing=outcomeFeatures(profiles,{},'home',2);
 assert.equal(missing[3],0);assert.ok(missing[9]>0);profiles.home.xg=1;assert.equal(JSON.stringify(profiles),before);
 const empty=outcomeFeatures({},null,'away',1);assert.equal(empty[9],1);assert.ok(empty.every(Number.isFinite));
});

test('Poisson and negative-binomial probability families preserve mass and mean, with overdispersion',()=>{
 const stats=shape=>{
  const p=goalProbabilities(2,200,shape),mass=p.reduce((s,x)=>s+x,0),mean=p.reduce((s,x,i)=>s+x*i,0),variance=p.reduce((s,x,i)=>s+x*(i-2)**2,0);
  assert.ok(Math.abs(mass-1)<1e-10);assert.ok(Math.abs(mean-2)<1e-9);return variance;
 };
 assert.ok(Math.abs(stats(null)-2)<1e-9);assert.ok(Math.abs(stats(2)-4)<1e-8);
 assert.deepEqual(goalProbabilities(0,4,2),[1,0,0,0,0]);
 assert.ok(goalProbabilities(5,1).reduce((s,x)=>s+x,0)<1,'tail is not silently normalized');
 assert.throws(()=>goalProbabilities(1,4,-1));assert.throws(()=>goalProbabilities(-1,4));
});

test('insufficient and rejected models retain exact baseline means and Poisson family',()=>{
 const few=trainOutcomeModel(rows(119),opts);assert.equal(few.status,'insufficient');assert.equal(few.accepted,false);
 const data={homeBase:1.4,awayBase:.7,homeFeatures:features(),awayFeatures:features(false)};
 assert.deepEqual(applyOutcomeModel(few,data),{home:1.4,away:.7,homeFactor:1,awayFactor:1,shape:null,used:false,status:'insufficient'});
 const neutral=trainOutcomeModel(rows(240,{neutral:true}),opts);
 assert.equal(neutral.status,'baseline-retained');assert.equal(neutral.accepted,false);assert.equal(neutral.shape,null);
 assert.ok(neutral.coefficients.every(x=>x===0));
});

test('deterministic ridge fit learns residual means with untouched chronological test and final refit disclosure',()=>{
 const data=rows(),before=JSON.stringify(data),a=trainOutcomeModel(data,opts),b=trainOutcomeModel(data,opts);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(data),before);assert.equal(a.status,'trained');assert.equal(a.accepted,true);
 assert.equal(a.scope.type,'league');assert.equal(a.counts.train,168);assert.equal(a.counts.validation,36);assert.equal(a.counts.test,36);
 assert.ok(a.report.validation.selected.nll<a.report.validation.baseline.nll);
 assert.ok(a.report.test.selected.nll<a.report.test.baseline.nll);
 assert.ok(a.report.test.selected.mae<a.report.test.baseline.mae);
 assert.equal(a.training.finalRefitCount,240);assert.equal(a.training.finalRefitIncludesTest,true);
 assert.ok(Date.parse(a.ranges.train.lastDate)<Date.parse(a.ranges.validation.firstDate));
 assert.ok(Date.parse(a.ranges.validation.lastDate)<Date.parse(a.ranges.test.firstDate));
 const corrected=applyOutcomeModel(a,{homeBase:.8,awayBase:.6,homeFeatures:features(true,.8),awayFeatures:features(false,.6)});
 assert.ok(corrected.home>.8&&corrected.home<=1.6);assert.ok(corrected.away>.6&&corrected.away<=1.2);assert.equal(corrected.used,true);
});

test('target labels, unavailable labels, unverified feature timing, duplicates and other form windows cannot train',()=>{
 const data=rows(),base=trainOutcomeModel(data,opts),bad={...data[0],id:'target',homeScore:100};
 const added=[bad,{...bad,id:'future',date:'2027-01-02T00:00:00Z',availableAt:'2027-01-02T03:00:00Z'},
  {...bad,id:'not-final-yet',availableAt:opts.cutoff},{...bad,id:'leaky-features',featureMaxAvailableAt:data[0].date},
  {...bad,id:'unverified',featureCutoff:null},{...bad,id:'other-window',formCount:5},data[0]];
 const modified=trainOutcomeModel([...data,...added],opts);
 assert.deepEqual(modified.coefficients,base.coefficients);assert.equal(modified.shape,base.shape);assert.deepEqual(modified.report,base.report);
 assert.equal(modified.counts.excluded['target-match'],1);assert.equal(modified.counts.excluded['feature-timing-unverified'],2);
 assert.equal(modified.counts.excluded['duplicate-id'],1);assert.equal(modified.counts.excluded['form-window-mismatch'],1);
});

test('kickoff grouping and completion purges prevent concurrent or unfinished matches crossing split boundaries',()=>{
 const data=rows();
 for(const r of data)r.availableAt=iso(Date.parse(r.date)+6*DAY);
 const model=trainOutcomeModel(data,opts);
 assert.equal(model.accepted,true);assert.equal(model.counts.purgedTrain,6);assert.equal(model.counts.purgedValidation,6);
 assert.ok(model.counts.train>=70&&model.counts.validation>=15&&model.counts.test>=15);
 const firstKickoff=iso(start),concurrent=rows().map(r=>({...r,date:firstKickoff,featureCutoff:firstKickoff,featureMaxAvailableAt:iso(start-DAY)}));
 const grouped=trainOutcomeModel(concurrent,opts);assert.equal(grouped.status,'insufficient');assert.equal(grouped.counts.validation,0);
});

test('test labels cannot select coefficients, penalty or tail shape; final refit is explicitly separate',()=>{
 const data=rows(),first=trainOutcomeModel(data,opts),testStart=Date.parse(first.ranges.test.firstDate);
 const changed=data.map(r=>Date.parse(r.date)>=testStart?{...r,homeScore:20,awayScore:0}:r),second=trainOutcomeModel(changed,opts);
 assert.deepEqual(first.report.lockedCoefficients,second.report.lockedCoefficients);
 assert.deepEqual(first.report.selection,second.report.selection);assert.deepEqual(first.report.validation,second.report.validation);
 assert.notDeepEqual(first.report.test,second.report.test);assert.notDeepEqual(first.coefficients,second.coefficients);
});

test('tail-only validation gain can select negative binomial while preserving the learned mean',()=>{
 const model=trainOutcomeModel(rows(400,{dispersed:true}),opts);
 assert.equal(model.accepted,true);assert.ok(model.shape>0);
 assert.ok(model.report.validation.selected.nll<model.report.validation.baseline.nll);
 const prediction=applyOutcomeModel(model,{homeBase:1.125,awayBase:1.125,homeFeatures:features(true,1.125),awayFeatures:features(false,1.125)});
 assert.ok(Math.abs(prediction.home-1.125)<1e-6);assert.ok(Math.abs(prediction.away-1.125)<1e-6);
 assert.equal(prediction.shape,model.shape);
});

test('league specificity requires 180 samples; a smaller requested league discloses global fallback',()=>{
 const data=rows(240).map((r,i)=>({...r,leagueId:i<100?87:47}));
 const global=trainOutcomeModel(data,opts);assert.equal(global.scope.type,'global');assert.equal(global.scope.eligibleSameLeague,100);assert.equal(global.counts.eligible,240);
 const local=trainOutcomeModel(data,{...opts,leagueId:47});assert.equal(local.scope.type,'global');
 const specific=trainOutcomeModel(rows(240),opts);assert.equal(specific.scope.type,'league');assert.equal(specific.scope.leagueId,87);
});
