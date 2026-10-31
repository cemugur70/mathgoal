import {buildPlayerProfile,playerMinutes,playerPosition} from './player-profile.mjs';
import {rosterForTeam,selectEligiblePlayerMatches} from './player-history.mjs';

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const asId=(id,kind)=>String(id).startsWith(`${kind}:`)?String(id).slice(kind.length+1):String(id);
const ID_ORDER=new Intl.Collator('en',{numeric:true}),TEXT_ORDER=new Intl.Collator('tr');
const compareId=(a,b)=>ID_ORDER.compare(String(a),String(b));
const newest=(a,b)=>Date.parse(b.date)-Date.parse(a.date)||compareId(a.matchId??a.id,b.matchId??b.id);
const bounded=(n,fallback,min,max)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Math.floor(Number(n)))):fallback;
const copyFacts=m=>({id:String(m.id),matchId:String(m.id),date:m.date,home:{...m.home},away:{...m.away},
  homeScore:m.homeScore,awayScore:m.awayScore,score:`${m.homeScore}–${m.awayScore}`,
  leagueId:m.leagueId??null,leagueName:m.leagueName??null,finished:true,
  url:m.url??`https://www.fotmob.com/match/${m.id}`});

export const PLAYER_STAT_CATEGORIES=Object.freeze([
  {id:'important',label:'Önemli',keys:['rating_title','rating','minutes_played','goals','assists','expected_goals','expected_goals_on_target_variant','expected_goals_on_target','expected_assists']},
  {id:'attack',label:'Hücum',keys:['goals','expected_goals','expected_goals_on_target_variant','expected_goals_on_target','total_shots','shots_on_target','ShotsOnTarget','shot_accuracy','shots_blocked','shots_off_target','hit_woodwork',
    'touches_opp_box','touches','dribbles_succeeded','big_chance_missed','big_chance_missed_title','offside','penalties_won']},
  {id:'passing',label:'Pas',keys:['assists','expected_assists','accurate_passes','total_pass','chances_created','key_passes','big_chance_created','accurate_crosses',
    'long_balls_accurate','passes_into_final_third','accurate_own_half_passes','accurate_opposition_half_passes']},
  {id:'defense',label:'Savunma',keys:['defensive_actions','matchstats.headers.tackles','tackles','won_tackle','interceptions','clearances',
    'headed_clearance','blocked_shots','recoveries','dribbled_past','fouls','yellow_cards','red_cards','errors_lead_to_goal','errors_lead_to_shot']},
  {id:'duels',label:'İkili mücadele',keys:['duel_won','duel_lost','ground_duels_won','aerials_won','aerials_lost','was_fouled','dispossessed']},
  {id:'keeper',label:'Kaleci',keys:['saves','keeper_saves','goals_conceded','goals_prevented','expected_goals_on_target_faced',
    'saves_inside_box','keeper_diving_save','keeper_sweeper','keeper_high_claim','punches','player_throws','penalty_saved']},
  {id:'other',label:'Diğer',keys:[]}
].map(c=>Object.freeze({...c,keys:Object.freeze(c.keys)})));
const CATEGORY_BY_KEY=new Map(PLAYER_STAT_CATEGORIES.flatMap(c=>c.keys.map(key=>[key,c.id])));
const LABELS={rating_title:'FotMob puanı',rating:'Puan',minutes_played:'Oynanan dakika',goals:'Gol',assists:'Asist',
  expected_goals:'Beklenen gol (xG)',expected_goals_on_target:'İsabetli şut beklenen golü (xGOT)',expected_goals_on_target_variant:'İsabetli şut beklenen golü (xGOT)',expected_assists:'Beklenen asist (xA)',total_shots:'Toplam şut',shots_on_target:'İsabetli şut',ShotsOnTarget:'İsabetli şut',
  shot_accuracy:'Şut isabeti',shots_blocked:'Bloklanan şut',shots_off_target:'İsabetsiz şut',hit_woodwork:'Direkten dönen şut',
  touches_opp_box:'Rakip ceza sahasında dokunuş',touches:'Topla buluşma',dribbles_succeeded:'Başarılı çalım',
  big_chance_missed:'Kaçan büyük fırsat',big_chance_missed_title:'Kaçan büyük fırsat',offside:'Ofsayt',
  accurate_passes:'İsabetli pas',total_pass:'Toplam pas',chances_created:'Yaratılan fırsat',key_passes:'Kilit pas',
  big_chance_created:'Yaratılan büyük fırsat',accurate_crosses:'İsabetli orta',long_balls_accurate:'İsabetli uzun top',
  passes_into_final_third:'Son üçte bir bölgeye pas',defensive_actions:'Savunma aksiyonu','matchstats.headers.tackles':'Top kapma',
  tackles:'Top kapma',won_tackle:'Kazanılan top kapma',interceptions:'Pas arası',clearances:'Uzaklaştırma',headed_clearance:'Kafayla uzaklaştırma',
  blocked_shots:'Şut engelleme',recoveries:'Top kazanma',dribbled_past:'Geçildiği çalım',fouls:'Yapılan faul',was_fouled:'Kazanılan faul',
  yellow_cards:'Sarı kart',red_cards:'Kırmızı kart',duel_won:'Kazanılan ikili mücadele',duel_lost:'Kaybedilen ikili mücadele',
  ground_duels_won:'Kazanılan yer mücadelesi',aerials_won:'Kazanılan hava mücadelesi',aerials_lost:'Kaybedilen hava mücadelesi',
  dispossessed:'Top kaybı',saves:'Kurtarış',keeper_saves:'Kurtarış',goals_conceded:'Yenilen gol',goals_prevented:'Önlenen gol',
  expected_goals_on_target_faced:'Karşılaşılan isabetli şut xG',saves_inside_box:'Ceza sahası içi kurtarış',
  keeper_diving_save:'Atlayarak kurtarış',keeper_sweeper:'Süpürücü kaleci aksiyonu',keeper_high_claim:'Yüksek top alma',
  punches:'Yumruklama',player_throws:'Elle başlatma',penalty_saved:'Kurtarılan penaltı',
  physical_metrics_topspeed:'En yüksek hız',physical_metrics_distance_covered:'Kat edilen mesafe'};
