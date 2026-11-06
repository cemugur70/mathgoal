// Fits the live-price layer for races without AGF after horse-gbdt.mjs; writes data/horse/horse-odds-layer.json and a section of docs/horse-rating-model.md.
// Exponents per horizon: on the last discovery year from trees and logit that did not see it (judged on the confirmation period), and on the confirmation period
// from the before-split trees (used live). Needs the price history from collect-horse-odds-history.mjs, which stays local; the server only reads the file.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {raceProbabilities,fitConditionalLogit,fitMarketBlend,blendMarket,scoreForecasts,MODEL_SETS,FEATURE_NAMES} from '../dist/horse-model.mjs';
import {binEdges,buildDataset,boostTrees,packTrees,unpackTrees,treeProbabilities,logitColumn,TREE_PARAMS} from '../dist/horse-gbdt.mjs';
import {ODDS_HORIZONS,nearestHorizon,priceColumn} from '../dist/horse-odds.mjs';
import {buildSpeedPars,attachSpeedFigures} from '../dist/horse-speed.mjs';
import {loadHorseArchive} from './horse-archive.mjs';
import {replayRaces} from './horse-replay.mjs';

// The scheduler starts at :20 and :50 and a run reads the race pages about a minute later.
const READ_MINUTE=21;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse'),started=performance.now();
const log=(...a)=>console.log(`[${((performance.now()-started)/60000).toFixed(1)} dk]`,...a);
const model=JSON.parse(await readFile(path.join(dir,'horse-model.json'),'utf8')),gbdt=JSON.parse(await readFile(path.join(dir,'horse-gbdt.json'),'utf8')),{split}=model,{blendStart}=model.marketBlend;
const history=new Map(),historyDir=path.join(dir,'odds-history');
for(const f of await readdir(historyDir))for(const line of (await readFile(path.join(historyDir,f),'utf8')).split('\n'))if(line){try{const r=JSON.parse(line);history.set(`${r.date}|${r.city}|${r.number}`,r);}catch{}}
const {races,runsByHorse,breedByHorse,sireByHorse}=loadHorseArchive(new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true}));
attachSpeedFigures(runsByHorse,breedByHorse,buildSpeedPars(runsByHorse,breedByHorse,{before:split}));
const recs=replayRaces({model,races,runsByHorse,sireByHorse,ruleWeights:model.ruleWeights.discovery}),hasAgf=r=>r.rows.some(x=>x.agf>0),noAgf=r=>!hasAgf(r);
const early=recs.filter(r=>r.date<blendStart),lastYear=recs.filter(r=>r.date>=blendStart&&r.date<split),conf=recs.filter(r=>r.date>=split);
log('veri',JSON.stringify({early:early.length,lastYear:lastYear.length,conf:conf.length,seri:history.size}));

// Market-free trees and logit that did not see the last discovery year, at the count the tree layer chose.
const earlyEdges=binEdges(early),earlyFit=boostTrees(buildDataset(early,earlyEdges),MODEL_SETS.piyasasiz.map(f=>FEATURE_NAMES.indexOf(f)),{topK:TREE_PARAMS.topK,trees:gbdt.report.counts.free});
log('erken agaclar tamam');
const earlyTrees=unpackTrees(packTrees(earlyFit,earlyEdges)),freeTrees=unpackTrees(gbdt.validation.free.trees),agfTrees=unpackTrees(gbdt.validation.agf.trees),earlyLogit=fitConditionalLogit(early,MODEL_SETS.piyasasiz),confLogit=FEATURE_NAMES.map(f=>model.models.piyasasiz.weights[f]??0);
const freeBase=(r,trees,logit,blend)=>blendMarket(treeProbabilities(r.rows,trees),logitColumn(raceProbabilities(r.rows,logit)),blend);

const istanbul=label=>Date.parse(label.replace(' ','T')+'+03:00');
for(const r of [...lastYear,...conf]){r.off=r.time?Date.parse(/Z$/.test(r.time)?r.time:r.time+'Z'):null;const h=history.get(`${r.date}|${r.city}|${r.number}`);if(h?.t.length&&r.off){r.times=h.t.map(istanbul);r.series=r.rows.map(x=>h.r[String(x.number)]??[]);}}
/** The price `minutes` before the off, or null: the last series point must be within 20 minutes and every runner must have a price by then. */
function priceAt(r,minutes){
 if(!r.times)return null;
 const ms=r.off-minutes*60000;let k=-1;for(let i=0;i<r.times.length;i++)if(r.times[i]<=ms)k=i;if(k<0||ms-r.times[k]>20*60000)return null;
 const p=r.series.map(s=>{for(let i=k;i>=0;i--)if(s[i]>0)return s[i];return null;});return p.every(v=>v>0)?p:null;
}
const fitTable=(list,base)=>Object.fromEntries(ODDS_HORIZONS.map(m=>[m,fitMarketBlend(list.filter(r=>priceAt(r,m)).map(r=>({probs:base(r),agf:priceColumn(priceAt(r,m)),rows:r.rows,winners:r.winners})))]));
const learn=lastYear.filter(noAgf),test=conf.filter(noAgf);
const settled=fitTable(learn,r=>freeBase(r,earlyTrees,earlyLogit,gbdt.validation.free.blend)),live=fitTable(test,r=>freeBase(r,freeTrees,confLogit,gbdt.live.free.blend));
log('usler',JSON.stringify({settled,live}));

