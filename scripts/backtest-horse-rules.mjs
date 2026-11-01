// Evaluates the encoded handicapping rules against data/horse/horses.db, separately for English (TB) and Arabian (AR) horses,
// and writes docs/horse-rules-backtest.md + data/horse/rules-backtest.json.
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {RULES,evaluateRule,raceContext,benjaminiHochberg,confirmationVerdict} from '../dist/horse-rules.mjs';
import {CITIES} from './liderform-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(root,'data/horse/horses.db'),{readOnly:true});
const BREEDS={TB:'İngiliz',AR:'Arap'},S={TURF:'Çim',DIRT:'Kum',AWT:'Sentetik'};
// Rules are judged on races before SPLIT (discovery) and must repeat on races from SPLIT on (confirmation), which they never saw.
// While the archive is still short of pre-2026 races, the split moves to 60% of the predicted cities' finished races (an interim split, stated in the report).
let SPLIT=process.env.HORSE_SPLIT||'2026-01-01',INTERIM=false;
{const dates=db.prepare(`SELECT date FROM races WHERE status='RESULT' AND winners IS NOT NULL AND city IN (${Object.keys(CITIES).map(c=>`'${c}'`).join(',')}) ORDER BY date`).all().map(r=>r.date);
 if(!process.env.HORSE_SPLIT&&dates.filter(d=>d<SPLIT).length<1000&&dates.length){SPLIT=dates[Math.floor(dates.length*.6)];INTERIM=true;}}
