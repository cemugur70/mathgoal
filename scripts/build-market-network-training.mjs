import {readFile,writeFile,rename} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createMarketNetworkIndex,MARKET_NETWORK_FEATURE_NAMES,MARKET_NETWORK_POLICY} from '../dist/market-network.mjs';
const file=new URL(process.argv[2]??'../dist/data/training.json',import.meta.url),data=JSON.parse(await readFile(file));
if(data.schemaVersion<4)throw Error('Pazar ağı için önce ilk 11 ve pazar özellikleri oluşturulmalı.');
const index=createMarketNetworkIndex(data.rows);let processed=0;
for(const row of data.rows){const target={id:row.id,date:row.date,home:row.homeTeam,away:row.awayTeam,leagueId:row.leagueId};
 const result=index.features(target,{home:row.homeMarketFeatures,away:row.awayMarketFeatures,cutoff:row.date,formCount:row.formCount,historyCounts:row.marketHistoryCounts});
 row.homeMarketNetworkFeatures=result.home;row.awayMarketNetworkFeatures=result.away;row.marketNetworkFeatureMaxAvailableAt=result.evidence.maxAvailableAt;row.marketNetworkCoverage=result.coverage;
 if(result.evidence.matchIds.includes(String(row.id))||result.evidence.maxAvailableAt&&Date.parse(result.evidence.maxAvailableAt)>=Date.parse(row.date))throw Error('Target / future network evidence: '+row.id);
 if(++processed%500===0)console.log(`${processed}/${data.rows.length} geçmiş sonuçlu pazar ağı satırı`);
}
data.schemaVersion=5;data.marketNetworkFeatureNames=[...MARKET_NETWORK_FEATURE_NAMES];data.marketNetworkPolicy={version:'market-profile-diffusion-v1',...MARKET_NETWORK_POLICY};
data.marketNetworkSource={eligibleProfileRows:index.size,labelPolicy:'strict-prior-completion-rolling-features'};
data.id=createHash('sha256').update(JSON.stringify({sourceId:data.sourceId,graphSource:data.graphSource,starterSource:data.starterSource,marketSource:data.marketSource,
 starterPolicy:data.starterPolicy,marketPolicy:data.marketPolicy,marketNetworkPolicy:data.marketNetworkPolicy,rows:data.rows})).digest('hex');data.createdAt=new Date().toISOString();
await writeFile(new URL(file.href+'.tmp'),JSON.stringify(data));await rename(new URL(file.href+'.tmp'),file);
console.log(JSON.stringify({schema:data.schemaVersion,id:data.id,rows:data.rows.length,profileRows:index.size,networkFeatures:MARKET_NETWORK_FEATURE_NAMES.length}));
