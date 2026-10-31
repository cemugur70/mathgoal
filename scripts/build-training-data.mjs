import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {analyze} from '../dist/model.mjs';
import {outcomeFeatures,OUTCOME_FEATURE_NAMES} from '../dist/outcome-training.mjs';
const source=JSON.parse(await readFile(new URL('../data/training-source.json',import.meta.url),'utf8'));
const matches=source.matches,byId=new Map(matches.map(m=>[String(m.id),m])),rows=[];
const available=m=>Date.parse(m.completedAt??m.finishedAt??m.endDate)||Date.parse(m.date)+3*3600000;
let next=0;
for(const formCount of [5,10])for(const m of matches){
 const result=analyze({target:m,matches},{formCount,skipComparisons:true,skipPlayerAnalysis:true,trainingLayer:false,h2hLayer:false});
 if(!result.baselinePrediction)continue;
 const means=result.baselinePrediction.poissonMeans;
 const featureIds=new Set([...result.graph.matchIds,...result.homeForm.map(r=>String(r.id)),...result.awayForm.map(r=>String(r.id))]);
 const featureMaxAvailableAt=Math.max(...[...featureIds].map(id=>available(byId.get(String(id)))));
 if(!(featureMaxAvailableAt<Date.parse(m.date)))throw Error(`Future feature evidence: ${m.id}`);
 rows.push({id:String(m.id),date:m.date,availableAt:new Date(available(m)).toISOString(),leagueId:m.leagueId,formCount,
  homeBase:means.home,awayBase:means.away,homeFeatures:outcomeFeatures(result.profiles,result.network,'home',means.home),
  awayFeatures:outcomeFeatures(result.profiles,result.network,'away',means.away),homeScore:m.homeScore,awayScore:m.awayScore,
  featureCutoff:m.date,featureMaxAvailableAt:new Date(featureMaxAvailableAt).toISOString()});
 if(++next%100===0)console.log(`${next} eğitim satırı hazır (${formCount} maç penceresi)`);
}
const data={schemaVersion:1,baseVersion:'network-v1.2.0',featureNames:OUTCOME_FEATURE_NAMES,createdAt:new Date().toISOString(),sourceId:source.sourceId,
 sourceMatchCount:matches.length,sources:source.sources,conflictingMatchIds:source.conflictingMatchIds,rows};
data.id=createHash('sha256').update(JSON.stringify({sourceId:data.sourceId,rows})).digest('hex');
const output=new URL(process.argv[2]??'../dist/data/training.json',import.meta.url),temporary=new URL(output.href+'.tmp');
await writeFile(temporary,JSON.stringify(data));await rename(temporary,output);
console.log(JSON.stringify({id:data.id,rows:rows.length,sourceMatches:matches.length,bytes:JSON.stringify(data).length}));
