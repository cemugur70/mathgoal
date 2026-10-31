import {buildPlayerProfile,playerMinutes} from './player-profile.mjs';
import {selectEligiblePlayerMatches} from './player-history.mjs';
// An explanatory within-league, within-position rank; never a goal probability.
export const RATING_METRICS=Object.freeze({
 0:['saves90','goalsPrevented90','passes90','rating'],
 1:['tackles90','interceptions90','defensiveActions90','passes90','rating'],
 2:['keyPasses90','xa90','passes90','tackles90','interceptions90','rating'],
 3:['xg90','goals90','shots90','keyPasses90','xa90','rating']
});
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const enough=p=>p.games>=3&&p.minutes>=180;

export function ratePlayerProfiles(profiles){
 const unique=[...new Map(profiles.filter(p=>p.playerId!=null||p.id!=null).map(p=>[String(p.playerId??p.id),p])).values()];
 const references=new Map();
 for(const p of unique){
  if(!enough(p)||p.position==null)continue;
  for(const key of RATING_METRICS[p.position]??[]){
   if(!finite(p[key]))continue;
   const group=`${p.position}:${key}`;
   if(!references.has(group))references.set(group,[]);
   references.get(group).push(p[key]);
  }
 }
 const byId={};
 for(const p of unique){
  const specs=p.position==null?[]:RATING_METRICS[p.position]??[];
  const components=specs.map(key=>{
   const values=references.get(`${p.position}:${key}`)??[],value=finite(p[key])?p[key]:null;
   const reason=value===null?'missing-metric':values.length<5?'insufficient-reference':null;
   const lower=reason?0:values.filter(v=>v<value).length,equal=reason?0:values.filter(v=>v===value).length;
   return {key,value,direction:'higher',referenceCount:values.length,percentile:reason?null:100*(lower+equal/2)/values.length,reason};
  });
  const valid=components.filter(c=>finite(c.percentile));
  const reason=!specs.length?'unknown-position':!enough(p)?'insufficient-appearances':valid.length<3?'insufficient-dimensions':null;
  byId[String(p.playerId??p.id)]={playerId:String(p.playerId??p.id),position:p.position,games:p.games,minutes:p.minutes,
   score:reason?null:valid.reduce((s,c)=>s+c.percentile,0)/valid.length,reason,components,metricCount:valid.length,totalMetrics:specs.length,
   reliability:p.minutes/(p.minutes+180),method:'position-percentiles-v1'};
 }
 return {byId,playerCount:unique.length};
}

export function buildLeagueRatings(bundle,{cutoff=bundle.analysisAt??bundle.target?.date,formCount=10}={}){
 const meta=bundle.leagueCoverage,target=bundle.target??{};
 const times=[target.date,bundle.analysisAt,cutoff].map(v=>typeof v==='number'?v:Date.parse(v)).filter(Number.isFinite),before=times.length?Math.min(...times):NaN;
 const unknown=reason=>({leagueId:target.leagueId??null,season:null,profiles:[],byId:{},coverage:{status:'unknown',reason,expected:null,acquired:0,withPlayerStats:0,missingMatchIds:[]}});
 if(!meta||String(meta.leagueId)!==String(target.leagueId)||typeof meta.season!=='string'||!meta.season.trim()||!Array.isArray(meta.expectedMatchIds))return unknown('season-evidence-missing');
 if(!Number.isFinite(before)||Date.parse(meta.cutoff)!==before)return unknown('coverage-cutoff-mismatch');
 const expected=new Set(meta.expectedMatchIds.map(String));
 const matches=[...selectEligiblePlayerMatches(bundle,before,target.id).values()]
  .filter(m=>expected.has(String(m.id))&&String(m.leagueId)===String(meta.leagueId));
 const acquired=new Set(matches.map(m=>String(m.id))),withPlayers=new Set(),rowsByPlayer=new Map();
 for(const match of matches){
  const seen=new Set();
  for(const record of match.players??[]){
   const id=record.id==null?null:String(record.id),minutes=playerMinutes(record);
   if(!id||seen.has(id)||!finite(minutes)||minutes<=0)continue;
   const home=String(record.teamId)===String(match.home.id),away=String(record.teamId)===String(match.away.id);
   if(!home&&!away)continue;
   seen.add(id);
   if(Object.values(record.stats??{}).some(finite))withPlayers.add(String(match.id));
   if(!rowsByPlayer.has(id))rowsByPlayer.set(id,[]);
   rowsByPlayer.get(id).push({record,minutes,match,opponent:home?match.away:match.home,venue:home?'home':'away',opponentFactor:1,opponentHistoryCount:0});
  }
 }
 const inventory=new Map((bundle.playerMetricInventory??[]).map(m=>[m.key,m]));
 const count=[5,10].includes(Number(formCount))?Number(formCount):10,profiles=[];
 for(const [id,rows]of rowsByPlayer){
  rows.sort((a,b)=>Date.parse(b.match.date)-Date.parse(a.match.date)||String(a.match.id).localeCompare(String(b.match.id)));
  const selected=rows.slice(0,count),latest=selected[0],team=String(latest.record.teamId)===String(latest.match.home.id)?latest.match.home:latest.match.away;
  profiles.push(buildPlayerProfile(team,id,selected,inventory));
 }
 const rated=ratePlayerProfiles(profiles),missingMatchIds=[...expected].filter(id=>!acquired.has(id)),missingPlayerStatsMatchIds=[...expected].filter(id=>!withPlayers.has(id));
 return {leagueId:meta.leagueId,season:meta.season,cutoff:new Date(before).toISOString(),formCount:count,profiles,byId:rated.byId,
  coverage:{status:missingMatchIds.length||missingPlayerStatsMatchIds.length?'partial':'complete',expected:expected.size,acquired:acquired.size,withPlayerStats:withPlayers.size,
   missingMatchIds,missingPlayerStatsMatchIds,source:meta.source??null},method:'position-percentiles-v1'};
}
