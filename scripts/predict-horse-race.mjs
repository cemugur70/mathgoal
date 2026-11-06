// Predicts one race from the archive state strictly before its date and prints a Turkish markdown report with the field's
// head-to-head network. Usage: node scripts/predict-horse-race.mjs 2026-11-01 istanbul 5
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHorseRatingEngine,createMeetingIndex,distanceBucket} from '../dist/horse-rating.mjs';
import {raceFeatures,raceProbabilities,blendMarket,FEATURE_NAMES} from '../dist/horse-model.mjs';
import {loadEnsemble,ensembleProbabilities} from '../dist/horse-gbdt.mjs';
import {livePriceProbs,minutesToOff} from '../dist/horse-odds.mjs';
import {normalizeRacePage,SURFACES} from '../dist/horse-data.mjs';
import {ruleSignals} from '../dist/horse-rules.mjs';
import {createLiderformClient,createGallopClient} from './liderform-source.mjs';
import {gallopProfile} from '../dist/horse-gallop.mjs';
import {buildSpeedPars,attachSpeedFigures} from '../dist/horse-speed.mjs';
import {loadHorseArchive} from './horse-archive.mjs';
import {createConnectionStats} from '../dist/horse-connections.mjs';
import {createSirePreference} from '../dist/horse-pedigree.mjs';
import {surpriseInputs,surpriseRisk,surpriseCandidates,riskLevel} from '../dist/horse-surprise.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse');
const [date,city,number]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!city||!/^\d{1,2}$/.test(number||''))throw Error('Kullanım: node scripts/predict-horse-race.mjs YYYY-AA-GG şehir koşuNo');
const model=JSON.parse(await readFile(path.join(dir,'horse-model.json'),'utf8'));
const {races,runsByHorse,breedByHorse,sireByHorse,gallopPars}=loadHorseArchive(new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true}));
const page=await createLiderformClient({cache:path.join(dir,'cache')})(date,city,Number(number));
if(page.notFound)throw Error('Koşu sayfası bulunamadı.');
const target=normalizeRacePage(page,{date,city,number});if(!target)throw Error('Koşu sayfasında bu koşu yok.');
// The target page's own "last runs" fill career gaps (other tracks) for horses missing from the archive.
for(const u of target.runs){const list=runsByHorse.get(u.horseId)??runsByHorse.set(u.horseId,[]).get(u.horseId);if(!list.some(x=>x.date===u.date))list.push(u);}
attachSpeedFigures(runsByHorse,breedByHorse,buildSpeedPars(runsByHorse,breedByHorse));
const engine=createHorseRatingEngine(model.policy),past=races.filter(x=>x.race.date<date&&x.race.status==='RESULT');
const connections=createConnectionStats();
for(const x of past){engine.update(x.race,x.entries);connections.update(x.race,x.entries);}
const race={...target.race,classNumber:target.race.classNumber},entries=target.entries;
// Each runner's workouts before the race, from the race's gallop page.
const gallopPage=gallopPars?await createGallopClient({cache:path.join(dir,'cache')})(date,city,Number(number)).catch(()=>null):null;
if(gallopPage?.runners){const byNo=new Map(gallopPage.runners.map(r=>[String(r.number),r]));for(const e of entries){const r=byNo.get(String(e.number));e.gallop=r?gallopProfile(r.workouts,race,race.breed,gallopPars):null;}}
// Applied rules (confirmed in both backtest periods) move the probability; watched rules (discovery only) are shown, not used.
const applied=ruleSignals(race,entries,model.ruleWeights?.production),watched=ruleSignals(race,entries,model.ruleWeights?.discovery);
const ratings=engine.predict(race,entries),rows=raceFeatures(race,entries,{ratings,runsByHorse,rules:applied,connections,pedigree:createSirePreference(runsByHorse,sireByHorse)});
const hasAgf=entries.some(e=>e.agf1>0),set=hasAgf?'obsidian':'piyasasiz',base=raceProbabilities(rows,model.production[set]),netProbs=ratings.map(r=>r.prob);
const agfRows=rows.map(r=>({number:r.number,agf:entries.find(e=>e.number===r.number)?.agf1??null}));
// The surprise model was fitted on the logit probabilities.
const risk=model.surprise?surpriseRisk(surpriseInputs(race,agfRows,base),model.surprise.production):null,candidates=model.surprise?surpriseCandidates(agfRows,base,model.surprise.candidates):[];
const agf=agfRows.map(r=>r.agf),ensemble=loadEnsemble(await readFile(path.join(dir,'horse-gbdt.json'),'utf8').catch(()=>null),FEATURE_NAMES);
const modelProbs=ensemble?ensembleProbabilities(rows,base,agf,ensemble.live):blendMarket(base,agf,model.marketBlend?.production);
// A race without AGF takes the current price, as on the page.
const oddsLayer=ensemble?await readFile(path.join(dir,'horse-odds-layer.json'),'utf8').then(JSON.parse).catch(()=>null):null;
const odds=rows.map(r=>entries.find(e=>e.number===r.number)?.odds??null),probs=livePriceProbs(modelProbs,{odds,agf,minutes:minutesToOff(race.time,Date.now()),table:oddsLayer?.live})?.probs??modelProbs;
const net=createMeetingIndex(past).fieldNetwork(entries,date);
const ranked=rows.map((r,i)=>({...r,prob:probs[i],netProb:netProbs[i],entry:entries.find(e=>e.number===r.number)})).sort((a,b)=>b.prob-a.prob);
const pct=v=>(100*v).toFixed(1)+'%',sg=v=>(v>0?'+':'')+v.toFixed(2),B={kisa:'kısa',mil:'mil',orta:'orta',uzun:'uzun'};
const pairLine=p=>`| ${p.a} ${p.aName} – ${p.b} ${p.bName} | ${p.aheadA}–${p.aheadB} | ${p.meetings.slice(0,3).map(m=>`${m.date} ${m.city} ${SURFACES[m.surface]??m.surface} ${m.distance}m ${m.label}: ${m.placeA??'?'}.–${m.placeB??'?'}. (${m.kgA}–${m.kgB} kg)`).join('<br>')||'–'} | ${p.commonOpponents} | ${p.indirect>0?'+'+p.indirect:p.indirect} |`;
const actual=target.race.winners?`**Gerçek sonuç**: ${target.race.order.map(n=>`${n} ${entries.find(e=>e.number===n)?.name}`).join(' → ')}`:'Koşu henüz sonuçlanmadı.';
const md=[`# ${date} ${city} ${number}. koşu — ${target.race.label}, ${target.race.surfaceLabel} ${target.race.distance} m (${B[distanceBucket(target.race.distance)]}), ${target.race.breed==='TB'?'İngiliz':'Arap'} ${target.race.age??''}`,'',
 `Model: **${set==='obsidian'?'Obsidian (AGF dahil)':'Obsidian, piyasasız (AGF yok)'}**, ağırlıklar ${model.range.from} – ${model.range.to} verisiyle; rating\'ler yalnızca ${date} öncesi koşulardan. ${actual}`,'',...(risk==null?[]:[`**Sürpriz riski** (kazananın ganyanı ≥ ${model.surprise.odds} TL): ${pct(risk)} · ${riskLevel(risk)}. Sürpriz adayları: ${candidates.map(n=>`${n} ${entries.find(e=>e.number===n)?.name}`).join(', ')||'yok'}.`,'']),
 '| # | At | Kazanma olasılığı | Ağ rating\'i (genel / pist / mesafe) | Ağ koşusu | Kariyer: pist tercihi (n) | Mesafe tercihi (n) | Son dereceler | Kg | Handikap | Puan | AGF | Ganyan |',
 '|---:|---|---:|---|---:|---|---|---|---:|---:|---:|---:|---:|',
 ...ranked.map(r=>{const e=r.entry,p=r.profile,g=r.rating;return `| ${r.number} | ${r.name} | **${pct(r.prob)}** | ${sg(g.base)} / ${sg(g.surface)} / ${sg(g.distance)} | ${g.starts} | ${sg(p.surface.value)} (${p.surface.n}) | ${sg(p.distance.value)} (${p.distance.n}) | ${p.lastPlaces.join('-')||'–'} | ${e.kg??'–'} | ${e.handicap??'–'} | ${e.point??'–'} | ${e.agf1??'–'} | ${e.odds??'–'} |`;}),'',
 '## Kurallar (backtest ile)','',
 'Uygulanan: iki backtest döneminde de doğrulanan kurallar; olasılığı etkiler. İzlemede: yalnızca keşif döneminde anlamlı çıkanlar; olasılığı etkilemez. Ağırlık = kuralın seçtiği atların aynı sayıda AGF favorisine göre kazanma farkı.','',
 ...(()=>{const lines=ranked.flatMap(r=>[...applied.get(r.number).rules.map(x=>`| ${r.number} ${r.name} | uygulanan | ${x.text} | ${(100*x.weight).toFixed(1)} puan |`),
  ...watched.get(r.number).rules.filter(x=>!applied.get(r.number).rules.some(y=>y.id===x.id)).map(x=>`| ${r.number} ${r.name} | izlemede | ${x.text} | ${(100*x.weight).toFixed(1)} puan |`)]);
  return lines.length?['| At | Durum | Kural | Ağırlık |','|---|---|---|---:|',...lines]:['Bu koşuya uyan, backtest\'ten geçmiş kural yok.'];})(),'',
 '## Kim kimi geçti (rakip ağı)','','Doğrudan: iki atın birlikte koştuğu ve sırası bilinen geçmiş koşular (en yeni 3). Dolaylı: ortak rakiplere karşı karşılaştırma; + soldaki at lehine.','',
 '| Eşleşme | Doğrudan (sol–sağ önde) | Son karşılaşmalar | Ortak rakip | Dolaylı |','|---|---:|---|---:|---:|',
 ...net.filter(p=>p.meetings.length||p.commonOpponents).sort((a,b)=>b.meetings.length-a.meetings.length||b.commonOpponents-a.commonOpponents).slice(0,25).map(pairLine),''].join('\n');
await mkdir(path.join(dir,'predictions'),{recursive:true});
await writeFile(path.join(dir,'predictions',`${date}-${city}-${number}.json`),JSON.stringify({date,city,number,set,race:target.race,ranked:ranked.map(r=>({number:r.number,name:r.name,prob:r.prob,netProb:r.netProb,rating:r.rating,profile:r.profile})),network:net},null,1));
console.log(md);
