// Trains and freezes the long-shot score for its forward test. Needs horse-walkforward.mjs and the price history from collect-horse-odds-history.mjs; writes scripts/horse-longshot-model.json and docs/horse-longshot.md.
// Refuses to overwrite a frozen model, since that would void the forward test; --force starts a new test. Fits on 2023-2024 judged on 2025, on 2023-2025 judged on 2026, and on every priced race for the test itself.
// Prices come from the series, payouts from the closing price. The site does not read any of this.
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {raceProbabilities,fitConditionalLogit,MODEL_SETS} from '../dist/horse-model.mjs';
import {fitLogistic} from '../dist/horse-surprise.mjs';
import {buildSpeedPars,attachSpeedFigures} from '../dist/horse-speed.mjs';
import {LONGSHOT_SIGNALS,LONGSHOT_MIN_PRICE,FORWARD_MIN_BETS,createLongshotState,longshotSignals,scaleSignals,signalStats,boostLongshot,longshotScore,betSummary,enrichArchive} from './horse-longshot-lib.mjs';
import {loadHorseArchive} from './horse-archive.mjs';
import {replayRaces} from './horse-replay.mjs';

// The scheduler starts at :20 and :50 and a run reads the race pages about a minute later.
const READ_MINUTE=21,FROM='2023-01-01',root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse'),modelFile=path.join(root,'scripts/horse-longshot-model.json'),started=performance.now();
if(!process.argv.includes('--force')&&await access(modelFile).then(()=>true,()=>false))throw Error('Dondurulmuş model var; üzerine yazmak ileriye dönük testi geçersiz kılar. Yeni test için --force.');
const log=(...a)=>console.log(`[${((performance.now()-started)/60000).toFixed(1)} dk]`,...a);
const model=JSON.parse(await readFile(path.join(dir,'horse-model.json'),'utf8')),history=new Map(),historyDir=path.join(dir,'odds-history');
for(const f of await readdir(historyDir))for(const line of (await readFile(path.join(historyDir,f),'utf8')).split('\n'))if(line){try{const r=JSON.parse(line);history.set(`${r.date}|${r.city}|${r.number}`,r);}catch{}}
const db=new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true}),{races,runsByHorse,breedByHorse,sireByHorse,range}=loadHorseArchive(db);enrichArchive(db,races);
attachSpeedFigures(runsByHorse,breedByHorse,buildSpeedPars(runsByHorse,breedByHorse,{before:model.split}));
const recs=replayRaces({model,races,runsByHorse,sireByHorse,ruleWeights:model.ruleWeights.discovery}),recBy=new Map(recs.map(r=>[`${r.date}|${r.city}|${r.number}`,r]));
const asRace=r=>({rows:r.rows,winners:r.winners}),fit=(set,before='9999')=>fitConditionalLogit(recs.filter(r=>r.date<before).map(asRace),set),weights={a:fit(MODEL_SETS.piyasasiz,'2023-01-01'),b:fit(MODEL_SETS.piyasasiz,'2025-01-01'),c:fit(MODEL_SETS.piyasasiz,'2026-01-01')},weightOf=d=>d<'2025-01-01'?weights.a:d<'2026-01-01'?weights.b:weights.c;
log('agirliklar tamam');

const istanbul=label=>Date.parse(label.replace(' ','T')+'+03:00'),state=createLongshotState(),rows=[];let pending=[],current=null;
const flush=()=>{for(const x of pending)state.update(x.race,x.entries);pending=[];};
for(const x of races.filter(x=>x.race.status==='RESULT'&&x.race.winners)){
 const {race,entries}=x;if(race.date!==current){flush();current=race.date;}
 const key=`${race.date}|${race.city}|${race.number}`,rec=recBy.get(key),h=history.get(key);
 if(rec&&race.date>=FROM&&h?.t.length&&race.time&&rec.rows.every(r=>r.odds>0)){
  const off=Date.parse(/Z$/.test(race.time)?race.time:race.time+'Z'),times=h.t.map(istanbul),series=rec.rows.map(r=>h.r[String(r.number)]??[]),free=raceProbabilities(rec.rows,weightOf(race.date));
  const priceAt=m=>{const ms=off-m*60000;let k=-1;for(let i=0;i<times.length;i++)if(times[i]<=ms)k=i;if(k<0||ms-times[k]>20*60000)return null;const p=series.map(s=>{for(let i=k;i>=0;i--)if(s[i]>0)return s[i];return null;});return p.every(v=>v>0)?p:null;};
  for(const [view,minutes] of [['15',15],['read',(((off/60000-READ_MINUTE-1)%30)+30)%30+1]]){
   const prices=priceAt(minutes);if(!prices)continue;const signals=longshotSignals({race,rows:rec.rows,entries,free,prices,runsByHorse,state});
   rec.rows.forEach((r,i)=>{if(prices[i]>=LONGSHOT_MIN_PRICE)rows.push({view,meeting:race.date+'|'+race.city,year:+race.date.slice(0,4),y:race.winners.includes(r.number)?1:0,close:r.odds,lc:-Math.log(r.odds),signals:signals[i]});});
  }
 }
 state.noteDay(race,entries);pending.push(x);
}
flush();log('sinyaller',rows.length);

