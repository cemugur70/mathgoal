// Walk-forward evaluation of the horse network rating and the Obsidian blend; writes data/horse/horse-model.json and docs/horse-rating-model.md.
// Every race day is predicted from ratings built on earlier days only, then the day's results are applied.
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHorseRatingEngine,RATING_POLICY} from '../dist/horse-rating.mjs';
import {raceFeatures,raceProbabilities,fitConditionalLogit,scoreForecasts,MODEL_SETS,FEATURE_NAMES} from '../dist/horse-model.mjs';
import {buildSpeedPars,attachSpeedFigures} from '../dist/horse-speed.mjs';
import {loadHorseArchive} from './horse-archive.mjs';
import {CITIES} from './liderform-source.mjs';
import {learnRuleWeights,ruleSignals} from '../dist/horse-rules.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {races,runsByHorse,breedByHorse,range}=loadHorseArchive(new DatabaseSync(path.join(root,'data/horse/horses.db'),{readOnly:true}));
const WARMUP_DAYS=60,warmEnd=new Date(Date.parse(range.from)+WARMUP_DAYS*86400000).toISOString().slice(0,10);
const finished=races.filter(x=>x.race.status==='RESULT'&&x.race.winners);

/** Replays the archive day by day; returns one record per finished race with the pre-race engine prediction and features. */
function replay(policy,{features=true,ruleWeights=null}={}){
 const engine=createHorseRatingEngine(policy),out=[];let day=null,pending=[];
 const flush=()=>{for(const x of pending)engine.update(x.race,x.entries);pending=[];};
 for(const x of finished){
  if(x.race.date!==day){flush();day=x.race.date;}
  const ratings=engine.predict(x.race,x.entries),rules=features?ruleSignals(x.race,x.entries,ruleWeights):null;
  out.push({race:x.race,winners:x.race.winners,ratings,rows:features?raceFeatures(x.race,x.entries,{ratings,runsByHorse,rules}).map(r=>({...r,odds:x.entries.find(e=>e.number===r.number)?.odds??null})):null});
  pending.push(x);
 }
 flush();return {engine,out};
}
// Split: rules and weights are chosen on the discovery period and judged on the later confirmation period.
// Ratings learn from every domestic track; only the five predicted cities are evaluated and used to fit weights.
const predicted=r=>r.race.city in CITIES;
const evaluable=finished.filter(x=>x.race.date>=warmEnd&&predicted(x)).map(x=>x.race.date);
let split=process.env.HORSE_SPLIT||'2026-01-01',interim=false;
if(evaluable.filter(d=>d<split).length<500){split=evaluable[Math.floor(evaluable.length*.6)]??split;interim=true;}
const inDisc=r=>predicted(r)&&r.race.date>=warmEnd&&r.race.date<split,inConf=r=>predicted(r)&&r.race.date>=split;
// Speed-figure pars come from runs before the split only; each figure enters a race only through runs strictly before it.
const speedPars=buildSpeedPars(runsByHorse,breedByHorse,{before:split}),speedRuns=attachSpeedFigures(runsByHorse,breedByHorse,speedPars);
const netScore=(recs,pred)=>scoreForecasts(recs.map(r=>({probs:r.ratings.map(x=>x.prob),rows:r.ratings.map(x=>({number:x.number,odds:null})),winners:r.winners})));

// 1) Network policy: small grid, chosen by discovery log-loss of the pure rating (no other inputs).
const grid=[];
for(const lr of [.2,.35,.6])for(const halfLifeDays of [270,540])grid.push({...RATING_POLICY,lr,lrSurface:lr*.7,lrDistance:lr*.7,halfLifeDays});
const tried=grid.map(policy=>({policy,disc:netScore(replay(policy,{features:false}).out.filter(inDisc))}));
const best=tried.sort((a,b)=>a.disc.logLoss-b.disc.logLoss)[0].policy;
console.log('Ağ politikası',JSON.stringify({lr:best.lr,halfLifeDays:best.halfLifeDays}));

