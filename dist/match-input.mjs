export function parseMatchId(input) {
  const value=String(input??'').trim();
  if(/^\d{4,12}$/.test(value))return value;
  try {
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||!/(^|\.)fotmob\.com$/i.test(url.hostname)||url.username||url.password)return null;
    return url.hash.match(/^#(\d{4,12})(?::|$)/)?.[1]??url.pathname.match(/^\/(?:match|matches)\/(\d{4,12})(?:\/|$)/)?.[1]??null;
  } catch {return null;}
}

export function matchContext(raw,observedAt=new Date().toISOString()) {
  const g=raw.general,status=raw.header?.status??{};
  if(!g?.homeTeam?.id||!g?.awayTeam?.id)throw Error('Hedef maç bilgisi eksik.');
  const date=new Date(g.matchTimeUTCDate||g.matchTimeUTC).toISOString();
  const collectedAt=new Date(observedAt).toISOString();
  const finished=g.finished===true&&status.finished!==false;
  const target={id:String(g.matchId),date,home:g.homeTeam,away:g.awayTeam,leagueId:g.leagueId,leagueName:g.leagueName,url:`https://www.fotmob.com/match/${g.matchId}`,started:!!g.started,finished,cancelled:!!status.cancelled};
  const scores=raw.header?.teams?.map(t=>t.score);
  const actual=finished&&scores?.length===2&&scores.every(Number.isFinite)?{score:status.scoreStr??`${scores[0]} - ${scores[1]}`,homeScore:scores[0],awayScore:scores[1]}:null;
  return {target,actual,collectedAt,analysisAt:new Date(Math.min(Date.parse(date),Date.parse(collectedAt))).toISOString()};
}
