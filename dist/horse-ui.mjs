// Horse-racing page: race cards ranked by the Obsidian probability, the head-to-head network, model validation and the rule backtest.
// Data comes from dist/data/horse, written by scripts/publish-horse-ui.mjs.
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const pct=(v,d=1)=>v==null?'–':(100*v).toFixed(d).replace('.',',')+'%';
const signed=(v,d=2)=>v==null?'–':(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(d).replace('.',',');
const num=(v,d)=>v==null?'–':(d==null?String(v):v.toFixed(d)).replace('.',',');
const pts=v=>v==null?'–':(v>0?'+':v<0?'−':'')+Math.abs(100*v).toFixed(1).replace('.',',');
const CITY={istanbul:'İstanbul',ankara:'Ankara',izmir:'İzmir',bursa:'Bursa',adana:'Adana'},BREED={TB:'İngiliz',AR:'Arap'},BUCKET={kisa:'kısa',mil:'mil',orta:'orta',uzun:'uzun'};
const AGE={'2O':'2 yaşlı','3O':'3 yaşlı','3U':'3 ve yukarı','4U':'4 ve yukarı'};
const MODEL_NAMES={uniform:'Tekdüze (rastgele at)',handikap:'Yalnız handikap',ag:'Rakip ağı rating\'i',agTercih:'Ağ + pist/mesafe tercihi + kilo',hiz:'Yalnız hız puanı',obsidianHizsiz:'Obsidian, hız puanı olmadan',piyasasiz:'Obsidian, piyasasız (AGF hariç)',agf:'Yalnız AGF',obsidianKuralsiz:'Obsidian, kuralsız',obsidianEski:'Obsidian, ilk özellik seti (jokey/antrenör, galop ve pist kaydı olmadan)',obsidianPistsiz:'Obsidian, ayrıntılı pist kaydı olmadan',obsidianJokeysiz:'Obsidian, jokey AGF üstü başarısı olmadan',obsidianGalopsuz:'Obsidian + kurallar, galop olmadan',obsidian:'Obsidian + kurallar',obsidianSentez:'Obsidian + AGF sentezi; AGF yoksa piyasasız',obsidianAgac:'Obsidian + ağaç katmanı + AGF',obsidianOran:'Obsidian + ağaç + AGF; AGF yoksa canlı ganyan (sitede kullanılan)',closingOdds:'Kapanış ganyanı (yarış öncesi bilinmez)'};
const TITLES={program:'Yarış programı',odds:'Ganyan analizi',surprise:'Sürpriz analizi',model:'Model doğrulama',rules:'Kural backtest\'i'};
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
 for(const v of ['program','odds','surprise','model','rules'])$('#view-'+v).classList.toggle('hidden',v!==view);
 $('#view-title').textContent=TITLES[view];
}

// ---------- Program ----------
const placeBadge=p=>p==null?'<span class="hz-place none">–</span>':`<span class="hz-place p${Math.min(p,4)}">${p}</span>`;
const lastRuns=list=>list?.length?list.map(p=>`<span class="hz-run p${p==null?0:Math.min(p,4)}">${p??'?'}</span>`).join(''):'<span class="hz-muted">ilk koşu</span>';
// Career record per surface (all past starts): starts · win % / top-3 %; the race's own surface in bold.
const SURF={DIRT:'Kum',TURF:'Çim',AWT:'Sentetik'},rate=(k,n)=>Math.round(100*k/n);
const surfaceRecord=(rec,current)=>{const list=Object.entries(SURF).filter(([k])=>rec?.[k]?.starts);if(!list.length)return '';
 return `<small class="hz-surf">${list.map(([k,l])=>{const o=rec[k],t=`${l} ${o.starts} · %${rate(o.wins,o.starts)} / %${rate(o.top3,o.starts)}`;return l===current?`<b>${t}</b>`:t;}).join('<br>')}</small>`;};
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

