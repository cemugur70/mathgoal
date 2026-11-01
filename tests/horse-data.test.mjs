import test from 'node:test';import assert from 'node:assert/strict';
import {parseBetsResult,raceLabel,raceClass,normalizeRacePage} from '../dist/horse-data.mjs';
import {raceContext,ruleApplies,evaluateRule,RULES,wilson,pValue,benjaminiHochberg,confirmationVerdict,learnRuleWeights,ruleSignals} from '../dist/horse-rules.mjs';
import {extractPageProps} from '../scripts/liderform-source.mjs';
const horse=(n,o={})=>({entry_status:'RUNNER',horse_number:String(n),horse_start:n,horse:{id:1000+n,name:'AT'+n,age:3,gender:'H'},jockey:{id:n,name:'J'+n,weight_kg:56},handicap:{now:60,prev:58},point:{now:100,prev:90},odds_tjk:5,agf1:{percent:10,position:n},races:[],...o});
test('win pool is the bare GANYAN only; multi-race GANYAN pools and refunds never become winners',()=>{
 assert.deepEqual(parseBetsResult("GANYAN(8): 1,25TL 1. 6'LI GANYAN(2,8/4/7/1,5/10/8): 8.715,25TL İKİLİ(7/8): 5,20TL SIRALI İKİLİ(8/7): 6,20TL ÜÇLÜ BAHİS(8/7/2): 78,50TL"),{winners:['8'],order:['8','7','2'],deadHeat:false});
 assert.deepEqual(parseBetsResult('GANYAN(7): 8,75TL Çıkan 1 Atla: 14,40TL PLASE(): İade 2. ÇİFTE(4/7): 27,40TL AGF:6').order,['7']);
 assert.equal(parseBetsResult('GANYAN(4): 2TL GANYAN(6): 2TL SIRALI İKİLİ(4/6): 3TL').deadHeat,true);
 assert.deepEqual(parseBetsResult('GANYAN(3): 2TL SIRALI İKİLİ(5/3): 3TL').order,['3'],'an ordered pool that disagrees with the win pool is ignored');
 assert.equal(parseBetsResult(null),null);assert.equal(parseBetsResult('İKİLİ(1/2): 3TL'),null);
});
test('race type labels follow the site (HAN / ŞRT / KV) and class families are coarse',()=>{
 assert.equal(raceLabel('HAND-16'),'HAN-16');assert.equal(raceLabel('ST-7'),'KV-7');assert.equal(raceLabel('COND-3'),'ŞRT-3');assert.equal(raceLabel('MAIDEN'),'Maiden');
 assert.deepEqual(raceClass('ST-21'),{family:'KV',number:21});assert.deepEqual(raceClass('SHORTTERM-HAND22'),{family:'KV',number:22});assert.equal(raceClass('GR-1').family,'GROUP');assert.equal(raceClass('G3').family,'GROUP');
});
test('a race page normalizes to rows; past runs on or after the race date are dropped and places come from dividends',()=>{
 const page={raceTimeList:[{id:9,race_number:5,meeting_date:'2026-11-01',race_status:'RESULT',race_type:'HAND-16',surface:'AWT',distance_meters:1400,track:{track_code:'TUR_IST'},
  bets_result:'GANYAN(2): 3TL SIRALI İKİLİ(2/1): 5TL ÜÇLÜ BAHİS(2/1/3): 9TL'}],
  raceData:[horse(1,{races:[{meeting_date:'2026-10-12',horse_place:3,track:{track_code:'TUR_BUR'}},{meeting_date:'2026-11-01',horse_place:1}]}),horse(2),horse(3),horse(4,{entry_status:'NONRUNNER'})]};
 const n=normalizeRacePage(page,{date:'2026-11-01',city:'istanbul',number:5});
 assert.equal(n.race.label,'HAN-16');assert.equal(n.race.surfaceLabel,'Sentetik');assert.deepEqual(n.race.order,['2','1','3']);
 assert.deepEqual(n.entries.map(e=>e.place),[2,1,3,null]);assert.equal(n.runs.length,1);assert.equal(n.runs[0].date,'2026-10-12');
 assert.equal(normalizeRacePage(page,{date:'2026-11-01',city:'istanbul',number:6}),null);
 assert.equal(extractPageProps('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"a":1}}}</script>').a,1);assert.equal(extractPageProps('<html></html>'),null);
});
const entry=(number,o)=>({number:String(number),status:'RUNNER',odds:null,agf1:null,handicap:null,point:null,kg:null,start:number,...o});
test('ranks share ties, skip missing values and exclude non-runners',()=>{
 const c=raceContext({},[entry(1,{odds:2,handicap:70,kg:58}),entry(2,{odds:2,handicap:65,kg:52}),entry(3,{odds:9,handicap:null,kg:55}),entry(4,{odds:1,status:'NONRUNNER'})]);
 assert.equal(c.field,3);assert.equal(c.fav('1'),1);assert.equal(c.fav('2'),1);assert.equal(c.fav('3'),3);assert.equal(c.hcp('1'),1);assert.equal(c.hcp('3'),Infinity);assert.equal(c.light('2'),1);assert.ok(c.lightThird('2')&&!c.lightThird('1'));
 // Regression: a missing value must never satisfy "top N" (null <= 3 is true in JavaScript).
 assert.ok(!(c.hcp('3')<=3));const noHcp=raceContext({},[entry(1),entry(2)]);assert.equal(noHcp.pick(e=>noHcp.hcp(e.number)<=3).size,0);
 const agf=raceContext({},[entry(1,{agf1:40}),entry(2,{agf1:10})]);assert.equal(agf.fav('1'),1,'AGF is the fallback when no ganyan exists');
});
test('rule scope: class, surface, gender and the explicit dirt→synthetic trial',()=>{
 const rule=RULES.find(r=>r.id==='han16-kum-hcp'),race={family:'HAND',classNumber:16,surface:'AWT',gender:null};
 assert.equal(ruleApplies(rule,race),false);assert.equal(ruleApplies(rule,race,{surfaceAs:{from:'AWT',to:'DIRT'}}),true);assert.equal(ruleApplies(rule,{...race,classNumber:15,surface:'DIRT'}),false);
 const filly=RULES.find(r=>r.id==='kv7-disi-kum'),colt=RULES.find(r=>r.id==='kv7-erkek-kum-fav'),kv7={family:'KV',classNumber:7,surface:'DIRT'};
 assert.ok(ruleApplies(filly,{...kv7,gender:'F'})&&!ruleApplies(filly,{...kv7,gender:null}));assert.ok(ruleApplies(colt,{...kv7,gender:null})&&!ruleApplies(colt,{...kv7,gender:'F'}));
});
test('evaluation compares against the same number of favourites and refuses verdicts under 30 races',()=>{
 const mk=(i,winner)=>({race:{family:'HAND',classNumber:16,surface:'DIRT',gender:null,winners:[String(winner)]},entries:[1,2,3,4,5,6].map(n=>entry(n,{odds:n,handicap:100-10*n}))});
 const rule=RULES.find(r=>r.id==='han16-kum-hcp');
 const always=evaluateRule(rule,Array.from({length:40},(_,i)=>mk(i,1+i%3)));assert.equal(always.n,40);assert.equal(always.rate,1);assert.equal(always.favoriteSameSize,1);assert.equal(always.avgPick,3);assert.equal(always.random,.5);
 // Handicap order equals price order here, so the rule is a favourite pick and only its stated 80% share is judged.
 assert.equal(always.verdict,'iddia temkinli (gerçek oran daha yüksek)');assert.equal(always.claim,'temkinli');
 const few=evaluateRule(rule,Array.from({length:10},(_,i)=>mk(i,1)));assert.equal(few.verdict,'yetersiz örnek');
 const [lo,hi]=wilson(30,100);assert.ok(lo<.3&&hi>.3&&lo>.2&&hi<.4);
});
test('paired test, ROI at the paid ganyan, and Benjamini–Hochberg q-values',()=>{
 assert.ok(Math.abs(pValue(1.96)-.05)<1e-3);assert.ok(Math.abs(pValue(0)-1)<1e-6);assert.ok(Math.abs(pValue(-2.576)-.01)<1e-3);
 assert.deepEqual(benjaminiHochberg([.01,null,.04,.03]).map(q=>q&&+q.toFixed(4)),[.03,null,.04,.04]);
 // Program number 4 (4th favourite, odds 4) wins every second race: the "3,4,5 numaralı" rule beats the top-3 favourites it is compared to.
 const mk=i=>({race:{family:'KV',classNumber:21,surface:'TURF',gender:null,winners:[i%2?'4':'1']},entries:[1,2,3,4,5,6].map(n=>entry(n,{odds:n}))});
 const r=evaluateRule(RULES.find(x=>x.id==='kv21-cim-345'),Array.from({length:60},(_,i)=>mk(i)));
 assert.equal(r.rate,.5);assert.equal(r.favoriteSameSize,.5);assert.equal(r.paired.diff,0);assert.equal(r.paired.testable,true);
 assert.ok(Math.abs(r.roi-(30*4/180-1))<1e-12,'1 TL on each of 3 picks, 30 wins paid at 4.00');assert.ok(Math.abs(r.favoriteRoi-(30*1/180-1))<1e-12);
 const fav=evaluateRule(RULES.find(x=>x.id==='kv21-fav'),Array.from({length:60},(_,i)=>mk(i)));
 assert.equal(fav.paired.direction,-1);assert.ok(Math.abs(fav.paired.diff-(.5-1/6))<1e-12,'favourite wins half the time, far above its 1/6 random share');
});
test('rule weights come from the pre-race market edge, are gated by the backtest and only fire where the rule applies',()=>{
 // HAN-16 dirt: the top-3 handicaps (horses 4,5,6, unfancied) win 60% of the time while the top-3 AGF favourites (1,2,3) win 40%.
 const mk=(i,date)=>({race:{date,breed:'TB',family:'HAND',classNumber:16,surface:'DIRT',gender:null,winners:[String(i%5<3?4+i%3:1+i%3)]},
  entries:[1,2,3,4,5,6].map(n=>entry(n,{odds:n%2?1.5:30,agf1:[40,25,15,8,7,5][n-1],handicap:[50,49,48,70,69,68][n-1]}))});
 const races=[...Array.from({length:120},(_,i)=>mk(i,'2025-06-01')),...Array.from({length:120},(_,i)=>mk(i,'2026-06-01'))];
 const w=learnRuleWeights(races,{split:'2026-01-01'}),key='TB:han16-kum-hcp';
 assert.ok(Math.abs(w.discovery[key]-.2)<1e-9,'edge = 60% − 40% against AGF favourites, closing odds ignored');assert.ok(Math.abs(w.production[key]-.2)<1e-9);
 assert.equal(w.discovery['TB:han16-cim-fav3'],undefined,'a turf rule never fires on dirt');
 const sig=ruleSignals(races[0].race,races[0].entries,w.production);assert.ok(sig.get('4').score>0&&sig.get('1').score===0);assert.ok(sig.get('4').rules.some(r=>r.id==='han16-kum-hcp'));
 const noMarket=races.map(x=>({...x,entries:x.entries.map(e=>({...e,agf1:null}))}));
 assert.equal(learnRuleWeights(noMarket,{split:'2026-01-01'}).discovery[key],undefined,'without AGF there is no market to beat, so no weight');
});
test('confirmation requires discovery significance after correction and the same direction later',()=>{
 const ev=(n,diff,p,o={})=>({n,rate:.5,ci:[.4,.6],claimed:null,random:.2,paired:{diff,p,direction:1,testable:true},...o});
 assert.equal(confirmationVerdict(ev(100,.1,.001),ev(80,.08,.01),.02).status,'doğrulandı');
 assert.equal(confirmationVerdict(ev(100,.1,.001),ev(80,-.02,.6),.02).status,'tekrar etmedi');
 assert.equal(confirmationVerdict(ev(100,.1,.001),ev(80,.08,.01),.2).status,'kanıt yok','uncorrected p alone is not enough');
 assert.equal(confirmationVerdict(ev(100,-.1,.001),ev(80,-.08,.01),.02).status,'tersi doğrulandı');
 assert.equal(confirmationVerdict(ev(100,.1,.001),ev(20,.08,.01),.02).status,'yetersiz örnek');
 const claim=(lo,hi,rate)=>ev(100,0,null,{claimed:.7,ci:[lo,hi],rate,paired:{diff:0,p:null,direction:1,testable:false}});
 assert.equal(confirmationVerdict(claim(.25,.4,.32),claim(.22,.38,.3),null).status,'iddia çürütüldü');
 assert.equal(confirmationVerdict(claim(.6,.75,.68),claim(.62,.8,.71),null).status,'iddia doğrulandı');
 assert.equal(confirmationVerdict({...claim(.6,.75,.68),claimed:null},claim(.6,.75,.68),null).status,'favori seçimi');
});
