import test from 'node:test';import assert from 'node:assert/strict';
import {marketShares,favouriteRead,oddsSnapshot,oddsReport,bandOf,ODDS_BANDS,VALUE_BANDS,FAVOURITE_LEVELS,parseOddsHistory,ODDS_HORIZONS,ODDS_MAX_MINUTES,minutesToOff,nearestHorizon,livePriceProbs} from '../dist/horse-odds.mjs';
import {msToNextSlot} from '../scripts/horse-scheduler.mjs';

const TABLE=Object.fromEntries(ODDS_HORIZONS.map(h=>[h,{alpha:.8,theta:.05*Math.log(600/h)}]));
test('the live price applies only to fully priced races without AGF, inside the time limit',()=>{
 const probs=[.5,.3,.2],use=(over={})=>livePriceProbs(probs,{odds:[2,4,8],agf:[null,null,null],minutes:30,table:TABLE,...over});
 const hit=use();assert.equal(hit.horizon,30);assert.ok(Math.abs(hit.probs.reduce((a,v)=>a+v,0)-1)<1e-12);assert.notDeepEqual(hit.probs,probs);
 assert.equal(use({agf:[20,null,null]}),null,'a race with AGF keeps its probabilities');
 assert.equal(use({odds:[2,null,8]}),null,'a runner without a price');
 assert.equal(use({minutes:null}),null,'no race time');assert.equal(use({table:undefined}),null,'no layer file');
 assert.equal(use({minutes:ODDS_MAX_MINUTES+1}),null,'too early');assert.equal(use({minutes:ODDS_MAX_MINUTES}).horizon,240);
 assert.equal(use({minutes:-3}).horizon,1,'after the off the price is about closing');
 const a=livePriceProbs(probs,{odds:[20,4,1.5],agf:[null,null,null],minutes:5,table:TABLE}).probs;assert.ok(a[0]<probs[0]&&a[2]>probs[2],'the price moves the probabilities its way');
});
test('the horizon is the nearest on a log scale; race times are GMT with or without a suffix',()=>{
 assert.deepEqual([500,240,170,169,60,43,42,9,8,3,2,1,0,-5].map(nearestHorizon),[240,240,240,120,60,60,30,15,5,5,1,1,1,1]);
 const now=Date.parse('2026-11-07T12:00:00Z');assert.equal(minutesToOff('2026-11-07T12:30:00',now),30);assert.equal(minutesToOff('2026-11-07T11:57:00Z',now),-3);assert.equal(minutesToOff(null,now),null);
});
test('the scheduler reaches the next :20 or :50 whatever the start time',()=>{
 const at=c=>Date.parse(`2026-11-07T${c}Z`),next=c=>new Date(at(c)+msToNextSlot(at(c))).toISOString().slice(11,16);
 assert.equal(next('12:00:00'),'12:20');assert.equal(next('12:19:59'),'12:20');assert.equal(next('12:20:00'),'12:50');assert.equal(next('12:51:00'),'13:20');
});

test('the price history drops the placeholders the source writes before a runner has money on it',()=>{
 const h=parseOddsHistory({labels:['2026-10-31 08:18:00','2026-10-31 09:00:00'],datasets:[{label:'1',data:['999.99','3.20']},{label:2,data:['&nbsp;9999.99','1.85']},{label:'3',data:['','11.10']}]});
 assert.deepEqual(h,{t:['2026-10-31 08:18:00','2026-10-31 09:00:00'],r:{1:[null,3.2],2:[null,1.85],3:[null,11.1]}});
 assert.deepEqual(parseOddsHistory({labels:[],datasets:[]}),{t:[],r:{}},'a race without a series');
});

