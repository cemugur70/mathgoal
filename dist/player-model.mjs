import {eligiblePlayerMatch,createTeamHistoryLookup,buildPlayerHistoryIndex,selectPlayerHistory,rosterForTeam} from './player-history.mjs';
import {buildPlayerProfile as profileFor,playerMinutes} from './player-profile.mjs';
// Player evidence is built from completed match records, never current season totals.
import {buildLeagueRatings} from './player-rating.mjs';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const at=v=>new Date(v).getTime();
const same=(a,b)=>String(a)===String(b);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mean=xs=>{const v=xs.filter(finite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
const sum=xs=>{const v=xs.filter(finite);return v.length?v.reduce((a,b)=>a+b,0):null;};
// Preserve the legacy forecast's competition policy; personal form excludes national friendlies.
const usable=(match,cutoff,targetId)=>eligiblePlayerMatch(match,cutoff,targetId,{includeNationalFriendlies:true});
const SIMILARITY_METRICS={
  0:[['saves90',3],['goalsPrevented90',.7],['passes90',30],['rating',1]],
  1:[['tackles90',3],['interceptions90',2],['defensiveActions90',12],['passes90',45],['xg90',.3],['xa90',.25]],
  2:[['xg90',.4],['xa90',.4],['keyPasses90',3],['passes90',50],['tackles90',3],['interceptions90',2]],
  3:[['xg90',.7],['xa90',.4],['goals90',.7],['shots90',4],['touchesBox90',8],['keyPasses90',3]]
};
function collectGraph(recentFor,target,cutoff,count,depth,provided) {
  const nodes=new Map();
  if(Array.isArray(provided?.nodes)) for(const n of provided.nodes)nodes.set(String(n.id),{id:n.id,name:n.name,depth:n.depth??0});
  for(const team of [target.home,target.away])nodes.set(String(team.id),{...team,depth:0});
  if(!provided?.nodes) {
    let frontier=[target.home,target.away];
    for(let d=0;d<depth;d++) {
      const next=[];
      for(const t of frontier)for(const m of recentFor(t.id,cutoff,count)) {
        const opponent=same(m.home.id,t.id)?m.away:m.home,key=String(opponent.id);
        if(!nodes.has(key)){nodes.set(key,{...opponent,depth:d+1});next.push(opponent);}
      }
      frontier=next;
    }
  }
  return [...nodes.values()];
}
function weightedSignal(profile,parts) {
  let sum=0,w=0,count=0;
  for(const [key,weight,scale=1]of parts)if(finite(profile[key])){sum+=profile[key]/scale*weight;w+=weight;count++;}
  return {value:w?sum/w:null,dimensions:count};
}
function signals(profiles) {
  const refs={};
  for(const p of profiles) {
    const context={...p,xg90:p.contextMetrics.xg90,xa90:p.contextMetrics.xa90};
    const attack=weightedSignal(context,[['xg90',.5],['xa90',.3],['goals90',.1],['assists90',.1]]);
    const defense=p.position===0?weightedSignal(p,[['goalsPrevented90',1]]):
      weightedSignal(p,[['defensiveActions90',.5,12],['tackles90',.3,3],['interceptions90',.2,2]]);
    p.attackSignal=attack.value;p.attackDimensions=attack.dimensions;
    p.defenseSignal=defense.value;p.defenseDimensions=defense.dimensions;
    if(!refs[p.position])refs[p.position]={attack:[],defense:[]};
    if(p.minutes>=180&&p.games>=3){if(finite(attack.value))refs[p.position].attack.push(attack.value);if(finite(defense.value))refs[p.position].defense.push(defense.value);}
  }
  const reference=Object.fromEntries(Object.entries(refs).map(([key,r])=>[key,{attack:mean(r.attack),defense:mean(r.defense)}]));
  for(const p of profiles) {
    const r=reference[p.position]??{};
    p.regularizedAttack=finite(p.attackSignal)?p.reliability*p.attackSignal+(1-p.reliability)*(r.attack??p.attackSignal):null;
    p.regularizedDefense=finite(p.defenseSignal)?p.reliability*p.defenseSignal+(1-p.reliability)*(r.defense??p.defenseSignal):null;
  }
  return reference;
}
function lineupState(bundle,cutoff) {
  const lineup=bundle.targetLineup,target=bundle.target;
  if(!lineup)return {eligible:false,confidence:0,reason:'Başlama öncesi kadro kaydı yok; tarihî oyuncu profilleri açıklayıcıdır.'};
  if(!same(lineup.matchId,target.id))return {eligible:false,confidence:0,reason:'Kadro başka maça ait; kompozisyon düzeltmesi uygulanmadı.'};
  if(target.finished||target.started||at(bundle.analysisAt)>at(target.date))return {eligible:false,confidence:0,reason:'Geçmiş/başlamış hedefin sonradan görülen kadrosu modele alınmadı.'};
  if(!lineup.eligibleForModel||!Number.isFinite(at(lineup.observedAt))||at(lineup.observedAt)>cutoff)
    return {eligible:false,confidence:0,reason:'Kadro kaydının kesim anından önce bilindiği doğrulanamadı.'};
  const confidence={confirmed:1,predicted:.55,lastStarting11:.25}[lineup.type]??0;
  return {eligible:confidence>0,confidence,type:lineup.type,reason:lineup.type==='lastStarting11'?'Son ilk 11 referansı: doğrulanmış hedef kadro değildir; zayıf ağırlık uygulanır.':lineup.type==='predicted'?'Tahmini kadro; düşük ağırlık uygulanır.':confidence?'Başlama öncesi doğrulanmış kadro.':'Kadronun türü doğrulanamadı.'};
}
function composition(team,side,bundle,cutoff,enabled,scenarios,reference) {
  const neutral={attackFactor:1,defenseFactor:1,coverage:0,confidence:0,reason:'Oyuncu katmanı kapalı.',components:[],scenarios:[],lineupType:null};
  if(!enabled)return neutral;
  const players=team?.players??[],gameCount=team?.summary?.historyCount??0;
  if(gameCount<3||!players.length)return {...neutral,reason:'En az üç maçlık oyuncu geçmişi yok; takım tabanı korundu.'};
  const baseline=new Map(players.map(p=>[String(p.playerId),p.minutes/(gameCount*90)]));
  const state=lineupState(bundle,cutoff),listed=bundle.targetLineup?.[side],byId=new Map(players.map(p=>[String(p.playerId),p]));
  const applicable=Object.entries(scenarios??{}).filter(([id,s])=>byId.has(String(id))&&['in','out'].includes(s));
  if(!state.eligible&&!applicable.length)return {...neutral,reason:state.reason};
  let projected=new Map(baseline),rosterConfidence=state.eligible?state.confidence:.8;
  const changes=[];let unfilled=0;
  function replaceRemoved(playerId,removed) {
    if(removed<=0)return;
    const p=byId.get(String(playerId));
    const alternatives=players.filter(q=>p&&q.position===p.position&&!same(q.playerId,playerId)&&
      scenarios[String(q.playerId)]!=='out'&&(!state.eligible||!(listed?.unavailable??[]).some(u=>same(u.id,q.playerId)))&&
      (projected.get(String(q.playerId))??0)<1);
    let remaining=removed;
    for(let pass=0;pass<3&&remaining>1e-9;pass++) {
      const eligible=alternatives.filter(q=>(projected.get(String(q.playerId))??0)<1-1e-9);
      const total=eligible.reduce((s,q)=>s+Math.max(.025,baseline.get(String(q.playerId))??0),0);
      if(!total)break;
      const budget=remaining;
      for(const q of eligible) {
        const key=String(q.playerId),old=projected.get(key)??0;
        const amount=Math.min(1-old,budget*Math.max(.025,baseline.get(key)??0)/total);
        projected.set(key,old+amount);remaining-=amount;
      }
    }
    unfilled+=Math.max(0,remaining);
  }
  if(state.eligible) {
    if(!Array.isArray(listed?.starters)||listed.starters.length<8)return {...neutral,reason:'Kadroda en az sekiz başlangıç oyuncusu yok; kompozisyon düzeltmesi uygulanmadı.'};
    // The named XI is a composition scenario, not a claim about actual future minutes.
    projected=new Map(listed.starters.map(p=>[String(p.id),1]));
    for(const p of listed.unavailable??[]) {
      if(scenarios[String(p.id)]==='in')continue; // An explicit what-if may override availability.
      const removed=projected.get(String(p.id))??0;
      projected.delete(String(p.id));
      replaceRemoved(p.id,removed);
      changes.push({playerId:p.id,name:p.name,state:'unavailable',source:'pre-match-lineup',reason:p.reason??null});
    }
  }
  for(const [id,state]of applicable) {
    const p=byId.get(String(id));
    if(state==='out') {
      const removed=projected.get(String(id))??0;projected.delete(String(id));
      replaceRemoved(id,removed);
    } else {
      const desired=Math.max(projected.get(String(id))??0,.85),added=desired-(projected.get(String(id))??0);
      const alternatives=players.filter(q=>q.position===p.position&&!same(q.playerId,id)&&projected.has(String(q.playerId)));
      const total=alternatives.reduce((s,q)=>s+projected.get(String(q.playerId)),0);
      if(total>0)for(const q of alternatives)projected.set(String(q.playerId),Math.max(0,projected.get(String(q.playerId))-added*projected.get(String(q.playerId))/total));
      projected.set(String(id),desired);
    }
    changes.push({playerId:p.playerId,name:p.name,state,source:'what-if'});
  }
  if(unfilled>1e-6)return {...neutral,reason:'Eksilen oyuncunun pozisyonunda yeterli gözlenmiş yedek yok; eksik kişiyle oynama varsayımı yapılmadı.',scenarios:changes,lineupType:state.eligible?state.type:null};
  const measure=(weights,signal)=>{
    let total=0,observed=0,weightTotal=0,reliable=0;
    for(const [id,w]of weights) {
      const p=byId.get(id);if(signal==='regularizedAttack'&&p?.position===0)continue;
      weightTotal+=w;
      if(!p||!finite(p[signal]))continue;
      total+=w*p[signal];observed+=w;reliable+=w*p.reliability;
    }
    return {total,coverage:weightTotal?observed/weightTotal:0,reliability:observed?reliable/observed:0,weight:weightTotal};
  };
  const ba=measure(baseline,'regularizedAttack'),pa=measure(projected,'regularizedAttack');
  const bd=measure(baseline,'regularizedDefense'),pd=measure(projected,'regularizedDefense');
  const knownMinutes=players.reduce((s,p)=>s+p.minutes,0),minuteCoverage=clamp(knownMinutes/(gameCount*990),0,1);
  const attackCoverage=Math.min(ba.coverage,pa.coverage),defenseCoverage=Math.min(bd.coverage,pd.coverage);
  const confidence=rosterConfidence*Math.min(1,gameCount/5)*minuteCoverage;
  const aDelta=ba.total>0?(pa.total-ba.total)/(Math.abs(ba.total)+.5):0;
  const dDelta=(pd.total-bd.total)/(Math.abs(bd.total)+.5);
  const aConfidence=confidence*Math.min(ba.reliability,pa.reliability)*attackCoverage;
  const dConfidence=confidence*Math.min(bd.reliability,pd.reliability)*defenseCoverage;
  const attackFactor=attackCoverage>=.65&&minuteCoverage>=.65?Math.exp(clamp(aDelta,-.5,.5)*.12*aConfidence):1;
  // defenseFactor is goals allowed: stronger defending reduces the opponent's mean.
  const defenseFactor=defenseCoverage>=.65&&minuteCoverage>=.65?Math.exp(-clamp(dDelta,-.5,.5)*.10*dConfidence):1;
  return {attackFactor,defenseFactor,coverage:Math.min(attackCoverage,defenseCoverage),minuteCoverage,confidence,
    reason:applicable.length?'Kullanıcının oyuncu senaryosu; kesin kadro veya sakatlık bilgisi değildir.':state.reason,
    lineupType:state.eligible?state.type:null,scenarios:changes,
    components:[{key:'attack',baseline:ba.total,projected:pa.total,delta:aDelta,coverage:attackCoverage,confidence:aConfidence,factor:attackFactor},
      {key:'defense',baseline:bd.total,projected:pd.total,delta:dDelta,coverage:defenseCoverage,confidence:dConfidence,factor:defenseFactor}],
    baselineWeights:Object.fromEntries(baseline),projectedWeights:Object.fromEntries(projected)};
}

export function findComparablePlayers(analysis,playerId,limit=6) {
  const selected=typeof playerId==='object'?playerId:analysis.byId?.[String(playerId)];
  if(!selected||selected.position===null||selected.games<3||selected.minutes<180)return [];
  const specs=SIMILARITY_METRICS[selected.position]??[],result=[];
  for(const p of analysis.profiles??[]) {
    if(same(p.playerId,selected.playerId)||p.position!==selected.position||p.games<3||p.minutes<180)continue;
    let distance=0;const metrics=[];
    for(const [key,scale]of specs)if(finite(p[key])&&finite(selected[key])) {
      distance+=((p[key]-selected[key])/scale)**2;
      metrics.push({key,selected:selected[key],comparable:p[key]});
    }
    if(metrics.length<4)continue;
    distance=Math.sqrt(distance/metrics.length);if(distance>1.5)continue;
    result.push({playerId:p.playerId,teamId:p.teamId,name:p.name,teamName:p.teamName,position:p.position,
      similarity:Math.exp(-distance*distance),distance,coverage:metrics.length/specs.length,metrics,
      games:p.games,minutes:p.minutes,matches:p.matches});
  }
  return result.sort((a,b)=>a.distance-b.distance).slice(0,limit);
}


function personalProfiles(bundle,index,forecastTeams,graph,inventory,cutoff,count,context,recentFor) {
  const teams={},profiles=[],byId={},byKey={};
  const roots=[String(bundle.target.home.id),String(bundle.target.away.id)];
  const decorate=rows=>rows.map(row=>{const op=context(row.match,row.opponent.id);return {...row,opponentFactor:op.factor,opponentHistoryCount:op.count};});
  const teamWindows=new Map();
  function addTeam(team,external=false) {
    const id=String(team.id);
    if(teams[id])return teams[id];
    const source=forecastTeams[id],window=recentFor(team.id,cutoff,count);
    teamWindows.set(id,new Set(window.map(m=>String(m.id))));
    return teams[id]={...team,external,players:[],summary:source?.summary??{
      historyCount:window.length,matchesWithPlayers:window.filter(m=>(m.players??[]).some(p=>same(p.teamId,team.id)&&playerMinutes(p)>0)).length,
      records:0,playerCount:0,minutes:0,minuteCoverage:0,matches:window.map(m=>({id:m.id,date:m.date,home:m.home,away:m.away,homeScore:m.homeScore,awayScore:m.awayScore}))}};
  }
  function addProfile(team,playerId,identity={},external=false) {
    const id=String(playerId),key=`${team.id}:${id}`;
    if(byKey[key])return byKey[key];
    const selected=selectPlayerHistory(index,id,{count,cutoff,targetId:bundle.target.id,
      manifest:bundle.playerHistories?.[id],identity});
    const p=profileFor(team,id,decorate(selected.rows),inventory,identity);
    if(identity.name)p.name=identity.name;
    const listed=rosterForTeam(bundle,team.id).get(id);
    const original=forecastTeams[String(team.id)]?.players.find(p=>p.playerId===id);
    const window=teamWindows.get(String(team.id));
    p.teamContribution=original??profileFor(team,id,decorate((index.byPlayer.get(id)??[]).filter(r=>same(r.record.teamId,team.id)&&window.has(String(r.match.id)))),inventory,identity);
    p.teamContributionWindow=count;
    p.teamHistoryCount=teams[String(team.id)].summary.historyCount;
    p.rosterGroups=listed?.rosterGroups??['archive'];
    p.availability=listed?.availability??'archive';p.unavailableReason=listed?.unavailableReason??null;
    p.historyCoverage=selected.coverage;p.external=external;
    byKey[key]=p;profiles.push(p);teams[String(team.id)].players.push(p);
    const prior=byId[id],rank=t=>{const i=roots.indexOf(String(t));return i<0?roots.length:i;};
    if(!prior||rank(team.id)<rank(prior.teamId)||(rank(team.id)===rank(prior.teamId)&&at(p.lastDate)>at(prior.lastDate)))byId[id]=p;
    return p;
  }
  for(const team of graph) {
    addTeam(team);
    const roster=rosterForTeam(bundle,team.id),candidates=new Map();
    for(const [id,p]of roster)candidates.set(id,p);
    for(const [id,p]of index.teamPlayers.get(String(team.id))??[])if(!candidates.has(id))candidates.set(id,p);
    for(const p of forecastTeams[String(team.id)]?.players??[])if(!candidates.has(p.playerId))candidates.set(p.playerId,p);
    for(const [id,identity]of candidates)addProfile(team,id,identity);
  }
  const primaryProfiles=[...profiles];
  // Expand exactly one opponent layer. Every new identity is sourced from one selected match.
  for(const p of primaryProfiles)for(const m of p.matches)for(const opponent of m.opponentPlayers) {
    if(byKey[opponent.profileKey])continue;
    const team={id:opponent.teamId,name:opponent.teamName,depth:3};
    addTeam(team,true);addProfile(team,opponent.playerId,opponent,true);
  }
  for(const team of Object.values(teams))team.summary={...team.summary,playerCount:team.players.length};
  function resolvePlayer(playerId,teamId,identity={}) {
    if(playerId==null||teamId==null)return null;
    const id=String(playerId),tid=String(teamId),key=`${tid}:${id}`;
    if(byKey[key])return byKey[key];
    const sourceIdentity=index.teamPlayers.get(tid)?.get(id)??rosterForTeam(bundle,tid).get(id);
    if(!sourceIdentity)return null;
    const row=index.byPlayer.get(id)?.find(r=>same(r.record.teamId,tid));
    const sourceTeam=row?(same(row.match.home.id,tid)?row.match.home:row.match.away):
      [bundle.target.home,bundle.target.away].find(t=>same(t.id,tid));
    if(!sourceTeam)return null;
    const team=addTeam({...sourceTeam,depth:3},true);
    const p=addProfile(team,id,{...identity,...sourceIdentity},true);
    team.summary={...team.summary,playerCount:team.players.length};
    return p;
  }
  return {teams,profiles,byId,byKey,primaryProfiles,resolvePlayer};
}

export function analyzePlayers(bundle,opts={}) {
  const target=bundle.target;if(!target?.home||!target?.away||!Number.isFinite(at(target.date)))throw new Error('Oyuncu analizi için geçerli hedef maç gerekli.');
  const dates=[at(target.date),at(bundle.analysisAt),at(opts.cutoff)].filter(Number.isFinite);
  const cutoff=Math.min(...dates),formCount=[5,10].includes(Number(opts.formCount))?Number(opts.formCount):10;
  const depth=clamp(Math.round(opts.depth??2),1,3),enabled=opts.playerLayer!==false;
  const matches=[...new Map((bundle.matches??[]).filter(m=>usable(m,cutoff,target.id)).map(m=>[String(m.id),m])).values()];
  const teamHistory=createTeamHistoryLookup(matches,{includeNationalFriendlies:true});
  const recentFor=(teamId,before,count)=>teamHistory.recent(teamId,before,count);
  const graph=collectGraph(recentFor,target,cutoff,formCount,depth,opts.graph),forecastTeams={},forecastProfiles=[];
  const inventory=new Map((bundle.playerMetricInventory??[]).map(m=>[m.key,m]));
  const contextCache=new Map();
  function context(match,opponentId) {
    const key=`${match.id}:${opponentId}`;if(contextCache.has(key))return contextCache.get(key);
    const past=recentFor(opponentId,at(match.date),5),conceded=past.map(m=>same(m.home.id,opponentId)?m.awayScore:m.homeScore);
    const shrunk=((sum(conceded)??0)+3*1.4)/(conceded.length+3);
    const result={factor:conceded.length>=3?clamp(Math.sqrt(1.4/Math.max(.3,shrunk)),.85,1.15):1,count:conceded.length};
    contextCache.set(key,result);return result;
  }
  for(const team of graph) {
    const window=recentFor(team.id,cutoff,formCount),rows=new Map();
    let matchesWithPlayers=0,records=0;
    for(const match of window) {
      const home=same(match.home.id,team.id),opponent=home?match.away:match.home,op=context(match,opponent.id);
      const seen=new Set();let covered=false;
      for(const record of match.players??[]) {
        if(!same(record.teamId,team.id)||record.id==null||seen.has(String(record.id)))continue;
        seen.add(String(record.id));const minutes=playerMinutes(record);
        if(minutes===0)continue;
        // A bench name with neither minutes nor performance is not an appearance.
        if(minutes===null&&record.starter!==true&&!Object.entries(record.stats??{}).some(([key,v])=>key!=='minutes_played'&&finite(v)))continue;
        const id=String(record.id);if(!rows.has(id))rows.set(id,[]);
        rows.get(id).push({record,minutes,match,opponent,venue:home?'home':'away',opponentFactor:op.factor,opponentHistoryCount:op.count});
        records++;covered=true;
      }
      if(covered)matchesWithPlayers++;
    }
    const players=[...rows].map(([id,r])=>profileFor(team,id,r,inventory)).sort((a,b)=>b.minutes-a.minutes);
    forecastTeams[String(team.id)]={...team,players,summary:{historyCount:window.length,matchesWithPlayers,records,
      playerCount:players.length,minutes:players.reduce((s,p)=>s+p.minutes,0),
      minuteCoverage:window.length?clamp(players.reduce((s,p)=>s+p.minutes,0)/(window.length*990),0,1):0,
      matches:window.map(m=>({id:m.id,date:m.date,home:m.home,away:m.away,homeScore:m.homeScore,awayScore:m.awayScore}))}};
    forecastProfiles.push(...players);
  }
  // Forecast ownership stays with the original team-window profiles and reference cohort.
  // Personal history, roster-only identities and league ratings never enter these signals.
  const reference=signals(forecastProfiles);
  const home=composition(forecastTeams[String(target.home.id)],'home',bundle,cutoff,enabled,opts.playerScenarios??{},reference);
  const away=composition(forecastTeams[String(target.away.id)],'away',bundle,cutoff,enabled,opts.playerScenarios??{},reference);
  const adjustments={home:{...home,factor:clamp(home.attackFactor*away.defenseFactor,.92,1.08)},
    away:{...away,factor:clamp(away.attackFactor*home.defenseFactor,.92,1.08)},
    mapping:'home.factor = home.attackFactor × away.defenseFactor; away.factor = away.attackFactor × home.defenseFactor. Son gol katsayıları 0,92–1,08 aralığına sınırlanır.'};
  const index=buildPlayerHistoryIndex(bundle,cutoff,target.id);
  const {teams,profiles,byId,byKey,primaryProfiles,resolvePlayer}=personalProfiles(bundle,index,forecastTeams,graph,inventory,cutoff,formCount,context,recentFor);
  const nodeMap=new Map(),edgeMap=new Map();
  const addNode=node=>{if(!nodeMap.has(node.id))nodeMap.set(node.id,node);};
  const addEdge=(source,target,relation,extra={})=>{const id=`${source}>${target}:${relation}:${extra.relativeToTeamId??''}`;if(!edgeMap.has(id))edgeMap.set(id,{id,source,target,relation,...extra});};
  for(const p of primaryProfiles) {
    const teamNode=`team:${p.teamId}`,playerNode=`player:${p.teamId}:${p.playerId}`;
    addNode({id:teamNode,kind:'team',teamId:p.teamId,name:p.teamName});
    addNode({id:playerNode,kind:'player',playerId:p.playerId,teamId:p.teamId,name:p.name,position:p.position});
    addEdge(teamNode,playerNode,'contains');
    for(const m of p.matches) {
      const matchNode=`match:${m.matchId}`,opponentNode=`team:${m.opponent.id}`;
      addNode({id:matchNode,kind:'match',matchId:m.matchId,name:`${m.home.name} ${m.score} ${m.away.name}`,date:m.date,score:m.score,home:m.home,away:m.away});
      addNode({id:opponentNode,kind:'team',teamId:m.opponent.id,name:m.opponent.name});
      addEdge(playerNode,matchNode,'played',{minutes:m.minutes,playerId:p.playerId,
        teamId:m.teamId,displayTeamId:p.teamId,relativeToTeamId:m.teamId});
      addEdge(matchNode,opponentNode,'faced',{playerTeamId:m.teamId,relativeToTeamId:m.teamId});
      for(const opponent of m.opponentPlayers) {
        const opponentPlayerNode=`player:${opponent.teamId}:${opponent.playerId}`;
        addNode({...opponent,id:opponentPlayerNode,kind:'player'});
        addEdge(matchNode,opponentPlayerNode,'opponent-player',{playerId:opponent.playerId,
          teamId:opponent.teamId,relativeToTeamId:m.teamId,matchId:m.matchId,minutes:opponent.minutes,
          evidence:'same-match-appearance'});
      }
    }
  }
  const leagueRatings=buildLeagueRatings(bundle,{cutoff,formCount});
  const playerCoverage=()=>({teamCount:Object.keys(teams).length,graphTeamCount:graph.length,externalTeamCount:Object.values(teams).filter(t=>t.external).length,playerCount:profiles.length,uniquePlayerCount:Object.keys(byId).length,
      matchCount:new Set(profiles.flatMap(p=>p.matches.map(m=>m.matchId))).size,
      playerRecords:profiles.reduce((s,p)=>s+p.games,0),metricCount:new Set(profiles.flatMap(p=>Object.keys(p.metrics))).size,
      missingMinuteRecords:profiles.reduce((s,p)=>s+p.missingMinutes,0)});
  const result={enabled,cutoff:new Date(cutoff).toISOString(),formCount,depth,teams,profiles,byId,byKey,reference,leagueRatings,
    adjustments,playerNodes:[...nodeMap.values()],playerEdges:[...edgeMap.values()],comparables:{},
    coverage:playerCoverage(),
    notes:[
      'Kişisel form oyuncunun süre aldığı son 5/10 resmî maçtan hesaplanır; takımın son maçlarındaki katkı ayrıca tutulur. Tam kişisel geçmiş toplanmadıysa yalnız arşivdeki kapsam gösterilir.',
      'Maç tamamlanması ve zaman kesimi kontrol edilir; bitiş saati yoksa başlangıca üç saat eklenir. Hedef maçın oyuncu istatistikleri dışlanır.',
      '90 dakika oranları yalnızca o metriği ve dakika bilgisi bulunan gözlemlerden hesaplanır; eksikler sıfır sayılmaz. Puan ve yüzde değerleri 90 dakikaya çevrilmez.',
      'Rakip bağlamı yalnızca oyuncunun oynadığı maçtan önceki rakip savunma geçmişinden türetilir; az veri nötr kalır.',
      'Takım xG toplamına oyuncu xG toplamı eklenmez. Yalnızca tarihî dakika dağılımı ile bilinen/projeksiyon kadro veya açık oyuncu senaryosu arasındaki kompozisyon farkı küçük bir katsayı uygular.',
      'Son ilk 11 referansı kesin kadro değildir. Geçmiş hedeflere sonradan görülen kadrolar uygulanmaz; in/out tercihleri açık varsayım senaryosudur.',
      'Savunma aksiyonlarından türetilen kompozisyon sinyali ve tüm ağırlıklar sezgiseldir; sakatlık, gerçek oynama süresi veya doğrulanmış tahmin gücü iddiası taşımaz.',
      'Benzer oyuncular aynı pozisyon, en az üç maç, 180 dakika ve dört ortak metrik ister. Benzerlik yüzdesi skor doğruluğu değildir; dayanak maç skorları gösterilir.'
    ]};
  const refreshComparables=()=>{for(const id of [target.home.id,target.away.id])for(const p of teams[String(id)]?.players??[])result.comparables[p.playerId]=findComparablePlayers(result,p);};
  result.resolvePlayer=(playerId,teamId,identity={})=>{
    const priorCount=profiles.length,p=resolvePlayer(playerId,teamId,identity);
    if(profiles.length!==priorCount){result.coverage=playerCoverage();refreshComparables();}
    return p;
  };
  refreshComparables();
  return result;
}
