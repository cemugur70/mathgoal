import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {analyze} from '../dist/model.mjs';import {prepareSimulation,runSimulation,gbdtPhaseMeans} from '../dist/player-simulation.mjs';
const id=process.argv[2]??'5749726',formCount=Number(process.argv[3]??10),started=performance.now();
const bundle=JSON.parse(await readFile(new URL(`../dist/data/matches/${id}.json`,import.meta.url)));bundle.trainingData=JSON.parse(await readFile(new URL('../dist/data/training.json',import.meta.url)));
const result=analyze(bundle,{formCount,playerGraphMode:'market-graph'}),t=result.training,n=t.marketNetwork;
assert.equal(n.active,true,'the explicit network model must actually be used in this check');assert.equal(t.featureNames.length,255);
assert.ok(!result.marketNetwork.evidence.matchIds.includes(id));assert.ok(Date.parse(result.marketNetwork.evidence.maxAvailableAt)<Date.parse(result.target.date));
assert.ok(result.marketNetwork.neighbors.every(r=>Date.parse(r.availableAt)<Date.parse(result.target.date)));
assert.ok(Math.abs(result.marketNetwork.neighbors.reduce((s,r)=>s+r.weight,0)-1)<1e-12);assert.equal(n.testUsedForSelection,false);assert.equal(n.alignedCohorts,true);
const input=prepareSimulation(bundle,result);assert.deepEqual(input.baseMeans,result.baselinePrediction.poissonMeans);
const lineups=Object.fromEntries(input.teams.map(team=>{for(const p of t.gbdt.starters.teams[team.side].profiles)input.gbdtScenario.profiles[team.id][p.id]=p;return [team.id,t.gbdt.starters.teams[team.side].profiles.map(p=>p.id)];}));
assert.deepEqual(gbdtPhaseMeans(input,lineups),input.baseMeans);assert.deepEqual(input.gbdtScenario.reference.homeFeatures.slice(243),t.gbdt.targetInput.homeFeatures.slice(243));
const sim=runSimulation(input,{iterations:10000,seed:12345});
const changed={...bundle,actual:{homeScore:29,awayScore:28},trainingData:{...bundle.trainingData,rows:[...bundle.trainingData.rows,{...bundle.trainingData.rows[0],id,formCount,homeScore:29,awayScore:28}]}};
assert.deepEqual(analyze(changed,{formCount,playerGraphMode:'market-graph'}).prediction,result.prediction);
const automatic=analyze(bundle,{formCount,playerGraphMode:'auto'});assert.equal(automatic.training.marketNetwork.active,n.validated);
const summary={id,formCount,elapsedMs:Math.round(performance.now()-started),checks:'passed',modelVersion:result.version,dataId:t.dataId,counts:t.counts,
 active:n.active,experimental:n.experimental,reason:n.reason,featureCount:t.featureNames.length,treeCount:t.trees.length,
 forecast:result.prediction.topScores[0],baseMeans:input.baseMeans,simulation:{means:sim.means,forecast:sim.topScores[0]},
 comparison:n.comparison,graph:{nodes:result.marketNetwork.graph.nodes.length,links:result.marketNetwork.graph.links.length,coverage:result.marketNetwork.coverage},
 networkInputs:{home:result.marketNetwork.home,away:result.marketNetwork.away},learnedNetworkGains:t.featureImportance.filter(f=>f.feature.startsWith('marketNetwork.')),
 evidence:result.marketNetwork.evidence,automaticNetworkActive:automatic.training.marketNetwork.active};
await writeFile(new URL(`../data/market-network-prediction-${id}-${formCount}.json`,import.meta.url),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