test('market shares normalise 1/odds over the runners with odds; a scratched or unpriced runner stays empty',()=>{
 const s=marketShares([2,4,null,4]);assert.deepEqual(s,[.5,.25,null,.25]);
 assert.equal(marketShares([null,null]),null);assert.equal(marketShares([3,null]),null,'one priced runner is no market');
});
test('bands hold values below their bound',()=>{
 assert.equal(bandOf(ODDS_BANDS,1.99),'2 altı');assert.equal(bandOf(ODDS_BANDS,2),'2–3');assert.equal(bandOf(ODDS_BANDS,500),'40 ve üstü');
 assert.equal(bandOf(VALUE_BANDS,.59),'0,6 altı');assert.equal(bandOf(VALUE_BANDS,1.2),'1,2–1,5');
 assert.equal(bandOf(FAVOURITE_LEVELS,.89),'zayıf');assert.equal(bandOf(FAVOURITE_LEVELS,1),'normal');assert.equal(bandOf(FAVOURITE_LEVELS,1.1),'güçlü');
});
test('the favourite is the shortest price; the read compares the model with its share and says whether the model agrees',()=>{
 const strong=favouriteRead([.6,.2,.2],[2,4,4]);assert.equal(strong.index,0);assert.equal(strong.share,.5);assert.ok(Math.abs(strong.ratio-1.2)<1e-12);assert.equal(strong.level,'güçlü');assert.equal(strong.agrees,true);
 const weak=favouriteRead([.2,.6,.2],[2,4,4]);assert.equal(weak.level,'zayıf');assert.equal(weak.agrees,false);
 assert.equal(favouriteRead([.5,.5],[null,3]),null,'no market without two prices');
 assert.equal(favouriteRead([.1,.5,.4],[null,5,3]).index,2,'an unpriced runner is never the favourite');
});
test('a snapshot records a race not yet run, only with odds or AGF present',()=>{
 const race={date:'2026-11-07',city:'bursa',number:3,time:'2026-11-07T12:00:00',status:'PROGRAM'},at='2026-11-07T09:00:00.000Z';
 const e=(number,odds,agf1,agf2)=>({number,odds,agf1,agf2});
 assert.deepEqual(oddsSnapshot(race,[e('1',3.5,20,18),e('2',null,null,null),e('3',8,null,null)],at),{at,date:race.date,city:'bursa',number:3,time:race.time,runners:[['1',3.5,20,18],['3',8,null,null]]});
 assert.equal(oddsSnapshot(race,[e('1',null,null,null)],at),null,'the day before: nothing to record');
 assert.equal(oddsSnapshot({...race,status:'RESULT'},[e('1',3.5,20,18)],at),null,'a finished race is not a pre-race price');
 assert.equal(oddsSnapshot({...race,winners:['1']},[e('1',3.5,20,18)],at),null);
});
// A market that is right about the win chance, paying 1/(share × 1.4) on it, with a model that sees the same shares.
function market(count,seed=9,{agf=false}={}){
 let s=seed;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
 return Array.from({length:count},(_,k)=>{const n=6,raw=Array.from({length:n},()=>rnd()+.05),z=raw.reduce((a,v)=>a+v,0),p=raw.map(v=>v/z);let u=rnd(),w=0;while(u>p[w]&&w<n-1){u-=p[w];w++;}
  return {date:`2026-${String(1+Math.floor(k*11/count)).padStart(2,'0')}-15`,rows:p.map((v,i)=>({number:String(i+1),odds:+(1/(v*1.4)).toFixed(2)})),winners:[String(w+1)],probs:p,agf:p.map(v=>agf?v*100:null)};});
}
test('the report: ROI near the takeout, the shares add up, unpriced races are left out, and the odds test finds nothing when the model already knows them',()=>{
 const records=market(3000),extra={date:'2026-05-01',rows:[{number:'1',odds:null},{number:'2',odds:2}],winners:['2'],probs:[.5,.5],agf:[null,null]},R=oddsReport([...records,extra]);
 assert.equal(R.races,3000);assert.ok(Math.abs(R.overround-1.4)<.01);
 assert.equal(R.bands.reduce((a,b)=>a+b.runners,0),18000);assert.equal(R.value.reduce((a,b)=>a+b.runners,0),18000);
 const total=R.bands.reduce((a,b)=>a+b.runners*(1+b.roi),0)/18000-1;assert.ok(Math.abs(total-(1/1.4-1))<.08,'overall ROI '+total);
 for(const b of R.bands){assert.ok(b.roiCi[0]<=b.roi+.05&&b.roiCi[1]>=b.roi-.05,b.key);assert.ok(b.winRate>=0&&b.winRate<=1);}
 assert.equal(R.favourite.all.runners,3000);assert.equal(R.favourite.levels.length,1,'a model equal to the market reads every favourite as normal');assert.equal(R.favourite.levels[0].key,'normal');
 // Rounded odds can reorder near-equal runners, so a few races disagree even here.
 assert.ok(R.favourite.agreement[0].key==='Model de 1. seçiyor'&&R.favourite.agreement[0].runners>2900);assert.equal(R.favourite.agreement.reduce((a,x)=>a+x.runners,0),3000);
 const t=R.withOdds.free;assert.equal(R.withOdds.agf,null,'no race with AGF');assert.ok(t.races>1000);assert.ok(Math.abs(t.diff)<.01,'nothing to gain: '+t.diff);
});
test('the odds test splits races with and without AGF and learns the exponents on the first half only',()=>{
 const R=oddsReport([...market(1500,3,{agf:true}),...market(1500,4)]);assert.ok(R.withOdds.agf&&R.withOdds.free);
 assert.ok(R.withOdds.agf.races+R.withOdds.free.races<=3000);assert.ok(R.half>'2026-01-15'&&R.half<'2026-12-15');
 // A model that knows nothing: uniform probabilities gain a lot from the odds.
 const blind=market(2000,7).map(r=>({...r,probs:r.probs.map(()=>1/6)})),t=oddsReport(blind).withOdds.free;
 assert.ok(t.diff<-.05&&t.ci[1]<0,'uniform model gain '+t.diff);assert.ok(t.mixed.logLoss<t.site.logLoss);
});
