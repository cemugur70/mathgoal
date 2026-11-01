import test from 'node:test';import assert from 'node:assert/strict';
import {finishingPrefix,compareFinish,createHorseRatingEngine,createMeetingIndex,distanceBucket,RATING_POLICY} from '../dist/horse-rating.mjs';
import {careerProfile,raceFeatures,raceProbabilities,fitConditionalLogit,scoreForecasts,FEATURE_NAMES} from '../dist/horse-model.mjs';
const e=(horseId,place,o={})=>({horseId,number:String(horseId),name:'AT'+horseId,status:'RUNNER',place,kg:56,...o});
const race=(date,o={})=>({date,surface:'DIRT',distance:1400,breed:'TB',...o});
test('finishing prefix stops at the first gap; unknown horses are behind the known prefix only',()=>{
 const rs=[e(1,1),e(2,2),e(3,null),e(4,5),e(5,null),e(6,3,{status:'NONRUNNER'})],p=finishingPrefix(rs);
 assert.deepEqual(p.prefix.map(x=>x.horseId),[1,2]);assert.equal(p.runners.length,5);
 assert.equal(compareFinish(rs[0],rs[2],2),1);assert.equal(compareFinish(rs[2],rs[1],2),-1);assert.equal(compareFinish(rs[2],rs[4],2),null,'two unplaced horses are not comparable');
 assert.equal(compareFinish(rs[3],rs[2],2),null,'a place beyond the gap says nothing about an unplaced horse');assert.equal(compareFinish(rs[1],rs[3],2),1);
 assert.deepEqual(finishingPrefix([e(1,1),e(2,1),e(3,3)]).prefix.length,3,'dead heat shares a place');
 assert.equal(distanceBucket(1300),'kisa');assert.equal(distanceBucket(1400),'mil');assert.equal(distanceBucket(2000),'orta');assert.equal(distanceBucket(2400),'uzun');
});
test('beating a strong horse is worth more than beating a weak one, and strength propagates through the network',()=>{
 const g=createHorseRatingEngine();
 for(let i=0;i<6;i++)g.update(race(`2026-01-${String(i+1).padStart(2,'0')}`),[e(1,1),e(2,2),e(3,3)]);
 const strong=g.horse(1).base,weak=g.horse(3).base;assert.ok(strong>0&&weak<0);
 const a=createHorseRatingEngine(),b=createHorseRatingEngine();
 for(const x of [a,b])for(let i=0;i<6;i++)x.update(race(`2026-01-${String(i+1).padStart(2,'0')}`),[e(1,1),e(2,2),e(3,3)]);
 a.update(race('2026-02-01'),[e(9,1),e(1,2)]);b.update(race('2026-02-01'),[e(9,1),e(3,2)]);
 assert.ok(a.horse(9).base>b.horse(9).base,'newcomer 9 gains more for beating the strong horse 1');
 // 10 never met 1, but beat 2, who is known to be weaker than 1: 10 rates above a horse that lost to 2.
 a.update(race('2026-02-02'),[e(10,1),e(2,2),e(11,3)]);assert.ok(a.horse(10).base>a.horse(11).base);
});
test('predictions only use updates applied so far; probabilities sum to 1; preferences stay relative',()=>{
 const g=createHorseRatingEngine();assert.ok(g.predict(race('2026-01-01'),[e(1),e(2)]).every(p=>Math.abs(p.prob-.5)<1e-12));
 for(let i=0;i<8;i++){g.update(race(`2026-01-${String(i+1).padStart(2,'0')}`,{surface:'TURF'}),[e(1,1),e(2,2)]);g.update(race(`2026-01-${String(i+1).padStart(2,'0')}`,{surface:'DIRT'}),[e(2,1),e(1,2)]);}
 const h=g.horse(1);assert.ok(h.surface.TURF>0&&h.surface.DIRT<0,'1 prefers turf');assert.ok(Math.abs(h.surface.TURF*h.surfaceN.TURF+h.surface.DIRT*h.surfaceN.DIRT)<1e-9,'offsets are centred on the start mix');
 const turf=g.predict(race('2026-02-01',{surface:'TURF'}),[e(1),e(2)]),dirt=g.predict(race('2026-02-01',{surface:'DIRT'}),[e(1),e(2)]);
 assert.ok(turf[0].prob>.5&&dirt[0].prob<.5);assert.ok(Math.abs(turf.reduce((a,p)=>a+p.prob,0)-1)<1e-12);
 const only=createHorseRatingEngine();for(let i=0;i<5;i++)only.update(race(`2026-01-0${i+1}`),[e(1,1),e(2,2)]);assert.ok(Math.abs(only.horse(1).surface.DIRT)<1e-12,'one surface only: no preference');
 const later=createHorseRatingEngine();later.update(race('2024-01-01'),[e(1,1),e(2,2)]);const before=later.predict(race('2024-01-02'),[e(1),e(2)])[0].prob,after=later.predict(race('2026-01-02'),[e(1),e(2)])[0].prob;
 assert.ok(after<before&&after>.5,'ratings shrink toward average over a long absence');assert.equal(RATING_POLICY.halfLifeDays>0,true);
});
test('meeting index reports who beat whom, under which conditions, only before the cutoff',()=>{
 const rs=[{race:{date:'2026-01-01',city:'istanbul',surface:'TURF',distance:1600,label:'HAN-16'},entries:[e(1,1,{kg:58}),e(2,2,{kg:55}),e(3,null)]},
  {race:{date:'2026-02-01',city:'ankara',surface:'DIRT',distance:1400,label:'KV-7'},entries:[e(2,1),e(3,2)]},
  {race:{date:'2026-03-01',city:'izmir',surface:'DIRT',distance:1400,label:'KV-7'},entries:[e(2,1),e(1,2)]}];
 const ix=createMeetingIndex(rs),m=ix.meetings(1,2,'2026-02-15');
 assert.equal(m.length,1);assert.deepEqual([m[0].result,m[0].placeA,m[0].placeB,m[0].kgA,m[0].kgB,m[0].surface],[1,1,2,58,55,'TURF']);
 assert.equal(ix.meetings(1,2,'2026-12-01').length,2);assert.equal(ix.meetings(3,2,'2026-12-01').length,2);
 const pair=ix.fieldNetwork([e(1),e(3)],'2026-02-15')[0];assert.equal(pair.aheadA,1);assert.equal(pair.commonOpponents,1,'both met horse 2');assert.equal(pair.indirect,1,'1 beat 2, 3 lost to 2');
});
test('career preference, race-centred features, conditional logit and scoring',()=>{
 const runs=[{date:'2025-01-01',place:1,surface:'TURF',distance:2000},{date:'2025-02-01',place:1,surface:'TURF',distance:2000},{date:'2025-03-01',place:8,surface:'DIRT',distance:1200},{date:'2027-01-01',place:1,surface:'DIRT',distance:1200}];
 const p=careerProfile(runs,race('2026-01-01',{surface:'TURF',distance:2000}));assert.equal(p.starts,3,'future runs are ignored');assert.ok(p.surface.value>0&&p.distance.value>0);
 assert.ok(careerProfile(runs,race('2026-01-01',{surface:'DIRT',distance:1200})).surface.value<0);
 const ent=[e(1,null,{handicap:70,agf1:40}),e(2,null,{handicap:60,agf1:10}),e(3,null,{handicap:null,agf1:null})],ratings=ent.map(x=>({number:x.number,base:0,surface:0,distance:0,starts:0}));
 const rows=raceFeatures(race('2026-01-01'),ent,{ratings,runsByHorse:new Map()}),h=FEATURE_NAMES.indexOf('handicap'),a=FEATURE_NAMES.indexOf('agf');
 assert.ok(Math.abs(rows.reduce((s,r)=>s+r.x[h],0))<1e-12,'centred');assert.equal(rows[2].x[h],0,'missing handicap is neutral');assert.equal(rows[2].x[a],rows[1].x[a],'missing AGF counts as the weakest share');
 const data=Array.from({length:80},(_,i)=>({rows:[{number:'1',x:FEATURE_NAMES.map(f=>f==='handicap'?1:0)},{number:'2',x:FEATURE_NAMES.map(f=>f==='handicap'?-1:0)}],winners:[i%4?'1':'2']}));
 const w=fitConditionalLogit(data,['handicap'],{l2:0,iterations:600});assert.ok(Math.abs(raceProbabilities(data[0].rows,w)[0]-.75)<.02,'recovers a 75% edge');
 assert.ok(w.every((v,i)=>i===h||v===0),'unused features keep weight 0');
 const s=scoreForecasts([{probs:[.6,.4],rows:[{number:'1',odds:2},{number:'2',odds:3}],winners:['1']},{probs:[.6,.4],rows:[{number:'1',odds:2},{number:'2',odds:3}],winners:['2']}],{edge:1.1});
 assert.equal(s.top1,.5);assert.equal(s.topRoi,0);assert.equal(s.valueBets,4);assert.ok(Math.abs(s.valueRoi-(5/4-1))<1e-12);
});
