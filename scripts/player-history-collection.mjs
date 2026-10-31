// Historical acquisition only. Current season totals never become match observations.
const HOUR=3600000;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const id=value=>String(value??'');
const validId=value=>/^\d{4,12}$/.test(id(value));
const timestamp=value=>Date.parse(value);
const official=leagueId=>![489,114].includes(Number(leagueId));
export const PLAYER_HISTORY_POLICY=Object.freeze({workers:3,durationMs:180000,maxPages:4});

function finishedBefore(match,cutoff,targetId) {
  const start=timestamp(match.date),recorded=timestamp(match.completedAt??match.finishedAt??match.endDate);
  const end=Number.isFinite(recorded)?recorded:start+3*HOUR;
  return id(match.id)!==id(targetId)&&Number.isFinite(start)&&start<cutoff&&end<cutoff&&
    match.finished!==false&&!match.cancelled&&!match.awarded&&official(match.leagueId)&&
    finite(match.homeScore)&&finite(match.awayScore);
}

function parseAppearanceSummary(raw,{cutoff,targetId}) {
  const invalid=reason=>({kind:'invalid',id:id(raw?.id)||null,reason});
  const excluded=reason=>({kind:'excluded',reason});
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return invalid('invalid-record');
  if(id(raw.id)===id(targetId))return excluded('target-match');
  const date=raw.matchDate?.utcTime,start=timestamp(date);
  if(Number.isFinite(start)&&start>=timestamp(cutoff))return excluded('future-match');
  if(raw.playedInMatch===false||raw.minutesPlayed===0)return excluded('not-played');
  if(!official(raw.leagueId))return excluded('friendly-match');
  if(!validId(raw.id))return invalid('invalid-match-id');
  const teamId=value=>/^[1-9]\d{0,11}$/.test(id(value));
  if(!teamId(raw.teamId)||!teamId(raw.opponentTeamId)||id(raw.teamId)===id(raw.opponentTeamId))return invalid('invalid-team-identity');
  if(typeof raw.isHomeTeam!=='boolean')return invalid('unknown-venue');
  if(!teamId(raw.leagueId))return invalid('missing-league');
  if(!Number.isFinite(start))return invalid('invalid-match-date');
  if(!finite(raw.homeScore)||!finite(raw.awayScore))return invalid('missing-score');
  if(raw.minutesPlayed!=null&&(!finite(raw.minutesPlayed)||raw.minutesPlayed<0))return invalid('invalid-minutes');
  const minutes=finite(raw.minutesPlayed)&&raw.minutesPlayed>=0?raw.minutesPlayed:null;
  if(minutes===null&&raw.playedInMatch!==true)return invalid('unknown-appearance');
  const own={id:Number(raw.teamId),name:String(raw.teamName??'')};
  const opponent={id:Number(raw.opponentTeamId),name:String(raw.opponentTeamName??'')};
  const row={id:id(raw.id),date,home:raw.isHomeTeam?own:opponent,away:raw.isHomeTeam?opponent:own,
    homeScore:raw.homeScore,awayScore:raw.awayScore,leagueId:raw.leagueId,leagueName:raw.leagueName??null,
    teamId:own.id,teamName:own.name,minutes,starter:null,playedInMatch:true,
    appearanceEvidence:raw.playedInMatch===true?'source-playedInMatch':'source-positive-minutes',
    completedAt:raw.completedAt??raw.finishedAt??null,finished:raw.finished,
    cancelled:raw.cancelled,awarded:raw.awarded,
    sourceUrl:typeof raw.matchPageUrl==='string'?raw.matchPageUrl:null};
  return finishedBefore(row,timestamp(cutoff),targetId)?{kind:'selected',match:row}:excluded('not-completed-before-cutoff');
}

export function normalizeAppearanceSummary(raw,context) {
  const parsed=parseAppearanceSummary(raw,context);
  return parsed.kind==='selected'?parsed.match:null;
}

export function validatePlayerHistoryPageUrl(value,playerId) {
  try {
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&
      ['pub.fotmob.com','www.fotmob.com'].includes(url.hostname)&&
      url.pathname===`/prod/db/api/player/${id(playerId)}/matches`?url.href:null;
  } catch{return null;}
}

function provenance(snapshot) {
  return Object.fromEntries(['source','observedAt','sha256','bytes','cached'].filter(key=>snapshot?.[key]!==undefined).map(key=>[key,snapshot[key]]));
}