const pct=v=>v===null||v===undefined?'–':(100*v).toFixed(1)+'%',signed=v=>v===null||v===undefined?'–':(v>0?'+':'')+(100*v).toFixed(1),roi=v=>v===null||v===undefined?'–':signed(v)+'%',pv=v=>v===null||v===undefined?'–':v<.001?'<0.001':v.toFixed(3);
function analyse(breed){
 // The rules were written for the five predicted cities; network-only tracks are not judged.
 const raceRows=db.prepare(`SELECT * FROM races WHERE status='RESULT' AND winners IS NOT NULL AND breed=? AND city IN (${Object.keys(CITIES).map(c=>`'${c}'`).join(',')}) ORDER BY date`).all(breed);
 const byRace=new Map();for(const e of db.prepare('SELECT e.* FROM entries e JOIN races r ON r.id=e.race_id WHERE r.breed=?').all(breed))(byRace.get(e.race_id)??byRace.set(e.race_id,[]).get(e.race_id)).push(e);
 const races=raceRows.map(r=>({race:{...r,classNumber:r.class_number,winners:r.winners.split(',')},entries:(byRace.get(r.id)||[]).map(e=>({...e}))}));
 const three=races.filter(x=>x.race.age==='3O'),discovery=races.filter(x=>x.race.date<SPLIT),confirmation=races.filter(x=>x.race.date>=SPLIT);
 const results=RULES.map(rule=>{
  const all=evaluateRule(rule,races),age3=evaluateRule(rule,three);
  const awt=rule.surface==='DIRT'?evaluateRule(rule,races.filter(x=>x.race.surface==='AWT'),{surfaceAs:{from:'AWT',to:'DIRT'}}):null;
  return {...all,age3:{n:age3.n,rate:age3.rate,favoriteSameSize:age3.favoriteSameSize,verdict:age3.verdict},synthetic:awt&&{n:awt.n,rate:awt.rate,favoriteSameSize:awt.favoriteSameSize,verdict:awt.verdict},
   discovery:evaluateRule(rule,discovery),confirmation:evaluateRule(rule,confirmation)};
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
 return {races:races.length,discoveryRaces:discovery.length,confirmationRaces:confirmation.length,results,segments:Object.fromEntries(seg),gates:Object.fromEntries(gateTables),
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
// One multiple-testing family: every testable discovery comparison across both breeds.
const tested=Object.values(breeds).flatMap(a=>a.results),qs=benjaminiHochberg(tested.map(r=>r.discovery.paired.testable?r.discovery.paired.p:null));
tested.forEach((r,i)=>{r.discovery.q=qs[i];r.confirmationVerdict=confirmationVerdict(r.discovery,r.confirmation,qs[i]);});
const STATUS_ORDER=['doğrulandı','iddia doğrulandı','tersi doğrulandı','iddia çürütüldü','tekrar etmedi','kanıt yok','belirsiz','favori seçimi','yetersiz örnek'];
function summary(breed,a){
 const name=BREEDS[breed],rows=[...a.results].sort((x,y)=>STATUS_ORDER.indexOf(x.confirmationVerdict.status)-STATUS_ORDER.indexOf(y.confirmationVerdict.status)||(x.discovery.q??1)-(y.discovery.q??1));
 const counts=STATUS_ORDER.map(s=>[s,a.results.filter(r=>r.confirmationVerdict.status===s).length]).filter(([,n])=>n);
 return [`### ${name}: doğrulama özeti`,'',`Keşif < ${SPLIT}: ${a.discoveryRaces} koşu · doğrulama ≥ ${SPLIT}: ${a.confirmationRaces} koşu. ${counts.map(([s,n])=>`${s}: ${n}`).join(' · ')}.`,'',
  '| Kural | Karar | Keşif n | Keşif isabet / favori | Fark (puan) | p | q (BH) | Doğrulama n | Doğrulama isabet / favori | Fark (puan) | p | ROI kural / aynı sayıda favori (tüm dönem) |',
  '|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|',
  ...rows.map(r=>{const d=r.discovery,c=r.confirmation,ref=x=>x.paired.direction<0?pct(x.random):r.id==='srt3-cim-plase'?pct(x.favoriteWin):pct(x.favoriteSameSize);
   return `| ${r.text} | **${r.confirmationVerdict.status}** | ${d.n} | ${pct(d.rate)} / ${ref(d)} | ${signed(d.paired.diff)} | ${pv(d.paired.p)} | ${pv(d.q)} | ${c.n} | ${pct(c.rate)} / ${ref(c)} | ${signed(c.paired.diff)} | ${pv(c.paired.p)} | ${roi(r.roi)} / ${roi(r.favoriteRoi)} |`;}),''];
}
// ROI relies on the final ganyan equalling the paid win dividend; re-measured on every run.
const oddsCheck=db.prepare("SELECT r.bets_result b,e.odds o FROM races r JOIN entries e ON e.race_id=r.id AND e.place=1 AND e.place_source='dividends' WHERE r.dead_heat=0").all()
 .map(x=>{const m=x.b.match(/(?:^|\s)GANYAN\([^)]*\):\s*([\d.,]+)TL/);return m&&x.o!=null?Math.abs(Number(m[1].replace(/\./g,'').replace(',','.'))-x.o)<.011:null;}).filter(v=>v!==null);
const oddsMatch=`${oddsCheck.filter(Boolean).length}/${oddsCheck.length}`;
const report={generatedAt:new Date().toISOString(),scope:{from:range.a,to:range.b,split:SPLIT,oddsMatch},breeds};
await writeFile(path.join(root,'data/horse/rules-backtest.json'),JSON.stringify(report,null,1));
const md=[`# Kural seti backtest'i (İngiliz ve Arap atları)`,'',`Kaynak: liderform.com.tr herkese açık program sayfaları, ${range.a} – ${range.b}; İstanbul, Ankara, İzmir, Bursa ve Adana'da ${breeds.TB.races} İngiliz, ${breeds.AR.races} Arap koşusu. Üretim: ${report.generatedAt}.`,'',
 '## Yorum varsayımları','','- **Favori**: en düşük kapanış TJK ganyanı (yoksa AGF). **Plase**: 2.–3. favori. **İlk N at**: ilk N favori.',
 '- **N. handikap**: koşudaki N. en yüksek handikap puanı. **Puan / TGP / Türkiye puanı**: liderform "puan" alanı (varsayım).',
 '- **N numaralı**: program numarası; **N startlı**: kulvar. **Hafif kg**: koşunun en hafif üçte biri. "Fotomaç / posta puanı" ve "kazanç" verisi yok, o kurallar test edilmedi.',
 '- Çim/kum kuralları kendi pistinde ölçüldü; kum kuralları ayrıca sentetikte (AWT) denendi. İngiliz ve Arap koşuları ayrı ölçülür, hiç karıştırılmaz.','',
 '## Nasıl okunur','','- **İsabet**: kazanan, kuralın seçtiği atlar arasında mı. **Aynı sayıda favori**: kural kaç at seçtiyse o kadar favori seçilseydi isabet. Bir kuralın değeri bu sütunu geçip geçmemesidir.',
 '- **Karar** (ayrıntı tablolarında, tüm dönem): %95 Wilson aralığına göre. 30 koşudan azsa karar verilmez.','',
 '## Geriye dönük doğrulama','',
 `Kurallar önce **keşif** döneminde (${SPLIT} öncesi) test edilir, sonra hiç görmedikleri **doğrulama** döneminde (${SPLIT} ve sonrası) tekrar etmeleri beklenir.${INTERIM?' **Ara bölme**: 2026 öncesi veri henüz yetersiz; bölme noktası koşuların %60\'ına kondu. Tam veriyle 2026-01-01 kullanılacak.':''}`,
 '- **Fark**: her koşuda kural isabeti (1/0) eksi karşılaştırma ölçütü, ortalaması yüzde puan olarak. Ölçüt: aynı sayıda favori; "plase favoriden şanslı" iddiası için favorinin kazanması; "favori gelmez" iddiaları için rastgele pay (beklenen yön negatif). p eşleştirilmiş z testinden.',
 '- **q (BH)**: iki ırktaki tüm keşif testleri tek aile sayılarak Benjamini–Hochberg düzeltmesi. 140 testte birkaçının şansla anlamlı çıkması beklenir; q bunu düzeltir.',
 '- **doğrulandı**: keşifte q < 0,10 ve doğrulamada aynı yönde p < 0,05. **tersi doğrulandı**: iki dönemde de kuralın aleyhine anlamlı. **tekrar etmedi**: keşifte anlamlı ama doğrulamada değil. **kanıt yok**: ölçütten farkı anlamlı değil.',
 '- **favori seçimi**: kural tam olarak aynı sayıda favoriyi seçiyor, test edilecek ayrı üstünlük yok. Oran iddiası varsa (ör. "%70 favori") iki dönemin %95 aralığıyla karşılaştırılır: **iddia doğrulandı / çürütüldü**.',
 `- **ROI**: seçilen her ata 1 TL ganyan; resmi kapanış ganyanı ile (ödenen ganyan ikramiyesiyle ${oddsMatch} koşuda birebir aynı). Hipodrom kesintisi yüzünden rastgele oynamanın beklenen ROI'si negatiftir.`,'',
 ...summary('TB',breeds.TB),...summary('AR',breeds.AR),
 ...section('TB',breeds.TB),...section('AR',breeds.AR)].join('\n');
await writeFile(path.join(root,'docs/horse-rules-backtest.md'),md);
console.log(JSON.stringify(Object.fromEntries(Object.entries(breeds).map(([b,a])=>[b,{races:a.races,discovery:a.discoveryRaces,confirmation:a.confirmationRaces,
 status:Object.fromEntries(STATUS_ORDER.map(s=>[s,a.results.filter(r=>r.confirmationVerdict.status===s).map(r=>r.id)]).filter(([,v])=>v.length))}]))));
