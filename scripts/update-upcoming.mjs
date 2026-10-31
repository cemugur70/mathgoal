import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../dist/app.mjs',import.meta.url);let s=await readFile(file,'utf8');
if(!s.includes("import {parseMatchId}"))s="import {parseMatchId} from './match-input.mjs';\n"+s;
const start=s.indexOf("const input=$('#match-url').value.trim();let id;");
if(start>=0){const end=s.indexOf('if(!id){',start);if(end<start)throw Error('URL parser boundary missing');s=s.slice(0,start)+"const id=parseMatchId($('#match-url').value);"+s.slice(end);}
const cardStart=s.indexOf('<div class="card spaced"><h2>Sonucu sonradan kontrol et');
if(cardStart>=0){const end=s.indexOf("`;$('#run-backtest').onclick=runBacktest;}",cardStart);if(end<cardStart)throw Error('Result card boundary missing');s=s.slice(0,cardStart)+'${resultComparison(p)}'+s.slice(end);}
if(!s.includes('function resultComparison(')){
const helper=`function resultComparison(p){
 if(!bundle.target.finished||!bundle.actual)return '<div class="card spaced"><h2>Maç öncesi tahmin</h2><p class="small-text">Bu maç henüz tamamlanmadı. Gösterilen skorlar modelin tahminidir. İki takımın analiz anına kadar tamamlanmış son 5 resmi maçı ve rakip ağı kullanılır. Maç yaklaştığında güncel verilerle yeniden analiz edebilirsiniz.</p></div>';
 return \`<div class="card spaced"><h2>Sonucu sonradan kontrol et</h2><p class="small-text">Tamamlanmış maç için geçmişe dönük simülasyon. Gerçek sonuç tahmine verilmez.</p><details><summary>Gerçek sonucu aç · Tahmini etkilemez</summary><p>Gerçek skor: <strong>\${esc(bundle.target.home.name)} \${bundle.actual.homeScore} – \${bundle.actual.awayScore} \${esc(bundle.target.away.name)}</strong></p><p class="inline-note">Bu skorun model olasılığı: \${pct(p?.heatmap.find(c=>c.home===bundle.actual.homeScore&&c.away===bundle.actual.awayScore)?.probability)}</p></details></div>\`;
}
`;
s=s.replace('function method(){',helper+'function method(){');}
s=s.replace('bundle=await r.json();selectedTeam=',"bundle=await r.json();$('#match-url').value=bundle.target.url;selectedTeam=");
s=s.replace("t.finished?'GEÇMİŞE DÖNÜK TAHMİN':'MAÇ ÖNCESİ MODEL'","t.finished?'GEÇMİŞE DÖNÜK TAHMİN':t.started?'MAÇ ÖNCESİ MODEL':'HENÜZ OYNANMADI'");
s=s.replace('Veri sınırı: başlama saatinden önce tamamlanan maçlar · Son',"${t.finished?'Veri sınırı: başlama saatinden önce tamamlanan maçlar':'Veri sınırı: analiz anına kadar tamamlanan maçlar'} · Son");
s=s.replace("<a href=\"${esc(t.url)}\" target=\"_blank\" rel=\"noreferrer\">FotMob’da görüntüle ↗</a>","<a href=\"${esc(t.url)}\" target=\"_blank\" rel=\"noreferrer\">FotMob’da görüntüle ↗</a>");
s=s.replace('<div class="tabs"', '<div class="tabs"');
s=s.replace("history(bundle.matches,id,bundle.target.date,5,bundle.target.id)","history(bundle.matches,id,bundle.analysisAt??bundle.target.date,5,bundle.target.id)");
s=s.replace('Canlı akış değildir; yeniden toplama düğmesiyle güncellenir.','Canlı akış değildir; Maçı analiz et düğmesiyle güncellenir.');
s=s.replace('<dt>Başlama</dt>', '<dt>Veri zamanı</dt><dd>${esc(new Date(bundle.analysisAt??bundle.collectedAt).toLocaleString(\'tr-TR\',{timeZone:\'Europe/Istanbul\'}))} İstanbul</dd><dt>Başlama</dt>');
await writeFile(file,s);
const html=new URL('../dist/index.html',import.meta.url);let h=await readFile(html,'utf8');h=h.replace('https://www.fotmob.com/tr/matches/afc-bournemouth-vs-manchester-united/2yrx85#5795493:tab=stats','https://www.fotmob.com/tr/matches/galatasaray-vs-fenerbahce/2hfnrt#5904782');h=h.replace('id="match-url" type="text"','id="match-url" type="text" aria-label="FotMob maç bağlantısı veya maç kimliği" placeholder="FotMob maç bağlantısı veya maç kimliği"');await writeFile(html,h);
console.log('Oynanmamış maç arayüzü güncellendi.');
