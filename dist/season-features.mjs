// Season-to-date team features rebuilt from the archive as of each cutoff. FotMob season tables, player season totals and ratings are never read.
const finite=v=>typeof v==='number'&&Number.isFinite(v),stamp=v=>v==null?NaN:typeof v==='number'?v:Date.parse(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),DAY=86400000,LAG=10800000,LN2=Math.log(2);
export const SEASON_FEATURE_NAMES=Object.freeze(['played','ppg','gfPerGame','gaPerGame','xgFor','xgAgainst','finishing','concession','venuePpg','rank','shotsPerGame','sotPerGame','restDays','missingFraction'].map(n=>'season.'+n));
export const SEASON_POLICY=Object.freeze({version:'archive-league-season-to-date-v1',pseudoGames:5,maxMatches:38,minimumTargetMatches:3,minimumRankTeams:6,minimumLeagueRows:10,
 boundary:'1 Temmuz; takvim yılı liglerinde 1 Ocak',calendarLeagues:Object.freeze([51,59,67,126,130,182,223,268]),defaults:Object.freeze({ppg:1.35,goals:1.35,xg:1.3,shots:12,sot:4.2}),
 note:'Sezon değerleri arşivdeki tamamlanmış lig maçlarından kesim anına göre yeniden hesaplanır; aynı sezondaki kupa / Avrupa maçları yalnız dinlenme gününe girer.'});
