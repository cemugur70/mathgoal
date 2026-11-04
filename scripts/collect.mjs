import {extractH2HMatches} from '../dist/h2h-model.mjs';
import {normalizeTargetLineup} from '../dist/player-data.mjs';
import {normalizeMatch} from '../dist/match-data.mjs';
import {createFotMobClient} from './fotmob-source.mjs';
import {collectPlayerHistories,buildLeagueCoverage,mergePlayerHistoryMatches,mergeSourceProvenance} from './player-history-collection.mjs';
import {getPlayerProfile,getPlayerHistoryPage} from './player-profile.mjs';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {matchContext} from '../dist/match-input.mjs';
import {spawn} from 'node:child_process';
import {openSync} from 'node:fs';
import {createPiRatingIndex,PI_POLICY,PI_FEATURE_NAMES} from '../dist/pi-ratings.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=path.join(root,'data/cache');
await mkdir(cache,{recursive:true});await mkdir(path.join(root,'dist/data'),{recursive:true});
const matchId=process.argv[2]||'5795493';
if(!/^\d{4,12}$/.test(matchId)) throw Error('Geçerli sayısal maç kimliği gerekiyor.');
const errors=[],sources=[];
const get=createFotMobClient({cache,sources,throttleMs:180});
const T0=performance.now();let TL=T0;const timing={matchId,stages:[],settledCache:process.env.FOTMOB_SETTLED_CACHE!=='0'};const mark=name=>{const t=performance.now();timing.stages.push({name,ms:Math.round(t-TL)});TL=t;};
const timed=(kind,fn)=>async(...args)=>{const t=performance.now();try{return await fn(...args);}finally{(timing.player??={})[kind]??={calls:0,ms:0};timing.player[kind].calls++;timing.player[kind].ms+=Math.round(performance.now()-t);}};
async function pool(items,fn){let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<items.length){let item=items[next++];try{await fn(item);}catch(e){errors.push({item,error:String(e.message)});console.warn(item,e.message);}}}));}
const rawTarget=await get('matchDetails',matchId,true),g=rawTarget.general;mark('hedef maç');
const {target,actual,collectedAt,analysisAt}=matchContext(rawTarget);
const date=analysisAt;
const teams={},rawTeams={},fixtures=new Map(),playerMetricInventory=new Map();
const eligible=m=>m.status?.finished&&!m.status.cancelled&&!m.status.awarded&&new Date(m.status.utcTime)<new Date(date)&&String(m.id)!==String(matchId)&&Number(m.tournament?.leagueId)!==489;
function addFixtures(list){for(const m of list.filter(eligible))fixtures.set(String(m.id),m);}
let frontier=[{id:g.homeTeam.id,name:g.homeTeam.name,depth:0},{id:g.awayTeam.id,name:g.awayTeam.name,depth:0}];
for(let depth=0;depth<=2;depth++){
 const next=new Map();await pool(frontier,async t=>{if(teams[t.id])return;const d=await get('teams',t.id);rawTeams[t.id]=d;teams[t.id]={id:Number(t.id),name:d.details?.name||t.name,depth};const f=(d.fixtures?.allFixtures?.fixtures||[]).filter(eligible).sort((a,b)=>new Date(b.status.utcTime)-new Date(a.status.utcTime));addFixtures(f.slice(0,depth===0?60:15));for(const m of f.slice(0,10)){for(const side of [m.home,m.away])if(!teams[side.id])next.set(side.id,{id:side.id,name:side.name,depth:depth+1});}});
 console.log(`Ağ katmanı ${depth}: ${Object.keys(teams).length} takım, ${fixtures.size} maç`);frontier=[...next.values()];
}
mark('takım ağı');const league=await get('leagues',g.leagueId);mark('lig');addFixtures(league.fixtures?.allMatches||[]);
for(const m of fixtures.values())for(const t of [m.home,m.away])teams[t.id]??={id:Number(t.id),name:t.name,depth:3};
const matches=[];let done=0;
await pool([...fixtures.keys()],async id=>{const d=await get('matchDetails',id);if(!d.general?.finished)return;const m=normalizeMatch(d,playerMetricInventory);if(!Number.isFinite(m.homeScore)||!Number.isFinite(m.awayScore)){errors.push({item:id,error:'Skor eksik'});return;}if(m.date>=date||m.id===matchId)return;matches.push(m);if(++done%25===0)console.log(`${done}/${fixtures.size} maç indirildi`);});
mark('geçmiş maç detayları');matches.sort((a,b)=>a.date.localeCompare(b.date));
const inventory={};for(const m of matches)for(const [k,s]of Object.entries(m.stats)){inventory[k]??={key:k,title:s.title,group:s.group,matches:0};inventory[k].matches++;}
const bundle={schemaVersion:1,collectedAt,analysisAt,target,actual,h2hMatches:extractH2HMatches(rawTarget),matches,teams,targetLineup:normalizeTargetLineup(rawTarget,{target,collectedAt}),playerMetricInventory:[...playerMetricInventory.values()],inventory:Object.values(inventory),provenance:{provider:'FotMob',method:'Public same-origin JSON responses; REA browser capture documented separately',sources,errors,cutoff:date,depth:2,formCount:10,excluded:['target-match','future-matches','unfinished','cancelled','awarded','club-friendlies'],scope:'Last 10 pre-match competitive fixtures per team; up to 60 fixtures per target team, 15 per discovered opponent plus current league season for comparison. All available match statistic keys and periods retained. Raw responses retained locally.'},teamSnapshots:{}};
for(const id of [g.homeTeam.id,g.awayTeam.id]){const d=rawTeams[id];bundle.teamSnapshots[id]={details:d?.details,stats:d?.stats,squad:d?.squad,transfers:d?.transfers,history:d?.history,observedAt:bundle.collectedAt,warning:'Güncel takım anlık görüntüsü; geçmiş tarihe ait olduğu doğrulanmadığından tahminde kullanılmaz.'};}
if(matches.length===0||!rawTeams[g.homeTeam.id]||!rawTeams[g.awayTeam.id])throw Error('Hedef takımların geçmişi alınamadı; mevcut arşiv korunuyor.');
mark('paket hazırlama');console.log('İlk 11 ve yedeklerin kişisel maç geçmişleri tamamlanıyor…');
let previousArchive=null;
try {
 const previous=JSON.parse(await readFile(path.join(root,'dist/data/matches',matchId+'.json'),'utf8'));
 if(String(previous.target?.id)!==matchId)throw Error('Mevcut arşivin maç kimliği eşleşmiyor.');
 previousArchive=previous;
} catch(error) {if(error.code!=='ENOENT')throw error;}
const cachedMatches=new Map([...(previousArchive?.matches??[]),...(previousArchive?.playerHistoryMatches??[]),...matches].map(match=>[String(match.id),match]));
const enrichment=await collectPlayerHistories({target,lineup:bundle.targetLineup,cutoff:date,baseMatches:[...cachedMatches.values()],
 trainingMatchIds:matches.map(match=>match.id),previousHistories:previousArchive?.playerHistories??{},
 loadProfile:timed('profile',getPlayerProfile),loadPage:timed('historyPage',getPlayerHistoryPage),loadMatch:async(id,{signal})=>{
  const raw=await get('matchDetails',id,false,{signal});
  if(raw.general?.finished!==true)throw Error('Maç tamamlanmamış.');
  return normalizeMatch(raw,playerMetricInventory);
 }});
