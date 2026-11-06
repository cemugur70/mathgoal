import test from 'node:test';import assert from 'node:assert/strict';
import {binEdges,buildDataset,boostTrees,packTrees,unpackTrees,treeProbabilities,ensembleProbabilities,loadEnsemble,logitColumn} from '../dist/horse-gbdt.mjs';
import {blendMarket} from '../dist/horse-model.mjs';

// Runner strength is the first feature; the second is noise. Finishing order follows strength plus Gumbel noise, so the win and the places carry the signal.
function synthetic(count,seed=3,{known=9}={}){
 let s=seed;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
 return Array.from({length:count},()=>{const n=5+Math.floor(rnd()*5),rows=Array.from({length:n},(_,i)=>({number:String(i+1),x:[rnd()*2-1,rnd()*2-1]}));
  const order=rows.map(r=>({r,k:2*r.x[0]-Math.log(-Math.log(rnd()+1e-12))})).sort((a,b)=>b.k-a.k);order.forEach((o,i)=>{o.r.place=i<known?i+1:null;});
  return {rows,winners:[order[0].r.number]};});
}
const logLoss=(races,T)=>races.reduce((a,r)=>{const p=treeProbabilities(r.rows,T);return a-Math.log(r.rows.reduce((t,x,i)=>t+(r.winners.includes(x.number)?p[i]:0),0));},0)/races.length;
const small={depth:2,lambda:1,minH:2,lr:.1,colsample:1};

test('trees learn the signal, and stored trees score exactly like the binned training scores',()=>{
 const train=synthetic(1500),holdout=synthetic(500,11),edges=binEdges(train),D=buildDataset(train,edges),V=buildDataset(holdout,edges);
 const m=boostTrees(D,[0,1],{trees:60,valid:V,every:20,...small}),T=unpackTrees(JSON.parse(JSON.stringify(packTrees(m,edges))));
 const uniform=holdout.reduce((a,r)=>a+Math.log(r.rows.length),0)/holdout.length,ll=logLoss(holdout,T);
 assert.ok(ll<uniform-.1,`log-loss ${ll} vs uniform ${uniform}`);
 assert.ok(Math.abs(m.curve.at(-1)[1]-ll)<1e-3,'validation curve and stored trees agree');
 assert.deepEqual(m.curve.map(c=>c[0]),[20,40,60]);
 const noise=m.f.reduce((a,f)=>a+(f===1),0),signal=m.f.reduce((a,f)=>a+(f===0),0);assert.ok(signal>noise,'splits favour the real feature');
});
test('a prefix of the trees equals a shorter fit; the feature list limits the splits',()=>{
 const train=synthetic(300),edges=binEdges(train),D=buildDataset(train,edges),race=train[0].rows;
 const long=boostTrees(D,[0,1],{trees:20,...small}),short=boostTrees(D,[0,1],{trees:8,...small});
 const a=treeProbabilities(race,unpackTrees(packTrees(long,edges,8))),b=treeProbabilities(race,unpackTrees(packTrees(short,edges)));
 a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-5));
 const only=boostTrees(D,[1],{trees:10,...small});assert.ok(only.f.every(f=>f===1||f===-1),'market-free trees never split on a left-out feature');
});
test('the finishing prefix stops at the first unknown or shared place; a dead heat for first trains on the win only',()=>{
 const row=(number,place)=>({number,place,x:[+number]}),races=[
  {rows:[row('1',1),row('2',2),row('3',null),row('4',4)],winners:['1']},
  {rows:[row('1',2),row('2',1),row('3',3),row('4',3)],winners:['2']},
  {rows:[row('1',1),row('2',1),row('3',3)],winners:['1','2']}];
 assert.deepEqual(buildDataset(races,binEdges(races)).orders,[[0,1],[1,0],[]]);
 const D=buildDataset(races,binEdges(races));assert.deepEqual(Array.from(D.y.subarray(8)),[.5,.5,0],'dead heat shares the win');
});
test('placing data changes the fit only through Plackett-Luce stages',()=>{
 const placed=synthetic(400),blind=placed.map(r=>({...r,rows:r.rows.map(x=>({...x,place:null}))})),edges=binEdges(placed);
 const fit=(races,topK)=>Array.from(boostTrees(buildDataset(races,edges),[0,1],{trees:10,topK,...small}).v);
 assert.deepEqual(fit(placed,1),fit(blind,1),'softmax ignores places');assert.notDeepEqual(fit(placed,4),fit(blind,4));
 assert.deepEqual(fit(blind,4),fit(blind,1),'without known places Plackett-Luce falls back to the win');
});
test('a race with AGF uses the all-feature trees × AGF; without AGF the market-free trees × logit; missing or stale files fall back',()=>{
 const train=synthetic(300),edges=binEdges(train),D=buildDataset(train,edges),race=train[0].rows,n=race.length;
 const agfTrees=unpackTrees(packTrees(boostTrees(D,[0],{trees:10,...small}),edges)),freeTrees=unpackTrees(packTrees(boostTrees(D,[1],{trees:10,...small}),edges));
 const stage={agf:{trees:agfTrees,blend:{alpha:.7,theta:.5}},free:{trees:freeTrees,blend:{alpha:.6,theta:.4}}},logit=race.map((_,i)=>(i+1)/(n*(n+1)/2)),agf=race.map((_,i)=>i?10:50);
 assert.deepEqual(ensembleProbabilities(race,logit,agf,stage),blendMarket(treeProbabilities(race,agfTrees),agf,stage.agf.blend));
 const none=race.map(()=>null),p=ensembleProbabilities(race,logit,none,stage);
 assert.deepEqual(p,blendMarket(treeProbabilities(race,freeTrees),logit,stage.free.blend));
 assert.ok(Math.abs(p.reduce((a,v)=>a+v,0)-1)<1e-12);assert.notDeepEqual(p,treeProbabilities(race,freeTrees),'logit moves the market-free probabilities');
 assert.equal(logitColumn([0,.5])[0],1e-6,'a vanishing logit share stays above the missing-AGF floor check');
 const pack=packTrees(boostTrees(D,[0],{trees:3,...small}),edges),file=JSON.stringify({featureNames:['a','b'],validation:{agf:{trees:pack,blend:{alpha:1,theta:0}},free:{trees:pack,blend:{alpha:1,theta:0}}},live:{agf:{trees:pack,blend:{alpha:1,theta:0}},free:{trees:pack,blend:{alpha:1,theta:0}}},report:{ok:1}});
 assert.equal(loadEnsemble(null,['a','b']),null);assert.equal(loadEnsemble(file,['a','c']),null,'trained on another feature list');
 const loaded=loadEnsemble(file,['a','b']);assert.equal(loaded.report.ok,1);assert.equal(treeProbabilities(race,loaded.live.agf.trees).length,n);
});
