// Ganyan analysis: market shares, favourite strength and value bands, race-day odds snapshots and the historical odds report.
import {blendMarket,fitMarketBlend,scoreForecasts} from './horse-model.mjs';

// [upper bound, label]; a band holds values below its bound.
export const ODDS_BANDS=[[2,'2 altı'],[3,'2–3'],[5,'3–5'],[8,'5–8'],[12,'8–12'],[20,'12–20'],[40,'20–40'],[Infinity,'40 ve üstü']];
export const VALUE_BANDS=[[.6,'0,6 altı'],[.8,'0,6–0,8'],[1,'0,8–1'],[1.2,'1–1,2'],[1.5,'1,2–1,5'],[2,'1,5–2'],[Infinity,'2 ve üstü']];
export const FAVOURITE_LEVELS=[[.9,'zayıf'],[1.1,'normal'],[Infinity,'güçlü']];
export const bandOf=(bands,v)=>bands.find(b=>v<b[0])[1];

/** Shares of the win pool from odds: 1/odds, normalised over the runners with odds. Null when fewer than two have odds. */
export function marketShares(odds){
 const inv=odds.map(v=>v>0?1/v:null),z=inv.reduce((a,v)=>a+(v??0),0);
 return inv.filter(v=>v!=null).length<2?null:inv.map(v=>v==null?null:v/z);
}
/**
 * How the model reads the ganyan favourite: the model's probability over the favourite's market share, as a level.
 * `agrees` says the favourite is also the model's first pick. Null without usable odds.
 */
export function favouriteRead(probs,odds){
 const share=marketShares(odds);if(!share)return null;
 let index=-1;odds.forEach((v,i)=>{if(v>0&&(index<0||v<odds[index]))index=i;});
 const ratio=probs[index]/share[index];
 return {index,odds:odds[index],share:share[index],ratio,level:bandOf(FAVOURITE_LEVELS,ratio),agrees:probs.indexOf(Math.max(...probs))===index};
}
/** One race's odds and AGF at this moment, for the snapshot log; null once it has a result or while it has neither. */
export function oddsSnapshot(race,entries,at){
 if(race.status==='RESULT'||race.winners)return null;
 const runners=entries.filter(e=>e.odds>0||e.agf1>0).map(e=>[e.number,e.odds??null,e.agf1??null,e.agf2??null]);
 return runners.length?{at,date:race.date,city:race.city,number:race.number,time:race.time??null,runners}:null;
}
/**
 * A win-pool price series as the source gives it, for storing: {t:[labels],r:{number:[odds]}}. A runner's price is empty until it has a real one:
 * the source writes placeholders such as 999.99 or "&nbsp;9999.99" while no money is on it.
 */
export function parseOddsHistory({labels=[],datasets=[]}){
 const price=v=>{const n=Number(String(v??'').replace(/&nbsp;/g,'').trim());return n>0&&n<999?n:null;};
 return {t:labels,r:Object.fromEntries(datasets.map(d=>[String(d.label),d.data.map(price)]))};
}
// Minutes before the off with stored exponents; an earlier price than the limit stays out, since few races have one and it was not tested.
export const ODDS_HORIZONS=[240,120,60,30,15,5,1],ODDS_MAX_MINUTES=300;
/** Minutes from `now` to the off; negative after it. Race times are GMT, usually without a suffix. Null without a time. */
export const minutesToOff=(time,now)=>time?(Date.parse(/Z$/.test(time)?time:time+'Z')-now)/60000:null;
/** The horizon nearest to these minutes on a log scale; a price at or after the off counts as one minute before it. */
export const nearestHorizon=minutes=>{const m=Math.log(Math.max(minutes,1)),gap=h=>Math.abs(m-Math.log(h));return ODDS_HORIZONS.reduce((a,h)=>gap(h)<gap(a)?h:a);};
/** A price series point as the blend's second column. */
export const priceColumn=odds=>marketShares(odds).map(v=>Math.max(v,1e-6));
/**
 * Probabilities with the current win price, for races without AGF only: with AGF the price added no measured gain.
 * Null when the layer does not apply: AGF present, a runner without a price, no time, or earlier than the limit. `table` maps a horizon to {alpha,theta}.
 */
