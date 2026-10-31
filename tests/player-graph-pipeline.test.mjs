import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('offline retraining retains older player facts and atomically publishes a graph feature artifact',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'mathgoal-graph-pipeline-'));
 try{
  for(const sub of ['scripts','dist','data','dist/data','dist/data/matches'])await mkdir(path.join(directory,sub),{recursive:true});
  for(const name of ['train.mjs','json-source-stream.mjs','export-training-source.mjs','export-player-graph-source.mjs','build-training-data.mjs','build-player-graph-training.mjs','build-starter-training.mjs','build-market-network-training.mjs','build-season-training.mjs','build-pi-training.mjs'])await copyFile(new URL('../scripts/'+name,import.meta.url),path.join(directory,'scripts',name));
  for(const name of await readdir(new URL('../dist/',import.meta.url)))if(name.endsWith('.mjs'))await copyFile(new URL('../dist/'+name,import.meta.url),path.join(directory,'dist',name));
  const teams=[{id:1,name:'A'},{id:2,name:'B'}],players=teams.flatMap(t=>[0,1].map(p=>({id:t.id*100+p,teamId:t.id,name:`P${t.id}${p}`,position:p===0?0:3,isGoalkeeper:p===0,minutes:90,starter:true,stats:{minutes_played:90,expected_goals:.2,expected_assists:.1,goals_prevented:p===0?.1:null}})));
  const match=(id,day)=>({id:String(id),date:new Date(Date.UTC(2025,0,day)).toISOString(),home:teams[0],away:teams[1],leagueId:71,finished:true,homeScore:2,awayScore:1,players,stats:{expected_goals:{values:[1.8,1.1]}}});
  const older=match(100000,1),current=Array.from({length:20},(_,i)=>match(100001+i,2+i));
  await writeFile(path.join(directory,'data/training-source.json'),JSON.stringify({schemaVersion:1,sourceId:'older-labels',sources:[],matches:[older]}));
  await writeFile(path.join(directory,'data/player-graph-source.json'),JSON.stringify({schemaVersion:1,id:'older-players',matches:[older]}));
  await writeFile(path.join(directory,'dist/data/matches/9999999.json'),JSON.stringify({target:{id:'9999999',date:'2025-02-01T00:00:00Z',home:teams[0],away:teams[1],leagueId:71},matches:current}));
  const run=spawnSync(process.execPath,['scripts/train.mjs'],{cwd:directory,encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(run.status,0,run.stderr+'\n'+run.stdout);
  const graph=JSON.parse(await readFile(path.join(directory,'data/player-graph-source.json'),'utf8'));
  assert.equal(graph.id,createHash('sha256').update(JSON.stringify(graph.matches)).digest('hex'),'streamed source keeps the canonical record hash');
  assert.ok(graph.matches.some(m=>m.id==='100000'),'pre-existing older season evidence is retained');
  const artifact=JSON.parse(await readFile(path.join(directory,'dist/data/training.json'),'utf8'));
  assert.equal(artifact.schemaVersion,6);assert.equal(artifact.seasonFeatureNames.length,14);assert.ok(artifact.rows.every(r=>r.homeSeasonFeatures.length===14&&r.awaySeasonFeatures.length===14&&(r.seasonFeatureMaxAvailableAt===null||Date.parse(r.seasonFeatureMaxAvailableAt)<Date.parse(r.date))));assert.equal(artifact.graphFeatureNames.length,12);assert.equal(artifact.starterFeatureNames.length,101);assert.equal(artifact.marketFeatureNames.length,120);assert.equal(artifact.marketNetworkFeatureNames.length,12);
  assert.ok(artifact.rows.length>0);assert.ok(artifact.rows.every(r=>r.homeGraphFeatures.length===12&&r.awayGraphFeatures.length===12));
  assert.ok(artifact.rows.every(r=>r.graphFeatureMaxAvailableAt===null||Date.parse(r.graphFeatureMaxAvailableAt)<Date.parse(r.date)));
  assert.ok(artifact.rows.every(r=>r.homeStarterFeatures.length===101&&r.awayStarterFeatures.length===101));
  assert.ok(artifact.rows.every(r=>r.starterFeatureMaxAvailableAt===null||Date.parse(r.starterFeatureMaxAvailableAt)<Date.parse(r.date)));
  assert.equal((await readdir(path.join(directory,'dist/data'))).some(name=>name.endsWith('.tmp')),false);
  assert.ok(artifact.rows.every(r=>r.homeMarketNetworkFeatures.length===12&&r.awayMarketNetworkFeatures.length===12));
  assert.ok(artifact.rows.every(r=>r.marketNetworkFeatureMaxAvailableAt===null||Date.parse(r.marketNetworkFeatureMaxAvailableAt)<Date.parse(r.date)));
  const published=await readFile(path.join(directory,'dist/data/training.json'),'utf8');
  await writeFile(path.join(directory,'scripts/build-market-network-training.mjs'),"throw Error('Injected network builder failure');");
  const failed=spawnSync(process.execPath,['scripts/train.mjs'],{cwd:directory,encoding:'utf8',timeout:15000,windowsHide:true});
  assert.notEqual(failed.status,0);assert.equal(await readFile(path.join(directory,'dist/data/training.json'),'utf8'),published,'failed retraining cannot replace the published artifact');
 }finally{
  const target=path.resolve(directory),temporaryRoot=path.resolve(tmpdir());
  if(path.dirname(target)!==temporaryRoot||!path.basename(target).startsWith('mathgoal-graph-pipeline-'))throw new Error('Unexpected pipeline cleanup target');
  await rm(target,{recursive:true,force:true});
 }
});
