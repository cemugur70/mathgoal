import test from 'node:test';import assert from 'node:assert/strict';
import {buildGallopPars,workoutScore,gallopProfile} from '../dist/horse-gallop.mjs';
const work=(date,t400,extra={})=>({date,track:'ADANA',type:'GALLOP',effort:'UNDERRESTRAINT',going:'GOOD',times:{400:t400},...extra});
const items=Array.from({length:40},(_,i)=>({breed:'AR',workout:work('2025-06-05',26+i%5*.5)}));
test('pars are medians of the same workout kind, built only from earlier workouts',()=>{
 const pars=buildGallopPars(items);assert.equal(pars['ADANA|AR|GALLOP|400|GOOD|E|400'],27);
 assert.equal(Object.keys(buildGallopPars(items,{before:'2025-06-05'})).length,0);
});
test('a faster workout scores above zero and an unknown kind scores null',()=>{
 const pars=buildGallopPars(items);
 assert.ok(workoutScore(work('2026-02-01',26),'AR',pars)>3);assert.equal(workoutScore(work('2026-02-01',27),'AR',pars),0);
 assert.equal(workoutScore(work('2026-02-01',26,{track:'BURSA'}),'AR',pars),null);
});
test('the profile uses only workouts before the race and inside the window',()=>{
 const pars=buildGallopPars(items),ws=[work('2026-03-01',25),work('2026-02-25',27),work('2025-12-01',24)];
 const p=gallopProfile(ws,{date:'2026-03-01'},'AR',pars);
 assert.equal(p.n,1);assert.equal(p.best,0);assert.equal(p.days,4);
 assert.equal(gallopProfile([],{date:'2026-03-01'},'AR',pars).best,null);
});
