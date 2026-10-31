// A pre-match bipartite graph: match profiles <-> recurring market states.
// Outcomes are read only AFTER edges and diffusion weights have been frozen.
import {CORE_MARKET_IDS,MARKETS,MARKET_FEATURE_NAMES} from './market-model.mjs';
export const MARKET_NETWORK_FEATURE_NAMES=Object.freeze(['directOwnResidual','directOpponentResidual','networkOwnResidual','networkOpponentResidual',
 'networkWinRate','networkDrawRate','networkOver25Rate','networkBttsRate','scoreConcentration','effectiveSupport','meanSimilarity','missingFraction']);
export const MARKET_NETWORK_POLICY=Object.freeze({maximumNeighbors:48,minimumSharedMarkets:12,maximumDistance:.32,
 minimumHistory:3,restart:.35,iterations:8,halfLifeDays:365,residualPrior:12,minimumTargetNeighbors:12,minimumEffectiveSupport:6});
const finite=v=>typeof v==='number'&&Number.isFinite(v),stamp=v=>v==null?NaN:typeof v==='number'?v:Date.parse(v);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),valid=v=>Array.isArray(v)&&v.length===MARKET_FEATURE_NAMES.length&&v.every(x=>finite(x)&&Math.abs(x)<=3);
const neutral=()=>MARKET_NETWORK_FEATURE_NAMES.map(n=>n==='missingFraction'?1:0);
function tokens(v){const out=[];
 for(let i=0;i<CORE_MARKET_IDS.length*2;i++){const run=v[i*3],rate=v[i*3+1],coverage=v[i*3+2];if(coverage<.5)continue;
  const length=Math.round(Math.abs(run)*30),bucket=length===0?0:length===1?1:length<=3?2:length<=6?3:length<=10?4:5;
  const rateBucket=clamp(Math.floor((rate+1)*2),0,3),state=run===0?'u':run>0?'y':'n';
  out.push({id:`pattern:${i}:${state}${bucket}:${rateBucket}`,marketId:CORE_MARKET_IDS[i%20],side:i<20?'home':'away',state,bucket,rateBucket,coverage});
 }return out;
}
export function marketProfileDistance(a,b){let loss=0,weight=0,common=0;
 for(let i=0;i<CORE_MARKET_IDS.length*2;i++){const j=i*3,c=Math.min(a[j+2],b[j+2]);if(c<.5)continue;
  const knownRun=a[j]!==0&&b[j]!==0,runWeight=knownRun?.35:0;
  loss+=c*(runWeight*Math.abs(a[j]-b[j])/2+.65*Math.abs(a[j+1]-b[j+1])/2)/(runWeight+.65);weight+=c;common++;}
 return {distance:weight?loss/weight:Infinity,common,coverage:weight/(CORE_MARKET_IDS.length*2)};
}
function normalize(values){const sum=values.reduce((s,v)=>s+v,0);return sum>0?values.map(v=>v/sum):values.map(()=>0);}
function diffuse(neighbors){
 const patterns=new Map(),members=neighbors.map((n,i)=>tokens(n.vector).map(t=>{if(!patterns.has(t.id))patterns.set(t.id,{...t,members:[]});patterns.get(t.id).members.push({i,weight:t.coverage});return t.id;}));
 const personal=normalize(neighbors.map(n=>n.seed)),degrees=members.map(ids=>ids.reduce((sum,id)=>sum+1/Math.log(2+patterns.get(id).members.length),0));
 for(const p of patterns.values()){p.total=p.members.reduce((s,m)=>s+m.weight,0);p.rarity=1/Math.log(2+p.members.length);}
 let p=[...personal],difference=0;
 for(let iteration=0;iteration<MARKET_NETWORK_POLICY.iterations;iteration++){
  const next=personal.map(v=>MARKET_NETWORK_POLICY.restart*v);let dangling=0;
  for(const pattern of patterns.values())pattern.flow=0;
  for(let i=0;i<neighbors.length;i++){
   if(!degrees[i]){dangling+=p[i];continue;}
   for(const id of members[i]){const pattern=patterns.get(id);pattern.flow+=(1-MARKET_NETWORK_POLICY.restart)*p[i]*pattern.rarity/degrees[i];}
  }
  for(const pattern of patterns.values())for(const m of pattern.members)next[m.i]+=pattern.flow*m.weight/pattern.total;
  for(let i=0;i<next.length;i++)next[i]+=(1-MARKET_NETWORK_POLICY.restart)*dangling*personal[i];
  difference=next.reduce((s,v,i)=>s+Math.abs(v-p[i]),0);p=normalize(next);
 }
 return {weights:p,personal,patterns,difference};
}
function aggregate(neighbors,weights){
 const out={own:0,opponent:0,win:0,draw:0,awayWin:0,over25:0,btts:0,similarity:0,coverage:0,scores:new Map()};
 for(let i=0;i<neighbors.length;i++){const n=neighbors[i],p=weights[i],r=n.row,y=n.reversed?r.awayScore:r.homeScore,z=n.reversed?r.homeScore:r.awayScore,
  base=n.reversed?r.awayBase:r.homeBase,other=n.reversed?r.homeBase:r.awayBase;
  out.own+=p*clamp(Math.log((y+.5)/(base+.5)),-2,2);out.opponent+=p*clamp(Math.log((z+.5)/(other+.5)),-2,2);
  out.win+=p*Number(y>z);out.draw+=p*Number(y===z);out.awayWin+=p*Number(y<z);out.over25+=p*Number(y+z>=3);out.btts+=p*Number(y>0&&z>0);
  out.similarity+=p*n.similarity;out.coverage+=p*n.coverage;const key=y+':'+z;out.scores.set(key,(out.scores.get(key)??0)+p);
 }return out;
}
function featureVector(direct,network,nEff,count,side){const shrink=nEff/(nEff+MARKET_NETWORK_POLICY.residualPrior),reverse=side==='away';
 return [direct[reverse?'opponent':'own']*shrink,direct[reverse?'own':'opponent']*shrink,network[reverse?'opponent':'own']*shrink,network[reverse?'own':'opponent']*shrink,
  (2*network[reverse?'awayWin':'win']-1)*shrink,(2*network.draw-1)*shrink,(2*network.over25-1)*shrink,(2*network.btts-1)*shrink,
  Math.max(0,...network.scores.values())*shrink,Math.min(1,nEff/MARKET_NETWORK_POLICY.maximumNeighbors),network.similarity,
  1-network.coverage*Math.min(1,count/MARKET_NETWORK_POLICY.minimumTargetNeighbors)];
}
function graphFor(target,neighbors,diffusion,targetVector){
 const nodes=new Map(),links=[],root='target:'+target.id,add=(id,type,label,detail)=>{if(!nodes.has(id))nodes.set(id,{id,type,label,detail});return id;};
 add(root,'target',(target.home?.name??'Ev')+' – '+(target.away?.name??'Deplasman'),{matchId:String(target.id),date:target.date});
 for(const side of ['home','away']){const t=target[side]??{},id=add('team:'+String(t.id??side),'team',t.name??side,{teamId:t.id,side});links.push({source:root,target:id,weight:1,type:'target-team'});}
 const activeTokens=new Set(tokens(targetVector).map(t=>t.id));
 const chosen=[...diffusion.patterns.values()].filter(p=>activeTokens.has(p.id)||p.members.length>=3).sort((a,b)=>Number(activeTokens.has(b.id))-Number(activeTokens.has(a.id))||b.members.length-a.members.length||a.id.localeCompare(b.id)).slice(0,36);
 for(const p of chosen){const market=MARKETS.find(m=>m.id===p.marketId),ranges=['bilinmiyor','1','2–3','4–6','7–10','11+'];
  const label=(p.side==='home'?'Ev':'Dep')+' · '+(market?.label??p.marketId)+' · '+(p.state==='u'?'seri bilinmiyor':p.state==='y'?'var ':'yok ')+ranges[p.bucket];
  add(p.id,'pattern',label,{marketId:p.marketId,side:p.side,state:p.state,range:ranges[p.bucket],frequencyRange:[p.rateBucket/4,(p.rateBucket+1)/4],matches:p.members.length});
  if(activeTokens.has(p.id))links.push({source:root,target:p.id,weight:1,type:'current-pattern'});
 }
 for(let i=0;i<neighbors.length;i++){const n=neighbors[i],r=n.row,home=n.reversed?r.awayTeam:r.homeTeam,away=n.reversed?r.homeTeam:r.awayTeam,
  h=n.reversed?r.awayScore:r.homeScore,a=n.reversed?r.homeScore:r.awayScore,id=add('match:'+r.id,'match',(home?.name??r.id)+' '+h+'–'+a+' '+(away?.name??''),
   {matchId:String(r.id),date:r.date,availableAt:r.availableAt,homeScore:h,awayScore:a,similarity:n.similarity,weight:diffusion.weights[i],reversed:n.reversed,
    url:'https://www.fotmob.com/match/'+r.id,homeTeam:home??null,awayTeam:away??null});
  links.push({source:root,target:id,weight:diffusion.weights[i],type:'profile-similarity'});
  for(const p of chosen)if(p.members.some(m=>m.i===i))links.push({source:p.id,target:id,weight:1/Math.sqrt(p.members.length),type:'shared-pattern'});
  for(const team of [home,away])if(team?.id!=null){const tid=add('team:'+team.id,'team',team.name??String(team.id),{teamId:team.id});links.push({source:id,target:tid,weight:.4,type:'played-by'});}
 }
 return {nodes:[...nodes.values()],links};
}
export function createMarketNetworkIndex(inputRows){
 const rows=new Map(),conflicts=new Set();
 for(const r of inputRows??[]){if(!r||r.id==null||![5,10].includes(Number(r.formCount))||!valid(r.homeMarketFeatures)||!valid(r.awayMarketFeatures)||
  ![r.homeScore,r.awayScore].every(v=>Number.isInteger(v)&&v>=0&&v<=100)||![r.homeBase,r.awayBase].every(v=>finite(v)&&v>0&&v<=100))continue;
  const date=stamp(r.date),available=stamp(r.availableAt),marketMax=stamp(r.marketFeatureMaxAvailableAt),featureMax=stamp(r.featureMaxAvailableAt),cutoff=stamp(r.featureCutoff);
  if(![date,available,marketMax,featureMax,cutoff].every(Number.isFinite)||available<date||marketMax>=date||featureMax>=date||cutoff>date||featureMax>cutoff||
   (r.marketHistoryCounts?.home??0)<MARKET_NETWORK_POLICY.minimumHistory||(r.marketHistoryCounts?.away??0)<MARKET_NETWORK_POLICY.minimumHistory)continue;
  const key=String(r.id)+':'+r.formCount,old=rows.get(key);if(old&&(old.homeScore!==r.homeScore||old.awayScore!==r.awayScore||stamp(old.date)!==date)){conflicts.add(key);continue;}
  if(!old)rows.set(key,{...r,formCount:Number(r.formCount),date:r.date,availableAt:r.availableAt,start:date,available});
 }
 for(const key of conflicts)rows.delete(key);const library=[...rows.values()].sort((a,b)=>a.start-b.start||String(a.id).localeCompare(String(b.id)));
 return {size:library.length,features(target,{home,away,cutoff=target.date,formCount=10,historyCounts={home:10,away:10},includeGraph=false}={}){
  const before=stamp(cutoff),empty=reason=>({home:neutral(),away:neutral(),neighbors:[],graph:{nodes:[],links:[]},policy:MARKET_NETWORK_POLICY,
   coverage:{neighborCount:0,effectiveSupport:0,sharedMarketFraction:0,status:'insufficient',reason},evidence:{maxAvailableAt:null,matchIds:[],usesTargetOutcome:false,rankingUsesOutcomes:false}});
  if(!finite(before)||!valid(home)||!valid(away)||historyCounts.home<3||historyCounts.away<3)return empty('Her iki takımın en az üç geçmiş maç ve doğrulanmış pazar profili gerekli.');
  const eligible=library.filter(r=>String(r.id)!==String(target.id)&&r.formCount===Number(formCount)&&r.start<before&&r.available<before),candidates=[];
  for(const row of eligible){const same=marketProfileDistance(home,row.homeMarketFeatures),reverse=marketProfileDistance(home,row.awayMarketFeatures);
   const reversed=reverse.distance+.025<same.distance,match=reversed?reverse:same,distance=match.distance+(reversed?.025:0)+(String(row.leagueId)===String(target.leagueId)?0:.025);
   if(match.common<MARKET_NETWORK_POLICY.minimumSharedMarkets||distance>MARKET_NETWORK_POLICY.maximumDistance)continue;
   const similarity=Math.exp(-distance/.2),recency=Math.pow(.5,Math.max(0,(before-row.available)/86400000)/MARKET_NETWORK_POLICY.halfLifeDays);
   candidates.push({row,reversed,distance,similarity,coverage:match.coverage,common:match.common,vector:reversed?row.awayMarketFeatures:row.homeMarketFeatures,seed:similarity**3*Math.sqrt(match.coverage)*recency});
  }
  candidates.sort((a,b)=>a.distance-b.distance||b.row.start-a.row.start||String(a.row.id).localeCompare(String(b.row.id)));
  const neighbors=candidates.slice(0,MARKET_NETWORK_POLICY.maximumNeighbors);if(!neighbors.length)return empty('Eşik içinde, başlama öncesinde bilinen benzer pazar profili bulunamadı.');
  const diffusion=diffuse(neighbors),direct=aggregate(neighbors,diffusion.personal),network=aggregate(neighbors,diffusion.weights),nEff=1/diffusion.weights.reduce((s,p)=>s+p*p,0);
  const usable=neighbors.length>=MARKET_NETWORK_POLICY.minimumTargetNeighbors&&nEff>=MARKET_NETWORK_POLICY.minimumEffectiveSupport;
  return {home:featureVector(direct,network,nEff,neighbors.length,'home'),away:featureVector(direct,network,nEff,neighbors.length,'away'),
   neighbors:neighbors.map((n,i)=>({id:String(n.row.id),date:n.row.date,availableAt:n.row.availableAt,homeTeam:n.reversed?n.row.awayTeam:n.row.homeTeam,awayTeam:n.reversed?n.row.homeTeam:n.row.awayTeam,
    homeScore:n.reversed?n.row.awayScore:n.row.homeScore,awayScore:n.reversed?n.row.homeScore:n.row.awayScore,reversed:n.reversed,similarity:n.similarity,distance:n.distance,
    directWeight:diffusion.personal[i],weight:diffusion.weights[i],sharedMarkets:n.common,leagueId:n.row.leagueId})),
   graph:includeGraph?graphFor(target,neighbors,diffusion,home):{nodes:[],links:[]},policy:MARKET_NETWORK_POLICY,
   coverage:{neighborCount:neighbors.length,candidateCount:candidates.length,eligibleLibrary:eligible.length,effectiveSupport:nEff,sharedMarketFraction:network.coverage,
    patternCount:diffusion.patterns.size,diffusionResidual:diffusion.difference,status:usable?'ready':'insufficient',reason:usable?'Pazar profili ağı, geçmiş sonuçlardan 12 öğrenme girdisi üretti.':'Benzer maç sayısı veya etkin örneklem desteği düşük.'},
   evidence:{maxAvailableAt:new Date(Math.max(...neighbors.map(n=>n.row.available))).toISOString(),matchIds:neighbors.map(n=>String(n.row.id)),usesTargetOutcome:false,rankingUsesOutcomes:false,
    temporalEvaluation:'rolling-pre-match: önceki doğrulama/test maçları ancak bittikten sonra sonraki maçların geçmişine girebilir; model parametreleri testten seçilmez.'}};
 }};
}