const STAT_KEYS={xg:['expected_goals'],shots:['total_shots','shots'],sot:['ShotsOnTarget','shots_on_target']};
const pair=(m,keys)=>{for(const key of keys){const v=m.stats?.[key]?.values;if(Array.isArray(v)&&v.length===2&&v.every(x=>finite(x)&&x>=0))return v;}return null;};
export function seasonKey(leagueId,date,calendar=false){const t=stamp(date);if(!finite(t)||leagueId==null)return null;const d=new Date(t),y=d.getUTCFullYear(),m=d.getUTCMonth();return `${leagueId}:${calendar?y:m>=6?y:y-1}`;}
/** Calendar-year leagues: explicit list plus archives whose May–June fixtures continue into July–August within 50 days. */
export function detectCalendarLeagues(matches){
 const out=new Set(SEASON_POLICY.calendarLeagues),dates=new Map();
 for(const m of matches??[]){const t=stamp(m?.date);if(!finite(t)||m.leagueId==null)continue;const id=Number(m.leagueId);if(!dates.has(id))dates.set(id,[]);dates.get(id).push(t);}
 for(const [id,list] of dates){if(out.has(id))continue;const sorted=[...new Set(list)].sort((a,b)=>a-b);
  for(let i=1;i<sorted.length;i++){const a=new Date(sorted[i-1]),b=new Date(sorted[i]);
   if(a.getUTCMonth()>=4&&a.getUTCMonth()<=5&&b.getUTCMonth()>=6&&b.getUTCMonth()<=7&&a.getUTCFullYear()===b.getUTCFullYear()&&sorted[i]-sorted[i-1]<=50*DAY){out.add(id);break;}}}
 return out;
}
const points=r=>r.gf>r.ga?3:r.gf===r.ga?1:0,sum=(rows,f)=>rows.reduce((s,r)=>s+f(r),0);
const logRatio=(value,reference)=>clamp(Math.log((value+.1)/(reference+.1)),-1,1);
export function createSeasonFeatureIndex(matches){
 const byId=new Map(),conflicts=new Set();
 for(const m of matches??[]){if(m?.id==null||!m.home?.id||!m.away?.id||String(m.home.id)===String(m.away.id)||m.finished===false||m.cancelled||m.awarded||[489,114].includes(Number(m.leagueId))||![m.homeScore,m.awayScore].every(v=>Number.isInteger(v)&&v>=0&&v<=100)||!finite(stamp(m.date)))continue;
  const id=String(m.id),previous=byId.get(id);if(previous&&(m.homeScore!==previous.homeScore||m.awayScore!==previous.awayScore||m.date!==previous.date||String(m.home.id)!==String(previous.home.id)||String(m.away.id)!==String(previous.away.id))){conflicts.add(id);continue;}
  if(!previous||Object.keys(m.stats??{}).length>Object.keys(previous.stats??{}).length)byId.set(id,m);
 }
 for(const id of conflicts)byId.delete(id);
 const calendar=detectCalendarLeagues([...byId.values()]),teams=new Map(),seasons=new Map();
 for(const m of byId.values()){const start=stamp(m.date),end=stamp(m.completedAt??m.finishedAt??m.endDate),available=finite(end)?end:start+LAG;if(available<start)continue;
  const season=seasonKey(m.leagueId,start,calendar.has(Number(m.leagueId))),xg=pair(m,STAT_KEYS.xg),shots=pair(m,STAT_KEYS.shots),sot=pair(m,STAT_KEYS.sot);
  [m.home,m.away].forEach((team,i)=>{const teamId=String(team.id),row={id:String(m.id),teamId,start,available,leagueId:Number(m.leagueId),season,home:i===0,
   gf:i===0?m.homeScore:m.awayScore,ga:i===0?m.awayScore:m.homeScore,xgFor:xg?xg[i]:null,xgAgainst:xg?xg[1-i]:null,shots:shots?shots[i]:null,sot:sot?sot[i]:null};
   if(!teams.has(teamId))teams.set(teamId,[]);teams.get(teamId).push(row);if(season){if(!seasons.has(season))seasons.set(season,[]);seasons.get(season).push(row);}});
 }
 for(const rows of teams.values())rows.sort((a,b)=>b.start-a.start||a.id.localeCompare(b.id));
 const contexts=new Map(),k=SEASON_POLICY.pseudoGames,D=SEASON_POLICY.defaults;
 return {size:byId.size,calendarLeagues:[...calendar].sort((a,b)=>a-b),seasonKey:(leagueId,date)=>seasonKey(leagueId,date,calendar.has(Number(leagueId))),
  features(target,{cutoff=target.date}={}){
   const before=stamp(cutoff),targetId=String(target.id),season=finite(before)?seasonKey(target.leagueId,before,calendar.has(Number(target.leagueId))):null;
   const contextKey=[targetId,target.home?.id,target.away?.id,target.leagueId,cutoff].join(':');if(contexts.has(contextKey))return contexts.get(contextKey);
   const prior=r=>r.id!==targetId&&r.start<before&&r.available<before,evidence=new Map(),use=r=>{evidence.set(r.id,r.available);return r;};
   const pool=(seasons.get(season)??[]).filter(prior),byTeam=new Map();for(const r of pool){if(!byTeam.has(r.teamId))byTeam.set(r.teamId,[]);byTeam.get(r.teamId).push(r);}
   const meanOf=(rows,f,fallback)=>{const xs=rows.filter(r=>finite(f(r)));return xs.length?sum(xs,f)/xs.length:fallback;};
   const L=pool.length>=SEASON_POLICY.minimumLeagueRows?{ppg:sum(pool,points)/pool.length,goals:sum(pool,r=>r.gf)/pool.length,xg:meanOf(pool,r=>r.xgFor,D.xg),shots:meanOf(pool,r=>r.shots,D.shots),sot:meanOf(pool,r=>r.sot,D.sot)}:{...D};
   const table=[...byTeam.entries()].map(([teamId,rows])=>({teamId,ppg:sum(rows,points)/rows.length,games:rows.length})).sort((a,b)=>b.ppg-a.ppg||a.teamId.localeCompare(b.teamId));
   const ranked=table.length>=SEASON_POLICY.minimumRankTeams;if(ranked)pool.forEach(use);
   const sides={};
   for(const side of ['home','away']){const teamId=String(target[side]?.id),all=(teams.get(teamId)??[]).filter(prior),rows=season===null?[]:all.filter(r=>r.season===season).map(use);
    const n=rows.length,missing=[],v=name=>{missing.push(name);return 0;};
    const shrunk=(xs,f,reference)=>(sum(xs,f)+k*reference)/(xs.length+k);
    const xgRows=rows.filter(r=>finite(r.xgFor)&&finite(r.xgAgainst)),shotRows=rows.filter(r=>finite(r.shots)),sotRows=rows.filter(r=>finite(r.sot)),venueRows=rows.filter(r=>r.home===(side==='home'));
    const finishing=(gf,xg,count)=>clamp(Math.log((gf+.5)/(xg+.5)),-LN2,LN2)/LN2*(count/(count+k));
    const rankIndex=table.findIndex(t=>t.teamId===teamId),last=all[0]?use(all[0]):null;
    const vector=[Math.min(n,SEASON_POLICY.maxMatches)/SEASON_POLICY.maxMatches,
     n?clamp((shrunk(rows,points,L.ppg)-L.ppg)/1.5,-1,1):v('ppg'),
     n?logRatio(shrunk(rows,r=>r.gf,L.goals),L.goals):v('gfPerGame'),
     n?logRatio(shrunk(rows,r=>r.ga,L.goals),L.goals):v('gaPerGame'),
     xgRows.length?logRatio(shrunk(xgRows,r=>r.xgFor,L.xg),L.xg):v('xgFor'),
     xgRows.length?logRatio(shrunk(xgRows,r=>r.xgAgainst,L.xg),L.xg):v('xgAgainst'),
     xgRows.length?finishing(sum(xgRows,r=>r.gf),sum(xgRows,r=>r.xgFor),xgRows.length):v('finishing'),
     xgRows.length?finishing(sum(xgRows,r=>r.ga),sum(xgRows,r=>r.xgAgainst),xgRows.length):v('concession'),
     venueRows.length?clamp((shrunk(venueRows,points,L.ppg)-L.ppg)/1.5,-1,1):v('venuePpg'),
     ranked&&rankIndex>=0?1-2*rankIndex/(table.length-1):v('rank'),
     shotRows.length?logRatio(shrunk(shotRows,r=>r.shots,L.shots),L.shots):v('shotsPerGame'),
     sotRows.length?logRatio(shrunk(sotRows,r=>r.sot,L.sot),L.sot):v('sotPerGame'),
     last?clamp((before-last.start)/DAY,0,14)/14-.5:v('restDays')];
    vector.push(missing.length/(SEASON_FEATURE_NAMES.length-2));
    sides[side]={vector,matches:n,withXg:xgRows.length,venueMatches:venueRows.length,rank:ranked&&rankIndex>=0?rankIndex+1:null,points:sum(rows,points),goalsFor:sum(rows,r=>r.gf),goalsAgainst:sum(rows,r=>r.ga),
     lastMatchAt:last?new Date(last.start).toISOString():null,missing,matchIds:rows.map(r=>r.id)};
   }
   const ready=['home','away'].every(s=>sides[s].matches>=SEASON_POLICY.minimumTargetMatches),times=[...evidence.values()];
   const result={home:sides.home.vector,away:sides.away.vector,summaries:sides,season,calendar:calendar.has(Number(target.leagueId)),leagueMeans:L,
    coverage:{status:ready?'ready':'insufficient',homeMatches:sides.home.matches,awayMatches:sides.away.matches,leagueTeams:table.length,leagueRows:pool.length,ranked,
     reason:ready?'Sezon-içi lig değerleri her iki takım için kesim öncesi arşivden hesaplandı.':'Her takım için aynı sezonda en az '+SEASON_POLICY.minimumTargetMatches+' tamamlanmış lig maçı gerekli.'},
    evidence:{maxAvailableAt:times.length?new Date(Math.max(...times)).toISOString():null,matchIds:[...evidence.keys()].sort(),usesTargetOutcome:false,
     completeness:'archive-only',note:'Sıra ve lig ortalamaları yalnız arşivdeki takımlar arasında hesaplanır; resmi puan tablosu değildir.'}};
   if(contexts.size>=16)contexts.clear();contexts.set(contextKey,result);return result;
  }};
}
