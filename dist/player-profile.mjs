// Canonical normalized-player metrics shared by personal, team and league profiles.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const at=v=>new Date(v).getTime();
const mean=xs=>{const v=xs.filter(finite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
const sum=xs=>{const v=xs.filter(finite);return v.length?v.reduce((a,b)=>a+b,0):null;};
const ALIASES={
  goals:['goals'],assists:['assists'],xg:['expected_goals'],xa:['expected_assists'],
  shots:['total_shots'],shotsOnTarget:['shots_on_target','ShotsOnTarget'],
  keyPasses:['chances_created','key_passes'],passes:['accurate_passes'],
  touches:['touches'],touchesBox:['touches_opp_box'],
  tackles:['matchstats.headers.tackles','tackles','won_tackle'],
  interceptions:['interceptions'],defensiveActions:['defensive_actions'],
  saves:['saves','keeper_saves'],goalsPrevented:['goals_prevented'],
  rating:['rating_title','rating'],minutes:['minutes_played']
};
const POSITION_NAMES=['Kaleci','Defans','Orta saha','Forvet'];
function value(stats,keys) {for(const key of keys) if(finite(stats?.[key]))return stats[key];return null;}
export function playerPosition(p) {
  if(p.isGoalkeeper)return 0;
  const raw=p.position??p.usualPosition??p.usualPlayingPositionId;
  if(raw==null||raw==='')return null;
  const candidate=Number(raw);
  return [0,1,2,3].includes(candidate)?candidate:null;
}
export function playerMinutes(p) {const m=finite(p.minutes)?p.minutes:value(p.stats,ALIASES.minutes);return finite(m)&&m>=0?m:null;}
function nonCount(key,type) {
  if(/fraction/i.test(type??''))return false; // A fraction's value is its count numerator.
  return key==='minutes_played'||/rating|percentage|percent|accuracy|speed|distance|height|weight|fantasy|plus_minus/i.test(key)||/^(boolean|percentage|percent|speed|distance)$/i.test(type??'');
}
function additive(key,type) {
  if(/fraction|distance/i.test(type??''))return true;
  return !/rating|percentage|percent|accuracy|speed|height|weight|fantasy|plus_minus/i.test(key)&&!/^(boolean|percentage|percent|speed)$/i.test(type??'');
}
function summarize(rows,inventory) {
  const metricKeys=new Set(rows.flatMap(r=>Object.keys(r.record.stats??{}))),metrics={};
  for(const key of metricKeys) {
    const observed=rows.filter(r=>finite(r.record.stats?.[key]));
    const label=inventory.get(key)??{};
    const countLike=!nonCount(key,label.type);
    const timed=observed.filter(r=>finite(r.minutes)&&r.minutes>0);
    const minutesCovered=timed.reduce((s,r)=>s+r.minutes,0);
    const total=sum(observed.map(r=>r.record.statTotals?.[key]??r.record.labels?.[key]?.total));
    const numerator=sum(observed.map(r=>r.record.stats[key]));
    const weighted=timed.reduce((s,r)=>s+r.record.stats[key]*r.minutes,0);
    metrics[key]={key,title:label.title??rows.find(r=>r.record.labels?.[key])?.record.labels?.[key]?.title??key,
      group:label.group??rows.find(r=>r.record.labels?.[key])?.record.labels?.[key]?.group??'',type:label.type??null,
      sum:additive(key,label.type)?numerator:null,average:mean(observed.map(r=>r.record.stats[key])),
      minuteWeightedAverage:minutesCovered?weighted/minutesCovered:null,
      per90:countLike&&minutesCovered?timed.reduce((s,r)=>s+r.record.stats[key],0)*90/minutesCovered:null,
      totalSum:total,ratio:finite(total)&&total>0&&finite(numerator)?numerator/total:null,
      games:observed.length,minutesCovered,coverage:rows.length?observed.length/rows.length:0};
  }
  return metrics;
}
function pickMetric(metrics,keys) {for(const key of keys)if(metrics[key]?.games>0)return metrics[key];return null;}
/** Canonical alias evidence for consumers; missing measurements remain explicit unknowns. */
export function playerMetricEvidence(profile,alias) {
  const per90=alias.endsWith('90'),name=per90?alias.slice(0,-2):alias;
  const metric=pickMetric(profile?.metrics??{},ALIASES[name]??[]);
  const observed=per90?metric?.per90:name==='rating'?(metric?.minuteWeightedAverage??metric?.average):metric?.sum;
  return {alias,key:metric?.key??null,value:finite(observed)?observed:null,
    games:metric?.games??0,minutesCovered:metric?.minutesCovered??0,coverage:metric?.coverage??0};
}
export function buildPlayerProfile(team,playerId,rows,inventory=new Map(),identity={}) {
  rows=[...rows].sort((a,b)=>at(b.match.date)-at(a.match.date));
  const latest=rows[0]?.record??identity,metrics=summarize(rows,inventory),aliases={};
  for(const [name,keys]of Object.entries(ALIASES)) {
    const metric=pickMetric(metrics,keys);
    aliases[`${name}90`]=metric?.per90??null;
    aliases[name]=name==='rating'?(metric?.minuteWeightedAverage??metric?.average??null):metric?.sum??null;
  }
  const minutes=rows.reduce((s,r)=>s+(r.minutes??0),0),pos=playerPosition(latest);
  // Every context factor uses the opponent's history before that individual match.
  const contextMetrics={};
  for(const [alias,keys]of [['xg',ALIASES.xg],['xa',ALIASES.xa]]) {
    const covered=rows.filter(r=>finite(value(r.record.stats,keys))&&finite(r.minutes)&&r.minutes>0);
    const mins=covered.reduce((s,r)=>s+r.minutes,0);
    contextMetrics[`${alias}90`]=mins?covered.reduce((s,r)=>s+value(r.record.stats,keys)*r.opponentFactor,0)*90/mins:null;
  }
  const matches=rows.map(r=>({matchId:r.match.id,date:r.match.date,opponent:r.opponent,
    teamId:r.record.teamId,playedForTeam:String(r.record.teamId)===String(r.match.home.id)?r.match.home:r.match.away,
    detailStatus:r.detailStatus??'available',detailReason:r.detailReason??null,opponentPlayers:r.opponentPlayers??[],
    home:r.match.home,away:r.match.away,score:`${r.match.homeScore}–${r.match.awayScore}`,
    homeScore:r.match.homeScore,awayScore:r.match.awayScore,venue:r.venue,minutes:r.minutes,
    starter:r.record.starter===true,stats:r.record.stats??{},opponentFactor:r.opponentFactor,
    opponentHistoryCount:r.opponentHistoryCount,url:r.match.url??`https://www.fotmob.com/match/${r.match.id}`}));
  return {id:playerId,playerId,teamId:team.id,teamName:team.name,name:latest.name??String(playerId),
    key:`${team.id}:${playerId}`,position:pos,positionName:POSITION_NAMES[pos]??'Bilinmiyor',
    isGoalkeeper:pos===0,games:rows.length,appearances:rows.filter(r=>(finite(r.minutes)&&r.minutes>0)||r.record.playedInMatch===true).length,
    starts:rows.filter(r=>r.record.starter===true).length,missingMinutes:rows.filter(r=>r.minutes===null).length,
    lastDate:rows[0]?.match.date??null,metrics,stats:metrics,...aliases,minutes,contextMetrics,matches,
    reliability:minutes/(minutes+180),url:`https://www.fotmob.com/players/${playerId}`};
}
