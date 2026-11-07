// Long-shot score under forward test; the site does not use it. Boosted shallow trees trained with the closing price as an offset, so the score holds only what the final market misses.
// The signals are all known before the off and read the price of that moment, never the closing one. Pure, except enrichArchive, which reads the columns the shared archive loader leaves out.
import {marketShares} from '../dist/horse-odds.mjs';
import {FEATURE_NAMES} from '../dist/horse-model.mjs';

export const LONGSHOT_MIN_PRICE=10,LONGSHOT_MAX_MINUTES=60,FORWARD_MIN_BETS=500;
// The order matters: the trees pick columns by position, so a changed order is a different model.
export const LONGSHOT_SIGNALS=['logShare','entropy','favShare','overround','field','rankPrice','agfMissing','shinZ','logShin','figSd','figCeil','figVsField','placeSd','winShare','top3Share','lsWinsBefore','figN','figSlope','placeTrend','cusum','lastPct','lastBeatOdds','driftFromLast',
 'hcpDelta','hcpRel','hcpVsPrice','kgRel','kgDelta','classDrop','pointRel','pointVsPrice','pointDelta','prizeLog','trainerAE','trainerLsAE','jockeyAE','jockeyLsAE','ownerLsAE','jockeyChange','jockeyUpgrade','trainerChange','pairRuns','mates','mateShorter','ownerMates',
 'daysOffLog','eqAdded','eqRemoved','addB','addTT','firstTrack','distChange','gallopRel','gallopVsPrice','sinceWinLog','gateAE','startRel','dayLs','dayGate','raceNo','modelRatio','modelRank','netRel','formRel','speedRel'];
const TREE_DEFAULTS={trees:300,depth:3,lr:.04,lambda:20,minH:25,bins:32,colsample:.5,seed:7};
const idx=name=>FEATURE_NAMES.indexOf(name),mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const spread=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));};
function standardised(vals){const ok=vals.filter(v=>v!=null),m=ok.length?mean(ok):0,s=ok.length>1?spread(ok):0;return vals.map(v=>v==null||!s?0:(v-m)/s);}
/** 0 for the first runner, 1 for the last; an empty value goes last. Ascending for prices, descending for strength. */
function rankShare(vals,ascending=true){
 const order=vals.map((v,i)=>[v??(ascending?Infinity:-Infinity),i]).sort((a,b)=>ascending?a[0]-b[0]:b[0]-a[0]),rank=Array(vals.length);
 order.forEach(([,i],k)=>{rank[i]=vals.length>1?k/(vals.length-1):0;});return rank;
}
const shrunkRatio=(map,key)=>{const o=map.get(key);return o?Math.log((o[0]+3)/(o[1]+3)):0;};
const bump=(map,key,won,share)=>{const o=map.get(key)??map.set(key,[0,0]).get(key);o[0]+=won;o[1]+=share;};
const gateKey=(race,startShare)=>`${race.trackCode}|${race.surface}|${race.distance<1400?'k':race.distance<1800?'m':'u'}|${Math.min(3,Math.floor(startShare*4))}`;
const runnersOf=entries=>entries.filter(e=>e.status!=='NONRUNNER');
/** What finished races teach: wins over the market's expectation per jockey, trainer, owner and gate; each horse's starts; and each race day's picture at each track. */
export function createLongshotState(){
 const trainerAll=new Map(),trainerLs=new Map(),jockeyAll=new Map(),jockeyLs=new Map(),ownerLs=new Map(),gate=new Map(),jockeyRate=new Map(),pairs=new Map(),horses=new Map(),days=new Map();
 const dayOf=(date,city)=>{const k=date+'|'+city;return days.get(k)??days.set(k,{ls:0,gates:[]}).get(k);};
 return {trainerAll,trainerLs,jockeyAll,jockeyLs,ownerLs,gate,pairs,
  horse:id=>horses.get(id)??[],day:dayOf,
  jockeyWinRate(id){const o=jockeyRate.get(id);return o?(o[0]+1)/(o[1]+15):null;},
  /** A finished race enters its day's picture at once, since later races of that day may read it. */
  noteDay(race,entries){const rs=runnersOf(entries);if(!marketShares(rs.map(e=>e.odds)))return;const d=dayOf(race.date,race.city),st=rankShare(rs.map(e=>e.start));rs.forEach((e,i)=>{if(race.winners.includes(e.number)){if(e.odds>=LONGSHOT_MIN_PRICE)d.ls++;d.gates.push(st[i]);}});},
  /** A finished race enters the records once its day is over. */
  update(race,entries){
   const rs=runnersOf(entries),share=marketShares(rs.map(e=>e.odds)),n=rs.length,rank=share?rankShare(rs.map(e=>e.odds)):null,starts=rankShare(rs.map(e=>e.start));
   rs.forEach((e,i)=>{
    const won=race.winners.includes(e.number)?1:0,s=share?.[i]??0;
    if(share){bump(trainerAll,e.trainer,won,s);bump(jockeyAll,e.jockeyId,won,s);if(e.odds>=LONGSHOT_MIN_PRICE){bump(trainerLs,e.trainer,won,s);bump(jockeyLs,e.jockeyId,won,s);bump(ownerLs,e.owner,won,s);}bump(gate,gateKey(race,starts[i]),won,s);}
    const j=jockeyRate.get(e.jockeyId)??jockeyRate.set(e.jockeyId,[0,0]).get(e.jockeyId);j[0]+=won;j[1]+=1;bump(pairs,e.jockeyId+'|'+e.horseId,1,0);
    (horses.get(e.horseId)??horses.set(e.horseId,[]).get(e.horseId)).push({date:race.date,place:e.place,n,won,odds:e.odds,oddsRank:rank?.[i]??null,jockeyId:e.jockeyId,trainer:e.trainer,kg:e.kg,equipment:e.equipment??'',prize:race.prize1??null,track:race.trackCode});
   });
  }};
}
/**
 * The signals of every runner, in LONGSHOT_SIGNALS order, from what is known before the race; a value is null when the horse has too little history for it.
 * `rows` are the model's feature rows, `free` the market-free probabilities and `prices` the win prices of the same runners. Null unless every runner has a price.
 */
