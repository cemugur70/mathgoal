import {createPlayerExplorerIndex,explorerGraph,PLAYER_STAT_CATEGORIES,statCategory,metricLabel} from './player-explorer-data.mjs?v=2026-10-31.1';
import {playerStatMeasure} from './player-stat-values.mjs?v=2026-10-31.1';

let active=null;
const sessions=new Map();
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const role=p=>['Kaleci','Defans','Orta saha','Forvet'][p]??'Mevki bilinmiyor';
const kind=n=>({player:'Oyuncu',match:'Maç',team:'Takım'})[n.kind]??'';
const hash=s=>[...String(s)].reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,7);
export function stopPlayerExplorer(){active?.destroy();active=null;}

export function mountPlayerExplorer(root,ctx,selected,onProfile){
 stopPlayerExplorer();
 const {bundle,result,options,esc,number,pct,date,download}=ctx;
 const key=`${bundle.target.id}:${result.playerAnalysis.cutoff}:${options.formCount}`;
 const index=createPlayerExplorerIndex(bundle,result.playerAnalysis,{formCount:options.formCount});
 const seed=`player:${selected?.playerId??selected?.id??''}`;
 const requestedPlayer=new URLSearchParams(location.search).get('player'),requestedRoot=/^\d{4,12}$/.test(requestedPlayer??'')?'player:'+requestedPlayer:null;
 let state=sessions.get(key);
 if(!state||!index.nodes.has(state.rootId)){
  state={rootId:requestedRoot&&index.nodes.has(requestedRoot)?requestedRoot:index.nodes.has(seed)?seed:[...index.nodes.keys()].find(k=>k.startsWith('player:')),selectedId:null,seed,expanded:new Set(),positions:new Map(),trail:[],category:'important',scope:'graph',mode:'sum',sortKey:null,descending:true,page:0,allMetrics:false,showTeams:true,playersPerMatch:8,paused:false,labels:'auto',view:{scale:1,x:0,y:0}};
  sessions.set(key,state);if(sessions.size>8)sessions.delete(sessions.keys().next().value);
 }else if(seed!==state.seed&&index.nodes.has(seed)){state.rootId=seed;state.selectedId=seed;state.seed=seed;state.expanded.clear();state.trail=[];}
 state.selectedId??=state.rootId;
 if(!state.rootId){root.innerHTML='<p class="empty">Ağ oluşturmak için doğrulanmış oyuncu kaydı yok.</p>';return;}
 const abort=new AbortController(),signal=abort.signal,inventory=new Map((bundle.playerMetricInventory??[]).map(m=>[m.key,m]));
 let graph,points=[],edges=[],frame=0,alpha=1,hover=null,drag=null,width=700,height=620,dpr=1,disposed=false,full=false,previousOverflow='',profileCache=new Map();
 root.innerHTML=`<section class="ex-shell card"><div class="card-title"><div><div class="eyebrow">OYUNCU · MAÇ · TAKIM</div><h2>Bağlantıların peşinden git.</h2></div><span class="tag">OYUNCU AĞI</span></div><p class="ex-intro">Bir oyuncuyu seçin, oynadığı maçları açın; takım arkadaşlarının ve rakiplerinin diğer maçlarına geçin. Düğümler gerçek katılım kayıtlarıyla bağlanır.</p><div class="ex-toolbar"><div class="ex-search"><label for="ex-search">Arşivde oyuncu ara</label><input id="ex-search" class="filter-input" type="search" placeholder="Oyuncu adı…" autocomplete="off"><div id="ex-search-results" class="ex-search-results" role="region" aria-label="Oyuncu arama sonuçları"></div></div><label>Görünüm<select id="ex-density" class="filter-input"><option value="8">Odaklı · maç başına 8 oyuncu</option><option value="30">Tüm maç kadrosu</option></select></label><label>İsimler<select id="ex-labels" class="filter-input"><option value="auto">Yakın bağlantılar</option><option value="all">Tüm isimler</option><option value="none">Seçilen düğüm</option></select></label><label class="ex-check"><input id="ex-teams" type="checkbox"> Takımları göster</label><button class="button ghost" data-ex-action="export-graph">Ağ JSON ↓</button></div><div class="ex-breadcrumbs" id="ex-trail" aria-label="İzlenen bağlantılar"></div><div class="ex-workspace"><div class="ex-stage"><div class="ex-graph-tools"><button type="button" aria-label="Ağı yakınlaştır" data-ex-action="zoom-in">+</button><button type="button" aria-label="Ağı uzaklaştır" data-ex-action="zoom-out">−</button><button type="button" aria-label="Ağı ekrana sığdır" data-ex-action="fit">Sığdır</button><button type="button" data-ex-action="pause" id="ex-pause">Durdur</button><button type="button" data-ex-action="fullscreen" aria-label="Oyuncu ağını tam ekran göster">Tam ekran</button></div><canvas id="ex-canvas" tabindex="0" role="img" aria-label="Oyuncuların, maçların ve takımların bağlantı haritası" aria-describedby="ex-help ex-counts"></canvas><div id="ex-tooltip" class="ex-tooltip" hidden></div><div class="ex-legend"><span><i class="ex-dot player"></i> Oyuncu</span><span><i class="ex-dot match"></i> Maç</span><span><i class="ex-dot team"></i> Takım</span></div><p id="ex-help" class="ex-help">Seç: tıkla · Genişlet: çift tıkla · Düğümü taşı veya zemini sürükle · Tekerlek: yakınlaştır. Klavye için bağlantı listesini kullanın.</p></div><aside id="ex-inspector" class="ex-inspector" aria-label="Seçili düğüm ayrıntıları"></aside></div><div id="ex-counts" class="ex-counts" role="status"></div><details class="ex-accessible"><summary>Bağlantıları liste olarak gez</summary><div id="ex-node-list" class="ex-node-list"></div></details></section><section class="card spaced ex-stats"><div class="card-title"><div><h2>Oyuncu istatistikleri</h2><p class="inline-note" id="ex-table-caption"></p></div><button class="button ghost" data-ex-action="export-stats">Tablo CSV ↓</button></div><div class="ex-stat-categories" id="ex-categories" role="tablist" aria-label="Oyuncu istatistik kategorileri"></div><div class="ex-stat-controls"><label>Kapsam<select class="filter-input" id="ex-stat-scope"><option value="graph">Ağdaki oyuncular · kişisel son maçları</option><option value="player">Seçili oyuncu · kişisel son maçları</option><option value="match">Seçili maçtaki tüm oyuncular</option></select></label><label>Değer<select class="filter-input" id="ex-stat-mode"><option value="sum">Toplam / oran</option><option value="average">Maç başına</option><option value="per90">90 dakika başına</option></select></label><button class="text-button" data-ex-action="all-metrics" id="ex-all-metrics"></button></div><div id="ex-stat-table" class="table-wrap ex-stat-table"></div><div class="ex-pagination"><button class="button ghost" data-ex-action="prev-page">Önceki</button><span id="ex-page-status" role="status"></span><button class="button ghost" data-ex-action="next-page">Sonraki</button></div><p class="inline-note">“—” ölçümün bulunmadığını belirtir; sıfır değildir. Oranlar yalnız pay ve paydası birlikte bulunan kayıtlardan hesaplanır. Puanlar ve yüzdeler 90 dakikaya çevrilmez; dakika sütunu toplam süreyi gösterir. Kişisel son maçlar farklı tarihlere ve eski takımlara ait olabilir. Aynı maçta yer almak doğrudan ikili mücadele kanıtı değildir.</p></section>`;
 const q=s=>root.querySelector(s),canvas=q('#ex-canvas'),c=canvas.getContext('2d'),tooltip=q('#ex-tooltip');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const profile=id=>{if(!profileCache.has(id))profileCache.set(id,index.profile(String(id)));return profileCache.get(id);};
 const color=n=>n.kind==='match'?'#d9e2d2':n.kind==='team'?'#8cb6cf':String(n.teamId)===String(bundle.target.home.id)?'#c3ef79':String(n.teamId)===String(bundle.target.away.id)?'#e7ab80':'#91b7a5';
 const radius=n=>(n.id===state.rootId?12:n.kind==='team'?10:n.kind==='match'?7:5+Math.min(3,Math.log2((index.adjacency.get(n.id)?.length??0)+1)/2))/Math.pow(state.view.scale,.6);
 function repaint(){if(!disposed&&!frame)frame=requestAnimationFrame(tick);}
 function physics(){
  const a=alpha*.7;
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   const p=points[i],q=points[j],dx=p.x-q.x||.1,dy=p.y-q.y||.1,d2=dx*dx+dy*dy+80,f=85*a/d2;
   p.vx+=dx*f;p.vy+=dy*f;q.vx-=dx*f;q.vy-=dy*f;
  }
  for(const {a:p,b:q} of edges){const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1,desired=p.kind==='team'||q.kind==='team'?130:94,f=(d-desired)/d*.025*a;p.vx+=dx*f;p.vy+=dy*f;q.vx-=dx*f;q.vy-=dy*f;}
  for(const p of points){p.vx=(p.vx-p.x*.0015*a)*.72;p.vy=(p.vy-p.y*.0015*a)*.72;p.x=p.fx??p.x+clamp(p.vx,-18,18);p.y=p.fy??p.y+clamp(p.vy,-18,18);}
  alpha*=.97;
 }
 function tick(){frame=0;if(disposed)return;if(alpha>.008&&!state.paused){physics();physics();}draw();if(alpha>.008&&!state.paused&&!reduced)repaint();}
 function draw(){
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.fillStyle='#0e1713';c.fillRect(0,0,width,height);
  c.fillStyle='#24382b';for(let x=20;x<width;x+=28)for(let y=20;y<height;y+=28){c.beginPath();c.arc(x,y,.65,0,Math.PI*2);c.fill();}
  c.save();c.translate(width/2+state.view.x,height/2+state.view.y);c.scale(state.view.scale,state.view.scale);
  const focus=hover??state.selectedId,near=new Set([focus]);
  for(const e of edges)if(e.source===focus||e.target===focus){near.add(e.source);near.add(e.target);}
  for(const e of edges){const on=e.source===focus||e.target===focus;c.globalAlpha=on?.8:.16;c.strokeStyle=on?'#c3ef79':e.relation==='fixture'?'#8cb6cf':'#8eac91';c.lineWidth=(on?1.7:.8)/Math.sqrt(state.view.scale);c.beginPath();c.moveTo(e.a.x,e.a.y);c.lineTo(e.b.x,e.b.y);c.stroke();}
  const labelCandidates=[];
  for(const p of points){
   const selected=p.id===state.selectedId,on=near.has(p.id),r=radius(p);c.globalAlpha=on?1:.8;c.fillStyle=color(p);c.strokeStyle=color(p);c.lineWidth=1.5;
   if(selected){c.globalAlpha=.1;c.beginPath();c.arc(p.x,p.y,r+12,0,Math.PI*2);c.fill();c.globalAlpha=1;c.strokeStyle='#ecf7df';c.beginPath();c.arc(p.x,p.y,r+5,0,Math.PI*2);c.stroke();}
   c.beginPath();if(p.kind==='match'){c.moveTo(p.x,p.y-r);c.lineTo(p.x+r,p.y);c.lineTo(p.x,p.y+r);c.lineTo(p.x-r,p.y);c.closePath();c.fill();}else{c.arc(p.x,p.y,r,0,Math.PI*2);if(p.kind==='team')c.stroke();else c.fill();}
   const label=selected||p.id===state.rootId||hover===p.id||state.labels==='all'||state.labels==='auto'&&(on||state.view.scale>1.5);
   if(label)labelCandidates.push({p,selected,on,r,priority:selected?0:hover===p.id?1:p.id===state.rootId?2:3});
  }
  const occupied=[],scale=state.view.scale;
  for(const {p,selected,on,r,priority} of labelCandidates.sort((a,b)=>a.priority-b.priority)){
   c.globalAlpha=on?1:.83;c.font=`${selected?'600 ':''}${(selected?13:11)/scale}px "DM Sans",sans-serif`;c.textAlign='center';c.fillStyle=selected?'#edf5e9':color(p);
   const title=p.kind==='match'&&!selected&&hover!==p.id?p.matchLabel:p.name,text=title.length>28?title.slice(0,26)+'…':title,w=c.measureText(text).width,h=15/scale;
   const positions=[{x:p.x,y:p.y+r+17/scale},{x:p.x,y:p.y-r-9/scale},{x:p.x+r+10/scale+w/2,y:p.y+4/scale},{x:p.x-r-10/scale-w/2,y:p.y+4/scale}];
   for(const [n,position] of positions.entries()){
    const box={left:position.x-w/2-3/scale,right:position.x+w/2+3/scale,top:position.y-h,bottom:position.y+4/scale};
    const overlap=occupied.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top);
    if(overlap&&state.labels!=='all'&&(n<positions.length-1||priority>2))continue;
    c.fillText(text,position.x,position.y);occupied.push(box);break;
   }
  }
  c.restore();c.globalAlpha=1;
 }
 function fit(){if(!points.length)return;const minX=Math.min(...points.map(p=>p.x-35)),maxX=Math.max(...points.map(p=>p.x+35)),minY=Math.min(...points.map(p=>p.y-30)),maxY=Math.max(...points.map(p=>p.y+35));state.view.scale=clamp(Math.min((width-70)/(maxX-minX),(height-100)/(maxY-minY)),.2,2);state.view.x=-(minX+maxX)/2*state.view.scale;state.view.y=-(minY+maxY)/2*state.view.scale;repaint();}
 function refresh(fitView=false){
  graph=explorerGraph(index,{rootId:state.rootId,expandedIds:[...state.expanded],maxNodes:260,playersPerMatch:state.playersPerMatch,matchLimit:options.formCount,showTeams:state.showTeams});
  points=graph.nodes.map((n,i)=>{
   let p=state.positions.get(n.id);if(!p){const angle=hash(n.id)%628/100,r=n.kind==='match'?190:n.kind==='team'?310:250+hash(n.id)%160;p={x:Math.cos(angle)*r,y:Math.sin(angle)*r,vx:0,vy:0};state.positions.set(n.id,p);}Object.assign(p,n);if(n.id===state.rootId){p.fx=0;p.fy=0;p.x=0;p.y=0;p.rootPinned=true;}else if(p.rootPinned){delete p.fx;delete p.fy;delete p.rootPinned;}p.matchLabel=n.kind==='match'?`${n.homeScore}–${n.awayScore} · ${date(n.date)}`:null;return p;
  });
  const byId=new Map(points.map(p=>[p.id,p]));edges=graph.edges.map(e=>({...e,a:byId.get(e.source),b:byId.get(e.target)})).filter(e=>e.a&&e.b);
  if(!byId.has(state.selectedId))state.selectedId=state.rootId;
  alpha=1;for(let i=0;i<100;i++)physics();if(fitView)fit();
  q('#ex-counts').textContent=`${points.filter(p=>p.kind==='player').length} oyuncu · ${points.filter(p=>p.kind==='match').length} maç · ${edges.length} bağlantı. ${graph.nodes.length>=260?'260 düğümlük görünüm sınırı; yeni bir düğüme odaklanarak devam edin.':graph.truncated?`${graph.omittedNodeCount} düğüm odaklı görünüm dışında. Seçilen maçın tüm oyuncuları tabloda gösterilir.`:'Maç seçildiğinde tablodaki tüm oyuncular gösterilir.'}`;
  q('#ex-node-list').innerHTML=graph.nodes.map(n=>`<button type="button" data-ex-node="${esc(n.id)}" ${n.id===state.selectedId?'aria-current="true"':''}><small>${kind(n)}</small> ${esc(n.name)}</button>`).join('');
  renderInspector();renderTable();draw();repaint();
 }
 function select(id,{focus=false,expand=false}={}){
  if(!index.nodes.has(id))return;
  focus=focus||!graph.nodes.some(n=>n.id===id);
  state.selectedId=id;state.page=0;
  if(state.trail.at(-1)!==id)state.trail=[...state.trail,id].slice(-7);
  const node=index.nodes.get(id);if(node.kind==='match'){state.matchId=node.matchId;state.scope='match';}else if(node.kind==='player')state.playerId=node.playerId;
  if(focus){if(node.kind==='player'){state.scope='graph';state.matchId=null;}state.rootId=id;state.expanded.clear();refresh(true);}else if(expand){state.expanded.add(id);refresh(true);}else{renderInspector();renderTable();repaint();}
  const url=new URL(location.href),rootNode=index.nodes.get(state.rootId);if(rootNode?.kind==='player')url.searchParams.set('player',rootNode.playerId);else url.searchParams.delete('player');history.replaceState(null,'',url);
 }
 function renderInspector(){
  const n=index.nodes.get(state.selectedId)??index.nodes.get(state.rootId);if(!n)return;
  q('#ex-node-list').querySelectorAll('[data-ex-node]').forEach(button=>{if(button.dataset.exNode===n.id)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
  q('#ex-trail').innerHTML=(state.trail.length?state.trail:[state.rootId]).map(id=>{const v=index.nodes.get(id);return v?`<button data-ex-node="${esc(id)}" ${id===n.id?'aria-current="page"':''}>${esc(v.name)}</button>`:'';}).join('<span aria-hidden="true">›</span>');
  let body='';
  if(n.kind==='player'){
   const p=profile(n.playerId),matches=index.playerMatches(n.playerId);
   body=`<div class="ex-player-heading"><img src="https://images.fotmob.com/image_resources/playerimages/${encodeURIComponent(n.playerId)}.png" width="52" height="52" alt="" onerror="this.style.visibility='hidden'"><div><span class="eyebrow">OYUNCU</span><h3>${esc(n.name)}</h3><p>${esc(n.teamName??p?.teamName??'')} · ${role(n.position)}</p></div></div><div class="ex-facts"><span><b>${p?.games??0}</b> maç</span><span><b>${number(p?.minutes,0)}</b> dk</span><span><b>${number(p?.goals,0)}</b> gol</span><span><b>${number(p?.xg90,2)}</b> xG / 90</span></div><p class="inline-note">Arşivdeki son ${options.formCount} kişisel görünüm. Eksik maçlar olabilir; tam kariyer kapsamı değildir.</p><button class="button ghost" data-ex-action="profile">Ayrıntılı oyuncu profilini aç</button><h4>Oynadığı maçlar</h4><div class="ex-related">${matches.map(m=>`<button data-ex-node="match:${esc(m.matchId??m.id)}"><span>${date(m.date)} · ${esc(m.opponent?.name??m.away?.name??'Maç')}</span><b>${esc(m.score??`${m.homeScore}–${m.awayScore}`)}</b><small>${number(m.minutes,0)} dk · ${m.starter?'İlk 11':'Katılım'}</small></button>`).join('')||'<p class="inline-note">Doğrulanmış katılım kaydı bulunamadı.</p>'}</div>`;
  }else if(n.kind==='match'){
   const rows=index.matchPlayers(n.matchId);
   body=`<span class="eyebrow">MAÇ</span><h3>${esc(n.home.name)} <span class="ex-inline-score">${n.homeScore}–${n.awayScore}</span> ${esc(n.away.name)}</h3><p>${date(n.date,true)}</p><p class="inline-note">${rows.length} süre aldığı doğrulanan oyuncu. Tam maç istatistikleri aşağıdaki tabloya geçti.</p><button class="button ghost" data-ex-action="match-detail">Maç ayrıntılarını aç</button>${[n.home,n.away].map(team=>`<h4>${esc(team.name)}</h4><div class="ex-related">${rows.filter(p=>String(p.teamId)===String(team.id)).map(p=>`<button data-ex-node="player:${esc(p.playerId??p.id)}"><span>${esc(p.name)}</span><small>${role(p.position)} · ${number(p.minutes,0)} dk</small></button>`).join('')}</div>`).join('')}`;
  }else{
   const matches=[...index.matches.values()].filter(m=>String(m.home.id)===String(n.teamId)||String(m.away.id)===String(n.teamId)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,options.formCount);
   body=`<span class="eyebrow">TAKIM</span><h3>${esc(n.name)}</h3><p class="inline-note">Analiz kesiminden önceki arşiv maçları.</p><div class="ex-related">${matches.map(m=>`<button data-ex-node="match:${esc(m.id??m.matchId)}"><span>${date(m.date)} · ${esc(m.home.name)} – ${esc(m.away.name)}</span><b>${m.homeScore}–${m.awayScore}</b></button>`).join('')}</div>`;
  }
  q('#ex-inspector').innerHTML=`<div class="ex-inspector-actions"><button class="button primary" data-ex-action="expand">${state.expanded.has(n.id)?'Bağlantılar açık':'Bağlantıları genişlet'}</button><button class="button ghost" data-ex-action="focus">Odaklan</button></div>${body}`;
 }
 function tableRows(){
  if(state.scope==='match')return state.matchId?index.matchPlayers(state.matchId).map(p=>({...p,playerId:String(p.playerId??p.id),raw:true})):[];
  const ids=state.scope==='player'?[state.playerId??index.nodes.get(state.selectedId)?.playerId]:graph.nodes.filter(n=>n.kind==='player').map(n=>n.playerId);
  return [...new Set(ids.filter(Boolean).map(String))].map(id=>profile(id)).filter(Boolean).map(p=>({...p,playerId:String(p.playerId??p.id),raw:false}));
 }
 function metricKeys(rows){
  const available=new Set(rows.flatMap(r=>Object.keys(r.raw?r.stats??{}:r.metrics??{})));
  const cat=PLAYER_STAT_CATEGORIES.find(c=>c.id===state.category)??PLAYER_STAT_CATEGORIES[0];
  const ordered=(cat.keys??[]).filter(k=>available.has(k));
  for(const k of available)if(statCategory(k,inventory.get(k))===cat.id&&!ordered.includes(k))ordered.push(k);
  return ordered;
 }
 function measurement(row,key){
  const {value,paired,nonCount}=playerStatMeasure(row,key,{meta:inventory.get(key),mode:state.mode,fractionEvidence:index.fractionEvidence});
  if(!finite(value))return {value:null,text:'—',title:'Kaynakta ölçüm yok'};
  if(state.mode==='sum'&&paired?.total>0)return {value,text:`${number(paired.numerator,0)}/${number(paired.total,0)} (${pct(paired.numerator/paired.total,0)})`,title:`Pay/payda birlikte gözlendi: ${paired.games} maç. ${finite(paired.coverage)?number(paired.coverage*100,0)+'% kapsam.':''}`};
  return {value,text:number(value,key==='minutes_played'&&state.mode!=='average'?0:nonCount||state.mode!=='sum'||!Number.isInteger(value)||/expected|goals_prevented/.test(key)?2:0),title:row.raw?'Maçta gözlenen ölçüm':`${row.metrics?.[key]?.games??0}/${row.games??0} maçta ölçüm`};
 }
 function sortedRows(){
  const rows=tableRows(),keys=metricKeys(rows),key=keys.includes(state.sortKey)?state.sortKey:keys[0];state.sortKey=key;
  return {keys,rows:rows.sort((a,b)=>{const x=measurement(a,key).value,y=measurement(b,key).value;if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;return (finite(x)&&finite(y)&&(state.descending?y-x:x-y))||String(a.name).localeCompare(String(b.name),'tr')||a.playerId.localeCompare(b.playerId);})};
 }
 function renderTable(){
  q('#ex-categories').innerHTML=PLAYER_STAT_CATEGORIES.map(cat=>`<button role="tab" aria-selected="${cat.id===state.category}" class="${cat.id===state.category?'active':''}" data-ex-category="${cat.id}">${esc(cat.label)}</button>`).join('');
  q('#ex-stat-scope').value=state.scope;q('#ex-stat-mode').value=state.mode;
  q('#ex-stat-scope option[value="match"]').disabled=!state.matchId;
  const {rows,keys}=sortedRows(),columns=state.allMetrics?keys:keys.slice(0,8),maxPage=Math.max(0,Math.ceil(rows.length/25)-1);state.page=clamp(state.page,0,maxPage);
  const shown=rows.slice(state.page*25,state.page*25+25),match=state.matchId?index.matches.get(String(state.matchId)):null;
  q('#ex-table-caption').textContent=state.scope==='match'&&match?`${match.home.name} ${match.homeScore}–${match.awayScore} ${match.away.name} · ${date(match.date,true)} · Maçtaki tüm oyuncular`:`Her oyuncunun arşivdeki son ${options.formCount} kişisel maçı · ${rows.length} oyuncu`;
  q('#ex-all-metrics').textContent=state.allMetrics?'İlk 8 ölçüm':'Tüm '+keys.length+' ölçüm';q('#ex-all-metrics').hidden=keys.length<=8;
  q('#ex-stat-table').innerHTML=rows.length&&columns.length?`<table><thead><tr><th>OYUNCU / TAKIM</th><th>${state.scope==='match'?'DAKİKA':'MAÇ / DK'}</th>${columns.map(k=>`<th aria-sort="${k===state.sortKey?state.descending?'descending':'ascending':'none'}"><button data-ex-sort="${esc(k)}">${esc(metricLabel(k,inventory.get(k)))}${k===state.sortKey?state.descending?' ↓':' ↑':''}</button></th>`).join('')}</tr></thead><tbody>${shown.map(row=>`<tr class="${'player:'+row.playerId===state.selectedId?'selected':''}"><td><button data-ex-node="player:${esc(row.playerId)}"><b>${esc(row.name)}</b><small>${esc(row.teamName??index.nodes.get('player:'+row.playerId)?.teamName??'')} · ${role(row.position)}</small></button></td><td>${row.raw?number(row.minutes,0):`${row.games??0} / ${number(row.minutes,0)}`}</td>${columns.map(k=>{const m=measurement(row,k);return `<td title="${esc(m.title)}">${esc(m.text)}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`:'<p class="empty">Bu kapsam ve kategoride ölçüm bulunamadı. Başka bir maç veya oyuncu seçin.</p>';
  q('#ex-page-status').textContent=rows.length?`${state.page*25+1}–${Math.min((state.page+1)*25,rows.length)} / ${rows.length} oyuncu`:'0 oyuncu';
  q('[data-ex-action="prev-page"]').disabled=state.page===0;q('[data-ex-action="next-page"]').disabled=state.page>=maxPage;
 }
 function zoom(factor){state.view.scale=clamp(state.view.scale*factor,.15,4);repaint();}
 function setFullscreen(value){full=value;root.querySelector('.ex-shell').classList.toggle('ex-fullscreen',full);if(full){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}else document.body.style.overflow=previousOverflow;q('[data-ex-action="fullscreen"]').textContent=full?'Ekranı kapat':'Tam ekran';resize();fit();draw();}
 function action(name){
  if(name==='zoom-in')zoom(1.25);if(name==='zoom-out')zoom(.8);if(name==='fit')fit();
  if(name==='pause'){state.paused=!state.paused;q('#ex-pause').textContent=state.paused?'Hareket ettir':'Durdur';repaint();}
  if(name==='fullscreen')setFullscreen(!full);
  if(name==='expand')select(state.selectedId,{expand:true});if(name==='focus')select(state.selectedId,{focus:true});
  if(name==='profile'){const n=index.nodes.get(state.selectedId);if(n?.kind==='player')onProfile?.(n.playerId,n.teamId,n);}
  if(name==='match-detail'){const n=index.nodes.get(state.selectedId);if(n?.kind==='match')ctx.openMatch(n.matchId);}
  if(name==='prev-page'||name==='next-page'){state.page+=name==='prev-page'?-1:1;renderTable();}
  if(name==='all-metrics'){state.allMetrics=!state.allMetrics;renderTable();}
  if(name==='export-graph')download(`mathgoal-player-network-${bundle.target.id}.json`,{cutoff:index.cutoff,coverage:index.coverage,rootId:state.rootId,expandedIds:[...state.expanded],...graph});
  if(name==='export-stats'){
   const {rows,keys}=sortedRows(),safe=s=>/^[=+@-]/.test(String(s))?"'"+s:s;
   const cells=[['Oyuncu','Takım','Maç / dakika',...keys.map(k=>metricLabel(k,inventory.get(k)))],...rows.map(r=>[safe(r.name),safe(r.teamName??''),r.raw?r.minutes:`${r.games} / ${r.minutes}`,...keys.map(k=>measurement(r,k).text)])];
   download(`mathgoal-player-stats-${bundle.target.id}-${state.category}.csv`,'\uFEFF'+cells.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n'),'text/csv;charset=utf-8');
  }
 }
 root.addEventListener('click',e=>{const node=e.target.closest('[data-ex-node]'),category=e.target.closest('[data-ex-category]'),sort=e.target.closest('[data-ex-sort]'),button=e.target.closest('[data-ex-action]');
  if(node){e.preventDefault();select(node.dataset.exNode,{focus:!!node.closest('#ex-search-results')});q('#ex-search-results').innerHTML='';}
  else if(category){state.category=category.dataset.exCategory;state.page=0;state.sortKey=null;state.allMetrics=false;renderTable();}
  else if(sort){state.descending=state.sortKey===sort.dataset.exSort?!state.descending:true;state.sortKey=sort.dataset.exSort;renderTable();}
  else if(button)action(button.dataset.exAction);
 },{signal});
 q('#ex-stat-scope').onchange=e=>{state.scope=e.target.value;state.page=0;renderTable();};
 q('#ex-stat-mode').onchange=e=>{state.mode=e.target.value;renderTable();};
 q('#ex-density').value=String(state.playersPerMatch);q('#ex-density').onchange=e=>{state.playersPerMatch=Number(e.target.value);refresh(true);};
 q('#ex-labels').value=state.labels;q('#ex-labels').onchange=e=>{state.labels=e.target.value;repaint();};
 q('#ex-teams').checked=state.showTeams;q('#ex-teams').onchange=e=>{state.showTeams=e.target.checked;refresh(true);};
 q('#ex-search').oninput=e=>{const text=e.target.value.trim();q('#ex-search-results').innerHTML=text?index.findPlayers(text,12).map(p=>`<button data-ex-node="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.teamName??'')} · ${p.games??0} maç</small></button>`).join('')||'<p>Arşivde oyuncu bulunamadı.</p>':'';};
 q('#ex-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();q('#ex-search-results button')?.click();}if(e.key==='ArrowDown'){e.preventDefault();q('#ex-search-results button')?.focus();}if(e.key==='Escape')q('#ex-search-results').innerHTML='';};
 function local(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 function world(p){return {x:(p.x-width/2-state.view.x)/state.view.scale,y:(p.y-height/2-state.view.y)/state.view.scale};}
 function hit(p){const v=world(p);return [...points].sort((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y)).find(n=>Math.hypot(n.x-v.x,n.y-v.y)<Math.max(radius(n)+5,20/state.view.scale));}
 canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const p=local(e);drag={start:p,last:p,node:hit(p),moved:false};},{signal});
 canvas.addEventListener('pointermove',e=>{const p=local(e);if(drag){if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>5)drag.moved=true;if(drag.moved){if(drag.node){const v=world(p);drag.node.fx=v.x;drag.node.fy=v.y;drag.node.x=v.x;drag.node.y=v.y;alpha=.15;}else{state.view.x+=p.x-drag.last.x;state.view.y+=p.y-drag.last.y;}drag.last=p;repaint();}return;}const n=hit(p);hover=n?.id??null;canvas.style.cursor=n?'pointer':'grab';tooltip.hidden=!n;if(n){tooltip.textContent=kind(n)+' · '+n.name;tooltip.style.left=clamp(p.x+14,10,width-210)+'px';tooltip.style.top=Math.max(60,p.y-38)+'px';}repaint();},{signal});
 canvas.addEventListener('pointerup',()=>{if(drag&&!drag.moved&&drag.node)select(drag.node.id);drag=null;},{signal});
 canvas.addEventListener('pointercancel',()=>{drag=null;},{signal});
 canvas.addEventListener('pointerleave',()=>{if(!drag){hover=null;tooltip.hidden=true;repaint();}},{signal});
 canvas.addEventListener('dblclick',e=>{const n=hit(local(e));if(n)select(n.id,{expand:true});},{signal});
 canvas.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();zoom(Math.exp(-e.deltaY*.001));},{passive:false,signal});
 canvas.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.25);}if(e.key==='-'){e.preventDefault();zoom(.8);}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();state.view.x+=e.key==='ArrowLeft'?30:e.key==='ArrowRight'?-30:0;state.view.y+=e.key==='ArrowUp'?30:e.key==='ArrowDown'?-30:0;repaint();}},{signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&full)setFullscreen(false);},{signal});
 function resize(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;width=rect.width;height=rect.height;dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);draw();repaint();}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();refresh(true);q('#ex-pause').textContent=state.paused?'Hareket ettir':'Durdur';
 active={destroy(){disposed=true;abort.abort();observer.disconnect();if(frame)cancelAnimationFrame(frame);if(full)document.body.style.overflow=previousOverflow;}};
 return active;
}