const riskTag=race=>race.surprise?`<span class="tag hz-risk ${race.surprise.level==='yüksek'?'high':race.surprise.level==='orta'?'mid':''}" title="Kazananın ganyanının 10 TL ve üstü olma olasılığı">SÜRPRİZ RİSKİ ${esc(race.surprise.level.toLocaleUpperCase('tr-TR'))} · ${pct(race.surprise.risk,0)}</span>`:'';

// How the model reads the ganyan favourite, with what that group did in the validation period.
const FAV_CLASS={'güçlü':'strong','zayıf':'weak'},favHistory=level=>state.summary.odds?.favourite.levels.find(l=>l.key===level);
const oddsTag=race=>race.oddsLayer?`<span class="tag" title="Bu koşuda AGF olmadığı için olasılıklara son yenilemedeki ganyan oranı katıldı${race.oddsLayer.minutes>0?` (yarıştan ${race.oddsLayer.minutes} dk önce)`:''}. Oran yarışa kadar değişebilir.">CANLI GANYAN</span>`:'';
const favTag=race=>{const f=race.favourite;if(!f)return '';const h=favHistory(f.level);
 return `<span class="tag hz-fav ${FAV_CLASS[f.level]??''}" title="Ganyan favorisi #${esc(f.number)} ${esc(f.name)}: oran ${num(f.odds)}, piyasa payı ${pct(f.share)}, ${race.oddsLayer?'oran katılmadan model':'model'} ${pct(f.prob)}.${h?` Geçmişte bu gruptaki favoriler %${(100*h.winRate).toFixed(1).replace('.',',')} kazandı.`:''}">FAVORİ #${esc(f.number)} ${esc(f.level.toLocaleUpperCase('tr-TR'))}</span>`;};

