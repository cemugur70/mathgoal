import {SIMULATION_MARKET_GROUPS} from './simulation-markets.mjs';

export function simulationMarketsHtml(report,{esc,number,teams}={}){
 if(!report)return '';
 const n=report.iterations.toLocaleString('tr-TR'),m=report.means;
 return `<section class="card spaced sim-market-summary" id="sim-market-summary"><div class="card-title"><h2>Simülasyon pazar yüzdeleri</h2><span class="tag">${n} SENARYO · ${report.markets.length} PAZAR</span></div><p class="inline-note">Her yüzde, bu simülasyonda ilgili seçeneğin gerçekleşme sayısının ${n} tekrara bölünmesidir. Bahis oranı veya geçmiş maç yüzdesi değildir. 1 = ev sahibi, X = beraberlik, 2 = deplasman. Birleşik pazarlar aynı senaryolardan birlikte sayılır.</p><div class="table-wrap"><table class="sm-averages"><caption>${teams?.length?esc(teams.map(t=>t.name).join(' – '))+' · ':''}Ortalama gol sayıları</caption><thead><tr><th>DÖNEM</th><th>EV SAHİBİ</th><th>DEPLASMAN</th><th>TOPLAM</th></tr></thead><tbody>${[['Maç',m.home,m.away],['İlk yarı',m.homeHalf,m.awayHalf],['İkinci yarı',m.homeSecond,m.awaySecond]].map(([label,h,a])=>`<tr><th scope="row">${label}</th><td>${number(h,2)}</td><td>${number(a,2)}</td><td>${number(h+a,2)}</td></tr>`).join('')}</tbody></table></div><div class="sm-controls"><label>Pazar grubu<select data-sm-group><option value="featured">Öne çıkanlar</option><option value="all">Tüm hesaplanan pazarlar</option>${Object.entries(SIMULATION_MARKET_GROUPS).map(([id,label])=>`<option value="${id}">${esc(label)}</option>`).join('')}</select></label><label>Pazar veya tercih ara<input data-sm-search class="filter-input" type="search" placeholder="Örn. KG, ilk yarı, handikap"></label><label>Sıralama<select data-sm-sort><option value="market">Pazar sırası</option><option value="probability">Yüzde: yüksekten düşüğe</option></select></label><button class="button ghost" data-sm-export>Tabloyu CSV indir ↓</button></div><p class="inline-note" data-sm-count role="status"></p><div class="table-wrap sm-table"><table><thead><tr><th scope="col">PAZAR</th><th scope="col">TERCİH</th><th scope="col">GERÇEKLEŞME</th><th scope="col">YÜZDE</th></tr></thead><tbody data-sm-body></tbody></table></div><p class="inline-note">Çifte şans seçenekleri birbiriyle örtüştüğü için toplamları %100 olmaz. Handikaplı maç sonucu, yazılan başlangıç skorunun eklenmesiyle hesaplanır; Asya handikapı değildir. İlk/ikinci yarı ve ilk gol yüzdeleri, her oyun safhasında gollerin zamana eşit dağılması varsayımına dayanır; ayrı kalibre edilmemiştir. Normal süre 90 dakika; uzatma ve penaltı atışları kapsam dışıdır.</p><details><summary>Bu simülasyonda hesaplanmayan pazarlar</summary><ul>${report.unsupported.map(r=>`<li><b>${esc(r.label)}:</b> ${esc(r.reason)}</li>`).join('')}</ul><p class="inline-note">Bu pazarlar için %0 gösterilmez. Aşağıdaki istatistik modelleri varsa, bunların değerleri 10.000 maçın frekansı sayılmaz.</p></details></section>`;
}

const normalize=text=>String(text).toLocaleLowerCase('tr-TR');
export function simulationMarketRows(report,{group='featured',search='',sort='market'}={}){
 const query=normalize(search.trim());
 const rows=report.markets.filter(m=>(group==='all'||group==='featured'&&m.featured||m.group===group)).flatMap(m=>m.options.map(o=>({marketId:m.id,market:m.label,choice:o.label,count:o.count,probability:o.probability,partition:m.partition})));
 const filtered=query?rows.filter(r=>normalize(r.market+' '+r.choice).includes(query)):rows;
 if(sort==='probability')filtered.sort((a,b)=>b.probability-a.probability||a.market.localeCompare(b.market,'tr')||a.choice.localeCompare(b.choice,'tr'));
 return filtered;
}

export function simulationMarketsCsv(rows,iterations){
 const quote=value=>{let s=String(value);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\ufeff'+[['Pazar','Tercih','Gerçekleşme','Simülasyon sayısı','Yüzde'],...rows.map(r=>[r.market,r.choice,r.count,iterations,(r.probability*100).toFixed(2).replace('.',',')])].map(row=>row.map(quote).join(';')).join('\r\n');
}

export function bindSimulationMarkets(root,report,{esc,pct,download,matchId,seed}={}){
 const panel=root.querySelector('#sim-market-summary');if(!panel)return;
 const q=s=>panel.querySelector(s);
 const current=()=>simulationMarketRows(report,{group:q('[data-sm-group]').value,search:q('[data-sm-search]').value,sort:q('[data-sm-sort]').value});
 function render(){
  const rows=current();q('[data-sm-count]').textContent=`${rows.length} seçenek gösteriliyor · ${report.iterations.toLocaleString('tr-TR')} simülasyon · Tohum ${seed}`;
  q('[data-sm-body]').innerHTML=rows.length?rows.map(r=>`<tr><th scope="row">${esc(r.market)}</th><td>${esc(r.choice)}</td><td>${r.count.toLocaleString('tr-TR')} / ${report.iterations.toLocaleString('tr-TR')}</td><td><div class="sm-percentage"><b>${pct(r.probability,2)}</b><span aria-hidden="true"><i style="width:${r.probability*100}%"></i></span></div></td></tr>`).join(''):'<tr><td colspan="4">Bu filtreye uyan pazar bulunamadı.</td></tr>';
 }
 for(const key of ['[data-sm-group]','[data-sm-sort]'])q(key).onchange=render;
 q('[data-sm-search]').oninput=render;
 q('[data-sm-export]').onclick=()=>download(`mathgoal-pazarlar-${matchId}-${seed}.csv`,simulationMarketsCsv(current(),report.iterations),'text/csv;charset=utf-8');
 render();
}