mark('oyuncu geçmişleri');Object.assign(bundle,{playerHistories:enrichment.playerHistories,playerHistoryMatches:mergePlayerHistoryMatches(matches,previousArchive?.matches,previousArchive?.playerHistoryMatches,enrichment.playerHistoryMatches),
 leagueCoverage:buildLeagueCoverage(league,matches,{cutoff:date,targetId:target.id}),playerMetricInventory:[...playerMetricInventory.values()]});
let archiveMatches=[];try{archiveMatches=JSON.parse(await readFile(path.join(root,'data/training-source.json'),'utf8')).matches??[];}catch(error){if(error.code!=='ENOENT')throw error;}
{const piCutoff=bundle.analysisAt??target.date,pi=createPiRatingIndex([...archiveMatches,...bundle.matches,...bundle.playerHistoryMatches]).features(target,{cutoff:piCutoff});
 bundle.piRatings={policy:PI_POLICY.version,featureNames:[...PI_FEATURE_NAMES],cutoff:piCutoff,archiveMatches:archiveMatches.length,...pi};}
mark('pi-rating');
bundle.provenance.playerHistory=enrichment.summary;
for(const history of Object.values(enrichment.playerHistories))for(const source of history.sources)if(source.source)sources.push(source);
bundle.provenance.sources=mergeSourceProvenance(previousArchive?.provenance?.sources,sources);
console.log(`Oyuncu geçmişleri: ${enrichment.summary.complete} tam, ${enrichment.summary.exhausted} kaynak sonu, ${enrichment.summary.partial} kısmi.`);
await mkdir(path.join(root,'dist/data/matches'),{recursive:true});
await writeFile(path.join(root,'dist/data/matches',matchId+'.json.tmp'),JSON.stringify(bundle));
await rename(path.join(root,'dist/data/matches',matchId+'.json.tmp'),path.join(root,'dist/data/matches',matchId+'.json'));
await writeFile(path.join(root,'dist/data/bundle.json.tmp'),JSON.stringify(bundle));
await rename(path.join(root,'dist/data/bundle.json.tmp'),path.join(root,'dist/data/bundle.json'));
await writeFile(path.join(root,'data/source-manifest.json'),JSON.stringify(bundle.provenance,null,2));
mark('dosya yazma');
// Training runs detached so the analysis response does not wait for it; the previous published training file stays in use until the new one is complete.
await writeFile(path.join(root,'data/training.pending'),JSON.stringify({matchId,requestedAt:new Date().toISOString()}));
const trainingLog=openSync(path.join(root,'data/training-queue.log'),'a');
if(process.env.MATHGOAL_TRAINING_DETACH!=='0')spawn(process.execPath,[path.join(root,'scripts/train-queue.mjs')],{cwd:root,detached:true,stdio:['ignore',trainingLog,trainingLog],windowsHide:true}).unref();
console.log('Eğitim arka planda güncelleniyor; analiz bu sırada mevcut eğitim dosyasıyla çalışır.');mark('eğitim kuyruğu');
timing.totalMs=Math.round(performance.now()-T0);timing.sources={};for(const x of sources){const kind=x.url?.match(/api\/data\/(\w+)/)?.[1];if(!kind)continue;const k=timing.sources[kind]??={requests:0,cached:0,settled:0,fetched:0,fetchMs:0,expiredFetched:0,wouldSettle:0};k.requests++;if(x.cached){k.cached++;if(x.reuse==='settled')k.settled++;}else{k.fetched++;k.fetchMs+=x.ms??0;if(x.refetch==='expired')k.expiredFetched++;if(x.wouldSettle)k.wouldSettle++;}}
await writeFile(path.join(root,'data',`collect-timing-${matchId}.json`),JSON.stringify(timing,null,2));console.log('TOPLAMA_SÜRESİ '+JSON.stringify(timing));
console.log(JSON.stringify({target,actual,matches:matches.length,teams:Object.keys(teams).length,metrics:bundle.inventory.length,errors:errors.length}));