export function longshotSignals({race,rows,entries,free,prices,runsByHorse,state}){
 if(prices.length<2||!prices.every(v=>v>0))return null;
 const pi=prices.map(v=>1/v),over=pi.reduce((a,v)=>a+v,0),share=pi.map(v=>v/over),n=prices.length;
 let z=.02;for(let it=0;it<40;it++)z=Math.max(0,Math.min(.5,pi.reduce((a,v)=>a+Math.sqrt(z*z+4*(1-z)*v*v/over),0)-2));
 const shin=pi.map(v=>Math.max((Math.sqrt(z*z+4*(1-z)*v*v/over)-z)/(2*(1-z)),1e-6)),entropy=-share.reduce((a,v)=>a+v*Math.log(v),0)/Math.log(Math.max(n,2)),favShare=Math.max(...share),rankP=rankShare(prices);
 const byNumber=new Map(entries.map(e=>[e.number,e])),list=rows.map(r=>byNumber.get(r.number)),X=(name,i)=>rows[i].x[idx(name)],modelRank=rankShare(free,false),hasAgf=list.some(e=>e.agf1>0);
 const handicaps=list.map(e=>e.handicap>0?e.handicap:null),hcp=standardised(handicaps),hcpRank=rankShare(handicaps,false),kg=standardised(list.map(e=>e.kg??null)),pointsRaw=list.map(e=>e.point??null),points=standardised(pointsRaw),pointRank=rankShare(pointsRaw,false);
 const gallopRaw=rows.map((r,i)=>X('gallopMissing',i)?null:X('gallopBest',i)),gallop=standardised(gallopRaw),gallopRank=rankShare(gallopRaw,false),starts=rankShare(list.map(e=>e.start));
 const figsOf=e=>(runsByHorse.get(e.horseId)||[]).filter(u=>u.date<race.date&&u.fig!=null).sort((a,b)=>a.date.localeCompare(b.date)).slice(-8).map(u=>u.fig);
 const figField=standardised(list.map(e=>{const f=figsOf(e);return f.length?Math.max(...f):null;})),net=standardised(rows.map((_,i)=>X('net',i))),form=standardised(rows.map((_,i)=>X('form',i))),speed=standardised(rows.map((_,i)=>X('speedMissing',i)?null:X('speedAvg',i)));
 const trainers=new Map(),owners=new Map();list.forEach((e,i)=>{(trainers.get(e.trainer)??trainers.set(e.trainer,[]).get(e.trainer)).push(prices[i]);owners.set(e.owner,(owners.get(e.owner)??0)+1);});
 const today=state.day(race.date,race.city);
 return rows.map((r,i)=>{
  const e=list[i],past=state.horse(e.horseId),last=past.at(-1),figs=figsOf(e),pct=past.filter(p=>p.place>0&&p.n>1).slice(-10).map(p=>(p.place-1)/(p.n-1)),mid=figs.length?mean(figs):null;
  const slope=figs.length>=3?(()=>{const f=figs.slice(-5),mx=(f.length-1)/2,my=mean(f);let a=0,b=0;f.forEach((v,k)=>{a+=(k-mx)*(v-my);b+=(k-mx)**2;});return a/b;})():null;
  let cusum=null;if(figs.length>=4){let c=0;cusum=0;for(const v of figs.slice(-6)){c=Math.max(0,c+v-mid);cusum=Math.max(cusum,c);}}
  const eqNow=new Set((e.equipment??'').split(',').filter(Boolean)),eqOld=new Set((last?.equipment??'').split(',').filter(Boolean)),added=last?[...eqNow].filter(v=>!eqOld.has(v)):[],removed=last?[...eqOld].filter(v=>!eqNow.has(v)):[];
  const mates=trainers.get(e.trainer)??[],lastWin=[...past].reverse().find(p=>p.won);
  const f={logShare:Math.log(share[i]),entropy,favShare,overround:over,field:n,rankPrice:rankP[i],agfMissing:hasAgf?0:1,shinZ:z,logShin:Math.log(shin[i]),
   figSd:spread(figs),figCeil:figs.length>=3?Math.max(...figs)-mean(figs.slice(-3)):null,figVsField:figField[i],placeSd:spread(pct),winShare:past.length?past.filter(p=>p.won).length/past.length:null,top3Share:past.length?past.filter(p=>p.place>0&&p.place<=3).length/past.length:null,lsWinsBefore:past.filter(p=>p.won&&p.odds>=LONGSHOT_MIN_PRICE).length,figN:figs.length,figSlope:slope,
   placeTrend:pct.length>=4?mean(pct.slice(-2))-mean(pct.slice(0,-2)):null,cusum,lastPct:pct.at(-1)??null,lastBeatOdds:last?.oddsRank!=null&&last.place>0&&last.n>1?last.oddsRank-(last.place-1)/(last.n-1):null,driftFromLast:last?.odds>0?Math.log(prices[i]/last.odds):null,
   hcpDelta:e.handicap>0&&e.handicapPrev>0?e.handicap-e.handicapPrev:null,hcpRel:hcp[i],hcpVsPrice:rankP[i]-hcpRank[i],kgRel:kg[i],kgDelta:last?.kg&&e.kg?e.kg-last.kg:null,classDrop:last?.prize>0&&race.prize1>0?Math.log(last.prize/race.prize1):null,pointRel:points[i],pointVsPrice:rankP[i]-pointRank[i],pointDelta:e.point!=null&&e.pointPrev!=null?e.point-e.pointPrev:null,prizeLog:race.prize1>0?Math.log(race.prize1):null,
   trainerAE:shrunkRatio(state.trainerAll,e.trainer),trainerLsAE:shrunkRatio(state.trainerLs,e.trainer),jockeyAE:shrunkRatio(state.jockeyAll,e.jockeyId),jockeyLsAE:shrunkRatio(state.jockeyLs,e.jockeyId),ownerLsAE:shrunkRatio(state.ownerLs,e.owner),jockeyChange:last?(last.jockeyId!==e.jockeyId?1:0):null,jockeyUpgrade:last&&last.jockeyId!==e.jockeyId?(state.jockeyWinRate(e.jockeyId)??0)-(state.jockeyWinRate(last.jockeyId)??0):0,trainerChange:last?(last.trainer!==e.trainer?1:0):null,pairRuns:Math.log(1+(state.pairs.get(e.jockeyId+'|'+e.horseId)?.[0]??0)),
   mates:mates.length-1,mateShorter:mates.some(v=>v<prices[i])?1:0,ownerMates:owners.get(e.owner)-1,daysOffLog:e.daysOff>0?Math.log(e.daysOff):null,eqAdded:last?added.length:null,eqRemoved:last?removed.length:null,addB:added.includes('B')?1:0,addTT:added.includes('TT')?1:0,firstTrack:past.length?(past.some(p=>p.track===race.trackCode)?0:1):null,distChange:X('distanceChange',i),gallopRel:gallop[i],gallopVsPrice:gallopRaw[i]==null?null:rankP[i]-gallopRank[i],sinceWinLog:lastWin?Math.log(1+(Date.parse(race.date)-Date.parse(lastWin.date))/86400000):null,
   gateAE:shrunkRatio(state.gate,gateKey(race,starts[i])),startRel:starts[i],dayLs:today.ls,dayGate:today.gates.length?(mean(today.gates)-.5)*(starts[i]-.5):0,raceNo:race.number,modelRatio:Math.log(Math.max(free[i],1e-6)/share[i]),modelRank:modelRank[i],netRel:net[i],formRel:form[i],speedRel:speed[i]};
  return LONGSHOT_SIGNALS.map(k=>f[k]==null||!Number.isFinite(f[k])?null:+f[k].toFixed(4));
 });
}
/** Mean and spread of each signal over training rows, from the values present. */
export function signalStats(list){return LONGSHOT_SIGNALS.map((_,j)=>{const v=list.map(r=>r[j]).filter(x=>x!=null),m=v.length?mean(v):0;return {m,s:v.length>1?spread(v):0};});}
/** An empty signal, and one without spread, is neutral; outliers are capped. */
export const scaleSignals=(signals,stats)=>signals.map((v,j)=>v==null||!stats[j].s?0:Math.max(-5,Math.min(5,(v-stats[j].m)/stats[j].s)));
/** Boosts logistic trees on scaled signals, on top of a fixed offset per row. `list` = [{z,offset,y}]. Returns JSON-ready trees: {f,t,b,l,r} at a split and {v} at a leaf. */
export function boostLongshot(list,over={}){
 const P={...TREE_DEFAULTS,...over},N=list.length,K=list[0].z.length,edges=[];
 for(let f=0;f<K;f++){const v=list.map(r=>r.z[f]).sort((a,b)=>a-b),e=[];for(let q=1;q<P.bins;q++){const c=v[Math.floor(q*N/P.bins)];if(!e.length||c>e.at(-1))e.push(c);}edges.push(e);}
 const binOf=(e,v)=>{let lo=0,hi=e.length;while(lo<hi){const m=(lo+hi)>>1;if(v>e[m])lo=m+1;else hi=m;}return lo;},B=new Uint8Array(N*K);
 list.forEach((r,i)=>{for(let f=0;f<K;f++)B[i*K+f]=binOf(edges[f],r.z[f]);});
 const F=Float64Array.from(list,r=>r.offset),g=new Float64Array(N),h=new Float64Array(N),HG=new Float64Array(P.bins+1),HH=new Float64Array(P.bins+1),trees=[];let s=P.seed;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
 for(let t=0;t<P.trees;t++){
  for(let i=0;i<N;i++){const p=1/(1+Math.exp(-F[i]));g[i]=list[i].y-p;h[i]=Math.max(p*(1-p),1e-6);}
  const cols=[];for(let f=0;f<K;f++)if(rnd()<P.colsample)cols.push(f);if(!cols.length)cols.push(t%K);
  const grow=(rows,d)=>{
   let G=0,H=0;for(const i of rows){G+=g[i];H+=h[i];}const leaf={v:+(P.lr*G/(H+P.lambda)).toFixed(6)};if(d>=P.depth||H<2*P.minH)return leaf;
   const parent=G*G/(H+P.lambda);let best=1e-6,bf=-1,bt=0;
   for(const f of cols){HG.fill(0);HH.fill(0);for(const i of rows){const b=B[i*K+f];HG[b]+=g[i];HH[b]+=h[i];}let gl=0,hl=0;for(let b=0;b<edges[f].length;b++){gl+=HG[b];hl+=HH[b];if(hl<P.minH)continue;const hr=H-hl;if(hr<P.minH)break;const gr=G-gl,gain=gl*gl/(hl+P.lambda)+gr*gr/(hr+P.lambda)-parent;if(gain>best){best=gain;bf=f;bt=b;}}}
   if(bf<0)return leaf;
   const L=[],R=[];for(const i of rows)(B[i*K+bf]<=bt?L:R).push(i);
   // The threshold stays exact: rounding it down would send every row tied at the edge to the other branch.
   return {f:bf,t:edges[bf][bt],b:bt,l:grow(L,d+1),r:grow(R,d+1)};};
  const tree=grow(Array.from({length:N},(_,i)=>i),0);
  for(let i=0;i<N;i++){let n=tree;while(n.l)n=B[i*K+n.f]<=n.b?n.l:n.r;F[i]+=n.v;}
  trees.push(tree);
 }
 return trees;
}
export function longshotScore(z,trees){let a=0;for(const t of trees){let n=t;while(n.l)n=z[n.f]<=n.t?n.l:n.r;a+=n.v;}return a;}
/** Program numbers of the race's candidates: priced at the minimum or longer, with a score at or above the frozen cut. */
export function longshotPicks(model,args){
 const signals=longshotSignals(args);if(!model||!signals)return [];
 return args.rows.filter((r,i)=>args.prices[i]>=LONGSHOT_MIN_PRICE&&longshotScore(scaleSignals(signals[i],model.stats),model.trees)>=model.cut).map(r=>r.number);
}
/** Last price of each runner before the off from a race's stored snapshots, or null: none in time, too old, or a runner without a price. */
export function lastPriceBefore(snapshots,off,numbers,maxMinutes=LONGSHOT_MAX_MINUTES){
 const seen=(snapshots||[]).filter(s=>Date.parse(s.at)<off&&(off-Date.parse(s.at))/60000<=maxMinutes);if(!seen.length)return null;
 const last=seen.reduce((a,s)=>Date.parse(s.at)>Date.parse(a.at)?s:a),map=new Map(last.runners.map(r=>[String(r[0]),r[1]])),prices=numbers.map(n=>map.get(String(n))??null);
 return prices.every(v=>v>0)?prices:null;
}
/** Bets, wins, the closing price's expected wins and ROI at the closing price, with intervals that resample race meetings. `list` = [{meeting,y,close,expected}]. */
export function betSummary(list,seed=11){
 const groups=new Map();let wins=0,paid=0,expected=0;
 for(const r of list){const back=r.y?r.close:0,o=groups.get(r.meeting)??groups.set(r.meeting,[0,0,0,0]).get(r.meeting);o[0]++;o[1]+=back;o[2]+=r.y;o[3]+=r.expected;wins+=r.y;paid+=back;expected+=r.expected;}
 if(!list.length)return {bets:0,wins:0,winRate:null,expected:0,ratio:null,ratioCi:null,roi:null,roiCi:null};
 const G=[...groups.values()],roi=[],ratio=[];let s=seed;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
 for(let k=0;k<1000;k++){let a=0,b=0,c=0,d=0;for(let i=0;i<G.length;i++){const o=G[Math.floor(rnd()*G.length)];a+=o[0];b+=o[1];c+=o[2];d+=o[3];}roi.push(b/a-1);ratio.push(d?c/d:0);}
 roi.sort((x,y)=>x-y);ratio.sort((x,y)=>x-y);
 return {bets:list.length,wins,winRate:wins/list.length,expected,ratio:expected?wins/expected:null,ratioCi:[ratio[25],ratio[974]],roi:paid/list.length-1,roiCi:[roi[25],roi[974]]};
}
/** The rule fixed before the forward test: enough candidates, the lower bound of wins over expectation above 1, and ROI above the old candidates on the same races. */
export function forwardVerdict(candidates,old,minBets=FORWARD_MIN_BETS){
 if(candidates.bets<minBets)return {state:'bekliyor',reason:`${candidates.bets} / ${minBets} aday`};
 const ratioOk=candidates.ratioCi[0]>1,roiOk=old.roi==null||candidates.roi>old.roi;
 return {state:ratioOk&&roiOk?'gecti':'kaldi',ratioOk,roiOk};
}
/** The stored file; null when there is none or its signal list differs. */
export function loadLongshot(text){if(!text)return null;const data=JSON.parse(text);return data.signals?.join()===LONGSHOT_SIGNALS.join()?data:null;}
/** Adds the columns the score reads and the shared archive loader leaves out, under the names the race pages use. */
export function enrichArchive(db,races){
 const entries=new Map();for(const e of db.prepare('SELECT race_id,number,handicap_prev,point_prev,equipment,owner FROM entries').iterate())entries.set(e.race_id+'|'+e.number,e);
 const info=new Map();for(const r of db.prepare('SELECT id,prize1,track_code FROM races').iterate())info.set(r.id,r);
 for(const {race,entries:list} of races){const i=info.get(race.id);race.prize1=i?.prize1??null;race.trackCode=i?.track_code??null;for(const e of list){const x=entries.get(race.id+'|'+e.number);e.handicapPrev=x?.handicap_prev??null;e.pointPrev=x?.point_prev??null;e.equipment=x?.equipment??'';e.owner=x?.owner??null;}}
}
