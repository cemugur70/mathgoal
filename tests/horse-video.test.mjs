import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeRace,classify} from '../dist/horse-video.mjs';
// A 1200 m race filmed at 2 fps with the start at video second 4: the leader passes 400 m at race time 24, 600 at 36, 800 at 48.
const frames=[];
for(let t=0;t<=90;t+=.5){
 const race=t-4,order=race<2?[1,2,3,4]:race<40?[3,1,2,4]:race<70?[1,3,4,2]:null,clock=[];
 if(race>=24)clock.push({meters:race>=48?800:race>=36?600:400,seconds:race>=48?48:race>=36?36:24});
 if(race>=36&&t%3===0)clock.push({meters:600,seconds:race>=48?36:63}); // a misread that breaks the 200 m pace
 frames.push({t,order:order&&t%10===0?null:order??[],clock});
}
test('a race summary keeps sectionals that fit the pace, finds the start offset and reads the order at each mark',()=>{
 const s=summarizeRace(frames,{distance:1200,field:[1,2,3,4],winnerTime:72});
 assert.equal(s.ok,true);
 assert.deepEqual(s.splits,[[400,24],[600,36],[800,48]]);
 assert.equal(s.offset,4);
 assert.deepEqual(s.positions.map(p=>[p.m,p.order.join('')]),[[400,'3124'],[600,'3124'],[800,'1342']]);
});
test('pre-start numbering and horses outside the field do not count as running order',()=>{
 const bad=frames.map(f=>({...f,order:f.order?.length?[9,...f.order.slice(1)]:f.order}));
 assert.equal(summarizeRace(bad,{distance:1200,field:[1,2,3,4]}).ok,false);
});
test('glyphs match the nearest template within the distance limit',()=>{
 const T={a:['1100'],b:['0011']};
 assert.equal(classify({bits:'1000'},T,1),'a');assert.equal(classify({bits:'0101'},T,1),null);
});
