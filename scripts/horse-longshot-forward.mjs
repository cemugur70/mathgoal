// Scores the frozen long-shot model on races after its freeze date, using the prices the server stored before each off, and applies the rule fixed before the test.
// First bring the server's data here, since the local archive lags: data/horse/horses.db and data/horse/odds-snapshots. Writes nothing.
// Usage: node scripts/horse-longshot-forward.mjs [--snapshots folder] [--from YYYY-MM-DD]. A dry run with --from before the freeze date checks the code, not the score.
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {buildSpeedPars,attachSpeedFigures} from '../dist/horse-speed.mjs';
import {createLongshotState,lastPriceBefore,betSummary,forwardBets,forwardVerdict,loadLongshot,enrichArchive} from './horse-longshot-lib.mjs';
import {loadHorseArchive} from './horse-archive.mjs';
import {replayRaces} from './horse-replay.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse'),arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null;};
const frozen=loadLongshot(await readFile(path.join(root,'scripts/horse-longshot-model.json'),'utf8').catch(()=>null));if(!frozen)throw Error('Dondurulmuş model yok.');
const from=arg('from')??frozen.frozenFrom,snapshotDir=arg('snapshots')??path.join(dir,'odds-snapshots'),dry=from<frozen.frozenFrom;
const model=JSON.parse(await readFile(path.join(dir,'horse-model.json'),'utf8'));
if(model.trainedAt!==frozen.modelTrainedAt)console.log('Not: kural ağırlıkları donma anından sonra yeniden eğitilmiş; model ağırlıkları dondurulmuş haliyle kullanılıyor.');
const snapshots=new Map();for(const f of await readdir(snapshotDir).catch(()=>[]))for(const line of (await readFile(path.join(snapshotDir,f),'utf8')).split('\n'))if(line){try{const s=JSON.parse(line),k=`${s.date}|${s.city}|${s.number}`;(snapshots.get(k)??snapshots.set(k,[]).get(k)).push(s);}catch{}}
const db=new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true}),{races,runsByHorse,breedByHorse,sireByHorse,range}=loadHorseArchive(db);enrichArchive(db,races);
attachSpeedFigures(runsByHorse,breedByHorse,buildSpeedPars(runsByHorse,breedByHorse,{before:model.split}));
const recs=replayRaces({model,races,runsByHorse,sireByHorse,ruleWeights:model.ruleWeights.discovery}),recBy=new Map(recs.map(r=>[`${r.date}|${r.city}|${r.number}`,r]));
const state=createLongshotState(),lists={candidates:[],old:[],all:[]},count={races:0,priced:0,noSnapshot:0,noPrice:0};let pending=[],current=null;
const flush=()=>{for(const x of pending)state.update(x.race,x.entries);pending=[];};
for(const x of races.filter(x=>x.race.status==='RESULT'&&x.race.winners)){
 const {race,entries}=x;if(race.date!==current){flush();current=race.date;}
 const key=`${race.date}|${race.city}|${race.number}`,rec=recBy.get(key);
 if(rec&&race.date>=from&&race.time&&rec.rows.every(r=>r.odds>0)){
  count.races++;const off=Date.parse(/Z$/.test(race.time)?race.time:race.time+'Z'),stored=snapshots.get(key),prices=stored?lastPriceBefore(stored,off,rec.rows.map(r=>r.number)):null;
  if(!stored)count.noSnapshot++;else if(!prices)count.noPrice++;
  if(prices){
   count.priced++;const bets=forwardBets(frozen,{race,rows:rec.rows,entries,prices,runsByHorse,state});for(const k of Object.keys(lists))lists[k].push(...bets[k]);
  }
 }
 state.noteDay(race,entries);pending.push(x);
}
const pct=v=>v==null?'–':(100*v).toFixed(1)+'%',show=(name,s)=>console.log(`${name.padEnd(24)} ${String(s.bets).padStart(5)} at | ${String(s.wins).padStart(4)} kazandi | ${pct(s.winRate).padStart(6)} | kat ${s.ratio==null?'–':s.ratio.toFixed(2)}${s.ratioCi?` [${s.ratioCi[0].toFixed(2)},${s.ratioCi[1].toFixed(2)}]`:''} | ROI ${pct(s.roi)}${s.roiCi?` [${pct(s.roiCi[0])},${pct(s.roiCi[1])}]`:''}`);
console.log(`Donma ${frozen.frozenFrom} | olcum ${from} – ${range.to}${dry?' | KURU CALISMA: bu gunler egitimde, sonuc gecersiz':''}`);
console.log(`Kosu ${count.races} | fiyati kullanilan ${count.priced} | kaydi yok ${count.noSnapshot} | kayitta tam fiyat yok ${count.noPrice}`);
const C=betSummary(lists.candidates),O=betSummary(lists.old),A=betSummary(lists.all);show('Yeni adaylar',C);show('Eski adaylar, ayni kosular',O);show('Tum uzun atislar',A);
const v=forwardVerdict(C,O);console.log('Karar:',dry?'yok (kuru calisma)':JSON.stringify(v));
