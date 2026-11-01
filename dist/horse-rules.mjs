// User-supplied handicapping heuristics encoded as testable selections, and their walk-free historical evaluation.
// Interpretations (stated in the report): "favori" = lowest final TJK ganyan, "plase" = 2nd–3rd favourite, "N. handikap" = Nth highest
// handicap rating in the race, "puan / TGP / Türkiye puanı" = liderform point, "N numaralı" = program number, "N startlı" = gate, "hafif kg" = lightest third.
// A missing value ranks Infinity, never null: `null <= 2` is true in JavaScript and would put every unrated horse into "top N" selections.
const rank=(rows,key,desc)=>{
 const vals=rows.map(r=>r[key]).filter(v=>v!==null&&v>0),out=new Map();
 for(const r of rows){const v=r[key];out.set(r.number,v===null||!(v>0)?Infinity:1+vals.filter(x=>desc?x>v:x<v).length);}
 return out;
};
/** Per-race helper: competition ranks (ties share a rank; missing values rank Infinity) over runners only. */
export function raceContext(race,entries){
 const runners=entries.filter(e=>e.status!=='NONRUNNER');
 const fav=rank(runners.map(e=>({...e,o:e.odds??(e.agf1?100/e.agf1:null)})),'o',false),hcp=rank(runners,'handicap',true),pt=rank(runners,'point',true),light=rank(runners,'kg',false);
 const third=Math.max(1,Math.round(runners.length/3));
 return {race,runners,field:runners.length,fav:n=>fav.get(n),hcp:n=>hcp.get(n),pt:n=>pt.get(n),light:n=>light.get(n),lightThird:n=>light.get(n)<=third,
  pick:test=>new Set(runners.filter(test).map(e=>e.number))};
}
const between=(v,a,b)=>v!==null&&v!==undefined&&v>=a&&v<=b,isIn=(v,list)=>list.includes(v);
const R=(id,family,number,surface,text,select,extra={})=>({id,family,number,surface,text,select,...extra});
// surface: TURF=çim, DIRT=kum; claimed = the share stated in the source text, when one is given.
export const RULES=[
 R('srt1-cim','COND',1,'TURF','Şartlı 1 çim: ilk 4 at arasında biter',c=>c.pick(e=>c.fav(e.number)<=4)),
 R('srt1-kum','COND',1,'DIRT','Şartlı 1 kum: favori-plaseler arasında biter',c=>c.pick(e=>c.fav(e.number)<=3)),
 R('srt1-puan','COND',1,null,'Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir',c=>c.pick(e=>c.pt(e.number)<=3)),
 R('srt2-fav','COND',2,null,'Şartlı 2: favori varsa kazanır',c=>c.pick(e=>c.fav(e.number)===1)),
 R('srt2-kum-190','COND',2,'DIRT','Şartlı 2 kum: puanı 190 üstü favori kazanır',c=>c.pick(e=>c.fav(e.number)===1&&e.point>190),{conditional:c=>c.runners.some(e=>c.fav(e.number)===1&&e.point>190)}),
 R('srt2-hcp1235','COND',2,null,'Şartlı 2: 1,2,3,5. handikaplar arasında geçer',c=>c.pick(e=>isIn(c.hcp(e.number),[1,2,3,5]))),
 R('srt2-hcp12','COND',2,null,'Şartlı 2: 1-2. handikap dışına çıkmaz',c=>c.pick(e=>c.hcp(e.number)<=2)),
 R('srt2-55kg','COND',2,null,'Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı)',c=>c.pick(e=>between(e.kg,54,56)&&c.fav(e.number)>1)),
 R('srt3-cim-plase','COND',3,'TURF','Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı',c=>c.pick(e=>between(c.fav(e.number),2,3)),{versus:'fav1'}),
 R('srt3-kum-fav','COND',3,'DIRT','Şartlı 3 kum: favori şanslı',c=>c.pick(e=>c.fav(e.number)===1)),
 R('srt3-hcp47-51','COND',3,'DIRT','Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer',c=>c.pick(e=>between(e.handicap,47,51))),
 R('srt3-60kg','COND',3,null,'Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg)',c=>c.pick(e=>between(e.kg,59,61))),
 R('srt4-cim-tgp','COND',4,'TURF','Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır',c=>c.pick(e=>between(c.pt(e.number),2,4))),
 R('srt4-kum-start','COND',4,'DIRT','Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır',c=>c.pick(e=>between(e.start,1,4))),
 R('srt4-fav','COND',4,null,'Şartlı 4: favori gelir',c=>c.pick(e=>c.fav(e.number)===1)),
 R('srt5-cim-fav','COND',5,'TURF','Şartlı 5 çim: favori çok şanslı',c=>c.pick(e=>c.fav(e.number)===1)),
 R('srt5-cim-hafif','COND',5,'TURF','Şartlı 5 çim: %40 hafif kg\'lar kazanır',c=>c.pick(e=>c.lightThird(e.number)),{claimed:.40}),
 R('srt5-kum-49-51','COND',5,'DIRT','Şartlı 5 kum: sürpriz 49–51 kg\'lardan gelir',c=>c.pick(e=>between(e.kg,49,51))),
 R('srt5-1200-start','COND',5,'DIRT','Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır',c=>c.pick(e=>isIn(e.start,[1,8,13])),{distance:1200}),
 R('srt5-fav234','COND',5,null,'Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori)',c=>c.pick(e=>c.fav(e.number)<=4)),
 R('kv6-cim','KV',6,'TURF','KV-6 çim: 1-2. atların dışına çıkmaz',c=>c.pick(e=>c.fav(e.number)<=2)),
 R('kv6-kum-fav','KV',6,'DIRT','KV-6 kum: 1-2. atlar şanslı',c=>c.pick(e=>c.fav(e.number)<=2)),
 R('kv6-kum-puan','KV',6,'DIRT','KV-6 kum: puana göre 1,2,3. atlar kazanır',c=>c.pick(e=>c.pt(e.number)<=3)),
 R('kv6-hcp123','KV',6,'DIRT','KV-6 kum: 1,2,3. handikaplar arasında geçer',c=>c.pick(e=>c.hcp(e.number)<=3)),
 R('kv6-disi-6','KV',6,'DIRT','KV-6 dişi kum: 6 numaralı ya da 6 startlı at',c=>c.pick(e=>e.number==='6'||e.start===6),{gender:'F'}),
 R('kv7-erkek-cim','KV',7,'TURF','KV-7 erkek çim: ilk 2 atın dışına çıkmaz',c=>c.pick(e=>c.fav(e.number)<=2),{gender:null}),
 R('kv7-erkek-kum-fav','KV',7,'DIRT','KV-7 erkek kum: %20 favori',c=>c.pick(e=>c.fav(e.number)===1),{gender:null,claimed:.20}),
 R('kv7-54kg','KV',7,'DIRT','KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5)',c=>c.pick(e=>between(e.kg,53.5,54.5)),{gender:null}),
 R('kv7-disi-cim','KV',7,'TURF','KV-7 dişi çim: favori, yoksa plaseler',c=>c.pick(e=>c.fav(e.number)<=3),{gender:'F'}),
 R('kv7-disi-kum','KV',7,'DIRT','KV-7 dişi kum: 1-2. handikaplı atlar',c=>c.pick(e=>c.hcp(e.number)<=2),{gender:'F'}),
 R('kv8-cim','KV',8,'TURF','KV-8 çim: 1-2-4 startlı favori/plase atlar',c=>c.pick(e=>isIn(e.start,[1,2,4])&&c.fav(e.number)<=3)),
 R('kv8-kum-fav','KV',8,'DIRT','KV-8 kum: favorinin şansı az (favori gelmez)',c=>c.pick(e=>c.fav(e.number)===1),{expectLow:true}),
 R('kv8-kum-57','KV',8,'DIRT','KV-8 kum: 57 kg altındaki atlar kazanır',c=>c.pick(e=>e.kg!==null&&e.kg<57)),
 R('kv9-fav3','KV',9,null,'KV-9: kesin favori, yoksa plaseler dışına çıkmaz',c=>c.pick(e=>c.fav(e.number)<=3)),
 R('kv21-cim-345','KV',21,'TURF','KV-21 çim: %60 3,4,5 numaralı atlar',c=>c.pick(e=>isIn(e.number,['3','4','5'])),{claimed:.60}),
 R('kv21-kum-345','KV',21,'DIRT','KV-21 kum: %60 3,4,5 numaralı atlar',c=>c.pick(e=>isIn(e.number,['3','4','5'])),{claimed:.60}),
 R('kv21-fav','KV',21,null,'KV-21: favori gelmez',c=>c.pick(e=>c.fav(e.number)===1),{expectLow:true}),
 R('kv22-cim-hcp','KV',22,'TURF','KV-22 çim: %60 1,2,3. handikaplar',c=>c.pick(e=>c.hcp(e.number)<=3),{claimed:.60}),
 R('kv22-kum-123','KV',22,'DIRT','KV-22 kum: %50 1,2,3 numaralı',c=>c.pick(e=>isIn(e.number,['1','2','3'])),{claimed:.50}),
 R('kv23-cim-fav','KV',23,'TURF','KV-23 çim: %70 favori kazanır',c=>c.pick(e=>c.fav(e.number)===1),{claimed:.70}),
 R('kv23-kum-fav','KV',23,'DIRT','KV-23 kum: %60 favori',c=>c.pick(e=>c.fav(e.number)===1),{claimed:.60}),
 R('kv24-cim-100','KV',24,'TURF','KV-24 çim: handikap puanı 100+ atlar %80',c=>c.pick(e=>e.handicap>=100),{claimed:.80}),
 R('kv24-kum-90-120','KV',24,'DIRT','KV-24 kum: 90–120 puanlılar %80',c=>c.pick(e=>between(e.handicap,90,120)),{claimed:.80}),
 R('kv25-cim-2345','KV',25,'TURF','KV-25 çim: 2,3,4,5 numaralı %75',c=>c.pick(e=>isIn(e.number,['2','3','4','5'])),{claimed:.75}),
 R('kv25-kum-345','KV',25,'DIRT','KV-25 kum: 3,4,5 numaralı %60',c=>c.pick(e=>isIn(e.number,['3','4','5'])),{claimed:.60}),
 R('han13-cim','HAND',13,'TURF','HAN-13 çim: ilk 3 at çok şanslı',c=>c.pick(e=>c.fav(e.number)<=3)),
 R('han13-kum','HAND',13,'DIRT','HAN-13 kum: 1,2,3,4. handikaplar %70',c=>c.pick(e=>c.hcp(e.number)<=4),{claimed:.70}),
 R('han14-cim-ust2','HAND',14,'TURF','HAN-14 çim: en üstteki 2 handikabın şansı %20',c=>c.pick(e=>c.hcp(e.number)<=2),{claimed:.20}),
 R('han14-cim-789','HAND',14,'TURF','HAN-14 çim: 7,8,9. handikap sırasındaki atlar',c=>c.pick(e=>between(c.hcp(e.number),7,9))),
 R('han14-kum-list','HAND',14,'DIRT','HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor',c=>c.pick(e=>isIn(e.handicap,[37,43,47,48,49,51,52]))),
 R('han14-kum-123','HAND',14,'DIRT','HAN-14 kum: %75 1-2-3. atlara güvenin',c=>c.pick(e=>c.fav(e.number)<=3),{claimed:.75}),
 R('han14-fav12','HAND',14,null,'HAN-14 (özet): 1-2. at kazanır',c=>c.pick(e=>c.fav(e.number)<=2)),
 R('han15-cim-num','HAND',15,'TURF','HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı',c=>c.pick(e=>isIn(e.number,['5','6','8','9','10']))),
 R('han15-kum-hcp','HAND',15,'DIRT','HAN-15 kum: 1,2,3. handikaplar fazla kazanır',c=>c.pick(e=>c.hcp(e.number)<=3)),
 R('han15-kum-54','HAND',15,'DIRT','HAN-15 kum: 54 kg\'lılar fazla kazanıyor (53.5–54.5)',c=>c.pick(e=>between(e.kg,53.5,54.5))),
 R('han15-fav3','HAND',15,null,'HAN-15 (özet): 1,2,3. at dışına çıkmaz',c=>c.pick(e=>c.fav(e.number)<=3)),
 R('han15-hcp3','HAND',15,null,'HAN-15 (özet): 3. handikaplı at tek',c=>c.pick(e=>c.hcp(e.number)===3)),
 R('han16-cim-fav3','HAND',16,'TURF','HAN-16 çim: favori-plaseler arasında biter',c=>c.pick(e=>c.fav(e.number)<=3)),
 R('han16-cim-789','HAND',16,'TURF','HAN-16 çim: %30 7,8,9 numaralar',c=>c.pick(e=>isIn(e.number,['7','8','9'])),{claimed:.30}),
 R('han16-kum-hcp','HAND',16,'DIRT','HAN-16 kum: 1,2,3. handikaplar %80',c=>c.pick(e=>c.hcp(e.number)<=3),{claimed:.80}),
 R('han16-kum-list','HAND',16,'DIRT','HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz',c=>c.pick(e=>isIn(e.handicap,[40,48,49,50,52,53,54]))),
 R('han16-hafif-fav','HAND',16,null,'HAN-16 (özet): hafif kilo favori',c=>c.pick(e=>c.lightThird(e.number)&&c.fav(e.number)<=3)),
 R('han17-cim-hafif','HAND',17,'TURF','HAN-17 çim: hafif kg\'lı atlar çok şanslı',c=>c.pick(e=>c.lightThird(e.number))),
 R('han17-kum-plase','HAND',17,'DIRT','HAN-17 kum: plase atlar şanslı %70',c=>c.pick(e=>between(c.fav(e.number),2,3)),{claimed:.70}),
 R('han17-kum-puan','HAND',17,'DIRT','HAN-17 kum: puana göre 1-4. atlar',c=>c.pick(e=>c.pt(e.number)<=4)),
 R('han17-fav12','HAND',17,null,'HAN-17: normal şartlarda 1-2. at dışına çıkmaz',c=>c.pick(e=>c.fav(e.number)<=2)),
 R('maiden-kum-fav','MAIDEN',null,'DIRT','Maiden kum: genelde favori kazanır',c=>c.pick(e=>c.fav(e.number)===1)),
 R('maiden-fav12','MAIDEN',null,null,'Maiden (özet): ilk iki at arasında',c=>c.pick(e=>c.fav(e.number)<=2)),
 R('grup-fav3','GROUP',null,'TURF','Açık/Grup çim: favori-plase dışına çıkmaz',c=>c.pick(e=>c.fav(e.number)<=3)),
 R('grup-kum-fav','GROUP',null,'DIRT','Açık/Grup kum: %70 favori',c=>c.pick(e=>c.fav(e.number)===1),{claimed:.70}),
];
/** True when the rule's class, surface, distance and gender restriction cover this race. `surfaceAs` lets a dirt rule be tried on synthetic (AWT). */
export function ruleApplies(rule,race,{surfaceAs=null}={}){
 if(rule.family!==race.family||(rule.number!==null&&rule.number!==race.classNumber))return false;
 const surface=surfaceAs&&race.surface===surfaceAs.from?surfaceAs.to:race.surface;
 if(rule.surface&&rule.surface!==surface)return false;
 if(rule.distance&&rule.distance!==race.distance)return false;
 if('gender' in rule&&(rule.gender==='F'?race.gender!=='F':race.gender==='F'))return false;
 return true;
}
// Wilson 95% interval for a proportion.
export function wilson(k,n){if(!n)return [null,null];const z=1.96,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)];}
// Two-sided normal p-value (Abramowitz–Stegun 7.1.26 erf, |error| < 1.5e-7).
export function pValue(z){const x=Math.abs(z)/Math.SQRT2,t=1/(1+.3275911*x),erf=1-((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return 1-erf;}
/** Benjamini–Hochberg adjusted q-values, same order as the input; null p-values stay null and are not counted. */
export function benjaminiHochberg(ps){
 const idx=ps.map((p,i)=>[p,i]).filter(([p])=>p!==null&&Number.isFinite(p)).sort((a,b)=>a[0]-b[0]),m=idx.length,q=ps.map(()=>null);let min=1;
 for(let j=m-1;j>=0;j--){min=Math.min(min,idx[j][0]*m/(j+1));q[idx[j][1]]=min;}
 return q;
}
/**
 * Evaluates one rule over finished races. Baselines per race: random share |S|/field, and the same number of shortest-priced horses
 * (the honest comparison: does the rule beat simply taking that many favourites?).
 * `paired` is a per-race paired test of rule hit minus its comparator: same-size favourites by default, the favourite for "plase beats
 * favourite" claims, and the random share for "favourite will not win" claims (expected direction negative).
 * ROI is a 1 TL win (ganyan) stake on every selected horse at the official final ganyan, which equals the paid dividend.
 */
export function evaluateRule(rule,races,{surfaceAs=null}={}){
 let n=0,hits=0,size=0,random=0,favSame=0,fav1=0,empty=0,identical=0,stake=0,ret=0,favRet=0,dSum=0,dSq=0,fN=0,fSum=0,fSq=0,fIdentical=0;
 for(const {race,entries} of races){
  if(!race.winners?.length||!ruleApplies(rule,race,{surfaceAs}))continue;
  const c=raceContext(race,entries);if(c.field<3)continue;
  if(rule.conditional&&!rule.conditional(c))continue;
  const s=rule.select(c);if(!s.size){empty++;continue;}
  const win=race.winners.some(w=>s.has(w)),k=s.size,favTop=c.pick(e=>c.fav(e.number)!==null&&c.fav(e.number)<=k);
  const favWin=race.winners.some(w=>favTop.has(w)),oneWin=race.winners.some(w=>c.fav(w)===1),share=Math.min(1,k/c.field);
  n++;hits+=win;size+=k;random+=share;favSame+=favWin;fav1+=oneWin;
  identical+=s.size===favTop.size&&[...s].every(v=>favTop.has(v));
  const odds=w=>c.runners.find(e=>e.number===w)?.odds??0;
  stake+=k;ret+=race.winners.filter(w=>s.has(w)).reduce((a,w)=>a+odds(w),0);favRet+=race.winners.filter(w=>favTop.has(w)).reduce((a,w)=>a+odds(w),0);
  const d=win-(rule.expectLow?share:rule.versus==='fav1'?oneWin:favWin);dSum+=d;dSq+=d*d;
  // Without a price for at least k horses there is no market comparison to make.
  if(favTop.size>=k){const f=win-favWin;fN++;fSum+=f;fSq+=f*f;fIdentical+=s.size===favTop.size&&[...s].every(v=>favTop.has(v));}
 }
 const rate=n?hits/n:null,[lo,hi]=wilson(hits,n),favRate=n?favSame/n:null;
 const mean=n?dSum/n:null,sd=n>1?Math.sqrt(Math.max(0,(dSq-n*mean*mean)/(n-1))):null,se=sd&&n?sd/Math.sqrt(n):null;
 const z=se?mean/se:null,paired={diff:mean,z,p:z===null?null:pValue(z),direction:rule.expectLow?-1:1,testable:n>=30&&!(identical===n&&!rule.expectLow&&rule.versus!=='fav1')};
 // Edge over the market for the model: rule hit minus the same number of favourites, whatever the rule claims.
 const fMean=fN?fSum/fN:null,fSd=fN>1?Math.sqrt(Math.max(0,(fSq-fN*fMean*fMean)/(fN-1))):null,fZ=fSd?fMean/(fSd/Math.sqrt(fN)):null;
 const vsFavorites={n:fN,diff:fMean,z:fZ,p:fZ===null?null:pValue(fZ),testable:fN>=30&&fIdentical<fN};
 let verdict;
 if(n<30)verdict='yetersiz örnek';
 // A pure favourite selection cannot beat itself; only its stated share is testable.
 else if(identical===n&&!rule.expectLow)verdict=rule.claimed===null||rule.claimed===undefined?'favori seçimi (oran bilgi amaçlı)':lo<=rule.claimed&&rule.claimed<=hi?'iddia edilen oran tutuyor':rule.claimed>hi?'iddia abartılı':'iddia temkinli (gerçek oran daha yüksek)';
 else if(rule.expectLow)verdict=fav1/n<random/n?'doğrulandı (favori ortalamanın altında)':'doğrulanmadı (favori yine en şanslı)';
 else if(rule.versus==='fav1')verdict=hits/n>fav1/n?'doğrulandı':'doğrulanmadı (favori daha sık kazanıyor)';
 else if(lo>favRate)verdict='favoriden iyi';
 else if(hi<random/n)verdict='rastgeleden kötü';
 else if(hi<favRate)verdict='favoriden kötü';
 else verdict='favoriden farksız';
 const claim=n>=30&&rule.claimed!=null?(lo<=rule.claimed&&rule.claimed<=hi?'tutuyor':rule.claimed>hi?'abartılı':'temkinli'):null;
 return {claim,id:rule.id,text:rule.text,n,empty,hits,rate,ci:[lo,hi],avgPick:n?size/n:null,random:n?random/n:null,favoriteSameSize:favRate,favoriteWin:n?fav1/n:null,claimed:rule.claimed??null,verdict,
  paired,vsFavorites,roi:stake?ret/stake-1:null,favoriteRoi:stake?favRet/stake-1:null};
}
// The model may only use what is known before the off: the final ganyan is not, so "favourite" there means the AGF order.
const stripOdds=entries=>entries.map(e=>({...e,odds:null})),preRace=races=>races.map(x=>({...x,entries:stripOdds(x.entries)}));
/**
 * Backtest-gated rule weights for the prediction model (pre-race: favourite = AGF order), per breed ("TB:han15-hcp3"). A rule's weight is its edge over the same number of
 * favourites (win-probability points; negative = the rule's horses do worse than the market suggests).
 * - `discovery`: rules whose discovery-period edge survives Benjamini–Hochberg (q < alphaQ); weight from discovery only. Used by the walk-forward,
 *   so confirmation races never influence which rules are applied.
 * - `production`: rules that also repeat the same sign at p < alpha in the confirmation period; weight from the whole archive. Used for live races.
 */
export function learnRuleWeights(allRaces,{split,alphaQ=.10,alpha=.05,breeds=['TB','AR']}={}){
 const table=[],races=preRace(allRaces);
 for(const breed of breeds){
  const rs=races.filter(x=>x.race.breed===breed),disc=rs.filter(x=>x.race.date<split),conf=rs.filter(x=>x.race.date>=split);
  for(const rule of RULES)table.push({key:`${breed}:${rule.id}`,breed,id:rule.id,text:rule.text,discovery:evaluateRule(rule,disc).vsFavorites,confirmation:evaluateRule(rule,conf).vsFavorites,all:evaluateRule(rule,rs)});
 }
 const qs=benjaminiHochberg(table.map(t=>t.discovery.testable?t.discovery.p:null)),discovery={},production={};
 table.forEach((t,i)=>{
  t.q=qs[i];t.discoveryPass=t.q!==null&&t.q<alphaQ;
  t.confirmed=t.discoveryPass&&t.confirmation.testable&&t.confirmation.p<alpha&&Math.sign(t.confirmation.diff)===Math.sign(t.discovery.diff);
  if(t.discoveryPass)discovery[t.key]=+t.discovery.diff.toFixed(4);
  if(t.confirmed)production[t.key]=+t.all.vsFavorites.diff.toFixed(4);
 });
 return {split,discovery,production,table:table.map(({all,...t})=>({...t,n:all.vsFavorites.n,rate:all.rate,favoriteSameSize:all.favoriteSameSize}))};
}
/** Per-runner rule signal: the sum of the weights of every applied rule that selects the horse, with the rules that fired. */
export function ruleSignals(race,entries,weights){
 const out=new Map(entries.map(e=>[e.number,{score:0,rules:[]}]));
 if(!weights||!Object.keys(weights).length)return out;
 const c=raceContext(race,stripOdds(entries));if(c.field<3)return out;
 for(const rule of RULES){
  const w=weights[`${race.breed}:${rule.id}`];if(w===undefined||!ruleApplies(rule,race))continue;
  if(rule.conditional&&!rule.conditional(c))continue;
  for(const n of rule.select(c)){const s=out.get(n);if(s){s.score+=w;s.rules.push({id:rule.id,text:rule.text,weight:w});}}
 }
 return out;
}
/**
 * Out-of-sample decision. A rule is confirmed only when its discovery-period paired test survives Benjamini–Hochberg (q < 0.10)
 * in the expected direction and the later, untouched confirmation period repeats that direction at p < 0.05.
 * Pure favourite selections have no edge to test; only a stated share is checked, and it must hold (or fail) in both periods.
 */
export function confirmationVerdict(discovery,confirmation,q,{alphaQ=.10,alpha=.05}={}){
 if(discovery.n<30||confirmation.n<30)return {status:'yetersiz örnek',detail:`keşif ${discovery.n}, doğrulama ${confirmation.n} koşu (en az 30+30 gerekir)`};
 if(!discovery.paired.testable){
  if(discovery.claimed==null)return {status:'favori seçimi',detail:'kural aynı sayıda favoriyi seçiyor; test edilecek ayrı bir üstünlük yok'};
  const inside=r=>r.ci[0]<=r.claimed&&r.claimed<=r.ci[1];
  if(inside(discovery)&&inside(confirmation))return {status:'iddia doğrulandı',detail:'iddia edilen oran iki dönemin %95 aralığında'};
  if(!inside(discovery)&&!inside(confirmation)&&Math.sign(discovery.rate-discovery.claimed)===Math.sign(confirmation.rate-confirmation.claimed))
   return {status:'iddia çürütüldü',detail:discovery.rate<discovery.claimed?'gerçek oran iki dönemde de iddianın altında':'gerçek oran iki dönemde de iddianın üstünde'};
  return {status:'belirsiz',detail:'iddia dönemler arasında tutarlı değil'};
 }
 const dir=discovery.paired.direction,dOk=q!==null&&q<alphaQ,sameDir=Math.sign(discovery.paired.diff)===Math.sign(confirmation.paired.diff),cOk=confirmation.paired.p!==null&&confirmation.paired.p<alpha;
 if(dOk&&sameDir&&cOk)return Math.sign(discovery.paired.diff)===dir?{status:'doğrulandı',detail:'keşifte anlamlı, doğrulama döneminde aynı yönde tekrar etti'}:{status:'tersi doğrulandı',detail:'iki dönemde de kuralın tersi yönde anlamlı'};
 if(dOk)return {status:'tekrar etmedi',detail:'keşifte anlamlıydı, doğrulama döneminde tekrar etmedi'};
 return {status:'kanıt yok',detail:'karşılaştırma ölçütünden anlamlı fark yok'};
}
