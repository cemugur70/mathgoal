const outcome=(h,a)=>h>a?'1':h<a?'2':'X';
const kg=(h,a)=>h>0&&a>0;
const line=n=>String(n).replace('.',',');
export const SIMULATION_MARKET_GROUPS={main:'Maç sonucu ve gol',halves:'İlk / ikinci yarı',combined:'Birleşik pazarlar',handicap:'Handikap ve fark',scores:'Skorlar'};

// Count joint half/full scores, rather than deriving halves from a single replay.
export function createSimulationMarketAccumulator(){
 const buckets=new Map();let iterations=0;
 return {
  record({home,away,homeHalf,awayHalf,firstGoal=null}){
   if(![home,away,homeHalf,awayHalf].every(n=>Number.isInteger(n)&&n>=0)||homeHalf>home||awayHalf>away)throw Error('Geçersiz yarı / maç skoru');
   if(home+away===0?firstGoal!==null:!['home','away'].includes(firstGoal))throw Error('İlk gol kaydı skorla eşleşmiyor');
   if(firstGoal==='home'&&home===0||firstGoal==='away'&&away===0)throw Error('Gol atmayan takım ilk golü atamaz');
   const key=[home,away,homeHalf,awayHalf,firstGoal??'none'].join(':');
   if(!buckets.has(key))buckets.set(key,{h:home,a:away,h1:homeHalf,a1:awayHalf,h2:home-homeHalf,a2:away-awayHalf,firstGoal,count:0});
   buckets.get(key).count++;iterations++;
  },
  finish(){return buildSimulationMarketSummary([...buckets.values()],iterations);}
 };
}