const base=rows.filter(r=>r.view==='15');
function fitScore(train){
 const nullW=fitLogistic(train.map(r=>({x:[1,r.lc,r.lc*r.lc],y:r.y})),{l2:0,iterations:30}),offset=r=>nullW[0]+nullW[1]*r.lc+nullW[2]*r.lc*r.lc,stats=signalStats(train.map(r=>r.signals));
 const trees=boostLongshot(train.map(r=>({z:scaleSignals(r.signals,stats),offset:offset(r),y:r.y}))),score=r=>longshotScore(scaleSignals(r.signals,stats),trees),ordered=train.map(score).sort((a,b)=>a-b);
 return {nullW,offset,stats,trees,score,cut:ordered[Math.floor(.9*ordered.length)]};
}
const judge=(year,F)=>{const of=l=>betSummary(l.map(r=>({meeting:r.meeting,y:r.y,close:r.close,expected:1/(1+Math.exp(-F.offset(r)))}))),out={};for(const view of ['15','read']){const t=rows.filter(r=>r.view===view&&r.year===year);out[view]={all:of(t),candidates:of(t.filter(r=>F.score(r)>=F.cut))};log(year,view,JSON.stringify(out[view].candidates));}return out;};
const y2025=judge(2025,fitScore(base.filter(r=>r.year<2025))),y2026=judge(2026,fitScore(base.filter(r=>r.year<2026))),live=fitScore(base);
const frozenFrom=new Date(Date.parse(range.to)+86400000).toISOString().slice(0,10);
await writeFile(modelFile,JSON.stringify({schemaVersion:1,trainedAt:new Date().toISOString(),frozenFrom,modelTrainedAt:model.trainedAt,signals:LONGSHOT_SIGNALS,stats:live.stats,cut:live.cut,trees:live.trees,nullW:live.nullW,freeWeights:Array.from(fit(MODEL_SETS.piyasasiz)),oldWeights:Array.from(fit(MODEL_SETS.obsidian)),oldCandidates:model.surprise.candidates,report:{2025:y2025,2026:y2026}}));

const pct=v=>(100*v).toFixed(1).replace('.',',')+'%',num=v=>v.toFixed(2).replace('.',','),row=(name,s)=>`| ${name} | ${s.bets} | ${s.wins} | ${num(s.ratio)} (${num(s.ratioCi[0])}–${num(s.ratioCi[1])}) | ${pct(s.roi)} (${pct(s.roiCi[0])} / ${pct(s.roiCi[1])}) |`;
await writeFile(path.join(root,'docs/horse-longshot.md'),['# Uzun atış skoru (ileriye dönük testte, sitede deneme olarak gösteriliyor)','',
 `Yarış öncesi ganyanı en az ${LONGSHOT_MIN_PRICE} olan atlar arasında, kapanış fiyatının bilmediğini arayan bir skor. Sığ ağaçlar kapanış fiyatının üstüne eğitilir; okuduğu ${LONGSHOT_SIGNALS.length} sinyal yarıştan önce bilinir. Skoru eğitim dönemindeki en iyi %10'a giren at adaydır. Ödemeler kapanış fiyatıyla hesaplanır; kendi bahsinin fiyatı düşürmesi hesaba katılmaz. **Kâr iddiası yoktur.**`,'',
 '## Geçmiş sonuçlar','','"Kat", kapanış fiyatının beklediğine göre kazanan sayısıdır; aralıklar %95 bootstrap. 2026 bu çalışma sırasında birkaç kez görüldüğü için tamamen bağımsız sayılmaz.','',
 '| Küme | Bahis | Kazanan | Kat | ROI |','|---|---:|---:|---|---|',row('2025, son okuma, adaylar',y2025.read.candidates),row('2025, son okuma, tüm uzun atışlar',y2025.read.all),row('2025, 15 dk, adaylar',y2025[15].candidates),row('2026, son okuma, adaylar',y2026.read.candidates),row('2026, son okuma, tüm uzun atışlar',y2026.read.all),row('2026, 15 dk, adaylar',y2026[15].candidates),'',
 '## İleriye dönük test','',`Model \`scripts/horse-longshot-model.json\` içinde dondurulmuştur ve ${frozenFrom} ve sonrasını sınar. Fiyat, sunucunun \`data/horse/odds-snapshots\` kayıtlarında yarıştan önce görülen son fiyattır. Kural testten önce yazıldı:`,'',
 `1. En az ${FORWARD_MIN_BETS} aday birikmeden karar verilmez.`,'2. Kat aralığının alt sınırı 1\'in üstünde olmalıdır.','3. ROI, aynı koşulardaki eski sürpriz adaylarından yüksek olmalıdır.','',
 'Ölçüm: sunucudan kayıtları ve veritabanını yerele alıp `npm run horse:longshotforward`. Geçerse skor sitedeki sürpriz adaylarının yerine önerilir; bunun için sinyalleri canlı yayında üretmek ve 512 MB sınırını sınamak gerekir.',''].join('\n'));
log('bitti',JSON.stringify({frozenFrom,agac:live.trees.length,kesim:live.cut,tepeRssMb:Math.round(process.resourceUsage().maxRSS/1024)}));
