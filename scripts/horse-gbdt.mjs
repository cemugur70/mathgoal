// Trains the tree layer of the horse model after horse-walkforward.mjs; writes data/horse/horse-gbdt.json and a section of docs/horse-rating-model.md.
// Two sets, both on all races: all features (blended with AGF) and market-free features (blended with the market-free logit, for races without AGF).
// Before the blend start: trees whose count is chosen on the last year, and that year fits the exponents shown for settled days. Before the split: the trees
// judged on the confirmation period, which fits the live exponents. All races: the live trees. Fits run in worker threads; the server only reads the file.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {raceProbabilities,fitConditionalLogit,fitMarketBlend,blendMarket,scoreForecasts,MODEL_SETS,FEATURE_NAMES} from '../dist/horse-model.mjs';
import {binEdges,buildDataset,boostTrees,packTrees,unpackTrees,treeProbabilities,ensembleProbabilities,logitColumn,TREE_PARAMS} from '../dist/horse-gbdt.mjs';
import {buildSpeedPars,attachSpeedFigures} from '../dist/horse-speed.mjs';
import {loadHorseArchive} from './horse-archive.mjs';
import {replayRaces} from './horse-replay.mjs';

const fitInWorker=job=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:job});w.once('message',resolve);w.once('error',reject);});
if(!isMainThread){const {train,features,options}=workerData;parentPort.postMessage(boostTrees(train,features,options));}
else await main();

