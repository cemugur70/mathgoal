import {playerMinutes,playerPosition} from './player-profile.mjs';

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const time=v=>new Date(v).getTime();
const same=(a,b)=>String(a)===String(b);
const newest=(a,b)=>time(b.match.date)-time(a.match.date)||String(a.match.id).localeCompare(String(b.match.id));

function matchFacts(match,{includeNationalFriendlies=false}={}) {
  if(!match||match.id==null||!match.home?.id||!match.away?.id||match.cancelled||match.awarded||
    match.finished===false||Number(match.leagueId)===489||
    (!includeNationalFriendlies&&Number(match.leagueId)===114)||
    !finite(match.homeScore)||!finite(match.awayScore))return null;
  const start=time(match.date);
  const recorded=time(match.completedAt??match.finishedAt??match.endDate);
  const end=Number.isFinite(recorded)?recorded:start+3*3600000;
  return Number.isFinite(start)&&Number.isFinite(end)?{match,start,end}:null;
}

/** The shared completion gate for normalized personal, team and league records. */
export function eligiblePlayerMatch(match,cutoff,targetId,policy={}) {
  const facts=matchFacts(match,policy);
  return !!facts&&!same(match.id,targetId)&&facts.start<cutoff&&facts.end<cutoff;
}

/** Parsed facts and memoized queries belong to one analysis, never ambient process state. */
export function createTeamHistoryLookup(matches,policy={}) {
  const teams=new Map(),cache=new Map();
  for(const match of matches) {
    const facts=matchFacts(match,policy);if(!facts)continue;
    for(const teamId of new Set([String(match.home.id),String(match.away.id)])) {
      if(!teams.has(teamId))teams.set(teamId,[]);
      teams.get(teamId).push(facts);
    }
  }
  for(const rows of teams.values())rows.sort((a,b)=>b.start-a.start||String(a.match.id).localeCompare(String(b.match.id)));
  return {recent(teamId,cutoff,count,targetId=null){
    const key=`${teamId}:${cutoff}:${count}:${targetId}`;
    if(!cache.has(key))cache.set(key,(teams.get(String(teamId))??[])
      .filter(f=>f.start<cutoff&&f.end<cutoff&&!same(f.match.id,targetId)).slice(0,count).map(f=>f.match));
    return cache.get(key);
  }};
}

function opponents(match,teamId) {
  const opposite=same(match.home.id,teamId)?match.away:match.home,seen=new Set(),result=[];
  for(const p of match.players??[]) {
    const id=String(p.id),minutes=playerMinutes(p);
    if(p.id==null||!same(p.teamId,opposite.id)||!(minutes>0)||seen.has(id))continue;
    seen.add(id);
    result.push({id:p.id,playerId:id,teamId:opposite.id,teamName:opposite.name,
      name:p.name??id,position:playerPosition(p),minutes,starter:p.starter===true,
      profileKey:`${opposite.id}:${id}`});
  }
  return result;
}

function rowFor(match,record,detailStatus='available',detailReason=null) {
  const home=same(match.home.id,record.teamId),opponent=home?match.away:match.home;
  return {record,match,minutes:playerMinutes(record),opponent,venue:home?'home':'away',
    opponentFactor:1,opponentHistoryCount:0,detailStatus,detailReason,
    opponentPlayers:detailStatus==='available'?opponents(match,record.teamId):[]};
}

/** Base evidence owns a duplicate identity; ineligible records cannot claim that identity. */
export function selectEligiblePlayerMatches(bundle,cutoff,targetId) {
  const matches=new Map();
  for(const match of [...(bundle.matches??[]),...(bundle.playerHistoryMatches??[])]) {
    if(!eligiblePlayerMatch(match,cutoff,targetId))continue;
    const id=String(match.id);
    if(!matches.has(id))matches.set(id,match);
  }
  return matches;
}

/** Index only normalized facts. No source page, metric alias or roster parsing here. */
export function buildPlayerHistoryIndex(bundle,cutoff,targetId) {
  const matches=selectEligiblePlayerMatches(bundle,cutoff,targetId);
  const byPlayer=new Map(),teamPlayers=new Map(),unknownMinutes=new Map();
  for(const match of matches.values()) {
    const seen=new Set();
    for(const record of match.players??[]) {
      if(record.id==null||(!same(record.teamId,match.home.id)&&!same(record.teamId,match.away.id)))continue;
      const id=String(record.id),teamId=String(record.teamId),minutes=playerMinutes(record);
      if(seen.has(id))continue;seen.add(id);
      if(minutes===null){unknownMinutes.set(id,(unknownMinutes.get(id)??0)+1);continue;}
      if(minutes<=0)continue;
      if(!byPlayer.has(id))byPlayer.set(id,[]);
      byPlayer.get(id).push(rowFor(match,record));
      if(!teamPlayers.has(teamId))teamPlayers.set(teamId,new Map());
      teamPlayers.get(teamId).set(id,record);
    }
  }
  for(const rows of byPlayer.values())rows.sort(newest);
  return {matches,byPlayer,teamPlayers,unknownMinutes};
}

