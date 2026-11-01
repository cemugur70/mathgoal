// Evaluates the encoded handicapping rules against data/horse/horses.db, separately for English (TB) and Arabian (AR) horses,
// and writes docs/horse-rules-backtest.md + data/horse/rules-backtest.json.
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {RULES,evaluateRule,raceContext} from '../dist/horse-rules.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(root,'data/horse/horses.db'),{readOnly:true});
const BREEDS={TB:'İngiliz',AR:'Arap'},S={TURF:'Çim',DIRT:'Kum',AWT:'Sentetik'};
const pct=v=>v===null||v===undefined?'–':(100*v).toFixed(1)+'%';
function analyse(breed){
 const raceRows=db.prepare("SELECT * FROM races WHERE status='RESULT' AND winners IS NOT NULL AND breed=? ORDER BY date").all(breed);
 const byRace=new Map();for(const e of db.prepare('SELECT e.* FROM entries e JOIN races r ON r.id=e.race_id WHERE r.breed=?').all(breed))(byRace.get(e.race_id)??byRace.set(e.race_id,[]).get(e.race_id)).push(e);
 const races=raceRows.map(r=>({race:{...r,classNumber:r.class_number,winners:r.winners.split(',')},entries:(byRace.get(r.id)||[]).map(e=>({...e}))}));
 const three=races.filter(x=>x.race.age==='3O');
 const results=RULES.map(rule=>{
  const all=evaluateRule(rule,races),age3=evaluateRule(rule,three);
  const awt=rule.surface==='DIRT'?evaluateRule(rule,races.filter(x=>x.race.surface==='AWT'),{surfaceAs:{from:'AWT',to:'DIRT'}}):null;
  return {...all,age3:{n:age3.n,rate:age3.rate,favoriteSameSize:age3.favoriteSameSize,verdict:age3.verdict},synthetic:awt&&{n:awt.n,rate:awt.rate,favoriteSameSize:awt.favoriteSameSize,verdict:awt.verdict}};
 });
 // Favourite baseline per class family and surface.
 const seg=new Map();
 for(const x of races){const c=raceContext(x.race,x.entries);if(c.field<3)continue;const k=`${x.race.family}|${x.race.surface}`,s=seg.get(k)??seg.set(k,{n:0,fav1:0,fav3:0,field:0}).get(k);
  s.n++;s.field+=c.field;s.fav1+=x.race.winners.some(w=>c.fav(w)===1);s.fav3+=x.race.winners.some(w=>c.fav(w)<=3);}
 // Gate (start) effect normalised by field size: actual wins / expected wins (Σ 1/field) for the most common surface × distance pairs.
 const gates=new Map();
 for(const x of races){const c=raceContext(x.race,x.entries);if(c.field<3)continue;const k=`${x.race.surface}|${x.race.distance}`,g=gates.get(k)??gates.set(k,{races:0,by:{}}).get(k);g.races++;
  for(const e of c.runners){if(!e.start)continue;const b=g.by[e.start]??={starts:0,wins:0,expected:0};b.starts++;b.expected+=1/c.field;b.wins+=x.race.winners.includes(e.number);}}
 const gateTables=[...gates].filter(([,g])=>g.races>=40).sort((a,b)=>b[1].races-a[1].races).slice(0,6);
 // HAN-16 profile: observed eligibility from the entrants themselves, and its winners.
 const han16=races.filter(x=>x.race.type==='HAND-16'),hc=han16.flatMap(x=>x.entries.map(e=>e.handicap).filter(v=>v>0)).sort((a,b)=>a-b);
 const winners=han16.slice(-15).reverse().map(x=>{const w=x.entries.find(e=>x.race.winners.includes(e.number));return w&&{date:x.race.date,city:x.race.city,surface:x.race.surface,distance:x.race.distance,age:x.race.age,horse:w.name,handicap:w.handicap,kg:w.kg,odds:w.odds,field:x.entries.filter(e=>e.status!=='NONRUNNER').length};}).filter(Boolean);
 return {races:races.length,results,segments:Object.fromEntries(seg),gates:Object.fromEntries(gateTables),
  han16:{races:han16.length,handicapRange:hc.length?[hc[0],hc.at(-1)]:null,handicapP10P90:hc.length?[hc[Math.floor(hc.length*.1)],hc[Math.floor(hc.length*.9)]]:null,ages:[...new Set(han16.map(x=>x.race.age))],winners}};
}
function section(breed,a){
 const name=BREEDS[breed];
 return [`## ${name} atları`,'',`${a.races} sonuçlanmış ${name} koşusu.${breed==='AR'?' Kurallar İngiliz atları için yazıldı; bu bölüm Araplara aktarılıp aktarılamayacağını gösterir.':''}`,'',
  `### Kurallar (${name})`,'','| Kural | Koşu | İsabet (95% aralık) | Ort. seçim | Rastgele | Aynı sayıda favori | İddia | Karar | 3 yaş (n / isabet / favori) | Sentetik (n / isabet / favori) |','|---|---:|---|---:|---:|---:|---|---|---|---|',
  ...a.results.map(r=>`| ${r.text} | ${r.n} | ${pct(r.rate)} (${pct(r.ci[0])}–${pct(r.ci[1])}) | ${r.avgPick?.toFixed(1)??'–'} | ${pct(r.random)} | ${pct(r.favoriteSameSize)} | ${r.claimed==null?'–':pct(r.claimed)+(r.claim?' · '+r.claim:'')} | ${r.verdict} | ${r.age3.n} / ${pct(r.age3.rate)} / ${pct(r.age3.favoriteSameSize)} | ${r.synthetic?`${r.synthetic.n} / ${pct(r.synthetic.rate)} / ${pct(r.synthetic.favoriteSameSize)}`:'–'} |`),
  '',`### Favori referansı (${name}, sınıf × pist)`,'','| Sınıf | Pist | Koşu | Ort. at | Favori kazandı | İlk 3 favoriden biri |','|---|---|---:|---:|---:|---:|',
  ...Object.entries(a.segments).filter(([,s])=>s.n>=20).sort((x,y)=>y[1].n-x[1].n).map(([k,s])=>{const [f,su]=k.split('|');return `| ${f} | ${S[su]??su} | ${s.n} | ${(s.field/s.n).toFixed(1)} | ${pct(s.fav1/s.n)} | ${pct(s.fav3/s.n)} |`;}),
  '',`### Start (kulvar) etkisi (${name}), alan büyüklüğüne göre düzeltilmiş`,'','A/E = gerçek birincilik / beklenen birincilik (Σ 1/at sayısı). 1,00 nötr; 1,20 = %20 fazla.','',
  ...Object.entries(a.gates).flatMap(([k,g])=>{const [su,d]=k.split('|');return [`**${S[su]??su} ${d} m** (${g.races} koşu)`,'','| Start | Koşan | Birincilik | A/E |','|---:|---:|---:|---:|',
   ...Object.entries(g.by).filter(([,b])=>b.starts>=15).sort((x,y)=>x[0]-y[0]).map(([s,b])=>`| ${s} | ${b.starts} | ${b.wins} | ${(b.wins/b.expected).toFixed(2)} |`),''];}),
  `### HAN-16 profili (${name})`,'',`${a.han16.races} koşu; katılan atların handikap puanı ${a.han16.handicapRange?.join('–')??'–'} (P10–P90: ${a.han16.handicapP10P90?.join('–')??'–'}); yaş şartları: ${a.han16.ages.join(', ')||'–'}. Resmi katılım şartı metni bu kaynakta yok; bu aralık katılanlardan gözlemdir.`,'',
  '| Tarih | Şehir | Pist | Mesafe | Yaş | Kazanan | Handikap | Kg | Ganyan | At |','|---|---|---|---:|---|---|---:|---:|---:|---:|',
  ...a.han16.winners.map(w=>`| ${w.date} | ${w.city} | ${S[w.surface]??w.surface} | ${w.distance} | ${w.age} | ${w.horse} | ${w.handicap??'–'} | ${w.kg??'–'} | ${w.odds??'–'} | ${w.field} |`),''];
}
const range=db.prepare('SELECT min(date) a,max(date) b FROM races').get(),breeds=Object.fromEntries(Object.keys(BREEDS).map(b=>[b,analyse(b)]));
const report={generatedAt:new Date().toISOString(),scope:{from:range.a,to:range.b},breeds};
await writeFile(path.join(root,'data/horse/rules-backtest.json'),JSON.stringify(report,null,1));
const md=[`# Kural seti backtest'i (İngiliz ve Arap atları)`,'',`Kaynak: liderform.com.tr herkese açık program sayfaları, ${range.a} – ${range.b}; ${breeds.TB.races} İngiliz, ${breeds.AR.races} Arap koşusu. Üretim: ${report.generatedAt}.`,'',
 '## Yorum varsayımları','','- **Favori**: en düşük kapanış TJK ganyanı (yoksa AGF). **Plase**: 2.–3. favori. **İlk N at**: ilk N favori.',
 '- **N. handikap**: koşudaki N. en yüksek handikap puanı. **Puan / TGP / Türkiye puanı**: liderform "puan" alanı (varsayım).',
 '- **N numaralı**: program numarası; **N startlı**: kulvar. **Hafif kg**: koşunun en hafif üçte biri. "Fotomaç / posta puanı" ve "kazanç" verisi yok, o kurallar test edilmedi.',
 '- Çim/kum kuralları kendi pistinde ölçüldü; kum kuralları ayrıca sentetikte (AWT) denendi. İngiliz ve Arap koşuları ayrı ölçülür, hiç karıştırılmaz.','',
 '## Nasıl okunur','','- **İsabet**: kazanan, kuralın seçtiği atlar arasında mı. **Aynı sayıda favori**: kural kaç at seçtiyse o kadar favori seçilseydi isabet. Bir kuralın değeri bu sütunu geçip geçmemesidir.',
 '- **Karar**: %95 Wilson aralığına göre. 30 koşudan azsa karar verilmez.','',
 ...section('TB',breeds.TB),...section('AR',breeds.AR)].join('\n');
await writeFile(path.join(root,'docs/horse-rules-backtest.md'),md);
console.log(JSON.stringify(Object.fromEntries(Object.entries(breeds).map(([b,a])=>[b,{races:a.races,judged:a.results.filter(r=>r.n>=30).length,better:a.results.filter(r=>r.verdict==='favoriden iyi').map(r=>r.id)}]))));
