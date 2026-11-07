import test from 'node:test';import assert from 'node:assert/strict';
import {LONGSHOT_SIGNALS,createLongshotState,longshotSignals,scaleSignals,signalStats,boostLongshot,longshotScore,longshotPicks,loadLongshot,lastPriceBefore,betSummary,forwardBets,forwardVerdict,FORWARD_MIN_BETS} from '../scripts/horse-longshot-lib.mjs';
import {FEATURE_NAMES} from '../dist/horse-model.mjs';

const at=name=>LONGSHOT_SIGNALS.indexOf(name);
const row=(number,over={})=>{const x=FEATURE_NAMES.map(()=>0);for(const [k,v] of Object.entries(over))x[FEATURE_NAMES.indexOf(k)]=v;return {number,x};};
const entry=(number,horseId,over={})=>({number,horseId,status:'RUNNER',start:Number(number),jockeyId:number,trainer:'T'+number,owner:'O'+number,odds:null,kg:55,equipment:'',...over});
const race={date:'2026-11-07',city:'bursa',number:3,trackCode:'BUR',surface:'DIRT',distance:1400,prize1:100000};
const field=(over={})=>({race,rows:[row('1',{net:2,speedAvg:1,gallopBest:3}),row('2',{net:0,speedAvg:2,gallopBest:1}),row('3',{net:-2,speedMissing:1,gallopMissing:1})],entries:[entry('1',11),entry('2',12,{owner:'same',trainer:'T'}),entry('3',13,{owner:'same',trainer:'T'})],free:[.5,.3,.2],prices:[2,4,20],runsByHorse:new Map([[11,[{date:'2026-10-01',fig:1},{date:'2026-12-01',fig:9}]],[12,[{date:'2026-10-01',fig:3}]]]),state:createLongshotState(),...over});
const finish=(state,r,entries)=>{state.noteDay(r,entries);state.update(r,entries);};