function metadata(meta,key){
  if(meta instanceof Map)return meta.get(key)??{};
  if(Array.isArray(meta))return meta.find(m=>m.key===key)??{};
  return meta?.key===key||meta?.title||meta?.group?meta:meta?.[key]??{};
}
export function metricLabel(key,inventorymeta){return LABELS[key]??metadata(inventorymeta,key).title??key;}
export function statCategory(key,inventorymeta){
  if(CATEGORY_BY_KEY.has(key))return CATEGORY_BY_KEY.get(key);
  const group=String(metadata(inventorymeta,key).group??'').toLocaleLowerCase('tr-TR');
  if(/goalkeep|keeper|kaleci/.test(group)||/keeper_|saves|goals_prevented/.test(key))return 'keeper';
  if(/duel|mücadele/.test(group)||/duel|aerial/.test(key))return 'duels';
  if(/pass|pas/.test(group)||/pass|cross|long_ball|chance.*creat/.test(key))return 'passing';
  if(/defen|savunma/.test(group)||/tackle|intercept|clearance|recover|block|foul/.test(key))return 'defense';
  if(/attack|hücum/.test(group)||/shot|touch|dribbl|offside|chance/.test(key))return 'attack';
  if(/top stat|önemli/.test(group)&&!/physical|distance|speed/.test(key))return 'important';
  return 'other';
}

