import test from 'node:test';import assert from 'node:assert/strict';
import {parseTiming,buildSpeedPars,attachSpeedFigures,speedProfile} from '../dist/horse-speed.mjs';
const run=(date,timing,o={})=>({date,timing,trackCode:'TUR_IST',surface:'DIRT',distance:1000,place:1,...o});
test('finishing time text is parsed as seconds; anything else is unknown',()=>{
 assert.equal(parseTiming('1.28.90'),88.9);assert.equal(parseTiming('0.58.10'),58.1);
 assert.equal(parseTiming('0.14'),null);assert.equal(parseTiming(null),null);assert.equal(parseTiming('0.05.00'),null,'implausibly fast');
});
test('figures compare a run with its par and remove the day variant; pars ignore runs from the split on',()=>{
 // Par day: 30 horses at 60 s; slow day: every horse 2 s slower, one horse 1 s faster than the rest; a later day must not move the par.
 const runsByHorse=new Map(),breed=new Map();
 for(let i=0;i<30;i++){runsByHorse.set(i,[run('2025-01-01','1.00.00')]);breed.set(i,'TB');}
 for(let i=0;i<7;i++){runsByHorse.get(i).push(run('2025-02-01',i?'1.02.00':'1.01.00'));}
 for(let i=0;i<30;i++)runsByHorse.get(i).push(run('2026-02-01','0.50.00'));
 const pars=buildSpeedPars(runsByHorse,breed,{before:'2026-01-01'});
 assert.equal(pars.get('TB|TUR_IST|DIRT|1000'),60);
 attachSpeedFigures(runsByHorse,breed,pars);
 assert.equal(runsByHorse.get(1)[1].fig,0,'a slow day is not a slow horse');
 assert.equal(runsByHorse.get(0)[1].fig,1,'one second faster than the day');
 assert.equal(runsByHorse.get(0)[0].fig,0);
});
test('a race sees only figures from earlier runs',()=>{
 const runs=[{date:'2025-01-01',fig:1},{date:'2025-06-01',fig:-1},{date:'2025-09-01',fig:2},{date:'2025-10-01',fig:5}];
 const p=speedProfile(runs,{date:'2025-10-01'});
 assert.equal(p.n,3);assert.equal(p.best,2);assert.equal(p.avg,2/3);assert.equal(p.last,2);
 assert.deepEqual(speedProfile([],{date:'2025-10-01'}),{best:null,avg:null,last:null,n:0});
});