test('the signals read the field: rank, price share, stablemates, and a future run stays out',()=>{
 const s=longshotSignals(field());assert.equal(s.length,3);assert.equal(s[0].length,LONGSHOT_SIGNALS.length);assert.equal(new Set(LONGSHOT_SIGNALS).size,LONGSHOT_SIGNALS.length);
 assert.deepEqual(s.map(r=>r[at('modelRank')]),[0,.5,1]);assert.deepEqual(s.map(r=>r[at('rankPrice')]),[0,.5,1]);
 const z=1/2+1/4+1/20;assert.equal(s[2][at('logShare')],+Math.log((1/20)/z).toFixed(4));assert.equal(s[2][at('modelRatio')],+Math.log(.2/((1/20)/z)).toFixed(4));
 assert.deepEqual(s.map(r=>r[at('ownerMates')]),[0,1,1]);assert.deepEqual(s.map(r=>r[at('mates')]),[0,1,1]);assert.deepEqual(s.map(r=>r[at('mateShorter')]),[0,0,1]);
 assert.equal(s[2][at('speedRel')],0,'a horse without speed is at the field mean');assert.equal(s[2][at('gallopVsPrice')],null);
 assert.ok(s[0][at('figVsField')]<0&&s[1][at('figVsField')]>0,'the run after the race date does not count');
 assert.equal(s[0][at('agfMissing')],1);assert.equal(s[0][at('winShare')],null,'a horse never seen has no record');assert.equal(s[0][at('jockeyChange')],null);
});
test('no signals without a price on every runner',()=>{
 assert.equal(longshotSignals(field({prices:[2,null,20]})),null);assert.equal(longshotSignals(field({prices:[2,0,20]})),null);
});
test('a past start feeds the horse signals: jockey change, equipment, price drift, class drop',()=>{
 const state=createLongshotState(),past={...race,date:'2026-10-20',winners:['9'],prize1:200000},e=[entry('1',11,{odds:4,place:2,jockeyId:7,kg:58,equipment:'B',trainer:'old'}),entry('9',99,{odds:2,place:1}),entry('8',98,{odds:9,place:3})];finish(state,past,e);
 const s=longshotSignals(field({state,entries:[entry('1',11,{equipment:'B,TT',jockeyId:8,kg:55}),entry('2',12),entry('3',13)]}))[0];
 assert.equal(s[at('jockeyChange')],1);assert.equal(s[at('trainerChange')],1);assert.equal(s[at('eqAdded')],1);assert.equal(s[at('addTT')],1);assert.equal(s[at('addB')],0);assert.equal(s[at('eqRemoved')],0);
 assert.equal(s[at('kgDelta')],-3);assert.equal(s[at('driftFromLast')],+Math.log(2/4).toFixed(4));assert.equal(s[at('classDrop')],+Math.log(2).toFixed(4));assert.equal(s[at('winShare')],0);assert.equal(s[at('top3Share')],1);assert.equal(s[at('lastPct')],.5);
});
test('the state counts wins over the market, long-shot records, and the day at once',()=>{
 const s=createLongshotState(),done={...race,winners:['2']},entries=[entry('1',1,{odds:2,jockeyId:7,trainer:'A'}),entry('2',2,{odds:10,jockeyId:8,trainer:'B',owner:'W'}),entry('3',3,{status:'NONRUNNER',odds:null,jockeyId:9,trainer:'C'})];
 s.noteDay(done,entries);assert.equal(s.day(race.date,'bursa').ls,1);assert.equal(s.day(race.date,'izmir').ls,0);assert.equal(s.jockeyAll.size,0,'the record waits for the end of the day');
 s.update(done,entries);const sig=longshotSignals(field({state:s,entries:[entry('1',11,{jockeyId:8,trainer:'B',owner:'W'}),entry('2',12,{jockeyId:7,trainer:'A'}),entry('3',13,{jockeyId:9,trainer:'C'})]}));
 assert.ok(sig[0][at('jockeyAE')]>0&&sig[0][at('trainerAE')]>0&&sig[0][at('jockeyLsAE')]>0&&sig[0][at('ownerLsAE')]>0);assert.ok(sig[1][at('jockeyAE')]<0&&sig[1][at('trainerAE')]<0);assert.equal(sig[2][at('jockeyAE')],0,'a non-runner is not counted');assert.equal(sig[0][at('dayLs')],1);
 const short={...race,number:4,winners:['1']};s.noteDay(short,entries);assert.equal(s.day(race.date,'bursa').ls,1,'a short-priced winner is no long shot');
});
test('the trees find a signal the offset does not hold, and ignore one that carries nothing',()=>{
 let seed=3;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296,list=[];
 for(let i=0;i<6000;i++){const a=rnd()*2-1,b=rnd()*2-1,p=a>.5?.3:.05;list.push({z:[a,b],offset:Math.log(.05/.95),y:rnd()<p?1:0});}
 const trees=boostLongshot(list,{trees:60});assert.ok(longshotScore([.9,0],trees)>longshotScore([-.9,0],trees)+.5);assert.ok(Math.abs(longshotScore([0,.9],trees)-longshotScore([0,-.9],trees))<.3);
});
test('scoring takes the branch training took, also for values tied at a threshold',()=>{
 // A discrete signal whose scaled value has many digits: every row sits exactly on an edge.
 const low=-.12345678912,high=.98765432198;let seed=5;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296,list=[];
 for(let i=0;i<4000;i++){const a=i%2?high:low;list.push({z:[a],offset:Math.log(.05/.95),y:rnd()<(a===high?.25:.04)?1:0});}
 const trees=boostLongshot(list,{trees:20,colsample:1});assert.ok(trees.some(t=>t.l),'the trees split');
 assert.ok(longshotScore([high],trees)>longshotScore([low],trees)+.3);
 for(const t of trees)for(let n=t;n.l;n=n.l)assert.ok(low<=n.t,'a low value stays on the left branch');
});
test('scaling uses the training mean and spread, and an empty value is neutral',()=>{
 const stats=signalStats([LONGSHOT_SIGNALS.map(()=>1),LONGSHOT_SIGNALS.map(()=>3),LONGSHOT_SIGNALS.map(()=>null)]);assert.equal(stats[0].m,2);assert.ok(stats[0].s>1);
 assert.equal(scaleSignals(LONGSHOT_SIGNALS.map(()=>2),stats)[0],0);assert.equal(scaleSignals(LONGSHOT_SIGNALS.map(()=>1e6),stats)[0],5);assert.equal(scaleSignals(LONGSHOT_SIGNALS.map(()=>null),stats)[0],0);
 assert.equal(scaleSignals([1],[{m:0,s:0}])[0],0,'a signal without spread stays neutral');
});
test('a candidate needs the minimum price and a score at the cut',()=>{
 const f=field(),stats=LONGSHOT_SIGNALS.map(()=>({m:0,s:1})),tree=[{f:at('modelRank'),t:.7,l:{v:1},r:{v:2}}];
 assert.deepEqual(longshotPicks({stats,trees:tree,cut:1},f),['3'],'the only runner at 10 or longer');assert.deepEqual(longshotPicks({stats,trees:tree,cut:3},f),[],'below the cut');
 assert.deepEqual(longshotPicks({stats,trees:tree,cut:1},field({prices:[10,4,20]})),['1','3']);assert.deepEqual(longshotPicks(null,f),[],'no file');assert.deepEqual(longshotPicks({stats,trees:tree,cut:1},field({prices:[2,null,20]})),[],'no full price');
});
test('the stored price is the last one seen before the off, never later, and not too old',()=>{
 const off=Date.parse('2026-11-07T12:00:00Z'),snap=(t,a,b)=>({at:`2026-11-07T${t}:00.000Z`,runners:[['1',a],['2',b]]}),list=[snap('11:00',9,3),snap('11:40',8,4),snap('12:03',7,5)];
 assert.deepEqual(lastPriceBefore(list,off,['1','2']),[8,4],'the snapshot after the off is left out');assert.equal(lastPriceBefore([snap('10:00',9,3)],off,['1','2']),null,'older than the limit');
 assert.equal(lastPriceBefore([snap('11:40',8,null)],off,['1','2']),null,'a runner without a price');assert.equal(lastPriceBefore(undefined,off,['1']),null);assert.equal(lastPriceBefore(list,off,['1','9']),null,'a runner the snapshot does not list');
});
test('the summary pays at the closing price and counts the expected wins',()=>{
 const s=betSummary([{meeting:'a',y:1,close:10,expected:.1},{meeting:'a',y:0,close:20,expected:.05},{meeting:'b',y:0,close:10,expected:.1},{meeting:'b',y:0,close:10,expected:.1}]);
 assert.equal(s.bets,4);assert.equal(s.wins,1);assert.ok(Math.abs(s.roi-(10/4-1))<1e-12);assert.ok(Math.abs(s.ratio-1/.35)<1e-12);assert.ok(s.roiCi[0]<=s.roi&&s.roiCi[1]>=s.roi);
 assert.deepEqual(betSummary([]).bets,0);assert.equal(betSummary([]).roi,null);
});
test('one race adds its long shots, candidates and old candidates, paid at the closing price',()=>{
 const stats=LONGSHOT_SIGNALS.map(()=>({m:0,s:1})),frozen={stats,trees:[{f:at('modelRank'),t:.7,l:{v:0},r:{v:2}}],cut:1,nullW:[0,0,0],freeWeights:FEATURE_NAMES.map(()=>0),oldWeights:FEATURE_NAMES.map(()=>0),oldCandidates:{minProb:.99,ratio:1.5}};
 const f=field({race:{...race,winners:['3']},entries:[entry('1',11,{odds:2}),entry('2',12,{odds:4}),entry('3',13,{odds:30})]}),free=FEATURE_NAMES.map(()=>0);assert.ok(free.length);
 const bets=forwardBets(frozen,{race:f.race,rows:f.rows,entries:f.entries,prices:[2,4,20],runsByHorse:f.runsByHorse,state:f.state});
 assert.equal(bets.all.length,1,'only the runner priced at 10 or longer');assert.deepEqual(bets.all[0],{meeting:race.date+'|bursa',y:1,close:30,expected:.5},'the closing price pays, not the price at the read');
 assert.equal(bets.old.length,0);
 const none=forwardBets(frozen,{race:f.race,rows:f.rows,entries:f.entries,prices:[2,null,20],runsByHorse:f.runsByHorse,state:f.state});assert.deepEqual(none,{candidates:[],old:[],all:[]},'no full price');
});
test('the forward rule waits for enough candidates, then needs both conditions',()=>{
 const c=(bets,lo,roi)=>({bets,ratioCi:[lo,lo+.5],roi});
 assert.equal(forwardVerdict(c(FORWARD_MIN_BETS-1,2,1),{roi:-1}).state,'bekliyor');assert.equal(forwardVerdict(c(FORWARD_MIN_BETS,1.1,-.1),{roi:-.2}).state,'gecti');
 assert.equal(forwardVerdict(c(FORWARD_MIN_BETS,.9,-.1),{roi:-.2}).state,'kaldi','wins not clearly above the price');assert.equal(forwardVerdict(c(FORWARD_MIN_BETS,1.1,-.3),{roi:-.2}).state,'kaldi','no better than the old candidates');
});
test('a stored file with another signal list is ignored',()=>{
 assert.equal(loadLongshot(null),null);assert.equal(loadLongshot(JSON.stringify({signals:['x']})),null);assert.equal(loadLongshot(JSON.stringify({signals:LONGSHOT_SIGNALS,cut:0})).cut,0);
});