export function mergeSourceProvenance(...collections) {
  const sources=new Map();
  for(const collection of collections)for(const source of Array.isArray(collection)?collection:[]) {
    const flat=Object.fromEntries(['source','url','observedAt','cachedAt','sha256','bytes','cached']
      .filter(key=>source?.[key]!==undefined&&(source[key]===null||['string','number','boolean'].includes(typeof source[key])))
      .map(key=>[key,source[key]]));
    sources.set(JSON.stringify(flat),flat);
  }
  return [...sources.values()];
}

export function mergePlayerHistoryMatches(trainingMatches,...collections) {
  const trainingIds=new Set(trainingMatches.map(match=>id(match.id))),extra=new Map();
  for(const collection of collections)for(const match of Array.isArray(collection)?collection:[])
    if(!trainingIds.has(id(match.id)))extra.set(id(match.id),match);
  return [...extra.values()];
}

const APPEARANCE_FACT_FIELDS=['id','date','homeScore','awayScore','leagueId','leagueName','teamId','teamName',
  'minutes','starter','playedInMatch','appearanceEvidence','completedAt','finished','cancelled','awarded',
  'sourceUrl','detailStatus','reason'];
function appearanceFact(row,{cutoff,targetId}) {
  if(!row||!validId(row.id)||!row.home?.id||!row.away?.id||
    ![id(row.home.id),id(row.away.id)].includes(id(row.teamId))||!finishedBefore(row,cutoff,targetId))return null;
  const fact=Object.fromEntries(APPEARANCE_FACT_FIELDS.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
  fact.home={id:row.home.id,name:row.home.name??''};fact.away={id:row.away.id,name:row.away.name??''};
  return fact;
}

// Keep facts once, rather than nesting prior full histories on every refresh.
function retainHistoryEvidence(previous,current,{targetId}) {
  const sameContext=previous&&id(previous.playerId)===current.playerId&&timestamp(previous.cutoff)===timestamp(current.cutoff);
  const prior=sameContext?previous:null,context={cutoff:timestamp(current.cutoff),targetId};
  const facts=new Map();
  for(const row of [...(Array.isArray(prior?.knownAppearances)?prior.knownAppearances:[]),
    ...(Array.isArray(prior?.matches)?prior.matches:[]),...current.matches]) {
    const fact=appearanceFact(row,context);if(fact)facts.set(JSON.stringify(fact),fact);
  }
  const result={...current,knownAppearances:[...facts.values()],sources:mergeSourceProvenance(prior?.sources,current.sources),
    retainedMatchIds:[],retainedFromPrevious:false};
  if(prior&&current.selectionComplete===false) {
    const selected=new Map(current.matches.map(row=>[id(row.id),{...row,retainedFromPrevious:false}]));
    for(const row of Array.isArray(prior.matches)?prior.matches:[]) {
      const fact=appearanceFact(row,context);
      if(fact&&!selected.has(id(fact.id)))selected.set(id(fact.id),{...fact,retainedFromPrevious:true});
    }
    result.matches=[...selected.values()].sort((a,b)=>timestamp(b.date)-timestamp(a.date)||id(a.id).localeCompare(id(b.id))).slice(0,current.requested);
    result.retainedMatchIds=result.matches.filter(row=>row.retainedFromPrevious).map(row=>id(row.id));
    result.retainedFromPrevious=result.retainedMatchIds.length>0;
    result.status='partial';result.selectionComplete=false;result.reason=current.reason??'selection-incomplete';
  }
  return result;
}

function abortable(operation,signal) {
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(operation).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}

/** Three shared workers cover profile, pagination and detail requests together. */
export async function collectPlayerHistories({target,lineup,cutoff,requested=10,baseMatches=[],
  trainingMatchIds,previousHistories={},loadProfile,loadPage,loadMatch,policy={},signal:callerSignal}) {
  if(!Number.isFinite(timestamp(cutoff)))throw Error('Invalid player history cutoff');
  const durationMs=policy.durationMs??PLAYER_HISTORY_POLICY.durationMs;
  const maxPages=policy.maxPages??PLAYER_HISTORY_POLICY.maxPages;
  if(!Number.isFinite(durationMs)||durationMs<=0||!Number.isInteger(maxPages)||maxPages<0||
    !Number.isInteger(requested)||requested<=0||requested>10)throw Error('Invalid player history resource policy');
  const budget=new AbortController(),timer=setTimeout(()=>budget.abort(Error('time-budget')),durationMs);
  const signal=callerSignal?AbortSignal.any([budget.signal,callerSignal]):budget.signal;
  const players=new Map();
  for(const side of ['home','away'])for(const group of ['starters','bench','unavailable'])
    for(const player of lineup?.[side]?.[group]??[])if(validId(player.id))players.set(id(player.id),player);
  const history={},extras=new Map(),base=new Map(baseMatches.map(match=>[id(match.id),match])),pending=new Map();
  const trainingIds=new Set((trainingMatchIds??baseMatches.map(match=>match.id)).map(id));
  const before=timestamp(cutoff),targetId=target.id;
  const requestMatch=matchId=>{
    if(base.has(matchId))return Promise.resolve(base.get(matchId));
    if(!pending.has(matchId))pending.set(matchId,abortable(()=>loadMatch(matchId,{signal}),signal).then(match=>{
      if(id(match?.id)!==matchId)throw Error('match-identity-mismatch');
      if(!finishedBefore(match,before,targetId))throw Error('match-not-eligible');
      return match;
    }));
    return pending.get(matchId);
  };
  async function collectPlayer(playerId) {
    const result={playerId,cutoff,requested,matches:[],status:'partial',reason:null,sourceExhausted:false,
      selectionComplete:false,rejectedAppearances:[],sources:[]};
    history[playerId]=result;
    const selected=new Map(),seenRawIds=new Set();
    const latest=()=>[...selected.values()].sort((a,b)=>timestamp(b.date)-timestamp(a.date)||a.id.localeCompare(b.id)).slice(0,requested);
    try {
      const profile=await abortable(()=>loadProfile(playerId,{signal}),signal),data=profile?.data;
      result.sources.push(provenance(profile));
      if(id(data?.id)!==playerId)throw Error('profile-identity-mismatch');
      if(data.initialMatchesPage!==undefined&&!Array.isArray(data.initialMatchesPage?.matches))throw Error('malformed-profile');
      if(!Array.isArray(data.recentMatches)&&!Array.isArray(data.initialMatchesPage?.matches))throw Error('malformed-profile');
      const addRows=rows=>{
        let newIds=0;
        for(const raw of rows) {
          if(validId(raw?.id)&&!seenRawIds.has(id(raw.id))){seenRawIds.add(id(raw.id));newIds++;}
          const parsed=parseAppearanceSummary(raw,{cutoff,targetId});
          if(parsed.kind==='invalid') {
            if(!result.rejectedAppearances.some(row=>row.id===parsed.id&&row.reason===parsed.reason))result.rejectedAppearances.push({id:parsed.id,reason:parsed.reason});
            result.reason??='malformed-appearance';
          } else if(parsed.kind==='selected'&&!selected.has(parsed.match.id))selected.set(parsed.match.id,parsed.match);
        }
        return newIds;
      };
      addRows([...(data.recentMatches??[]),...(data.initialMatchesPage?.matches??[])]);
      let next=data.initialMatchesPage?.previous??null;
      if(!data.initialMatchesPage&&typeof data.matchesUrl==='string')next=data.matchesUrl.replace(/\{(?:leagueId|teamId)\}/g,'');
      if(!next&&data.initialMatchesPage)result.sourceExhausted=true;
      else if(!next&&selected.size<requested)result.reason='history-pagination-unavailable';
      const visited=new Set();let pages=0;
      while(selected.size<requested&&next) {
        const url=validatePlayerHistoryPageUrl(next,playerId);
        if(!url){result.reason='invalid-page-url';break;}
        if(visited.has(url)){result.reason='repeated-page';break;}
        if(pages>=maxPages){result.reason='page-budget';break;}
        visited.add(url);pages++;
        const snapshot=await abortable(()=>loadPage(url,{signal,playerId}),signal),page=snapshot?.data;
        result.sources.push(provenance(snapshot));
        if(!Array.isArray(page?.matches)){result.reason='malformed-page';break;}
        const progress=addRows(page.matches);next=page.previous??null;
        if(!next){result.sourceExhausted=true;break;}
        if(!progress){result.reason='no-progress';break;}
      }
    } catch(error) {
      result.reason=signal.aborted?String(signal.reason?.message||'cancelled'):String(error.message);
    }
    result.matches=latest().map(row=>({...row,detailStatus:'unavailable',reason:'not-acquired'}));
    result.selectionComplete=!result.reason&&(result.matches.length===requested||result.sourceExhausted);
    for(const row of result.matches) {
        try {
          const match=await requestMatch(row.id);
          if(!finishedBefore(match,before,targetId)||id(match.home?.id)!==id(row.home.id)||id(match.away?.id)!==id(row.away.id))throw Error('match-identity-mismatch');
          const record=match.players?.find(p=>id(p.id)===playerId&&id(p.teamId)===id(row.teamId));
          if(!record||!Object.entries(record.stats??{}).some(([key,value])=>key!=='minutes_played'&&finite(value)))throw Error('player-statistics-missing');
          // A shared download is only a candidate until an applicable selected appearance validates it.
          if(!trainingIds.has(row.id))extras.set(row.id,match);
          row.detailStatus='available';row.reason=null;row.starter=typeof record.starter==='boolean'?record.starter:null;
          if(row.minutes===null&&finite(record.minutes)&&record.minutes>0)row.minutes=record.minutes;
        } catch(error) {
          row.reason=signal.aborted?id(signal.reason?.message||'cancelled'):String(error.message);
          if(signal.aborted){result.reason=row.reason;break;}
        }
    }
    if(!result.reason&&result.matches.some(row=>row.detailStatus!=='available'))result.reason='detail-unavailable';
    if(!result.reason&&result.matches.some(row=>row.minutes===null))result.reason='missing-minutes';
    result.status=result.reason?'partial':result.matches.length===requested?'complete':result.sourceExhausted?'exhausted':'partial';
    return result;
  }
  try {
    const ids=[...players.keys()];let next=0;
    await Promise.all(Array.from({length:Math.min(PLAYER_HISTORY_POLICY.workers,ids.length)},async()=>{
      while(next<ids.length){const playerId=ids[next++];await collectPlayer(playerId);}
    }));
  } finally {clearTimeout(timer);}
  for(const playerId of Object.keys(history))history[playerId]=retainHistoryEvidence(previousHistories[playerId],history[playerId],{targetId});
  return {playerHistories:history,playerHistoryMatches:[...extras.values()],
    summary:{players:players.size,complete:Object.values(history).filter(h=>h.status==='complete').length,
      exhausted:Object.values(history).filter(h=>h.status==='exhausted').length,
      partial:Object.values(history).filter(h=>h.status==='partial').length,
      durationMs,maxPages,workers:PLAYER_HISTORY_POLICY.workers}};
}

export function buildLeagueCoverage(league,matches,{cutoff,targetId}) {
  const leagueId=league.details?.id??null,season=league.details?.selectedSeason??null,before=timestamp(cutoff);
  const fixtures=Array.isArray(league.fixtures?.allMatches)?league.fixtures.allMatches:[];
  const expected=new Set(fixtures.filter(fixture=>fixture.status?.finished===true&&finishedBefore({
    id:fixture.id,date:fixture.status.utcTime,completedAt:fixture.status.completedAt??fixture.status.finishedAt,
    finished:true,cancelled:fixture.status.cancelled,awarded:fixture.status.awarded,leagueId,
    homeScore:0,awayScore:0},before,targetId)).map(fixture=>id(fixture.id)));
  const acquired=new Set(),withPlayers=new Set();
  for(const match of matches)if(expected.has(id(match.id))&&id(match.leagueId)===id(leagueId)&&finishedBefore(match,before,targetId)) {
    acquired.add(id(match.id));
    if(match.players?.some(p=>finite(p.minutes)&&p.minutes>0&&Object.entries(p.stats??{}).some(([key,value])=>key!=='minutes_played'&&finite(value))))withPlayers.add(id(match.id));
  }
  const expectedMatchIds=[...expected].sort(),acquiredMatchIds=[...acquired].sort(),playerStatsMatchIds=[...withPlayers].sort();
  return {leagueId,season,cutoff,expectedMatchIds,acquiredMatchIds,playerStatsMatchIds,
    missingMatchIds:expectedMatchIds.filter(matchId=>!acquired.has(matchId)),
    missingPlayerStatsMatchIds:expectedMatchIds.filter(matchId=>!withPlayers.has(matchId)),
    complete:season!==null&&Array.isArray(league.fixtures?.allMatches)&&expected.size>0&&withPlayers.size===expected.size};
}