// 2) Backtest-gated rules: which rules enter the model, and with what weight, is decided on discovery races only.
const ruleWeights=learnRuleWeights(finished.filter(predicted),{split});
console.log('Kurallar',JSON.stringify({kesif:ruleWeights.discovery,uretim:ruleWeights.production}));
// 3) Features with the chosen policy, then each model set fitted on discovery and scored on confirmation.
const {engine,out}=replay(best,{ruleWeights:ruleWeights.discovery}),disc=out.filter(inDisc),conf=out.filter(inConf);
const asRace=r=>({rows:r.rows,winners:r.winners});
const models={};
for(const [name,use] of Object.entries(MODEL_SETS)){
 const w=fitConditionalLogit(disc.map(asRace),use);
 const score=recs=>scoreForecasts(recs.map(r=>({probs:raceProbabilities(r.rows,w),rows:r.rows,winners:r.winners})));
 models[name]={features:use,weights:Object.fromEntries(use.map(f=>[f,+w[FEATURE_NAMES.indexOf(f)].toFixed(4)])),discovery:score(disc),confirmation:score(conf),
  byBreed:Object.fromEntries(['TB','AR'].map(b=>[b,score(conf.filter(r=>r.race.breed===b))]))};
}
// References: uniform, and the closing-ganyan market (known only at the off; not a pre-race input).
const closing=recs=>scoreForecasts(recs.map(r=>{const inv=r.rows.map(x=>x.odds>0?1/x.odds:0),z=inv.reduce((a,v)=>a+v,0);return {probs:inv.map(v=>z?v/z:1/inv.length),rows:r.rows,winners:r.winners};}));
const uniform=recs=>scoreForecasts(recs.map(r=>({probs:r.rows.map(()=>1/r.rows.length),rows:r.rows,winners:r.winners})));
const references={uniform:{discovery:uniform(disc),confirmation:uniform(conf)},closingOdds:{discovery:closing(disc),confirmation:closing(conf),byBreed:Object.fromEntries(['TB','AR'].map(b=>[b,closing(conf.filter(r=>r.race.breed===b))]))}};
// 4) Production weights on every evaluable race, with the rules confirmed in both periods.
const all=replay(best,{ruleWeights:ruleWeights.production}).out.filter(r=>predicted(r)&&r.race.date>=warmEnd).map(asRace),production=Object.fromEntries(Object.entries(MODEL_SETS).map(([n,use])=>[n,fitConditionalLogit(all,use).map(v=>+v.toFixed(5))]));
const model={schemaVersion:2,trainedAt:new Date().toISOString(),range,warmupUntil:warmEnd,split,interim,policy:best,kgBeta:engine.kgBeta(),featureNames:FEATURE_NAMES,production,models,references,ruleWeights,
 policyGrid:tried.map(t=>({lr:t.policy.lr,halfLifeDays:t.policy.halfLifeDays,discoveryLogLoss:+t.disc.logLoss.toFixed(4),discoveryTop1:+t.disc.top1.toFixed(4)}))};
await writeFile(path.join(root,'data/horse/horse-model.json'),JSON.stringify(model,null,1));