export function buildSimulationMarketSummary(records,iterations){
 if(!Number.isInteger(iterations)||iterations<1||records.reduce((s,r)=>s+r.count,0)!==iterations)throw Error('Simülasyon sayısı kayıtlarla eşleşmiyor');
 const markets=[];
 function add(id,group,label,choices,{partition=true,featured=false}={}){
  markets.push({id,group,label,partition,featured,options:choices.map(([label,test],i)=>{const count=records.reduce((s,r)=>s+(test(r)?r.count:0),0);return {id:id+'.'+i,label,count,probability:count/iterations};})});
 }
 const resultChoices=(prefix,h='h',a='a')=>['1','X','2'].map(o=>[prefix+o,r=>outcome(r[h],r[a])===o]);
 const doubleChoices=(prefix,h='h',a='a')=>[['1-X','2'],['1-2','X'],['X-2','1']].map(([name,excluded])=>[prefix+name,r=>outcome(r[h],r[a])!==excluded]);
 function yesNo(id,group,label,test){add(id,group,label,[['Evet',test],['Hayır',r=>!test(r)]]);}
 function overUnder(id,group,label,limit,total,featured=false){add(id,group,label,[[line(limit)+' Alt',r=>total(r)<limit],[line(limit)+' Üst',r=>total(r)>limit]],{featured});}
 add('ms','main','Maç Sonucu',resultChoices('MS '),{featured:true});
 add('dc','main','Çifte Şans',doubleChoices('ÇŞ '),{partition:false,featured:true});
 for(const n of [.5,1.5,2.5,3.5,4.5,5.5,6.5])overUnder('total.'+n,'main','Toplam Gol Alt/Üst · '+line(n),n,r=>r.h+r.a,n===2.5);
 add('btts','main','Karşılıklı Gol',[['KG Var',r=>kg(r.h,r.a)],['KG Yok',r=>!kg(r.h,r.a)]],{featured:true});
 for(const [side,key]of [['Ev Sahibi','h'],['Deplasman','a']])for(const n of [.5,1.5,2.5,3.5])overUnder(key+'.goals.'+n,'main',side+' Gol Alt/Üst · '+line(n),n,r=>r[key]);
 add('goalRange','main','Toplam Gol Aralığı',[[0,1],[2,3],[4,5],[6,Infinity]].map(([min,max])=>[max===Infinity?'6+ Gol':min+'–'+max+' Gol',r=>r.h+r.a>=min&&r.h+r.a<=max]));
 add('odd','main','Toplam Gol Tek/Çift',[['Tek',r=>(r.h+r.a)%2===1],['Çift',r=>(r.h+r.a)%2===0]]);
 add('firstGoal','main','İlk Golü Hangi Takım Atar?',[['1. Gol Ev',r=>r.firstGoal==='home'],['Olmaz',r=>r.firstGoal===null],['1. Gol Dep',r=>r.firstGoal==='away']]);
 for(const [home,away]of [[0,1],[0,2],[0,3],[1,0],[2,0],[3,0]])add('hms.'+home+'.'+away,'handicap','Handikaplı Maç Sonucu · '+home+':'+away,['1','X','2'].map(o=>['HMS '+o,r=>outcome(r.h+home,r.a+away)===o]));
 add('margin','handicap','Hangi Takım Kaç Farkla Kazanır?',[
  ['Ev 3+ Fark',r=>r.h-r.a>=3],['Ev 2 Fark',r=>r.h-r.a===2],['Ev 1 Fark',r=>r.h-r.a===1],['Berabere',r=>r.h===r.a],
  ['Dep 1 Fark',r=>r.a-r.h===1],['Dep 2 Fark',r=>r.a-r.h===2],['Dep 3+ Fark',r=>r.a-r.h>=3]]);
 for(const n of [1.5,2.5,3.5,4.5])add('ms.total.'+n,'combined','Maç Sonucu ve '+line(n)+' Gol Alt/Üst',['Alt','Üst'].flatMap(type=>['1','X','2'].map(o=>['MS '+o+' ve '+line(n)+' '+type,r=>outcome(r.h,r.a)===o&&(type==='Alt'?r.h+r.a<n:r.h+r.a>n)])));
 add('ms.kg','combined','Maç Sonucu ve Karşılıklı Gol',['1','X','2'].flatMap(o=>[true,false].map(b=>['MS '+o+' ve '+(b?'Var':'Yok'),r=>outcome(r.h,r.a)===o&&kg(r.h,r.a)===b])));
 add('kg.total','combined','Karşılıklı Gol ve 2,5 Gol Alt/Üst',[false,true].flatMap(b=>['Alt','Üst'].map(type=>['2,5 '+type+' ve KG '+(b?'Var':'Yok'),r=>kg(r.h,r.a)===b&&(type==='Alt'?r.h+r.a<2.5:r.h+r.a>2.5)])));
 for(const [label,h,a,prefix]of [['İlk Yarı','h1','a1','İY '],['İkinci Yarı','h2','a2','2.Y ']]){
  add(h+'.result','halves',label+' Sonucu',resultChoices(prefix,h,a));
  add(h+'.kg','halves',label+' Karşılıklı Gol',[[prefix+'KG Var',r=>kg(r[h],r[a])],[prefix+'KG Yok',r=>!kg(r[h],r[a])]]);
  for(const n of [.5,1.5,2.5])overUnder(h+'.total.'+n,'halves',label+' Gol Alt/Üst · '+line(n),n,r=>r[h]+r[a]);
 }
 add('ht.dc','halves','İlk Yarı Çifte Şans',doubleChoices('İY ','h1','a1'),{partition:false});
 add('htft','combined','İlk Yarı / Maç Sonucu',['1','X','2'].flatMap(first=>['1','X','2'].map(last=>[first+'/'+last,r=>outcome(r.h1,r.a1)===first&&outcome(r.h,r.a)===last])));
 for(const [side,key]of [['Ev Sahibi','h1'],['Deplasman','a1']])for(const n of [.5,1.5])overUnder(key+'.goals.'+n,'halves',side+' İlk Yarı Gol Alt/Üst · '+line(n),n,r=>r[key]);
 add('ht.result.total','combined','İlk Yarı Sonucu ve İY 1,5 Gol Alt/Üst',['Alt','Üst'].flatMap(type=>['1','X','2'].map(o=>['İY '+o+' ve 1,5 '+type,r=>outcome(r.h1,r.a1)===o&&(type==='Alt'?r.h1+r.a1<1.5:r.h1+r.a1>1.5)])));
 add('ht.result.kg','combined','İlk Yarı Sonucu ve İY Karşılıklı Gol',['1','X','2'].flatMap(o=>[true,false].map(b=>['İY '+o+' ve '+(b?'Var':'Yok'),r=>outcome(r.h1,r.a1)===o&&kg(r.h1,r.a1)===b])));
 for(const [id,label,first,second]of [['halves.more','Hangi Yarıda Daha Fazla Gol Atılır?',r=>r.h1+r.a1,r=>r.h2+r.a2],['h.more','Ev Sahibi Hangi Yarıda Daha Fazla Gol Atar?',r=>r.h1,r=>r.h2],['a.more','Deplasman Hangi Yarıda Daha Fazla Gol Atar?',r=>r.a1,r=>r.a2]])add(id,'halves',label,[['1. Yarı',r=>first(r)>second(r)],['Eşit',r=>first(r)===second(r)],['2. Yarı',r=>first(r)<second(r)]]);
 yesNo('halves.under','halves','Her İki Yarıda da 1,5 Gol Alt Olur mu?',r=>r.h1+r.a1<1.5&&r.h2+r.a2<1.5);
 yesNo('halves.over','halves','Her İki Yarıda da 1,5 Gol Üst Olur mu?',r=>r.h1+r.a1>1.5&&r.h2+r.a2>1.5);
 for(const [side,h,a]of [['Ev Sahibi','h','a'],['Deplasman','a','h']]){
  yesNo(h+'.bothGoals','halves',side+' Her İki Yarıda da Gol Atar mı?',r=>r[h+'1']>0&&r[h+'2']>0);
  yesNo(h+'.anyWin','halves',side+' Herhangi Bir Yarıyı Kazanır mı?',r=>r[h+'1']>r[a+'1']||r[h+'2']>r[a+'2']);
  yesNo(h+'.bothWin','halves',side+' Her İki Yarıyı da Kazanır mı?',r=>r[h+'1']>r[a+'1']&&r[h+'2']>r[a+'2']);
 }
 add('ht.odd','halves','İlk Yarı Gol Tek/Çift',[['İY Tek',r=>(r.h1+r.a1)%2===1],['İY Çift',r=>(r.h1+r.a1)%2===0]]);
 add('halves.kg','combined','1. Yarı ve 2. Yarı Karşılıklı Gol Olur mu?',[false,true].flatMap(first=>[false,true].map(last=>[(first?'Evet':'Hayır')+'/'+(last?'Evet':'Hayır'),r=>kg(r.h1,r.a1)===first&&kg(r.h2,r.a2)===last])));
 for(const [id,label,h,a,max]of [['score','Maç Skoru','h','a',5],['ht.score','İlk Yarı Skoru','h1','a1',3]]){
  const pairs=Array.from({length:max+1},(_,x)=>Array.from({length:max+1},(_,y)=>[x,y])).flat();
  add(id,'scores',label,[...pairs.map(([x,y])=>[x+':'+y,r=>r[h]===x&&r[a]===y]),['Diğer',r=>r[h]>max||r[a]>max]]);
 }
 const joint=new Map();for(const r of records){const key=`${r.h1}:${r.a1} → ${r.h}:${r.a}`;joint.set(key,(joint.get(key)??0)+r.count);}
 const topJoint=[...joint].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,12).map(([key])=>key);
 add('htft.scores','scores','İlk Yarı / Maç Sonucu Skorları',[...topJoint.map(key=>[key,r=>`${r.h1}:${r.a1} → ${r.h}:${r.a}`===key]),['Diğer',r=>!topJoint.includes(`${r.h1}:${r.a1} → ${r.h}:${r.a}`)]]);
 const mean=key=>records.reduce((s,r)=>s+r[key]*r.count,0)/iterations;
 return {version:1,iterations,markets,means:{home:mean('h'),away:mean('a'),homeHalf:mean('h1'),awayHalf:mean('a1'),homeSecond:mean('h2'),awaySecond:mean('a2')},
  unsupported:[{label:'Korner pazarları',reason:'Bu 10.000 maçta korner olayları üretilmiyor.'},{label:'Kart, şut, faul ve ofsayt pazarları',reason:'Bu olaylar maç simülasyonunun parçası değil.'},{label:'Oyuncu golü ve ilk golcü',reason:'Golcü ataması yalnız örnek maç için kaydediliyor; 10.000 tekrarın tamamında sayılmıyor.'}],
  policy:{normalTimeMinutes:90,halfTimeMinute:45,timeModel:'phase-uniform-goal-times',jointMarkets:'same-simulation-joint-counts',source:'empirical-simulation-frequency',overlapping:['Çifte Şans','İlk Yarı Çifte Şans']}};
}