export function livePriceProbs(probs,{odds,agf,minutes,table}){
 if(!table||minutes==null||minutes>ODDS_MAX_MINUTES||agf.some(v=>v>0)||odds.length<2||!odds.every(v=>v>0))return null;
 const horizon=nearestHorizon(minutes);
 return {probs:blendMarket(probs,priceColumn(odds),table[horizon]),horizon};
}
function lossOf(r,probs){return -Math.log(Math.max(r.rows.reduce((a,x,i)=>a+(r.winners.includes(x.number)?probs[i]:0),0),1e-9));}
/** Win rate, average market share and model probability, ROI at the stored odds, and a bootstrap interval that resamples whole races. */
function betStats(key,bets,rnd,resamples=400){
 const byRace=new Map();let wins=0,paid=0,share=0,model=0;
 for(const b of bets){const o=byRace.get(b.race)??byRace.set(b.race,[0,0]).get(b.race),back=b.win?b.odds:0;o[0]++;o[1]+=back;wins+=b.win?1:0;paid+=back;share+=b.share;model+=b.prob;}
 const groups=[...byRace.values()],sims=[];
 for(let k=0;k<resamples;k++){let n=0,t=0;for(let i=0;i<groups.length;i++){const c=groups[Math.floor(rnd()*groups.length)];n+=c[0];t+=c[1];}sims.push(t/n-1);}
 sims.sort((a,b)=>a-b);const n=bets.length;
 return {key,runners:n,wins,winRate:wins/n,share:share/n,model:model/n,roi:paid/n-1,roiCi:[sims[Math.floor(resamples*.025)],sims[Math.floor(resamples*.975)]]};
}
/**
 * The historical report. `records` = [{date,rows:[{number,odds}],winners,probs,agf}] with out-of-sample probabilities; only races with odds on every runner count.
 * The odds test uses closing odds, which are not known at prediction time, so its gain is an upper bound.
 */
export function oddsReport(records,seed=5){
 let s=seed;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
 const races=records.filter(r=>r.rows.every(x=>x.odds>0)).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0),all=[],favs=[];
 const overround=[];
 races.forEach((r,race)=>{const odds=r.rows.map(x=>x.odds),share=marketShares(odds),f=favouriteRead(r.probs,odds);r.share=share;overround.push(odds.reduce((a,v)=>a+1/v,0));
  r.rows.forEach((x,i)=>{const bet={race,odds:x.odds,share:share[i],prob:r.probs[i],win:r.winners.includes(x.number)};all.push(bet);if(i===f.index)favs.push({...bet,level:f.level,agrees:f.agrees});});});
 overround.sort((a,b)=>a-b);
 const grouped=(bets,keyOf,order)=>order.map(key=>[key,bets.filter(b=>keyOf(b)===key)]).filter(([,l])=>l.length).map(([key,l])=>betStats(key,l,rnd));
 // Exponents on the first half, judged on the second; races with and without AGF apart, since AGF already holds part of what the odds say.
 const half=races[Math.floor(races.length/2)]?.date,hasAgf=r=>r.agf.some(v=>v>0);
 const test=keep=>{const first=races.filter(r=>r.date<half&&keep(r)),second=races.filter(r=>r.date>=half&&keep(r));if(!first.length||!second.length)return null;
  const blend=fitMarketBlend(first.map(r=>({probs:r.probs,agf:r.share,rows:r.rows,winners:r.winners}))),mixed=r=>blendMarket(r.probs,r.share,blend),score=fn=>scoreForecasts(second.map(r=>({probs:fn(r),rows:r.rows,winners:r.winners})));
  const diff=second.map(r=>lossOf(r,mixed(r))-lossOf(r,r.probs)),sims=[];for(let k=0;k<1000;k++){let t=0;for(let i=0;i<diff.length;i++)t+=diff[Math.floor(rnd()*diff.length)];sims.push(t/diff.length);}sims.sort((a,b)=>a-b);
  const pick=x=>({logLoss:x.logLoss,top1:x.top1,top3:x.top3});
  return {races:second.length,blend,site:pick(score(r=>r.probs)),ganyan:pick(score(r=>r.share)),mixed:pick(score(mixed)),diff:diff.reduce((a,v)=>a+v,0)/diff.length,ci:[sims[25],sims[974]]};};
 return {races:races.length,from:races[0]?.date??null,to:races.at(-1)?.date??null,half,overround:overround[overround.length>>1]??null,
  bands:grouped(all,b=>bandOf(ODDS_BANDS,b.odds),ODDS_BANDS.map(b=>b[1])),value:grouped(all,b=>bandOf(VALUE_BANDS,b.prob*b.odds),VALUE_BANDS.map(b=>b[1])),
  favourite:{all:betStats('Tüm favoriler',favs,rnd),levels:grouped(favs,b=>b.level,FAVOURITE_LEVELS.map(b=>b[1])),agreement:grouped(favs,b=>b.agrees?'Model de 1. seçiyor':'Model başka at seçiyor',['Model de 1. seçiyor','Model başka at seçiyor'])},
  withOdds:{agf:test(hasAgf),free:test(r=>!hasAgf(r))}};
}