async function main(){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse'),started=performance.now();
 const log=(...a)=>console.log(`[${((performance.now()-started)/60000).toFixed(1)} dk]`,...a);
 const model=JSON.parse(await readFile(path.join(dir,'horse-model.json'),'utf8')),{split,marketBlend}=model,{blendStart}=marketBlend;
 const {races,runsByHorse,breedByHorse,sireByHorse}=loadHorseArchive(new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true}));
 attachSpeedFigures(runsByHorse,breedByHorse,buildSpeedPars(runsByHorse,breedByHorse,{before:split}));
 const replay=ruleWeights=>replayRaces({model,races,runsByHorse,sireByHorse,ruleWeights});
 const recs=replay(model.ruleWeights.discovery),all=replay(model.ruleWeights.production);
 const hasAgf=r=>r.rows.some(x=>x.agf>0),noAgf=r=>!hasAgf(r);
 const early=recs.filter(r=>r.date<blendStart),lastYear=recs.filter(r=>r.date>=blendStart&&r.date<split),before=recs.filter(r=>r.date<split),conf=recs.filter(r=>r.date>=split);
 log('veri',JSON.stringify({early:early.length,lastYear:lastYear.length,before:before.length,conf:conf.length,all:all.length}));
 const index=names=>names.map(f=>FEATURE_NAMES.indexOf(f));
 // The caps are the ones the choice was tested with. The all-feature curve turned before 2000 trees; the market-free one is flat at 1500.
 const SETS={agf:{features:index(FEATURE_NAMES),cap:2000,keep:hasAgf},free:{features:index(MODEL_SETS.piyasasiz),cap:1500,keep:noAgf}},names=Object.keys(SETS);
 const earlyEdges=binEdges(early),beforeEdges=binEdges(before),allEdges=binEdges(all),earlyD=buildDataset(early,earlyEdges),beforeD=buildDataset(before,beforeEdges),allD=buildDataset(all,allEdges);
 const P={topK:TREE_PARAMS.topK};
 // 1) Tree count: chosen on the last discovery year, only on the races this set will be used for.
 const firsts=await Promise.all(names.map(n=>fitInWorker({train:earlyD,features:SETS[n].features,options:{...P,trees:SETS[n].cap,every:100,valid:buildDataset(lastYear.filter(SETS[n].keep),earlyEdges)}})));
 const counts={},curves={},earlyTrees={};
 names.forEach((n,i)=>{const [t]=firsts[i].curve.reduce((a,c)=>c[1]<a[1]?c:a);counts[n]=t;curves[n]=firsts[i].curve.map(([k,l])=>[k,+l.toFixed(5)]);earlyTrees[n]=unpackTrees(packTrees(firsts[i],earlyEdges,t));});
 log('agac sayilari',JSON.stringify(counts));
 // 2) The same counts on the longer periods.
 const refits=await Promise.all(names.flatMap(n=>[beforeD,allD].map(train=>fitInWorker({train,features:SETS[n].features,options:{...P,trees:counts[n]}}))));
 const beforePack={agf:packTrees(refits[0],beforeEdges),free:packTrees(refits[2],beforeEdges)},allPack={agf:packTrees(refits[1],allEdges),free:packTrees(refits[3],allEdges)};
 const beforeTrees={agf:unpackTrees(beforePack.agf),free:unpackTrees(beforePack.free)};
 log('yeniden egitim tamam');
 // 3) Exponents: on probabilities from trees and logit weights that did not see the races.
 const byName=w=>FEATURE_NAMES.map(f=>w[f]??0),confLogit={obsidian:byName(model.models.obsidian.weights),piyasasiz:byName(model.models.piyasasiz.weights)},earlyFree=fitConditionalLogit(early,MODEL_SETS.piyasasiz);
 const exponents=(list,trees,freeLogit)=>({
  agf:fitMarketBlend(list.filter(hasAgf).map(r=>({probs:treeProbabilities(r.rows,trees.agf),agf:r.rows.map(x=>x.agf),rows:r.rows,winners:r.winners}))),
  free:fitMarketBlend(list.filter(noAgf).map(r=>({probs:treeProbabilities(r.rows,trees.free),agf:logitColumn(raceProbabilities(r.rows,freeLogit)),rows:r.rows,winners:r.winners})))});
 const settled=exponents(lastYear,earlyTrees,earlyFree),live=exponents(conf,beforeTrees,confLogit.piyasasiz);
 log('usler',JSON.stringify({settled,live}));
 // 4) Judged on the confirmation period, against what the site showed before: the blend on races with AGF and the market-free logit on the others.
 const stage={agf:{trees:beforeTrees.agf,blend:settled.agf},free:{trees:beforeTrees.free,blend:settled.free}};
 const agfOf=r=>r.rows.map(x=>x.agf),oldProbs=r=>blendMarket(raceProbabilities(r.rows,confLogit[hasAgf(r)?'obsidian':'piyasasiz']),agfOf(r),marketBlend.discovery),newProbs=r=>ensembleProbabilities(r.rows,raceProbabilities(r.rows,confLogit.piyasasiz),agfOf(r),stage);
 const score=(list,fn)=>scoreForecasts(list.map(r=>({probs:fn(r),rows:r.rows,winners:r.winners}))),withBreeds=fn=>({confirmation:score(conf,fn),byBreed:Object.fromEntries(['TB','AR'].map(b=>[b,score(conf.filter(r=>r.breed===b),fn)]))});
 const losses=(list,fn)=>list.map(r=>{const p=fn(r);return -Math.log(Math.max(r.rows.reduce((a,x,i)=>a+(r.winners.includes(x.number)?p[i]:0),0),1e-9));});
 let s=11;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
 const compare=list=>{const a=losses(list,newProbs),b=losses(list,oldProbs),d=a.map((v,i)=>v-b[i]),o=[];for(let k=0;k<1000;k++){let t=0;for(let i=0;i<d.length;i++)t+=d[Math.floor(rnd()*d.length)];o.push(t/d.length);}o.sort((x,y)=>x-y);
  const x=score(list,oldProbs),y=score(list,newProbs);return {races:list.length,before:{logLoss:x.logLoss,top1:x.top1,top3:x.top3},after:{logLoss:y.logLoss,top1:y.top1,top3:y.top3},diff:d.reduce((t,v)=>t+v,0)/d.length,ci:[o[25],o[974]]};};
 const report={params:TREE_PARAMS,counts,curves,exponents:{settled,live},comparison:{all:compare(conf),agf:compare(conf.filter(hasAgf)),free:compare(conf.filter(noAgf))},models:{obsidianSentez:withBreeds(oldProbs),obsidianAgac:withBreeds(newProbs)}};
 log('karsilastirma',JSON.stringify(report.comparison));
 const output={schemaVersion:1,trainedAt:new Date().toISOString(),modelTrainedAt:model.trainedAt,split,featureNames:FEATURE_NAMES,
  validation:{agf:{blend:settled.agf,trees:beforePack.agf},free:{blend:settled.free,trees:beforePack.free}},live:{agf:{blend:live.agf,trees:allPack.agf},free:{blend:live.free,trees:allPack.free}},report};
 const text=JSON.stringify(output);await writeFile(path.join(dir,'horse-gbdt.json'),text);
 // The walk-forward rewrites the report without this section, and this step adds it back.
 const f4=v=>v.toFixed(4),pct=v=>(100*v).toFixed(1)+'%',row=(name,c)=>`| ${name} | ${c.races} | ${f4(c.before.logLoss)} | ${f4(c.after.logLoss)} | ${f4(c.diff)} (${f4(c.ci[0])} / ${f4(c.ci[1])}) | ${pct(c.before.top1)} → ${pct(c.after.top1)} | ${pct(c.before.top3)} → ${pct(c.after.top3)} |`,C=report.comparison;
 const section=['<!-- agac-katmani -->','## Ağaç katmanı (sitede kullanılan)','',
  `Koşu içinde gruplanmış gradient boosting (derinlik ${TREE_PARAMS.depth}, öğrenme hızı ${TREE_PARAMS.lr}). Amaç fonksiyonu Plackett–Luce: bilinen ilk ${TREE_PARAMS.topK} derece, derecesi bilinmeyen atlar yalnız kalan aşamalarda rakip sayılır. Ağaç sayısı ${blendStart} – ${split} arasında seçildi.`,'',
  `- **AGF'li koşular**: tüm özelliklerle ${counts.agf} ağaç × AGF (doğrulama üsleri ${settled.agf.alpha} / ${settled.agf.theta}, canlı ${live.agf.alpha} / ${live.agf.theta}).`,
  `- **AGF'siz koşular ve AGF açıklanmadan önce**: piyasasız özelliklerle ${counts.free} ağaç × piyasasız logit (doğrulama üsleri ${settled.free.alpha} / ${settled.free.theta}, canlı ${live.free.alpha} / ${live.free.theta}).`,
  '- Sürpriz riski ve adayları ağaç ve sentez öncesi logit olasılığını kullanır.','',
  `Doğrulama (${split} ve sonrası), ağaçlardan önce sitede gösterilen olasılığa karşı; aralık %95 bootstrap:`,'',
  '| Koşular | Koşu | Önce | Sonra | Fark (aralık) | 1. tahmin | İlk 3 |','|---|---:|---:|---:|---|---|---|',row('Tümü',C.all),row("AGF'li",C.agf),row("AGF'siz",C.free),'','<!-- /agac-katmani -->',''].join('\n');
 const docs=path.join(root,'docs/horse-rating-model.md'),old=await readFile(docs,'utf8'),kept=old.replace(/<!-- agac-katmani -->[\s\S]*<!-- \/agac-katmani -->\n?/,'').trimEnd();
 await writeFile(docs,kept+'\n\n'+section);
 log('bitti',JSON.stringify({dosyaMb:+(text.length/1048576).toFixed(2),tepeRssMb:Math.round(process.resourceUsage().maxRSS/1024)}));
}