const pct=v=>v==null?'–':(100*v).toFixed(1)+'%',f3=v=>v==null?'–':v.toFixed(3),sg=v=>v==null?'–':(v>0?'+':'')+(100*v).toFixed(1)+'%';
const NAMES={uniform:'Tekdüze olasılık (1. tahmin = 1 numaralı at)',handikap:'Yalnız handikap',ag:'Rakip ağı rating\'i',agTercih:'Ağ + pist/mesafe tercihi + kilo',hiz:'Yalnız hız puanı',piyasasizHizsiz:'Obsidian, piyasasız, hız puanı olmadan',obsidianHizsiz:'Obsidian, kuralsız, hız puanı olmadan',piyasasiz:'Obsidian, piyasasız (AGF hariç)',agf:'Yalnız AGF',obsidianKuralsiz:'Obsidian, kuralsız (AGF dahil)',obsidian:'Obsidian + backtest\'ten geçen kurallar',closingOdds:'Kapanış ganyanı (referans, yarış öncesi bilinmez)'};
const row=(name,s)=>`| ${NAMES[name]} | ${s.races} | ${pct(s.top1)} | ${pct(s.top3)} | ${f3(s.logLoss)} | ${sg(s.topRoi)} | ${s.valueBets??'–'} | ${sg(s.valueRoi)} |`;
const head=['| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |','|---|---:|---:|---:|---:|---:|---:|---:|'];
const md=['# At yarışı: rakip ağı rating\'i ve Obsidian modeli','',
 `Veri ${range.from} – ${range.to}: rating\'ler tüm yurt içi hipodromlardaki ${finished.length} sonuçlanmış koşudan öğrenilir (${finished.filter(x=>!predicted(x)).length}'i yalnızca ağ için: Kocaeli, Elazığ, Antalya, Şanlıurfa, Diyarbakır); değerlendirme ve ağırlıklar yalnızca İstanbul, Ankara, İzmir, Bursa ve Adana koşularında.`,
 `İngiliz + Arap. İlk ${WARMUP_DAYS} gün (${warmEnd} öncesi) yalnızca rating ısınması için kullanıldı.`,
 `Keşif: ${warmEnd} – ${split} öncesi (${disc.length} koşu) · doğrulama: ${split} ve sonrası (${conf.length} koşu).${interim?' **Ara bölme**: 2026 öncesi veri henüz yetersiz olduğundan bölme noktası değerlendirilebilir koşuların %60\'ına kondu; tam veriyle 2026-01-01 kullanılacak.':''}`,'',
 '## Yöntem','',
 '1. **Kim kimi geçti**: her geçmiş koşuda ödeme metninden bilinen ilk dereceler ve sonraki programlardan bilinen dereceler; derecesi bilinmeyen atlar bilinen ilk derecelerin arkasında sayılır.',
 '2. **Rakip ağı rating\'i** (Plackett–Luce, çevrimiçi): her koşu sonrası her at, rakiplerinin o anki gücüne göre beklenen ile gerçekleşen arasındaki fark kadar hareket eder. Güçlü atı geçmek daha çok kazandırır; güç ortak rakipler üzerinden yayılır.',
 '3. **Pist / mesafe tercihi**: ağ içinde rakip gücüne göre düzeltilmiş pist (çim/kum/sentetik) ve mesafe (kısa ≤1300, mil ≤1600, orta ≤2000, uzun) sapmaları; ayrıca atın tüm hipodromlardaki kariyer kaydından aynı koşulda ortalama derece puanı (1/derece) eksi genel ortalaması, 3 sanal koşuyla büzülmüş.',
 `4. **Hız puanı**: atın kendi bitiş derecesi, ırk + hipodrom + pist + mesafe için ${split} öncesi koşulardan alınan medyan dereceyle (par) karşılaştırılır ve o günün pist farkıyla (aynı gün, hipodrom ve pistteki tüm atların medyan sapması) düzeltilir; birim 1000 m başına saniye, pozitif = par'dan hızlı. ${speedRuns} koşuya puan verildi. Modele son 3 koşunun ortalaması ve son bir yıldaki son 4 koşunun en iyisi girer.`,
 '5. **Obsidian**: koşu içi softmax (koşullu logit) ile ağ rating\'i, tercihler, kilo, handikap, puan, son 3 koşu formu, dinlenme, hız puanı, apranti ve yarış öncesi AGF birleştirilir. Ağırlıklar yalnız keşif döneminde öğrenilir.',
 `6. Ağ politikası keşif döneminde küçük bir ızgaradan seçildi: öğrenme hızı ${best.lr}, yarı ömür ${best.halfLifeDays} gün. Kilo katsayıları (log-güç / kg): ${Object.entries(model.kgBeta).map(([b,v])=>`${b} ${v.toFixed(3)}`).join(', ')}.`,'',
 '**Değer bahsi**: model olasılığı × kapanış ganyanı ≥ 1,20 olan her ata 1 TL. Kapanış ganyanı yarıştan önce kesin bilinmediği için bu ROI gösterge niteliğindedir.','',
 '## Doğrulama dönemi (modelin hiç görmediği koşular)','',...head,row('uniform',references.uniform.confirmation),...Object.keys(MODEL_SETS).map(n=>row(n,models[n].confirmation)),row('closingOdds',references.closingOdds.confirmation),'',
 '### Irka göre (doğrulama)','','| Model | İngiliz: 1. tahmin | İngiliz: log-kayıp | Arap: 1. tahmin | Arap: log-kayıp |','|---|---:|---:|---:|---:|',
 ...['ag','piyasasiz','obsidianKuralsiz','obsidian'].map(n=>`| ${NAMES[n]} | ${pct(models[n].byBreed.TB.top1)} | ${f3(models[n].byBreed.TB.logLoss)} | ${pct(models[n].byBreed.AR.top1)} | ${f3(models[n].byBreed.AR.logLoss)} |`),
 `| ${NAMES.closingOdds} | ${pct(references.closingOdds.byBreed.TB.top1)} | ${f3(references.closingOdds.byBreed.TB.logLoss)} | ${pct(references.closingOdds.byBreed.AR.top1)} | ${f3(references.closingOdds.byBreed.AR.logLoss)} |`,'',
 '## Keşif dönemi (ağırlıkların öğrenildiği dönem)','',...head,row('uniform',references.uniform.discovery),...Object.keys(MODEL_SETS).map(n=>row(n,models[n].discovery)),row('closingOdds',references.closingOdds.discovery),'',
 '## Kural katmanı (backtest ile uygulanan kurallar)','',
 'Kullanıcı kural setindeki her kural, yarış öncesi bilgiyle (favori = AGF sırası; kapanış ganyanı yarıştan önce bilinmez) aynı sayıda AGF favorisine karşı test edilir. Kuralın modeldeki ağırlığı bu farktır (kazanma olasılığı puanı; negatif = kuralın seçtiği atlar piyasanın sandığından kötü).',
 `- **Walk-forward'da uygulanan**: keşif döneminde Benjamini–Hochberg q < 0,10 olan kurallar (${Object.keys(ruleWeights.discovery).length} kural). Doğrulama dönemi bu seçimi hiç etkilemez.`,
 `- **Canlı tahminde uygulanan**: ayrıca doğrulama döneminde aynı yönde p < 0,05 tekrar eden kurallar (${Object.keys(ruleWeights.production).length} kural).`,
 `- Etki: doğrulama döneminde kurallı Obsidian log-kayıp ${f3(models.obsidian.confirmation.logLoss)}, kuralsız ${f3(models.obsidianKuralsiz.confirmation.logLoss)}; 1. tahmin ${pct(models.obsidian.confirmation.top1)} / ${pct(models.obsidianKuralsiz.confirmation.top1)}. Obsidian\'daki kural katsayısı: ${models.obsidian.weights.rules}.`,'',
 '| Irk | Kural | Koşu (tüm) | Keşif: fark / q | Doğrulama: fark / p | Walk-forward | Canlı |','|---|---|---:|---|---|---|---|',
 ...ruleWeights.table.filter(t=>t.discovery.testable).sort((a,b)=>(a.q??1)-(b.q??1)).slice(0,25).map(t=>`| ${t.breed==='TB'?'İngiliz':'Arap'} | ${t.text} | ${t.n} | ${sg(t.discovery.diff)} / ${f3(t.q)} | ${sg(t.confirmation.diff)} / ${f3(t.confirmation.p)} | ${t.discoveryPass?'✔':'–'} | ${t.confirmed?'✔':'–'} |`),
 '','Tablo keşif q değerine göre ilk 25 test edilebilir kuralı gösterir; tamamı `data/horse/horse-model.json` içinde.','',
 '## Obsidian ağırlıkları (keşif)','','Özellikler koşu içinde ortalamadan sapma olarak girer; pozitif ağırlık kazanma şansını artırır.','','| Özellik | Ağırlık |','|---|---:|',
 ...Object.entries(models.obsidian.weights).map(([k,v])=>`| ${k} | ${v} |`),'',
 '## Ağ politikası ızgarası (keşif, yalnız rating)','','| Öğrenme hızı | Yarı ömür (gün) | Log-kayıp | 1. tahmin |','|---:|---:|---:|---:|',...model.policyGrid.map(g=>`| ${g.lr} | ${g.halfLifeDays} | ${g.discoveryLogLoss} | ${pct(g.discoveryTop1)} |`),''].join('\n');
await writeFile(path.join(root,'docs/horse-rating-model.md'),md);
console.log(JSON.stringify({races:finished.length,split,interim,discovery:disc.length,confirmation:conf.length,confirmationTop1:Object.fromEntries(Object.entries(models).map(([n,m])=>[n,+m.confirmation.top1.toFixed(3)])),closing:+references.closingOdds.confirmation.top1.toFixed(3)}));