// Judged on the confirmation period with the exponents from the year before.
const base=r=>freeBase(r,freeTrees,confLogit,gbdt.validation.free.blend),loss=(r,p)=>-Math.log(Math.max(r.rows.reduce((a,x,i)=>a+(r.winners.includes(x.number)?p[i]:0),0),1e-9));
const score=(list,fn)=>scoreForecasts(list.map(r=>({probs:fn(r),rows:r.rows,winners:r.winners})));
let s=13;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
function compare(list,fn){
 const d=list.map(r=>loss(r,fn(r))-loss(r,base(r))),o=[];for(let k=0;k<1000;k++){let t=0;for(let i=0;i<d.length;i++)t+=d[Math.floor(rnd()*d.length)];o.push(t/d.length);}o.sort((x,y)=>x-y);
 const pick=x=>({logLoss:x.logLoss,top1:x.top1,top3:x.top3});return {races:list.length,before:pick(score(list,base)),after:pick(score(list,fn)),diff:d.reduce((t,v)=>t+v,0)/d.length,ci:[o[25],o[974]]};
}
const atHorizon=m=>r=>blendMarket(base(r),priceColumn(priceAt(r,m)),settled[m]);
const horizons=ODDS_HORIZONS.map(m=>({minutes:m,exponents:settled[m],...compare(test.filter(r=>priceAt(r,m)),atHorizon(m))}));
// What the site shows: the race's last page read before its off; a race without a full price there keeps the base.
const minutesAtRead=r=>(((r.off/60000-READ_MINUTE-1)%30)+30)%30+1;
const lastRead=r=>{if(!r.off)return base(r);const m=minutesAtRead(r),p=priceAt(r,m);return p?blendMarket(base(r),priceColumn(p),settled[nearestHorizon(m)]):base(r);};
const priced=r=>!!r.off&&!!priceAt(r,minutesAtRead(r));
const publish={all:compare(test,lastRead),priced:compare(test.filter(priced),lastRead)};
// A race that will have AGF, read before its AGF appears, uses the same layer.
const agfRaces=conf.filter(hasAgf),beforeAgf=[240,120,60].map(m=>({minutes:m,...compare(agfRaces.filter(r=>priceAt(r,m)),atHorizon(m))}));
log('sonuc',JSON.stringify({horizons:horizons.map(h=>[h.minutes,h.races,+h.diff.toFixed(4),h.ci.map(v=>+v.toFixed(4))]),publish:publish.all}));
// The whole confirmation period as the page's model table reads it: races with AGF as on the site, races without AGF with the last read's price.
const agfProbs=r=>blendMarket(treeProbabilities(r.rows,agfTrees),r.rows.map(x=>x.agf),gbdt.validation.agf.blend),withLayer=r=>hasAgf(r)?agfProbs(r):lastRead(r);
const models={obsidianOran:{confirmation:score(conf,withLayer),byBreed:Object.fromEntries(['TB','AR'].map(b=>[b,score(conf.filter(r=>r.breed===b),withLayer)]))}};
const report={readMinute:READ_MINUTE,exponents:{settled,live},horizons,publish,beforeAgf,models};
await writeFile(path.join(dir,'horse-odds-layer.json'),JSON.stringify({schemaVersion:1,trainedAt:new Date().toISOString(),gbdtTrainedAt:gbdt.trainedAt,split,settled,live,report}));

// The walk-forward rewrites the report without this section, and this step adds it back.
const f4=v=>v.toFixed(4),pct=v=>(100*v).toFixed(1)+'%',row=(name,c)=>`| ${name} | ${c.races} | ${f4(c.before.logLoss)} | ${f4(c.after.logLoss)} | ${f4(c.diff)} (${f4(c.ci[0])} / ${f4(c.ci[1])}) | ${pct(c.before.top1)} → ${pct(c.after.top1)} | ${pct(c.before.top3)} → ${pct(c.after.top3)} |`;
const section=['<!-- oran-katmani -->','## Canlı ganyan katmanı (sitede kullanılan)','',
 `AGF'si olmayan koşularda ağaç katmanının olasılığı son yayındaki ganyan payıyla birleşir; üsler yarışa kalan süreye göre ayrıdır. Fiyatı eksik koşu, ${ODDS_HORIZONS[0]+60} dakikadan erken fiyat ve AGF'li koşu bu katmanı kullanmaz. Geçmiş günlerin kartları bu katman olmadan gösterilir.`,'',
 `Üsler ${blendStart} – ${split} arasında öğrenildi, ${split} ve sonrasında sınandı; aralık %95 bootstrap. Kabul kuralı çalıştırmadan önce yazıldı: kazanç en az 0,005 ve aralığın üst sınırı sıfırın altında.`,'',
 '| Yarışa kalan | Koşu | Önce | Sonra | Fark (aralık) | 1. tahmin | İlk 3 |','|---|---:|---:|---:|---|---|---|',row(`Son yayın (:${READ_MINUTE}, :${READ_MINUTE+30}), tüm AGF'siz`,publish.all),row('Son yayın, fiyatı olan',publish.priced),...horizons.map(h=>row(`${h.minutes} dk`,h)),'',
 `AGF'li koşular, AGF görünmeden aynı katmanla: ${beforeAgf.map(b=>`${b.minutes} dk ${f4(b.diff)} (${f4(b.ci[0])} / ${f4(b.ci[1])})`).join(', ')}.`,'','<!-- /oran-katmani -->',''].join('\n');
const docs=path.join(root,'docs/horse-rating-model.md'),old=await readFile(docs,'utf8'),kept=old.replace(/<!-- oran-katmani -->[\s\S]*<!-- \/oran-katmani -->\n?/,'').trimEnd();
await writeFile(docs,kept+'\n\n'+section);
log('bitti',JSON.stringify({tepeRssMb:Math.round(process.resourceUsage().maxRSS/1024)}));
