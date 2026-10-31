import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPlayerGraphFeatureIndex,PLAYER_GRAPH_FEATURE_NAMES} from '../dist/player-graph-features.mjs';
const input=new URL(process.argv[2]??'../dist/data/training.json',import.meta.url),output=new URL(process.argv[3]??'../dist/data/training.json',import.meta.url);
const data=JSON.parse(await readFile(input,'utf8')),source=JSON.parse(await readFile(new URL('../data/player-graph-source.json',import.meta.url),'utf8'));
const labels=JSON.parse(await readFile(new URL('../data/training-source.json',import.meta.url),'utf8'));
const index=createPlayerGraphFeatureIndex(source.matches),byId=new Map(labels.matches.map(m=>[String(m.id),m]));
let processed=0;const started=performance.now();
for(const row of data.rows){
 const target=byId.get(String(row.id));if(!target)throw Error(`Missing target identity: ${row.id}`);
 const graph=index.features(target,{cutoff:row.date,formCount:row.formCount});
 const max=graph.evidence.maxAvailableAt;
 if(max&&!(Date.parse(max)<Date.parse(row.date)))throw Error(`Post-match graph feature: ${row.id}`);
 row.homeGraphFeatures=graph.home;row.awayGraphFeatures=graph.away;row.graphFeatureMaxAvailableAt=max;
 row.graphCoverage=graph.coverage;
 if(++processed%500===0)console.log(`${processed}/${data.rows.length} oyuncu ağı özellik satırı`);
}
data.schemaVersion=2;data.baseFeatureNames=data.baseFeatureNames??data.featureNames;data.graphFeatureNames=[...PLAYER_GRAPH_FEATURE_NAMES];
data.graphSource={id:source.id,matchCount:index.coverage.matchCount,appearanceCount:index.coverage.appearanceCount,featurePolicy:'same-league-prior-minutes-270-decay-120d-opponent-players-24-v1'};
data.id=createHash('sha256').update(JSON.stringify({sourceId:data.sourceId,graphSource:data.graphSource,rows:data.rows})).digest('hex');
data.createdAt=new Date().toISOString();
const temporary=new URL(output.href+'.tmp');await writeFile(temporary,JSON.stringify(data));await rename(temporary,output);
console.log(JSON.stringify({id:data.id,rows:data.rows.length,graphSource:data.graphSource,elapsedMs:performance.now()-started}));
