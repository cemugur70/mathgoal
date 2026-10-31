import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {analyze} from '../dist/model.mjs';import {prepareSimulation,runSimulation,gbdtPhaseMeans} from '../dist/player-simulation.mjs';
import {SEASON_FEATURE_NAMES} from '../dist/season-features.mjs';
const id=process.argv[2]??'5749726',formCount=Number(process.argv[3]??10),started=performance.now();
const bundle=JSON.parse(await readFile(new URL(`../dist/data/matches/${id}.json`,import.meta.url)));bundle.trainingData=JSON.parse(await readFile(new URL('../dist/data/training.json',import.meta.url)));
assert.equal(bundle.trainingData.schemaVersion,6);
const result=analyze(bundle,{formCount,playerGraphMode:'market-graph'}),t=result.training,s=t.season,season=result.season;
assert.ok(season,'season features must be computed for the target');assert.equal(season.home.length,SEASON_FEATURE_NAMES.length);
assert.ok(!season.evidence.matchIds.includes(id));assert.ok(!season.evidence.maxAvailableAt||Date.parse(season.evidence.maxAvailableAt)<Date.parse(result.target.date));
assert.equal(s.testUsedForSelection,false);
if(s.active){assert.equal(t.featureNames.length,255+SEASON_FEATURE_NAMES.length);assert.equal(s.alignedCohorts,true);
 assert.deepEqual(t.gbdt.targetInput.homeFeatures.slice(-SEASON_FEATURE_NAMES.length),season.home);assert.deepEqual(t.gbdt.targetInput.awayFeatures.slice(-SEASON_FEATURE_NAMES.length),season.away);}
const input=prepareSimulation(bundle,result);assert.deepEqual(input.baseMeans,result.baselinePrediction.poissonMeans);
let sim=null;
if(t.gbdt?.active){const lineups=Object.fromEntries(input.teams.map(team=>{for(const p of t.gbdt.starters.teams[team.side].profiles)input.gbdtScenario.profiles[team.id][p.id]=p;return [team.id,t.gbdt.starters.teams[team.side].profiles.map(p=>p.id)];}));
 assert.deepEqual(gbdtPhaseMeans(input,lineups),input.baseMeans);assert.deepEqual(input.gbdtScenario.reference.homeFeatures.slice(243),t.gbdt.targetInput.homeFeatures.slice(243));
 sim=runSimulation(input,{iterations:10000,seed:12345});}
const changed={...bundle,actual:{homeScore:29,awayScore:28},trainingData:{...bundle.trainingData,rows:[...bundle.trainingData.rows,{...bundle.trainingData.rows[0],id,formCount,homeScore:29,awayScore:28}]}};
assert.deepEqual(analyze(changed,{formCount,playerGraphMode:'market-graph'}).prediction,result.prediction);
const automatic=analyze(bundle,{formCount,playerGraphMode:'auto'});const autoSeason=automatic.training.season;assert.equal(autoSeason.testUsedForSelection,false);assert.equal(autoSeason.active,autoSeason.validated&&autoSeason.context?.coverage.status==='ready','automatic mode activates only a validated season layer');
const summary={id,formCount,elapsedMs:Math.round(performance.now()-started),checks:'passed',modelVersion:result.version,dataId:t.dataId,counts:t.counts,
 season:{active:s.active,validated:s.validated,experimental:s.experimental,reason:s.reason,gain:s.validationNllGain,coveredTrainingMatches:s.coveredTrainingMatches,comparison:s.comparison},
 marketNetwork:{active:t.marketNetwork?.active,validated:t.marketNetwork?.validated},featureCount:t.featureNames.length,treeCount:t.trees.length,
 forecast:result.prediction.topScores[0],baseMeans:input.baseMeans,simulation:sim?{means:sim.means,forecast:sim.topScores[0]}:null,
 seasonInputs:{home:season.home,away:season.away,summaries:{home:{...season.summaries.home,matchIds:undefined},away:{...season.summaries.away,matchIds:undefined}},coverage:season.coverage,leagueMeans:season.leagueMeans},
 learnedSeasonGains:(t.featureImportance??[]).filter(f=>f.feature.startsWith('season.')),evidence:{...season.evidence,matchIds:season.evidence.matchIds.length},automaticSeasonActive:autoSeason.active,automaticSeasonValidated:autoSeason.validated,automaticSeasonGain:autoSeason.validationNllGain};
await writeFile(new URL(`../data/season-prediction-${id}-${formCount}.json`,import.meta.url),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