export function selectPlayerHistory(index,playerId,{count,cutoff,targetId,manifest,identity={}}) {
  const id=String(playerId),known=new Map((index.byPlayer.get(id)??[]).map(r=>[String(r.match.id),r]));
  const manifestMatches=Array.isArray(manifest?.matches)?manifest.matches:[];
  const retained=new Set((Array.isArray(manifest?.retainedMatchIds)?manifest.retainedMatchIds:[]).map(String));
  for(const summary of manifestMatches)if(summary.retainedFromPrevious===true)retained.add(String(summary.id??summary.matchId));
  const sameTeams=(actual,expected)=>actual?.home?.id!=null&&actual?.away?.id!=null&&
    expected?.home?.id!=null&&expected?.away?.id!=null&&
    same(actual.home.id,expected.home.id)&&same(actual.away.id,expected.away.id);
  for(const summary of manifestMatches) {
    const matchId=String(summary.id??summary.matchId),existing=known.get(matchId);
    const detailedMatch=index.matches.get(matchId);
    const identityMismatch=(existing&&(!sameTeams(existing.match,summary)||!same(existing.record.teamId,summary.teamId)))||
      (detailedMatch&&!sameTeams(detailedMatch,summary));
    if(existing&&!identityMismatch)continue;
    if(existing)known.delete(matchId);
    const match={...summary,id:matchId};
    const provenAppearance=summary.minutes>0||(summary.playedInMatch===true&&summary.minutes==null);
    if(!provenAppearance||!eligiblePlayerMatch(match,cutoff,targetId))continue;
    if(!same(summary.teamId,match.home.id)&&!same(summary.teamId,match.away.id))continue;
    const detailedRecord=!identityMismatch&&detailedMatch?.players?.find(p=>same(p.id,id)&&same(p.teamId,summary.teamId)&&playerMinutes(p)===null);
    if(detailedRecord)known.set(matchId,rowFor(detailedMatch,{...detailedRecord,playedInMatch:true}));
    else {
      const record={...identity,id,teamId:summary.teamId,minutes:summary.minutes??null,
        playedInMatch:true,starter:summary.starter??null,stats:{}};
      known.set(matchId,rowFor(match,record,'unavailable',identityMismatch?'match-identity-mismatch':summary.reason??'player-record-unavailable'));
    }
  }
  const rows=[...known.values()].sort(newest).slice(0,count);
  const retainedMatchIds=rows.filter(r=>retained.has(String(r.match.id))).map(r=>String(r.match.id));
  const withDetails=rows.filter(r=>r.detailStatus==='available').length;
  const missingMinuteSlots=rows.filter(r=>r.minutes===null).length;
  const identityMismatch=rows.some(r=>r.detailReason==='match-identity-mismatch');
  const matchingCutoff=manifest&&time(manifest.cutoff)===cutoff;
  const exhausted=matchingCutoff&&manifest.sourceExhausted===true;
  let status='archive-only',reason='personal-history-not-collected';
  if(manifest) {
    if(!matchingCutoff){status='partial';reason='cutoff-mismatch';}
    else if(retainedMatchIds.length){status='partial';reason=manifest.reason??'previous-evidence-retained';}
    else if(identityMismatch){status='partial';reason='match-identity-mismatch';}
    else if(missingMinuteSlots){status='partial';reason='missing-minutes';}
    else if(withDetails<rows.length){status='partial';reason='detail-unavailable';}
    else if(manifest.selectionComplete===false){status='partial';reason=manifest.reason??'selection-incomplete';}
    else if(manifest.reason&&manifest.reason!=='source-exhausted'){status='partial';reason=manifest.reason;}
    else if(rows.length>=count&&manifest.status==='complete'){status='complete';reason=null;}
    else if(exhausted){status='exhausted';reason='source-exhausted';}
    else {status='partial';reason=manifest.reason??'appearance-window-incomplete';}
  }
  return {rows,coverage:{status,reason,requested:count,selected:rows.length,withDetails,
    retainedFromPrevious:retainedMatchIds.length>0,retainedMatchIds,
    missingDetails:rows.length-withDetails,missingMinuteSlots,
    unknownMinuteRecords:Math.max(index.unknownMinutes.get(id)??0,missingMinuteSlots),
    sourceExhausted:!!exhausted,cutoff:new Date(cutoff).toISOString()}};
}

/** A listed but unused or injured player remains a roster identity, never a fake appearance. */
export function rosterForTeam(bundle,teamId) {
  const result=new Map(),lineup=bundle.targetLineup;
  if(!lineup||!same(lineup.matchId,bundle.target.id))return result;
  const side=[lineup.home,lineup.away].find(t=>same(t?.id??(t===lineup.home?bundle.target.home.id:bundle.target.away.id),teamId));
  if(!side)return result;
  for(const group of ['starters','bench','unavailable'])for(const player of side[group]??[]) {
    if(player.id==null)continue;
    const id=String(player.id),prior=result.get(id);
    result.set(id,{...(prior??player),name:prior?.name||player.name,position:prior?.position??player.position??null,
      rosterGroups:[...(prior?.rosterGroups??[]),group],
      availability:group==='unavailable'?'unavailable':prior?.availability??'listed',
      unavailableReason:group==='unavailable'?player.reason??'unavailable':prior?.unavailableReason??null});
  }
  return result;
}