function raceCard(race,settled){
 const max=Math.max(...race.runners.map(r=>r.prob));
 const meta=[race.label,`${race.surface} ${race.distance} m (${BUCKET[race.bucket]??''})`,BREED[race.breed]??race.breed,AGE[race.age]??race.age].filter(Boolean).map(esc).join(' · ');
 const rows=race.runners.map((r,i)=>{const won=race.winners?.includes(r.number);
  const rules=r.rules.length?`<div class="hz-rules">${r.rules.map(x=>`<span class="hz-rule ${x.applied?'applied':''}" title="${esc(x.text)}">${x.applied?'Kural':'İzlemede'} ${pts(x.weight)}</span>`).join('')}</div>`:'';
  const cand=r.candidate?`<span class="hz-cand" title="AGF'de ilk 3 dışında; model AGF payının çok üstünde görüyor">Sürpriz adayı</span>`:'';
  const dry=r.drought?`<span class="hz-dry" title="Son ilk 3'ünden bu yana koşu sayısı. 2024–2026'da 3–5 koşudur ilk 3'e giremeyen atlar %6, 6+ koşudur giremeyenler %4 kazandı (son koşusu ilk 3 olanlar %17).">${r.drought.never?`Hiç ilk 3 yok · ${r.drought.runs} koşu`:`${r.drought.runs} koşudur ilk 3 yok`}</span>`:'';
  const thin=r.thin?`<span class="hz-thin-tag" title="Geçmiş koşusu 3'ten az: at hakkında net bilgi yok, tahmini temkinli okuyun.">${r.starts?`Az veri · ${r.starts} koşu`:'Az veri · ilk koşu'}</span>`:'';
  return `<tr class="${won?'hz-winner':''}"><td class="hz-rank">${i+1}</td><td class="hz-no">${esc(r.number)}</td>
   <td class="hz-name"><b${r.thin?' class="hz-thin"':''}>${esc(r.name)}</b>${r.jockey?`<small>${esc(r.jockey)}</small>`:''}${cand}${thin}${dry}${rules}</td>
   <td class="hz-prob"><div class="hz-bar"><span style="width:${(100*r.prob/max).toFixed(1)}%"></span></div><b>${pct(r.prob)}</b></td>
   <td>${signed(r.rating.base)} <small class="hz-muted">/ ${signed(r.rating.surface)} / ${signed(r.rating.distance)}</small><small class="hz-sub">${r.rating.starts} ağ koşusu</small></td>
   <td>${pref(r.pref.surface)}${surfaceRecord(r.surfaces,race.surface)}</td><td>${pref(r.pref.distance)}</td><td class="hz-runs">${lastRuns(r.last)}</td>
   <td>${r.kg??'–'}</td><td>${r.handicap??'–'}</td><td>${r.agf==null?'–':String(r.agf).replace('.',',')}</td><td>${r.odds==null?'–':String(r.odds).replace('.',',')}</td><td class="${r.value!=null&&r.value<.6?'hz-down':''}">${num(r.value,2)}</td>
   ${settled?`<td>${placeBadge(won?1:r.place)}</td>`:''}</tr>`;}).join('');
 return `<section class="card spaced hz-race" id="race-${esc(race.id)}"><div class="hz-race-head"><div><h2>${esc(CITY[race.city]??race.city)} · ${esc(race.number)}. koşu${race.time?` <span class="hz-time">${esc(raceClock(race.time))}</span>`:''}</h2><p>${meta}</p></div>
  <div class="hz-race-tags">${riskTag(race)}${favTag(race)}<span class="tag">${race.model==='obsidian'?'OBSIDIAN':'OBSIDIAN · AGF YOK'}</span>${oddsTag(race)}${verdict(race)}</div></div>
  <div class="table-wrap"><table class="hz-table"><thead><tr><th>Sıra</th><th>#</th><th>At</th><th>Kazanma olasılığı</th><th>Ağ rating'i <small>genel / pist / mesafe</small></th><th>Pist tercihi <small>koşu · 1. / ilk 3</small></th><th>Mesafe tercihi</th><th>Son dereceler</th><th>Kg</th><th>Hnd</th><th>AGF %</th><th>Ganyan</th><th title="Kazanma olasılığı × ganyan. 1 üstü, modelin oranı piyasadan yüksek gördüğünü söyler; bahis önerisi değildir. Ganyan analizi sayfasına bakın.">Değer</th>${settled?'<th>Derece</th>':''}</tr></thead><tbody>${rows}</tbody></table></div>
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
  ?`<p class="inline-note">Güncel program: rating'ler ${esc(s.range.to)} dahil tüm sonuçlanmış koşulardan, ağırlıklar tüm dönemden öğrenildi. Kurallardan yalnızca iki backtest döneminde de doğrulananlar olasılığı etkiler. AGF, ganyan ve değer yayın anındaki oranlarladır; yarış günü değişir, erken saatlerde çok oynaktır.</p>`
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
 const s=state.summary,order=['uniform','handikap','ag','agTercih','hiz','piyasasiz','agf','obsidianHizsiz','obsidianEski','obsidianKuralsiz','obsidianGalopsuz','obsidianJokeysiz','obsidianPistsiz','obsidian','obsidianSentez','obsidianAgac','obsidianOran','closingOdds'];
 const bestKey=['obsidianOran','obsidianAgac','obsidianSentez','obsidian'].find(k=>s.confirmation[k]),best=s.confirmation[bestKey],mkt=s.confirmation.closingOdds,net=s.confirmation.ag;
 const row=k=>{const m=s.confirmation[k];if(!m)return '';return `<tr class="${k===bestKey?'hz-best':k==='closingOdds'?'hz-ref':''}"><td>${esc(MODEL_NAMES[k])}</td><td>${m.races}</td>
  <td class="hz-prob"><div class="hz-bar"><span style="width:${(100*m.top1/0.45).toFixed(1)}%"></span></div><b>${pct(m.top1)}</b></td><td>${pct(m.top3)}</td><td>${m.logLoss.toFixed(3).replace('.',',')}</td><td class="hz-down">${pct(m.topRoi)}</td></tr>`;};
 const breed=k=>{const b=s.byBreed[k];if(!b)return '';return `<tr><td>${esc(MODEL_NAMES[k])}</td><td>${pct(b.TB?.top1)}</td><td>${pct(b.AR?.top1)}</td></tr>`;};
 $('#view-model').innerHTML=`<div class="hz-kpis big"><div><span>Obsidian 1. tahmin</span><b>${pct(best.top1)}</b><small>${best.races} doğrulama koşusu</small></div><div><span>Kazanan ilk 3 tahminde</span><b>${pct(best.top3)}</b><small>Obsidian</small></div><div><span>Yalnız rakip ağı</span><b>${pct(net.top1)}</b><small>piyasa bilgisi olmadan</small></div><div><span>Kapanış favorisi</span><b>${pct(mkt.top1)}</b><small>yarış öncesi bilinmez</small></div></div>
 <section class="card spaced"><div class="card-title"><h2>Doğrulama dönemi · modelin hiç görmediği koşular</h2><span class="tag">${esc(s.split)} VE SONRASI</span></div>
  <div class="table-wrap"><table><thead><tr><th>Model</th><th>Koşu</th><th>1. tahmin kazandı</th><th>İlk 3'te</th><th>Log-kayıp</th><th>ROI · 1. tahmine 1 TL</th></tr></thead><tbody>${order.map(row).join('')}</tbody></table></div>
  <p class="inline-note">Ağırlıklar ${esc(s.range.from)} – ${esc(s.split)} arasında öğrenildi, ${esc(s.split)} sonrasında sınandı. Log-kayıp düşük olan daha iyi olasılık verir. Hipodrom kesintisi yüzünden hiçbir yöntemin ROI'si artı değil: model kazananı sık bilir ama bunu piyasa da bilir.</p></section>
 <div class="grid hz-two spaced"><section class="card"><div class="card-title"><h2>Irka göre · 1. tahmin</h2></div><div class="table-wrap"><table><thead><tr><th>Model</th><th>İngiliz</th><th>Arap</th></tr></thead><tbody>${['ag','piyasasiz','obsidian','obsidianSentez','obsidianAgac','obsidianOran','closingOdds'].map(breed).join('')}</tbody></table></div></section>
 <section class="card"><div class="card-title"><h2>Yöntem</h2></div><ol class="hz-method">
  <li><b>Kim kimi geçti:</b> her geçmiş koşuda bilinen dereceler; aynı koşudaki her at çifti bir karşılaşmadır.</li>
  <li><b>Rakip ağı rating'i:</b> Plackett–Luce. Güçlü atı geçen çok, zayıfı geçen az puan kazanır; güç ortak rakipler üzerinden yayılır. Tüm yurt içi hipodromlardan öğrenilir.</li>
  <li><b>Pist ve mesafe tercihi:</b> rakip gücüne göre düzeltilmiş çim / kum / sentetik ve kısa / mil / orta / uzun sapmaları, artı kariyer kaydı.</li>
  <li><b>Hız puanı:</b> atın bitiş derecesi, aynı ırk, hipodrom, pist ve mesafedeki tipik dereceyle karşılaştırılır ve o günün pist koşuluna göre düzeltilir (1000 m başına saniye).</li>
  <li><b>Obsidian:</b> ağ rating'i, tercihler, kilo, handikap, puan, form, dinlenme, hız puanı, apranti, jokey ve antrenör formu, jokeyin AGF üstü başarısı (genel ve ırka göre), mesafe değişimi, koşulan pistteki ayrıntılı kayıt ve baba pist tercihi, galop dereceleri ve yarış öncesi AGF'yi koşu içi softmax ile birleştirir. Handikaplarda ve 11+ atlı koşularda AGF ile ağ rating'ine ayrı ağırlık verir.</li>
  <li><b>Kurallar:</b> yalnızca backtest'in iki döneminde de tutarlı çıkanlar modele girer.</li>
  <li><b>Piyasa sentezi:</b> Obsidian olasılığı ile AGF payı ikinci bir aşamada birleştirilir; katsayılar modelin görmediği dönemde öğrenilir. AGF'si olmayan koşularda uygulanmaz.</li>
  <li><b>Ağaç katmanı:</b> aynı özelliklerle koşu içinde gruplanmış gradient boosting; atın yalnız kazanmasından değil, bilinen ilk dört dereceden de öğrenir. Sitedeki olasılık, AGF'li koşularda ağaçlar ile AGF'nin, AGF'si olmayan koşularda piyasasız ağaçlar ile piyasasız Obsidian'ın birleşimidir. Sürpriz riski ve adayları bu aşamalardan önceki olasılığı kullanır.</li>
  <li><b>Canlı ganyan:</b> AGF'si olmayan koşularda son yenilemedeki ganyan oranı olasılığa katılır; yarışa yaklaştıkça ağırlığı artar. Tablodaki satır bu fiyatı doğrulama döneminde ölçer; geçmiş günlerin kartları oran katılmadan gösterilir. AGF'li koşularda kazanç ölçülmediği için kullanılmaz. Değer ve favori okuması oran katılmadan önceki olasılığı kullanır.</li></ol></section></div>`;
}

