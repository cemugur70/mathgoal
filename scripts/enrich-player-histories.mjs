// Reuses an existing match archive; never reruns the team-network crawl.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {normalizeMatch} from '../dist/match-data.mjs';
import {collectPlayerHistories,buildLeagueCoverage,mergePlayerHistoryMatches,mergeSourceProvenance} from './player-history-collection.mjs';
import {createFotMobClient} from './fotmob-source.mjs';
import {getPlayerProfile,getPlayerHistoryPage} from './player-profile.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const matchId=process.argv[2];
if(!/^\d{4,12}$/.test(matchId??''))throw Error('Kullanım: node scripts/enrich-player-histories.mjs MAÇ_KİMLİĞİ');
const archive=path.join(root,'dist/data/matches',matchId+'.json');
const bundle=JSON.parse(await readFile(archive,'utf8'));
if(String(bundle.target?.id)!==matchId)throw Error('Arşiv maç kimliği eşleşmiyor.');
const cutoff=bundle.analysisAt??bundle.target.date,sources=[];
const get=createFotMobClient({cache:path.join(root,'data/cache'),sources});
const inventory=new Map((bundle.playerMetricInventory??[]).map(metric=>[metric.key,metric]));
const enrichment=await collectPlayerHistories({target:bundle.target,lineup:bundle.targetLineup,cutoff,
 baseMatches:[...(bundle.matches??[]),...(bundle.playerHistoryMatches??[])],trainingMatchIds:(bundle.matches??[]).map(match=>match.id),previousHistories:bundle.playerHistories??{},loadProfile:getPlayerProfile,
 loadPage:getPlayerHistoryPage,loadMatch:async(id,{signal})=>{
  const raw=await get('matchDetails',id,false,{signal});
  if(raw.general?.finished!==true)throw Error('Maç tamamlanmamış.');
  return normalizeMatch(raw,inventory);
 }});
const extra=mergePlayerHistoryMatches(bundle.matches??[],bundle.playerHistoryMatches,enrichment.playerHistoryMatches);
Object.assign(bundle,{playerHistories:enrichment.playerHistories,playerHistoryMatches:extra,playerMetricInventory:[...inventory.values()]});
try {
 const league=await get('leagues',bundle.target.leagueId,false,{cacheOnly:true});
 bundle.leagueCoverage=buildLeagueCoverage(league,bundle.matches??[],{cutoff,targetId:matchId});
} catch(error) {
 bundle.provenance??={};
 (bundle.provenance.errors??=[]).push({item:'player-league-coverage',error:String(error.message)});
}
bundle.provenance??={};bundle.provenance.playerHistory=enrichment.summary;
bundle.provenance.sources=mergeSourceProvenance(bundle.provenance.sources,sources,Object.values(enrichment.playerHistories).flatMap(history=>history.sources));
const bytes=JSON.stringify(bundle);
await writeFile(archive+'.tmp',bytes);await rename(archive+'.tmp',archive);
const latest=path.join(root,'dist/data/bundle.json');
let latestId=null;
try{latestId=JSON.parse(await readFile(latest,'utf8')).target?.id;}catch{}
if(String(latestId)===matchId){await writeFile(latest+'.tmp',bytes);await rename(latest+'.tmp',latest);}
console.log(JSON.stringify({matchId,playerHistory:enrichment.summary,extraMatches:extra.length,leagueCoverage:bundle.leagueCoverage??null}));
