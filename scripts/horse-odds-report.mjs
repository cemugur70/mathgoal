// Writes data/horse/horse-odds.json: ganyan bands, value bands and favourite strength on the confirmation period, with the site's out-of-sample probabilities.
// Run after horse-gbdt.mjs. Odds here are closing odds, so these are descriptions of the past, not bets.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {raceProbabilities,blendMarket,FEATURE_NAMES} from '../dist/horse-model.mjs';
import {loadEnsemble,ensembleProbabilities} from '../dist/horse-gbdt.mjs';
import {oddsReport} from '../dist/horse-odds.mjs';
import {buildSpeedPars,attachSpeedFigures} from '../dist/horse-speed.mjs';
import {loadHorseArchive} from './horse-archive.mjs';
import {replayRaces} from './horse-replay.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse');
const model=JSON.parse(await readFile(path.join(dir,'horse-model.json'),'utf8')),ensemble=loadEnsemble(await readFile(path.join(dir,'horse-gbdt.json'),'utf8').catch(()=>null),FEATURE_NAMES);
const {races,runsByHorse,breedByHorse,sireByHorse}=loadHorseArchive(new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true}));
attachSpeedFigures(runsByHorse,breedByHorse,buildSpeedPars(runsByHorse,breedByHorse,{before:model.split}));
const byName=w=>FEATURE_NAMES.map(f=>w[f]??0),obsidian=byName(model.models.obsidian.weights),free=byName(model.models.piyasasiz.weights);
const records=replayRaces({model,races,runsByHorse,sireByHorse,ruleWeights:model.ruleWeights.discovery,from:model.split}).map(r=>{
 const agf=r.rows.map(x=>x.agf),market=agf.some(v=>v>0),logit=raceProbabilities(r.rows,market?obsidian:free);
 return {date:r.date,rows:r.rows,winners:r.winners,agf,probs:ensemble?ensembleProbabilities(r.rows,logit,agf,ensemble.validation):blendMarket(logit,agf,model.marketBlend?.discovery)};});
const report=oddsReport(records);
await writeFile(path.join(dir,'horse-odds.json'),JSON.stringify({generatedAt:new Date().toISOString(),...report}));
console.log(JSON.stringify({races:report.races,from:report.from,to:report.to,overround:report.overround,withOdds:report.withOdds,levels:report.favourite.levels.map(l=>[l.key,l.runners,+l.winRate.toFixed(3),+l.roi.toFixed(3)])}));
