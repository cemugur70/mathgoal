// Horse-racing page: race cards ranked by the Obsidian probability, the head-to-head network, model validation and the rule backtest.
// Data comes from dist/data/horse, written by scripts/publish-horse-ui.mjs.
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const pct=(v,d=1)=>v==null?'–':(100*v).toFixed(d).replace('.',',')+'%';
const signed=(v,d=2)=>v==null?'–':(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(d).replace('.',',');
const pts=v=>v==null?'–':(v>0?'+':v<0?'−':'')+Math.abs(100*v).toFixed(1).replace('.',',');
const CITY={istanbul:'İstanbul',ankara:'Ankara',izmir:'İzmir',bursa:'Bursa',adana:'Adana'},BREED={TB:'İngiliz',AR:'Arap'},BUCKET={kisa:'kısa',mil:'mil',orta:'orta',uzun:'uzun'};
const AGE={'2O':'2 yaşlı','3O':'3 yaşlı','3U':'3 ve yukarı','4U':'4 ve yukarı'};
const MODEL_NAMES={uniform:'Tekdüze (rastgele at)',handikap:'Yalnız handikap',ag:'Rakip ağı rating\'i',agTercih:'Ağ + pist/mesafe tercihi + kilo',piyasasiz:'Obsidian, piyasasız (AGF hariç)',agf:'Yalnız AGF',obsidianKuralsiz:'Obsidian, kuralsız',obsidian:'Obsidian + kurallar',closingOdds:'Kapanış ganyanı (yarış öncesi bilinmez)'};
const TITLES={program:'Yarış programı',model:'Model doğrulama',rules:'Kural backtest\'i'};
const longDate=d=>new Date(d+'T12:00:00Z').toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric',weekday:'long'});
// liderform race times are GMT without a zone suffix.
const raceClock=t=>new Date(/Z|[+-]\d\d:?\d\d$/.test(t)?t:t+'Z').toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'});
const istanbulToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'});
const shortDate=d=>new Date(d+'T12:00:00Z').toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
const state={summary:null,day:null,city:'all',cache:new Map()};
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const json=async url=>{const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error(`${url}: ${r.status}`);return r.json();};

function show(view){
 for(const b of document.querySelectorAll('.nav[data-view]'))b.classList.toggle('active',b.dataset.view===view);
 for(const v of ['program','model','rules'])$('#view-'+v).classList.toggle('hidden',v!==view);
 $('#view-title').textContent=TITLES[view];
}

// ---------- Program ----------
const placeBadge=p=>p==null?'<span class="hz-place none">–</span>':`<span class="hz-place p${Math.min(p,4)}">${p}</span>`;
const lastRuns=list=>list?.length?list.map(p=>`<span class="hz-run p${p==null?0:Math.min(p,4)}">${p??'?'}</span>`).join(''):'<span class="hz-muted">ilk koşu</span>';
const pref=x=>x.n?`<span class="${x.v>.02?'hz-up':x.v<-.02?'hz-down':''}">${signed(x.v)}</span> <small>(${x.n})</small>`:'<span class="hz-muted">–</span>';

function verdict(race){
 if(!race.winners)return `<span class="tag hz-tag-wait">SONUÇ BEKLENİYOR</span>`;
 const rank=race.runners.findIndex(r=>race.winners.includes(r.number));
 const w=race.runners[rank],cls=rank===0?'hit':rank<3?'near':'miss';
 return `<span class="tag hz-tag-${cls}">${rank===0?'✓ 1. TAHMİN KAZANDI':`KAZANAN #${esc(w?.number??race.winners[0])} · TAHMİN SIRASI ${rank+1}`}</span>`;
}

function networkHtml(race){
 if(!race.network.length)return '<p class="inline-note">Bu koşudaki atlar daha önce birbirleriyle ya da ortak rakiplerle karşılaşmamış.</p>';
 return `<div class="table-wrap"><table class="hz-net"><thead><tr><th>Eşleşme</th><th>Doğrudan</th><th>Son karşılaşmalar</th><th>Ortak rakip</th><th>Dolaylı</th></tr></thead><tbody>${race.network.map(p=>`<tr>
  <td><b>${esc(p.a)}</b> ${esc(p.aName)} <span class="hz-muted">–</span> <b>${esc(p.b)}</b> ${esc(p.bName)}</td>
  <td class="${p.aheadA>p.aheadB?'hz-up':p.aheadA<p.aheadB?'hz-down':''}">${p.aheadA}–${p.aheadB}</td>
  <td class="hz-meet">${p.last.map(m=>`${esc(shortDate(m.date))} ${esc(CITY[m.city]??m.city)} ${esc(m.surface)} ${esc(m.distance)}m: <b>${esc(m.placeA??'?')}.</b>–<b>${esc(m.placeB??'?')}.</b>`).join('<br>')||'–'}</td>
  <td>${p.common}</td><td class="${p.indirect>0?'hz-up':p.indirect<0?'hz-down':''}">${p.indirect>0?'+':''}${p.indirect}</td></tr>`).join('')}</tbody></table></div>
  <p class="inline-note">Doğrudan: iki atın birlikte koştuğu ve sırası bilinen koşularda soldaki – sağdaki kaç kez önde bitti. Dolaylı: ortak rakiplere karşı karşılaştırma; artı soldaki at lehine.</p>`;
}

function raceCard(race,settled){
 const max=Math.max(...race.runners.map(r=>r.prob));
 const meta=[race.label,`${race.surface} ${race.distance} m (${BUCKET[race.bucket]??''})`,BREED[race.breed]??race.breed,AGE[race.age]??race.age].filter(Boolean).map(esc).join(' · ');
 const rows=race.runners.map((r,i)=>{const won=race.winners?.includes(r.number);
  const rules=r.rules.length?`<div class="hz-rules">${r.rules.map(x=>`<span class="hz-rule ${x.applied?'applied':''}" title="${esc(x.text)}">${x.applied?'Kural':'İzlemede'} ${pts(x.weight)}</span>`).join('')}</div>`:'';
  return `<tr class="${won?'hz-winner':''}"><td class="hz-rank">${i+1}</td><td class="hz-no">${esc(r.number)}</td>
   <td class="hz-name"><b>${esc(r.name)}</b>${r.jockey?`<small>${esc(r.jockey)}</small>`:''}${rules}</td>
   <td class="hz-prob"><div class="hz-bar"><span style="width:${(100*r.prob/max).toFixed(1)}%"></span></div><b>${pct(r.prob)}</b></td>
   <td>${signed(r.rating.base)} <small class="hz-muted">/ ${signed(r.rating.surface)} / ${signed(r.rating.distance)}</small><small class="hz-sub">${r.rating.starts} ağ koşusu</small></td>
   <td>${pref(r.pref.surface)}</td><td>${pref(r.pref.distance)}</td><td class="hz-runs">${lastRuns(r.last)}</td>
   <td>${r.kg??'–'}</td><td>${r.handicap??'–'}</td><td>${r.agf==null?'–':String(r.agf).replace('.',',')}</td><td>${r.odds==null?'–':String(r.odds).replace('.',',')}</td>
   ${settled?`<td>${placeBadge(won?1:r.place)}</td>`:''}</tr>`;}).join('');
 return `<section class="card spaced hz-race" id="race-${esc(race.id)}"><div class="hz-race-head"><div><h2>${esc(CITY[race.city]??race.city)} · ${esc(race.number)}. koşu${race.time?` <span class="hz-time">${esc(raceClock(race.time))}</span>`:''}</h2><p>${meta}</p></div>
  <div class="hz-race-tags"><span class="tag">${race.model==='obsidian'?'OBSIDIAN':'OBSIDIAN · AGF YOK'}</span>${verdict(race)}</div></div>
  <div class="table-wrap"><table class="hz-table"><thead><tr><th>Sıra</th><th>#</th><th>At</th><th>Kazanma olasılığı</th><th>Ağ rating'i <small>genel / pist / mesafe</small></th><th>Pist tercihi</th><th>Mesafe tercihi</th><th>Son dereceler</th><th>Kg</th><th>Hnd</th><th>AGF %</th><th>Ganyan</th>${settled?'<th>Derece</th>':''}</tr></thead><tbody>${rows}</tbody></table></div>
  <details class="hz-details"><summary>Kim kimi geçti · rakip ağı</summary>${networkHtml(race)}</details></section>`;
}

async function renderProgram(){
 const s=state.summary,meta=s.days.find(d=>d.date===state.day);
 const data=state.cache.get(state.day)??await json(`/data/horse/day-${state.day}.json`);state.cache.set(state.day,data);
 const cities=[...new Set(data.races.map(r=>r.city))];if(state.city!=='all'&&!cities.includes(state.city))state.city='all';
 const races=data.races.filter(r=>state.city==='all'||r.city===state.city),settled=races.filter(r=>r.winners);
 const top1=settled.filter(r=>r.winners.includes(r.runners[0].number)).length,top3=settled.filter(r=>r.runners.slice(0,3).some(x=>r.winners.includes(x.number))).length;
 const options=s.days.map(d=>`<option value="${d.date}" ${d.date===state.day?'selected':''}>${esc(shortDate(d.date))} · ${d.kind==='live'?(d.date>istanbulToday()?'yarının programı':'bugünün programı'):`${d.top1}/${d.races} isabet`}</option>`).join('');
 const summary=settled.length?`<div class="hz-kpis"><div><span>1. tahmin kazandı</span><b>${top1}/${settled.length}</b><small>${pct(top1/settled.length,0)}</small></div><div><span>Kazanan ilk 3 tahminde</span><b>${top3}/${settled.length}</b><small>${pct(top3/settled.length,0)}</small></div><div><span>Koşu</span><b>${races.length}</b><small>${races.length-settled.length?`${races.length-settled.length} sonuç bekliyor`:'hepsi sonuçlandı'}</small></div></div>`:'';
 const note=data.kind==='live'
  ?`<p class="inline-note">Güncel program: rating'ler ${esc(s.range.to)} dahil tüm sonuçlanmış koşulardan, ağırlıklar tüm dönemden öğrenildi. Kurallardan yalnızca iki backtest döneminde de doğrulananlar olasılığı etkiler. AGF ve ganyan yayın anındaki değerlerdir.</p>`
  :`<p class="inline-note">Geriye dönük tahmin: her koşu yalnızca o günden önceki koşularla ve ${esc(s.split)} öncesinde öğrenilmiş ağırlıklarla tahmin edildi; model bu sonuçları görmedi. Ganyan kapanış değeridir ve modele girmez.</p>`;
 $('#view-program').innerHTML=`<div class="hz-toolbar card"><label>Gün<select id="hz-day">${options}</select></label>
  <div class="pill-row hz-cities" role="group" aria-label="Hipodrom">${['all',...cities].map(c=>`<button class="hz-chip ${c===state.city?'active':''}" data-city="${c}">${c==='all'?'Tümü':esc(CITY[c]??c)}</button>`).join('')}</div></div>
  <div class="hz-day-head"><h2>${esc(longDate(state.day))}</h2>${meta?.kind==='live'?`<span class="tag">${state.day>istanbulToday()?'YARIN':'GÜNCEL'}</span>`:'<span class="tag">GERİYE DÖNÜK</span>'}</div>${note}${summary}
  ${races.length?races.map(r=>raceCard(r,!!data.races.some(x=>x.winners))).join(''):'<p class="inline-note">Bu gün için koşu yok.</p>'}`;
 $('#hz-day').onchange=e=>{state.day=e.target.value;renderProgram();};
 for(const b of document.querySelectorAll('.hz-chip'))b.onclick=()=>{state.city=b.dataset.city;store.set('hz-city',state.city);renderProgram();};
}

// ---------- Model ----------
function renderModel(){
 const s=state.summary,order=['uniform','handikap','ag','agTercih','piyasasiz','agf','obsidianKuralsiz','obsidian','closingOdds'];
 const best=s.confirmation.obsidian,mkt=s.confirmation.closingOdds,net=s.confirmation.ag;
 const row=k=>{const m=s.confirmation[k];if(!m)return '';return `<tr class="${k==='obsidian'?'hz-best':k==='closingOdds'?'hz-ref':''}"><td>${esc(MODEL_NAMES[k])}</td><td>${m.races}</td>
  <td class="hz-prob"><div class="hz-bar"><span style="width:${(100*m.top1/0.45).toFixed(1)}%"></span></div><b>${pct(m.top1)}</b></td><td>${pct(m.top3)}</td><td>${m.logLoss.toFixed(3).replace('.',',')}</td><td class="hz-down">${pct(m.topRoi)}</td></tr>`;};
 const breed=k=>{const b=s.byBreed[k];if(!b)return '';return `<tr><td>${esc(MODEL_NAMES[k])}</td><td>${pct(b.TB?.top1)}</td><td>${pct(b.AR?.top1)}</td></tr>`;};
 $('#view-model').innerHTML=`<div class="hz-kpis big"><div><span>Obsidian 1. tahmin</span><b>${pct(best.top1)}</b><small>${best.races} doğrulama koşusu</small></div><div><span>Kazanan ilk 3 tahminde</span><b>${pct(best.top3)}</b><small>Obsidian</small></div><div><span>Yalnız rakip ağı</span><b>${pct(net.top1)}</b><small>piyasa bilgisi olmadan</small></div><div><span>Kapanış favorisi</span><b>${pct(mkt.top1)}</b><small>yarış öncesi bilinmez</small></div></div>
 <section class="card spaced"><div class="card-title"><h2>Doğrulama dönemi · modelin hiç görmediği koşular</h2><span class="tag">${esc(s.split)} VE SONRASI</span></div>
  <div class="table-wrap"><table><thead><tr><th>Model</th><th>Koşu</th><th>1. tahmin kazandı</th><th>İlk 3'te</th><th>Log-kayıp</th><th>ROI · 1. tahmine 1 TL</th></tr></thead><tbody>${order.map(row).join('')}</tbody></table></div>
  <p class="inline-note">Ağırlıklar ${esc(s.range.from)} – ${esc(s.split)} arasında öğrenildi, ${esc(s.split)} sonrasında sınandı. Log-kayıp düşük olan daha iyi olasılık verir. Hipodrom kesintisi yüzünden hiçbir yöntemin ROI'si artı değil: model kazananı sık bilir ama bunu piyasa da bilir.</p></section>
 <div class="grid hz-two spaced"><section class="card"><div class="card-title"><h2>Irka göre · 1. tahmin</h2></div><div class="table-wrap"><table><thead><tr><th>Model</th><th>İngiliz</th><th>Arap</th></tr></thead><tbody>${['ag','piyasasiz','obsidian','closingOdds'].map(breed).join('')}</tbody></table></div></section>
 <section class="card"><div class="card-title"><h2>Yöntem</h2></div><ol class="hz-method">
  <li><b>Kim kimi geçti:</b> her geçmiş koşuda bilinen dereceler; aynı koşudaki her at çifti bir karşılaşmadır.</li>
  <li><b>Rakip ağı rating'i:</b> Plackett–Luce. Güçlü atı geçen çok, zayıfı geçen az puan kazanır; güç ortak rakipler üzerinden yayılır. Tüm yurt içi hipodromlardan öğrenilir.</li>
  <li><b>Pist ve mesafe tercihi:</b> rakip gücüne göre düzeltilmiş çim / kum / sentetik ve kısa / mil / orta / uzun sapmaları, artı kariyer kaydı.</li>
  <li><b>Obsidian:</b> ağ rating'i, tercihler, kilo, handikap, puan, form, dinlenme, apranti ve yarış öncesi AGF'yi koşu içi softmax ile birleştirir.</li>
  <li><b>Kurallar:</b> yalnızca backtest'in iki döneminde de tutarlı çıkanlar modele girer.</li></ol></section></div>`;
}

// ---------- Rules ----------
function renderRules(){
 const s=state.summary,confirmed=s.rules.filter(r=>r.confirmed);
 $('#view-rules').innerHTML=`<section class="card"><div class="card-title"><h2>Kurallar favoriyi geçiyor mu?</h2><span class="tag">${confirmed.length} KURAL CANLIDA</span></div>
  <p class="inline-note">Her kural, aynı sayıda yarış öncesi AGF favorisiyle karşılaştırıldı. Fark, kuralın seçtiği atların kazanma oranı eksi favorilerinki (yüzde puan). Keşif döneminde (${esc(s.split)} öncesi) anlamlı çıkan kurallar burada; doğrulama döneminde aynı yönde tekrar edenler canlı tahmine girer. Negatif fark: kuralın seçtiği at piyasanın sandığından zayıf — model bunu "fazla güvenme" sinyali olarak kullanır.</p>
  <div class="table-wrap"><table><thead><tr><th>Irk</th><th>Kural</th><th>Keşif farkı</th><th>Doğrulama farkı</th><th>p</th><th>Koşu</th><th>Durum</th></tr></thead><tbody>${s.rules.map(r=>`<tr>
   <td>${esc(BREED[r.breed])}</td><td class="hz-wrap">${esc(r.text)}</td><td class="${r.discovery.diff<0?'hz-down':'hz-up'}">${pts(r.discovery.diff)}</td><td class="${r.confirmation.diff<0?'hz-down':'hz-up'}">${pts(r.confirmation.diff)}</td>
   <td>${r.confirmation.p==null?'–':r.confirmation.p<.001?'<0,001':String(r.confirmation.p).replace('.',',')}</td><td>${r.n}</td>
   <td>${r.confirmed?`<span class="tag ${r.confirmation.diff<0?'hz-tag-miss':'hz-tag-hit'}">${r.confirmation.diff<0?'TERSİ DOĞRULANDI':'DOĞRULANDI'}</span>`:'<span class="tag hz-tag-wait">TEKRAR ETMEDİ</span>'}</td></tr>`).join('')}</tbody></table></div>
  <p class="inline-note">Ayrıntılı rapor (tüm kurallar, favori segmentleri, ROI): docs/horse-rules-backtest.md.</p></section>`;
}

async function start(){
 try{
  state.summary=await json('/data/horse/summary.json');const days=state.summary.days;if(!days.length)throw Error('Yayınlanmış gün yok.');
  // Opens on today's programme (the newest published day otherwise); only the hippodrome filter is remembered.
  state.day=(days.find(d=>d.date===istanbulToday())??days[0]).date;state.city=store.get('hz-city')||'all';
  $('#archive-tag').innerHTML=`<span class="live-dot"></span> ${esc(state.summary.range.from)} – ${esc(state.summary.range.to)}`;
  await renderProgram();renderModel();renderRules();
  for(const b of document.querySelectorAll('.nav[data-view]'))b.onclick=()=>show(b.dataset.view);
  $('#loading').classList.add('hidden');$('#app').classList.remove('hidden');
 }catch(error){$('#loading').classList.add('hidden');const e=$('#error');e.textContent=`At yarışı verisi yüklenemedi: ${error.message}. Önce "npm run horse:publish" çalıştırın.`;e.classList.remove('hidden');}
}
start();