/** Build a local evidence graph. Co-appearance is a fixture fact, never a proven duel. */
export function createPlayerExplorerIndex(bundle,playerAnalysis,{formCount=10}={}){
  const count=[5,10].includes(Number(formCount))?Number(formCount):10;
  const dates=[bundle.target?.date,bundle.analysisAt,playerAnalysis?.cutoff].map(v=>Date.parse(v)).filter(Number.isFinite);
  const before=dates.length?Math.min(...dates):NaN,cutoff=Number.isFinite(before)?new Date(before).toISOString():null;
  const selected=selectEligiblePlayerMatches(bundle,before,bundle.target?.id);
  const matches=new Map(),appearances=new Map(),participants=new Map(),nodes=new Map(),edges=new Map(),adjacency=new Map(),teamMatches=new Map();
  const inventory=new Map((bundle.playerMetricInventory??[]).map(m=>[m.key,{...m}]));
  const addNode=node=>{if(!nodes.has(node.id)){nodes.set(node.id,node);adjacency.set(node.id,[]);}return nodes.get(node.id);};
  const addEdge=edge=>{if(edges.has(edge.id))return;edges.set(edge.id,edge);adjacency.get(edge.source)?.push(edge);adjacency.get(edge.target)?.push(edge);};
  const addTeam=team=>addNode({id:`team:${team.id}`,kind:'team',teamId:String(team.id),name:team.name??String(team.id)});
  const sorted=[...selected.values()].sort((a,b)=>newest(a,b));
  for(const raw of sorted){
    const fact=copyFacts(raw),mid=fact.id,matchNodeId=`match:${mid}`;matches.set(mid,fact);
    addNode({id:matchNodeId,kind:'match',...fact,id:matchNodeId,name:`${fact.home.name} ${fact.score} ${fact.away.name}`});
    for(const team of [fact.home,fact.away]){
      const tid=String(team.id);addTeam(team);if(!teamMatches.has(tid))teamMatches.set(tid,[]);teamMatches.get(tid).push(fact);
      addEdge({id:`fixture:${mid}:${tid}`,source:matchNodeId,target:`team:${tid}`,relation:'fixture',teamId:tid,evidence:'fixture-team'});
    }
    const proven=[],seen=new Set();
    for(const record of raw.players??[]){
      const playerId=record.id==null?null:String(record.id),teamId=String(record.teamId),minutes=playerMinutes(record);
      if(!playerId||seen.has(playerId)||!(minutes>0)||![String(fact.home.id),String(fact.away.id)].includes(teamId))continue;
      seen.add(playerId);const home=String(fact.home.id)===teamId,club=home?fact.home:fact.away;
      const entry={playerId,id:playerId,matchId:mid,date:fact.date,name:record.name??playerId,teamId,teamName:club.name,
        position:playerPosition(record),minutes,starter:record.starter===true,starterKnown:typeof record.starter==='boolean',
        stats:{...(record.stats??{})},statTotals:{...(record.statTotals??{})},home:fact.home,away:fact.away,
        homeScore:fact.homeScore,awayScore:fact.awayScore,score:fact.score,opponent:home?fact.away:fact.home,venue:home?'home':'away',url:fact.url};
      proven.push(entry);if(!appearances.has(playerId))appearances.set(playerId,[]);appearances.get(playerId).push(entry);
      const p=addNode({id:`player:${playerId}`,kind:'player',playerId,name:entry.name,teamId,teamName:club.name,
        position:entry.position,games:0,minutes:0,identitySource:'archive',clubIds:[],clubs:[]});
      if(!p.clubIds.includes(teamId)){p.clubIds.push(teamId);p.clubs.push({id:teamId,name:club.name});}
      addEdge({id:`appearance:${playerId}:${mid}`,source:`player:${playerId}`,target:matchNodeId,relation:'appearance',
        playerId,teamId,minutes,starter:entry.starter,evidence:'same-match-appearance'});
    }
    participants.set(mid,proven.sort(participantOrder));
  }
  // Listed identities without minutes remain selectable roots, with zero archive games.
  for(const team of [bundle.target?.home,bundle.target?.away].filter(Boolean)){
    addTeam(team);const listed=rosterForTeam(bundle,team.id);
    for(const [pid,p]of listed){
      const node=addNode({id:`player:${pid}`,kind:'player',playerId:pid,name:p.name??pid,teamId:String(team.id),teamName:team.name,
        position:playerPosition(p),games:0,minutes:0,identitySource:'roster',clubIds:[],clubs:[]});
      // Current roster identity is separate from every edge's historical club owner.
      node.teamId=String(team.id);node.teamName=team.name;node.name=p.name??node.name;node.position=playerPosition(p)??node.position;
      node.rosterGroups=[...p.rosterGroups];node.identitySource='roster';
    }
  }
  for(const [pid,rows]of appearances){
    rows.sort(newest);const node=nodes.get(`player:${pid}`),window=rows.slice(0,count);
    node.games=window.length;node.minutes=window.reduce((s,r)=>s+r.minutes,0);node.archiveGames=rows.length;
    node.lastDate=rows[0].date;
  }
  const searchRows=[...nodes.values()].filter(n=>n.kind==='player').map(node=>({node,name:fold(node.name),text:fold(`${node.name} ${node.teamName??''} ${node.playerId}`)}));
  const cloneEntry=e=>structuredClone(e);
  function fractionEvidence(playerId,key,{limit=count,teamId}={}){
    const rows=(appearances.get(asId(playerId,'player'))??[]).filter(r=>teamId==null||String(r.teamId)===asId(teamId,'team'))
      .slice(0,bounded(limit,count,0,1000));
    const paired=rows.filter(r=>finite(r.stats[key])&&finite(r.statTotals[key])&&r.statTotals[key]>0&&r.stats[key]>=0&&r.stats[key]<=r.statTotals[key]);
    const numerator=paired.length?paired.reduce((s,r)=>s+r.stats[key],0):null,total=paired.length?paired.reduce((s,r)=>s+r.statTotals[key],0):null;
    return {numerator,total,ratio:total>0?numerator/total:null,games:paired.length,selectedGames:rows.length,
      coverage:rows.length?paired.length/rows.length:0};
  }
  const index={nodes,edges,adjacency,matches,appearances,cutoff,formCount:count,inventory,
    coverage:{matchCount:matches.size,playerCount:appearances.size,identityCount:[...nodes.values()].filter(n=>n.kind==='player').length,
      appearanceCount:[...appearances.values()].reduce((s,rows)=>s+rows.length,0),
      rosterOnlyPlayers:[...nodes.values()].filter(n=>n.kind==='player'&&!appearances.has(n.playerId)).length,
      cutoff,status:'normalized-archive',note:'Yalnızca yerel arşivde tamamlanması kanıtlanan maçlar; yeni veri çekimi veya kişisel geçmişin eksiksizliği iddiası yok.'},
    profile(playerId,teamId){
      const pid=asId(playerId,'player'),node=nodes.get(`player:${pid}`);if(!node)return null;
      const all=(appearances.get(pid)??[]).filter(r=>teamId==null||String(r.teamId)===asId(teamId,'team')),window=all.slice(0,count);
      const selectedTeam=teamId==null?{id:node.teamId,name:node.teamName}:nodes.get(`team:${asId(teamId,'team')}`);
      const club={id:selectedTeam?.teamId??selectedTeam?.id??String(teamId??node.teamId),name:selectedTeam?.name??node.teamName};
      const rows=window.map(e=>{const match=matches.get(e.matchId);return {match:structuredClone(match),record:{id:pid,name:e.name,teamId:e.teamId,
        position:e.position,isGoalkeeper:e.position===0,minutes:e.minutes,starter:e.starter,stats:{...e.stats},statTotals:{...e.statTotals}},
        minutes:e.minutes,opponent:{...e.opponent},venue:e.venue,opponentFactor:1,opponentHistoryCount:0};});
      const profile=buildPlayerProfile(club,pid,rows,inventory,{id:pid,name:node.name,position:node.position});
      // Canonical sums retain every observed count. Ratios require paired numerator
      // and denominator evidence; an absent denominator must not inflate accuracy.
      for(const [key,metric]of Object.entries(profile.metrics)){
        const paired=fractionEvidence(pid,key,{teamId});
        Object.assign(metric,{pairedNumerator:paired.numerator,pairedTotal:paired.total,pairedGames:paired.games,
          pairedCoverage:paired.coverage,ratio:paired.ratio});
      }
      profile.name=node.name;profile.historyCoverage={status:'archive-only',reason:'normalized-archive-only-no-new-fetch',requested:count,
        selected:window.length,archiveAvailable:all.length,withDetails:window.length,cutoff};
      profile.clubs=structuredClone(node.clubs??[]);return profile;
    },
    matchPlayers(matchId,{includeStats=true}={}){return (participants.get(asId(matchId,'match'))??[]).map(includeStats?cloneEntry:
      e=>({playerId:e.playerId,teamId:e.teamId,name:e.name,position:e.position,minutes:e.minutes,starter:e.starter}));},
    fractionEvidence,
    playerMatches(playerId,{limit=count}={}){return (appearances.get(asId(playerId,'player'))??[]).slice(0,bounded(limit,count,0,1000)).map(cloneEntry);},
    findPlayers(query,limit=12){
      const needle=fold(query),rank=r=>r.name===needle||r.node.playerId===String(query)?0:r.name.startsWith(needle)?1:2;
      return searchRows.filter(r=>!needle||r.text.includes(needle))
        .sort((a,b)=>rank(a)-rank(b)||b.node.games-a.node.games||TEXT_ORDER.compare(a.name,b.name)||compareId(a.node.playerId,b.node.playerId))
        .slice(0,bounded(limit,12,0,100)).map(r=>structuredClone(r.node));
    },
    teamMatches(teamId,{limit=count}={}){return (teamMatches.get(asId(teamId,'team'))??[]).slice(0,bounded(limit,count,0,1000)).map(f=>structuredClone(f));}
  };
  return index;
}
function fold(value){return String(value??'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').trim();}
function participantOrder(a,b){return Number(b.starter)-Number(a.starter)||b.minutes-a.minutes||compareId(a.playerId,b.playerId);}

