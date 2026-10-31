import {normalizeMatchPlayers} from './player-data.mjs';

// One owning parser for both team-archive and personal-history match records.
export function normalizeMatch(raw,playerMetricInventory=new Map()) {
  const general=raw.general,stats={},periods={};
  if(!general?.matchId||!general.homeTeam?.id||!general.awayTeam?.id)throw Error('Maç kimliği veya takım bilgisi eksik.');
  for(const [period,body] of Object.entries(raw.content?.stats?.Periods||{})) {
    const values={};
    for(const group of body?.stats||[])for(const metric of group?.stats||[]) {
      if(!metric?.key||metric.type==='title'||!metric.stats?.some(value=>value!=null))continue;
      values[metric.key]={title:metric.title,group:group.title,
        values:[0,1].map(index=>{
          const value=metric.rawStats?.[index]?.value??metric.stats?.[index];
          if(value==null||value==='')return null;
          const number=typeof value==='number'?value:Number(String(value).replace('%','').replace(',','.'));
          return Number.isFinite(number)?number:null;
        }),display:metric.stats.map(value=>value==null?'—':String(value)),
        totals:[0,1].map(index=>metric.rawStats?.[index]?.total??null)};
    }
    periods[period]=values;
  }
  Object.assign(stats,periods.All||{});
  return {id:String(general.matchId),date:new Date(general.matchTimeUTCDate||general.matchTimeUTC).toISOString(),
    home:general.homeTeam,away:general.awayTeam,homeScore:raw.header?.teams?.[0]?.score,awayScore:raw.header?.teams?.[1]?.score,
    leagueId:general.leagueId,leagueName:general.leagueName,finished:general.finished,started:general.started,
    cancelled:general.cancelled,awarded:general.awarded,stats,periods,url:`https://www.fotmob.com/match/${general.matchId}`,
    coverageLevel:general.coverageLevel,players:normalizeMatchPlayers(raw,playerMetricInventory),rawFile:`matchDetails-${general.matchId}.json`,
    extras:{shotmap:!!raw.content?.shotmap,lineup:!!raw.content?.lineup,playerStats:!!raw.content?.playerStats,momentum:!!raw.content?.momentum}};
}
