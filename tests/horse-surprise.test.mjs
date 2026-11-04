import test from 'node:test';import assert from 'node:assert/strict';
import {fitLogistic,surpriseRisk,surpriseCandidates,auc,surpriseInputs,SURPRISE_FEATURES} from '../dist/horse-surprise.mjs';
import {createConnectionStats} from '../dist/horse-connections.mjs';
test('the logistic fit recovers a rate that rises with the input',()=>{
 const data=[];for(let i=0;i<400;i++){const x=i%2;data.push({x:[1,x],y:i%10<(x?4:1)?1:0});}
 const w=fitLogistic(data,{l2:0});
 assert.ok(Math.abs(surpriseRisk([1,0],w)-.2)<.01);assert.ok(Math.abs(surpriseRisk([1,1],w)-.4)<.01);
});
test('race inputs have one value per feature and mark a race without AGF',()=>{
 const x=surpriseInputs({family:'HAND',breed:'AR',surface:'TURF'},[{agf:null},{agf:null},{agf:null}],[.5,.3,.2]);
 assert.equal(x.length,SURPRISE_FEATURES.length);assert.equal(x[SURPRISE_FEATURES.indexOf('agfMissing')],1);assert.equal(x[SURPRISE_FEATURES.indexOf('handicap')],1);
});
test('candidates are outside the AGF top 3 and rated well above their AGF share',()=>{
 const rows=[{number:'1',agf:40},{number:'2',agf:30},{number:'3',agf:20},{number:'4',agf:5},{number:'5',agf:5}];
 assert.deepEqual(surpriseCandidates(rows,[.3,.2,.2,.2,.1],{minProb:.08,ratio:1.5}),['4','5']);
 assert.deepEqual(surpriseCandidates(rows,[.3,.2,.2,.2,.06],{minProb:.08,ratio:1.5}),['4']);
 assert.deepEqual(surpriseCandidates(rows.map(r=>({...r,agf:null})),[.2,.2,.2,.2,.2]),[]);
});
test('AUC is 1 for a perfect ranking and 0.5 for ties',()=>{
 assert.equal(auc([{p:.1,y:0},{p:.9,y:1}]),1);assert.equal(auc([{p:.5,y:0},{p:.5,y:1}]),.5);
});
test('jockey form counts only earlier results and compares wins with the field size',()=>{
 const c=createConnectionStats(),e=n=>({number:n,status:'RUNNER',jockeyId:Number(n),trainer:'T'+n});
 assert.equal(c.get({date:'2026-01-01'},e('1')).jockey,0);
 for(let d=1;d<=9;d++)c.update({date:`2026-01-0${d}`,winners:['1']},[e('1'),e('2'),e('3'),e('4')]);
 const r={date:'2026-01-10'};assert.ok(c.get(r,e('1')).jockey>.5);assert.ok(c.get(r,e('2')).jockey<0);assert.equal(c.get(r,e('9')).jockey,0);
});