/** Bounded neighborhood expansion. Hidden match participants stay available to the inspector. */
export function explorerGraph(index,{rootId,expandedIds=[],maxNodes=260,playersPerMatch=8,matchLimit=10,showTeams=true}={}){
  const max=bounded(maxNodes,260,1,1000),participantLimit=bounded(playersPerMatch,8,1,100),limit=bounded(matchLimit,10,1,30);
  const root=String(rootId??''),selected=new Map(),edgeMap=new Map(),omitted=new Set(),expanded=new Set(expandedIds.map(String)),processed=new Set();
  if(!index.nodes.has(root))return {nodes:[],edges:[],truncated:false,omittedNodeCount:0};
  const addNode=id=>{
    if(selected.has(id))return true;if(!index.nodes.has(id))return false;
    if(selected.size>=max){omitted.add(id);return false;}selected.set(id,index.nodes.get(id));omitted.delete(id);return true;
  };
  const addEdge=edge=>{if(selected.has(edge.source)&&selected.has(edge.target))edgeMap.set(edge.id,edge);};
  const linkToMatch=(parent,mid)=>{
    const nid=`match:${mid}`;if(!addNode(nid))return false;
    const edge=(index.adjacency.get(parent)??[]).find(e=>(e.source===nid||e.target===nid));
    if(edge)addEdge(edge);return true;
  };
  function expandMatch(mid,parent,all=false){
    const match=index.matches.get(mid);if(!match)return;
    const nodeId=`match:${mid}`;
    if(parent&&!linkToMatch(parent,mid))return;
    const people=index.matchPlayers(mid,{includeStats:false}),byTeam=new Map([[String(match.home.id),[]],[String(match.away.id),[]]]);
    for(const p of people)byTeam.get(p.teamId)?.push(p);
    const chosen=[],rootPlayer=root.startsWith('player:')?root.slice(7):null,forced=people.find(p=>p.playerId===rootPlayer);
    if(forced)chosen.push(forced);
    const queues=[...byTeam.values()].map(xs=>xs.filter(p=>p.playerId!==rootPlayer));
    // Start opposite the root's club, then alternate to preserve both teams.
    if(forced&&String(forced.teamId)===String(match.home.id))queues.reverse();
    const cap=all?people.length:participantLimit;
    while(chosen.length<cap&&queues.some(q=>q.length))for(const q of queues)if(q.length&&chosen.length<cap)chosen.push(q.shift());
    const chosenIds=new Set(chosen.map(p=>p.playerId));for(const p of people)if(!chosenIds.has(p.playerId))omitted.add(`player:${p.playerId}`);
    for(const p of chosen){const id=`player:${p.playerId}`;if(addNode(id)){
      const edge=index.edges.get(`appearance:${p.playerId}:${mid}`);if(edge)addEdge(edge);
    }}
    if(showTeams)for(const team of [match.home,match.away]){
      const id=`team:${team.id}`;if(addNode(id)){const edge=index.edges.get(`fixture:${mid}:${team.id}`);if(edge)addEdge(edge);}
    }
    // Close cycles between already visible nodes without manufacturing relationships.
    for(const edge of index.adjacency.get(nodeId)??[])addEdge(edge);
  }
  function expand(id){
    if(processed.has(id)||!selected.has(id))return;processed.add(id);const node=index.nodes.get(id);
    if(node.kind==='player')for(const m of index.playerMatches(node.playerId,{limit}))expandMatch(m.matchId,id,expanded.has(`match:${m.matchId}`));
    else if(node.kind==='match')expandMatch(node.matchId,null,true);
    else if(node.kind==='team')for(const m of index.teamMatches(node.teamId,{limit}))expandMatch(m.id,id,expanded.has(`match:${m.id}`));
  }
  addNode(root);expand(root);
  // Only expand requested nodes that have become reachable; never add disconnected roots.
  for(let pass=0;pass<=expanded.size;pass++){
    let progress=false;
    for(const id of [...expanded].sort(compareId))if(selected.has(id)&&!processed.has(id)){expand(id);progress=true;}
    if(!progress)break;
  }
  for(const id of selected.keys())omitted.delete(id);
  return {nodes:[...selected.values()].map(n=>structuredClone(n)),edges:[...edgeMap.values()].map(e=>({...e})),
    truncated:omitted.size>0,omittedNodeCount:omitted.size};
}
