import {goalProbabilities} from './outcome-training.mjs';
const finite=v=>typeof v==='number'&&Number.isFinite(v),stamp=v=>v==null?NaN:typeof v==='number'?v:Date.parse(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const STAT_MODEL_CACHE=new WeakMap();
const pair=(m,keys)=>{for(const key of keys){const v=m.stats?.[key]?.values;if(Array.isArray(v)&&v.length===2&&v.every(x=>finite(x)&&x>=0))return v;}return null;};
const STAT_KEYS={corners:['corners','corner_kicks'],cards:['yellow_cards'],reds:['red_cards'],shots:['total_shots','shots'],sot:['ShotsOnTarget','shots_on_target'],fouls:['fouls'],offsides:['Offsides','offsides']};
function facts(m,id){const own=String(m.home.id)===String(id)?0:1,stats={};for(const [name,keys]of Object.entries(STAT_KEYS)){const v=pair(m,keys);stats[name]=v?{own:v[own],against:v[1-own]}:null;}
 return {gf:own===0?m.homeScore:m.awayScore,ga:own===0?m.awayScore:m.homeScore,stats};}
const definitions=[];
const add=(id,label,group,test)=>definitions.push({id,label,group,test});
add('win','Galibiyet','goals',f=>f.gf>f.ga);add('draw','Beraberlik','goals',f=>f.gf===f.ga);add('loss','Mağlubiyet','goals',f=>f.gf<f.ga);
add('unbeaten','Yenilmez · 1X / X2','goals',f=>f.gf>=f.ga);add('notWin','Kazanamaz · X2 / 1X','goals',f=>f.gf<=f.ga);add('noDraw','Beraberlik olmaz · 12','goals',f=>f.gf!==f.ga);
add('score','Gol atar','goals',f=>f.gf>0);add('cleanSheet','Gol yemez','goals',f=>f.ga===0);
add('winToNil','Gol yemeden kazanır','goals',f=>f.gf>0&&f.ga===0);add('loseToNil','Gol atmadan kaybeder','goals',f=>f.gf===0&&f.ga>0);
add('btts','Karşılıklı gol · Var','goals',f=>f.gf>0&&f.ga>0);add('noBtts','Karşılıklı gol · Yok','goals',f=>f.gf===0||f.ga===0);
add('oddGoals','Toplam gol · Tek','goals',f=>(f.gf+f.ga)%2===1);add('evenGoals','Toplam gol · Çift','goals',f=>(f.gf+f.ga)%2===0);
for(const line of [.5,1.5,2.5,3.5,4.5,5.5])for(const over of [true,false])add(`total${over?'Over':'Under'}${line}`,`Toplam gol ${line} ${over?'üst':'alt'}`,'goals',f=>over?f.gf+f.ga>line:f.gf+f.ga<line);
for(const kind of ['own','against'])for(const line of [.5,1.5,2.5,3.5])for(const over of [true,false])add(`${kind}${over?'Over':'Under'}${line}`,`${kind==='own'?'Takım':'Rakip'} golü ${line} ${over?'üst':'alt'}`,'goals',f=>over?(kind==='own'?f.gf:f.ga)>line:(kind==='own'?f.gf:f.ga)<line);
for(const n of [0,1,2,3])add('goalsExact'+n,`Toplam tam ${n} gol`,'goals',f=>f.gf+f.ga===n);add('goals4plus','Toplam 4+ gol','goals',f=>f.gf+f.ga>=4);
for(let h=0;h<=3;h++)for(let a=0;a<=3;a++)add(`correct${h}:${a}`,`Takım perspektifinde skor ${h}–${a}`,'score',f=>f.gf===h&&f.ga===a);
for(const line of [-2,-1,1,2])for(const outcome of ['win','draw','loss'])add(`handicap${line}.${outcome}`,`Avrupa handikap ${line>0?'+':''}${line} · ${{win:'kazanır',draw:'berabere',loss:'kaybeder'}[outcome]}`,'goals',f=>outcome==='win'?f.gf+line>f.ga:outcome==='draw'?f.gf+line===f.ga:f.gf+line<f.ga);
for(const [kind,lines,label]of [['corners',[7.5,8.5,9.5,10.5,11.5,12.5],'Korner'],['cards',[2.5,3.5,4.5,5.5,6.5],'Sarı kart'],['shots',[19.5,23.5,27.5,31.5],'Şut'],['sot',[5.5,7.5,9.5],'İsabetli şut'],['fouls',[19.5,23.5,27.5],'Faul'],['offsides',[2.5,3.5,4.5],'Ofsayt']]){
 for(const line of lines)for(const over of [true,false])add(`${kind}${over?'Over':'Under'}${line}`,`Toplam ${label.toLocaleLowerCase('tr-TR')} ${line} ${over?'üst':'alt'}`,kind,f=>f.stats[kind]?over?f.stats[kind].own+f.stats[kind].against>line:f.stats[kind].own+f.stats[kind].against<line:null);
 for(const outcome of ['win','draw','loss'])add(`${kind}.${outcome}`,`${label} sayısı · ${{win:'daha fazla',draw:'eşit',loss:'daha az'}[outcome]}`,kind,f=>f.stats[kind]?outcome==='win'?f.stats[kind].own>f.stats[kind].against:outcome==='draw'?f.stats[kind].own===f.stats[kind].against:f.stats[kind].own<f.stats[kind].against:null);
}
for(const line of [3.5,4.5,5.5,6.5])for(const over of [true,false])add(`ownCorners${over?'Over':'Under'}${line}`,`Takım korneri ${line} ${over?'üst':'alt'}`,'corners',f=>f.stats.corners?over?f.stats.corners.own>line:f.stats.corners.own<line:null);
add('redCard','Maçta kırmızı kart · Var','reds',f=>f.stats.reds?f.stats.reds.own+f.stats.reds.against>0:null);
add('noRedCard','Maçta kırmızı kart · Yok','reds',f=>f.stats.reds?f.stats.reds.own+f.stats.reds.against===0:null);
export const MARKETS=Object.freeze(definitions);
export const CORE_MARKET_IDS=Object.freeze(['win','draw','unbeaten','score','cleanSheet','totalOver1.5','totalOver2.5','totalOver3.5','totalOver4.5','btts','ownOver1.5','againstOver1.5','oddGoals','cornersOver8.5','cornersOver9.5','cornersOver10.5','corners.win','cardsOver3.5','cardsOver4.5','redCard']);
export const MARKET_FEATURE_NAMES=Object.freeze(['own','opponent'].flatMap(side=>CORE_MARKET_IDS.flatMap(id=>['run','rate','coverage'].map(v=>`market.${side}.${id}.${v}`))));
function summarize(rows,market){
 const values=rows.map(r=>market.test(r.facts));let streak=0,state=values[0]??null;
 if(state!==null)for(const v of values){if(v!==state)break;streak++;}
 const recent=values.slice(0,30),observed=recent.filter(v=>typeof v==='boolean'),successes=observed.filter(Boolean).length;
 return {id:market.id,label:market.label,group:market.group,streak,state,rightCensored:streak>0&&streak===rows.length,
  consecutiveHistory:rows.length,known:observed.length,successes,frequency:observed.length?successes/observed.length:null,
  smoothedRate:observed.length?(successes+2)/(observed.length+4):null,coverage:recent.length?observed.length/recent.length:0};
}
export function createMarketHistoryIndex(matches){
 const byId=new Map(),conflicts=new Set();
 for(const m of matches??[]){if(m?.id==null||!m.home?.id||!m.away?.id||String(m.home.id)===String(m.away.id)||m.finished===false||m.cancelled||m.awarded||[489,114].includes(Number(m.leagueId))||![m.homeScore,m.awayScore].every(v=>Number.isInteger(v)&&v>=0&&v<=100)||!finite(stamp(m.date)))continue;
  const id=String(m.id),previous=byId.get(id);if(previous&&(m.homeScore!==previous.homeScore||m.awayScore!==previous.awayScore||m.date!==previous.date||String(m.home.id)!==String(previous.home.id)||String(m.away.id)!==String(previous.away.id))){conflicts.add(id);continue;}
  if(!previous||Object.keys(m.stats??{}).length>Object.keys(previous.stats??{}).length)byId.set(id,m);
 }
 for(const id of conflicts)byId.delete(id);const teams=new Map();
 for(const m of byId.values()){const start=stamp(m.date),end=stamp(m.completedAt??m.finishedAt??m.endDate),available=finite(end)?end:start+10800000;if(available<start)continue;
  for(const team of [m.home,m.away]){const id=String(team.id);if(!teams.has(id))teams.set(id,[]);teams.get(id).push({id:String(m.id),start,available,leagueId:m.leagueId,facts:facts(m,id)});}
 }
 for(const rows of teams.values())rows.sort((a,b)=>b.start-a.start||a.id.localeCompare(b.id));
 const contexts=new Map();return {features(target,{cutoff=target.date}={}){
  const contextKey=[target.id,target.home.id,target.away.id,target.leagueId,cutoff].join(':');if(contexts.has(contextKey))return contexts.get(contextKey);
  const before=stamp(cutoff),histories={},summaries={},evidence=new Map();
  for(const side of ['home','away']){const rows=(teams.get(String(target[side].id))??[]).filter(r=>r.id!==String(target.id)&&r.start<before&&r.available<before).slice(0,60);histories[side]=rows;rows.forEach(r=>evidence.set(r.id,r.available));summaries[side]=Object.fromEntries(MARKETS.map(m=>[m.id,summarize(rows,m)]));}
  const vector=side=>[side,side==='home'?'away':'home'].flatMap(s=>CORE_MARKET_IDS.flatMap(id=>{const m=summaries[s][id];return [m.state===null?0:(m.state?1:-1)*Math.min(30,m.streak)/30,m.smoothedRate===null?0:2*m.smoothedRate-1,m.coverage];}));
  const times=[...evidence.values()];const result={home:vector('home'),away:vector('away'),summaries,histories,
   evidence:{maxAvailableAt:times.length?new Date(Math.max(...times)).toISOString():null,matchIds:[...evidence.keys()].sort(),window:60,frequencyWindow:30,
    completeness:'archive-only',note:'Seriler arşivdeki ardışık maçlardır; aradaki maçların eksiksizliği kaynak kapsamına bağlıdır. Eksik bir metrik seriyi keser; bilinmeyen maç atlanmaz.'}};
  if(contexts.size>=16)contexts.clear();contexts.set(contextKey,result);return result;
 }};
}
export function countGrid(homeMean,awayMean,maximum=60){
 const h=goalProbabilities(homeMean,maximum),a=goalProbabilities(awayMean,maximum),rows=[];
 for(let i=0;i<h.length;i++)for(let j=0;j<a.length;j++)rows.push({home:i,away:j,probability:h[i]*a[j]});return rows;
}
export function marketProbability(market,grid,side='home'){
 let yes=0,knownMass=0;for(const c of grid??[]){const own=side==='home'?c.home:c.away,against=side==='home'?c.away:c.home;
  const f={gf:own,ga:against,stats:Object.fromEntries(Object.keys(STAT_KEYS).map(k=>[k,{own,against}]))},outcome=market.test(f);
  if(typeof outcome==='boolean'){knownMass+=c.probability;if(outcome)yes+=c.probability;}}
 return knownMass?clamp(yes/knownMass,0,1):null;
}
function meanStat(rows,kind,against){const observed=rows.slice(0,30).filter(r=>r.facts.stats[kind]);if(!observed.length)return null;
 let total=0,weight=0;for(let i=0;i<observed.length;i++){const w=Math.pow(.94,i);total+=observed[i].facts.stats[kind][against?'against':'own']*w;weight+=w;}return {mean:total/weight,count:observed.length};}
export function predictMarketTable(context,goalGrid){
 let cached=STAT_MODEL_CACHE.get(context);if(!cached){const models={};for(const kind of Object.keys(STAT_KEYS)){
  const hf=meanStat(context.histories.home,kind,false),ha=meanStat(context.histories.home,kind,true),af=meanStat(context.histories.away,kind,false),aa=meanStat(context.histories.away,kind,true);
  if([hf,ha,af,aa].every(v=>v?.count>=5)){const h=(hf.mean+aa.mean)/2,a=(af.mean+ha.mean)/2;models[kind]={home:h,away:a,minimumSample:Math.min(hf.count,ha.count,af.count,aa.count),grid:countGrid(h,a,kind==='shots'?150:kind==='fouls'?100:60)};}
 }
 const probabilities=new Map(MARKETS.filter(m=>!['goals','score'].includes(m.group)).map(m=>[m.id,{home:marketProbability(m,models[m.group]?.grid),away:marketProbability(m,models[m.group]?.grid,'away')}]));
 cached={models,probabilities};STAT_MODEL_CACHE.set(context,cached);}
 const statModels=cached.models;
 return {rows:MARKETS.map(m=>({id:m.id,label:m.label,group:m.group,home:context.summaries.home[m.id],away:context.summaries.away[m.id],
  probability:['goals','score'].includes(m.group)?marketProbability(m,goalGrid):cached.probabilities.get(m.id).home,
  probabilityAway:['goals','score'].includes(m.group)?marketProbability(m,goalGrid,'away'):cached.probabilities.get(m.id).away,
  method:['goals','score'].includes(m.group)?'score-model':statModels[m.group]?'stat-poisson-unvalidated':'unavailable'})),
  statModels:Object.fromEntries(Object.entries(statModels).map(([k,{grid,...v}])=>[k,v])),evidence:context.evidence,
  unavailable:['İlk yarı / maç sonucu ve yarı gol pazarları: zaman doğrulamalı devre skorları eksik.','İlk / son gol, gol dakikası ve oyuncu kart/asist/şut pazarları: ayrı olay ve oyuncu pazar modeli yok.','Kombine pazarların ortak olasılığı ve oran değeri: bağımlılık / bahis oranı verisi yok.'],
  note:'Uzun seri, sıradaki maçta tersinin olacağını veya serinin devam edeceğini garanti etmez. Seri girdileri yalnız doğrulama ile seçilen GBDT ağaçları üzerinden skor tahminine etki eder. Korner / kart / şut dağılımları ayrı, kalibre edilmemiş sayım modelleridir.'};
}
// Quarter Asian lines split the stake equally at adjacent half-lines. No odds or ROI is inferred.
export function settleAsian(own,against,line,{kind='handicap',under=false}={}){
 if(![own,against,line].every(finite)||own<0||against<0||Math.abs(line*4-Math.round(line*4))>1e-8)throw Error('Geçerli skor ve çeyrek basamaklı çizgi gerekli.');
 const quarter=Math.abs(Math.round(line*4))%2===1,lines=quarter?[line-.25,line+.25]:[line];let win=0,push=0,loss=0;
 for(const l of lines){const delta=kind==='total'?(under?l-own-against:own+against-l):own+l-against;if(Math.abs(delta)<1e-9)push+=1/lines.length;else if(delta>0)win+=1/lines.length;else loss+=1/lines.length;}
 return {win,push,loss};
}
export function asianProbabilities(grid,line,options={}){const totals={win:0,push:0,loss:0,fullWin:0,halfWin:0,fullPush:0,halfLoss:0,fullLoss:0};let mass=0;
 for(const c of grid??[]){const s=settleAsian(c.home,c.away,line,options);mass+=c.probability;for(const k of ['win','push','loss'])totals[k]+=s[k]*c.probability;
  totals[s.win===1?'fullWin':s.win===.5?'halfWin':s.push===1?'fullPush':s.loss===.5?'halfLoss':'fullLoss']+=c.probability;}
 return Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,mass?v/mass:0]));}
