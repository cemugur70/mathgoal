import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSimulationMarketAccumulator} from '../dist/simulation-markets.mjs';
import {simulationMarketRows,simulationMarketsCsv,simulationMarketsHtml} from '../dist/simulation-markets-ui.mjs';
import {forecastBundle} from './helpers.mjs';
import {analyze} from '../dist/model.mjs';
import {prepareSimulation,runSimulation} from '../dist/player-simulation.mjs';

function fixture(){const a=createSimulationMarketAccumulator();for(const [home,away,homeHalf,awayHalf,firstGoal]of [[2,1,0,1,'away'],[0,0,0,0,null],[1,3,1,1,'home'],[4,0,2,0,'home']])a.record({home,away,homeHalf,awayHalf,firstGoal});return a.finish();}
const get=(r,id,label)=>r.markets.find(m=>m.id===id).options.find(o=>o.label===label);
test('market percentages settle actual joint scenarios, European handicaps and period outcomes',()=>{
 const r=fixture();assert.equal(r.iterations,4);
 assert.equal(get(r,'ms','MS 1').probability,.5);assert.equal(get(r,'btts','KG Var').probability,.5);
 assert.equal(get(r,'total.2.5','2,5 Üst').count,3);
 assert.equal(get(r,'hms.0.1','HMS X').count,1);assert.equal(get(r,'hms.0.1','HMS 2').count,2);
 assert.equal(get(r,'htft','X/2').probability,.25,'joint frequency is not the product of separate marginals');
 assert.equal(get(r,'firstGoal','Olmaz').count,1);assert.equal(get(r,'h1.result','İY X').count,2);
 assert.equal(get(r,'halves.under','Evet').count,1);assert.equal(get(r,'odd','Tek').count,1);
 for(const market of r.markets){
  assert.ok(market.options.every(o=>Number.isInteger(o.count)&&o.count>=0&&o.count<=4));
  assert.ok(Math.abs(market.options.reduce((s,o)=>s+o.probability,0)-(market.partition?1:2))<1e-12,market.id+' exhaustive partition / overlapping double chance');
 }
 assert.equal(r.means.homeHalf+r.means.homeSecond,r.means.home);assert.equal(r.means.awayHalf+r.means.awaySecond,r.means.away);
 assert.equal(r.unsupported.length,3);assert.ok(!r.markets.some(m=>/corner|player|card/.test(m.id)));
 const high=createSimulationMarketAccumulator();high.record({home:9,away:8,homeHalf:5,awayHalf:4,firstGoal:'home'});
 assert.equal(get(high.finish(),'score','Diğer').count,1,'unlisted score tails remain accounted for');
});

test('new reporting preserves all pre-existing seeded scores, replay and player usage',()=>{
 const b=forecastBundle(),input=prepareSimulation(b,analyze(b,{trainingLayer:false})),r=runSimulation(input,{iterations:10000,seed:12345});
 const fingerprint=createHash('sha256').update(JSON.stringify({histogram:r.histogram,sample:r.sample,usage:r.usage,means:r.means})).digest('hex');
 assert.equal(fingerprint,'65243946a96a0ef14b9ca545b9754fc5a8fd11abf38063083791a47b32c403d3');
 const report=r.bettingSummary;
 assert.equal(report.iterations,10000);assert.equal(get(report,'ms','MS 1').probability,r.probabilities.home);
 assert.equal(get(report,'total.2.5','2,5 Üst').probability,r.probabilities.over25);
 assert.ok(Math.abs(report.means.home-r.means.home)<1e-12);
 const one=runSimulation(input,{iterations:1,seed:12345}),goals=one.sample.events.filter(e=>e.type==='goal');
 assert.equal(one.bettingSummary.means.homeHalf,goals.filter(e=>e.side==='home'&&e.time<=45).length);
 assert.equal(one.bettingSummary.means.awayHalf,goals.filter(e=>e.side==='away'&&e.time<=45).length);
 assert.equal(get(one.bettingSummary,'firstGoal',goals.length?(goals[0].side==='home'?'1. Gol Ev':'1. Gol Dep'):'Olmaz').count,1);
});

test('table filtering, sorting and CSV retain counts and label unsupported sources accurately',()=>{
 const r=fixture(),all=simulationMarketRows(r,{group:'all'}),half=simulationMarketRows(r,{group:'halves',search:'İLK YARI'});
 assert.ok(all.length>150);assert.ok(half.length>0);assert.ok(half.every(row=>row.market.includes('İlk Yarı')));
 assert.equal(simulationMarketRows(r,{group:'all',search:'nonexistent'}).length,0);
 const sorted=simulationMarketRows(r,{group:'all',sort:'probability'});assert.ok(sorted.every((row,i)=>!i||sorted[i-1].probability>=row.probability));
 const csv=simulationMarketsCsv(all,4);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"Gerçekleşme"'));assert.ok(csv.includes('"50,00"'));
 assert.ok(simulationMarketsCsv([{market:'=bad',choice:'"x"',count:1,probability:.25}],4).includes('"\'=bad"'));
 const html=simulationMarketsHtml(r,{esc:String,number:(v,n)=>v.toFixed(n)});
 assert.ok(html.includes('Ortalama gol sayıları'));assert.ok(html.includes('yalnız örnek maç'));assert.ok(html.includes('Asya handikapı değildir'));
});