// ---------- Ganyan ----------
async function renderOdds(){
 const O=state.summary.odds;if(!O){$('#view-odds').innerHTML='<p class="inline-note">Ganyan raporu henüz üretilmedi.</p>';return;}
 const today=state.summary.days.find(d=>d.kind==='live'&&d.date===istanbulToday())??state.summary.days.find(d=>d.kind==='live');
 const data=today?state.cache.get(today.date)??await json(`/data/horse/day-${today.date}.json`):null;if(today)state.cache.set(today.date,data);
 const open=(data?.races??[]).filter(r=>!r.winners&&r.favourite);
 const head='<thead><tr><th></th><th>At</th><th>Kazandı</th><th>Gerçek kazanma</th><th>Piyasa payı</th><th>Model</th><th>ROI · ata 1 TL</th><th>ROI aralığı</th></tr></thead>';
 const row=s=>`<tr><td>${esc(s.key)}</td><td>${s.runners}</td><td>${s.wins}</td><td class="hz-prob"><div class="hz-bar"><span style="width:${Math.min(100,100*s.winRate/.5).toFixed(1)}%"></span></div><b>${pct(s.winRate)}</b></td><td>${pct(s.share)}</td><td>${pct(s.model)}</td><td class="hz-down">${pct(s.roi)}</td><td class="hz-muted">${pct(s.roiCi[0],0)} / ${pct(s.roiCi[1],0)}</td></tr>`;
 const table=(title,list,note='')=>`<section class="card spaced"><div class="card-title"><h2>${esc(title)}</h2></div><div class="table-wrap"><table>${head}<tbody>${list.map(row).join('')}</tbody></table></div>${note?`<p class="inline-note">${note}</p>`:''}</section>`;
 const level=k=>O.favourite.levels.find(l=>l.key===k),T=O.withOdds,kpi=(name,s)=>s?`<div><span>${esc(name)}</span><b>${pct(s.winRate)}</b><small>${s.runners} koşu · ROI ${pct(s.roi)}</small></div>`:'';
 const test=(name,t)=>t?`<tr><td>${esc(name)}</td><td>${t.races}</td><td>${num(t.site.logLoss,3)}</td><td>${num(t.ganyan.logLoss,3)}</td><td>${num(t.mixed.logLoss,3)}</td><td class="${t.ci[1]<0?'hz-up':''}">${signed(t.diff,3)} <small class="hz-muted">(${signed(t.ci[0],3)} / ${signed(t.ci[1],3)})</small></td><td>${pct(t.site.top1)} → ${pct(t.mixed.top1)}</td></tr>`:'';
 $('#view-odds').innerHTML=`<div class="hz-kpis big"><div><span>1/oran toplamı</span><b>${num(O.overround,2)}</b><small>ortanca · 1'in üstü piyasanın kesintisi</small></div>${kpi('Tüm favoriler',O.favourite.all)}${kpi('Güçlü favori',level('güçlü'))}${kpi('Zayıf favori',level('zayıf'))}</div>
 <section class="card spaced"><div class="card-title"><h2>${today?`${esc(shortDate(today.date))} · bekleyen koşularda favori`:'Bekleyen koşu yok'}</h2><span class="tag">YAYIN ANINDAKİ ORAN</span></div>
  ${open.length?`<div class="table-wrap"><table><thead><tr><th>Koşu</th><th>Favori</th><th>Ganyan</th><th>Piyasa payı</th><th>Model</th><th>Model / piyasa</th><th>Durum</th><th>Modelin 1. seçimi</th></tr></thead><tbody>${open.map(r=>{const f=r.favourite,m=r.runners[0];return `<tr><td>${esc(CITY[r.city]??r.city)} ${esc(r.number)}.${r.time?` <small class="hz-muted">${esc(raceClock(r.time))}</small>`:''}</td><td>#${esc(f.number)} ${esc(f.name)}</td><td>${num(f.odds)}</td><td>${pct(f.share)}</td><td>${pct(f.prob)}</td><td>${num(f.ratio,2)}</td><td><span class="tag hz-fav ${FAV_CLASS[f.level]??''}">${esc(f.level.toLocaleUpperCase('tr-TR'))}</span></td><td>${f.agrees?'<span class="hz-muted">favori</span>':`#${esc((f.pick??m).number)} ${esc((f.pick??m).name)}`}</td></tr>`;}).join('')}</tbody></table></div>
  <p class="inline-note">Oranlar son yenilemedeki değerlerdir ve yarışa kadar değişir; havuz küçükken bir oran dakikalar içinde iki katına çıkabilir. Kapanışa yakın okuma daha anlamlıdır.</p>`:'<p class="inline-note">Şu an oranı açıklanmış, sonucu bekleyen koşu yok.</p>'}</section>
 ${table('Favori ne kadar güçlü?',O.favourite.levels.map(l=>({...l,key:`${l.key[0].toLocaleUpperCase('tr-TR')}${l.key.slice(1)}${l.key==='zayıf'?' (model / piyasa 0,9 altı)':l.key==='güçlü'?' (1,1 ve üstü)':' (0,9–1,1)'}`})).concat(O.favourite.agreement),'Model favoriye piyasadan az pay verdiğinde favori gerçekten daha az kazanıyor. Yine de model bu durumda abartır: gerçek kazanma oranı modelle piyasanın arasında kalır.')}
 ${table('Ganyan bandına göre tüm atlar',O.bands,'Kesinti yüzünden her bant zararda. Yüksek oranlı atlar, piyasa paylarının altında kazanır ve en çok zarar ettiren gruptur.')}
 ${table('Değer bandına göre tüm atlar (olasılık × ganyan)',O.value,'Düşük değerli atlar net biçimde en kötü gruptur. Yüksek değer ise kâr demek değildir: bu bantlarda model abartılıdır ve aralığı sıfırın net üstünde kalan bant yoktur.')}
 <section class="card spaced"><div class="card-title"><h2>Ganyan modele girse?</h2><span class="tag">ÜST SINIR · MODELDE DEĞİL</span></div>
  <div class="table-wrap"><table><thead><tr><th>Koşular</th><th>Koşu</th><th>Site</th><th>Yalnız ganyan</th><th>Site × ganyan</th><th>Fark (aralık)</th><th>1. tahmin</th></tr></thead><tbody>${test("AGF'li",T.agf)}${test("AGF'siz",T.free)}</tbody></table></div>
  <p class="inline-note">Log-kayıp, düşük olan iyi. Üsler dönemin ilk yarısında (${esc(O.half)} öncesi) öğrenildi, ikinci yarıda sınandı. Kapanış ganyanı yarıştan önce bilinmediği için bu kazanç bir üst sınırdır; gerçek değerini yarış öncesi oran kayıtları birikince ölçeceğiz.</p></section>
 <p class="inline-note">${esc(O.from)} – ${esc(O.to)} arasında ${O.races} koşu; olasılıklar modelin görmediği koşular içindir, ganyan kapanış değeridir. Bu sayfa geçmişi anlatır, bahis önerisi değildir.</p>`;
}

// ---------- Surprise ----------
function renderSurprise(){
 const S=state.summary.surprise;if(!S){$('#view-surprise').innerHTML='<p class="inline-note">Sürpriz modeli henüz eğitilmedi.</p>';return;}
 const R=S.risk,C=S.results,year=esc(state.summary.split.slice(0,4));
 const types=(title,list)=>`<section class="card"><div class="card-title"><h2>${esc(title)}</h2></div><div class="table-wrap"><table><thead><tr><th></th><th>Keşif koşu</th><th>Sürpriz</th><th>${year}+ koşu</th><th>Sürpriz</th></tr></thead><tbody>${list.map(t=>`<tr><td>${esc(t.key)}</td><td>${t.discovery.races}</td>
  <td class="hz-prob"><div class="hz-bar"><span style="width:${Math.min(100,100*t.discovery.rate/.3).toFixed(1)}%"></span></div><b>${pct(t.discovery.rate)}</b></td><td>${t.confirmation.races}</td><td>${pct(t.confirmation.rate)}</td></tr>`).join('')}</tbody></table></div></section>`;
 const cr=(name,c)=>`<tr><td>${esc(name)}</td><td>${c.bets}</td><td>${c.wins}</td><td>${pct(c.winRate)}</td><td class="${c.roi>=0?'hz-up':'hz-down'}">${pct(c.roi)}</td></tr>`;
 $('#view-surprise').innerHTML=`<div class="hz-kpis big"><div><span>Sürpriz oranı</span><b>${pct(R.rate)}</b><small>kazananın ganyanı ≥ ${S.odds} TL · ${R.races} doğrulama koşusu</small></div>
  ${R.levels.map(l=>`<div><span>Risk ${esc(l.level)}</span><b>${pct(l.rate)}</b><small>${l.races} koşu · model ${pct(l.predicted)} dedi</small></div>`).join('')}</div>
 <section class="card spaced"><div class="card-title"><h2>Sürpriz adayları tuttu mu?</h2><span class="tag">${esc(state.summary.split)} VE SONRASI</span></div>
  <div class="table-wrap"><table><thead><tr><th>Küme</th><th>At</th><th>Kazandı</th><th>Kazanma</th><th>ROI · ata 1 TL</th></tr></thead><tbody>${cr('Sürpriz adayları',C.confirmation)}${cr('Adaylar, orta / yüksek riskli koşularda',C.confirmationRisky)}${cr('Karşılaştırma: AGF ilk 3 dışındaki tüm atlar',C.outsideTop3)}${cr('Keşif dönemi adayları (eşik burada seçildi)',C.discovery)}</tbody></table></div>
  <p class="inline-note">Sürpriz adayı: AGF'de ilk 3'te olmayan, model olasılığı en az %${Math.round(100*S.candidates.minProb)} ve AGF payının en az ${String(S.candidates.ratio).replace('.',',')} katı olan at. Risk: kazananın kapanış ganyanının ${S.odds} TL ve üstü olma olasılığı; atlı sayısı, koşu türü, ırk, pist, AGF favorisinin payı ve model olasılıklarının dağınıklığından, yalnız yarış öncesi bilgiyle (AUC ${R.auc==null?'–':R.auc.toFixed(3).replace('.',',')}; 0,5 = şans). ROI kapanış ganyanıyla; hipodrom kesintisi yüzünden eksi olması beklenir, karşılaştırma satırına göre okuyun.</p></section>
 <div class="grid hz-two spaced">${types('Koşu türü',S.types.family)}${types('Atlı sayısı',S.types.field)}</div>
 <div class="grid hz-two spaced">${types('Irk × koşu türü',S.types.breedFamily)}${types('Irk × atlı sayısı',S.types.breedField)}</div>`;
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
  await renderProgram();await renderOdds();renderSurprise();renderModel();renderRules();
  for(const b of document.querySelectorAll('.nav[data-view]'))b.onclick=()=>show(b.dataset.view);
  $('#loading').classList.add('hidden');$('#app').classList.remove('hidden');
 }catch(error){$('#loading').classList.add('hidden');const e=$('#error');e.textContent=`At yarışı verisi yüklenemedi: ${error.message}. Önce "npm run horse:publish" çalıştırın.`;e.classList.remove('hidden');}
}
start();
