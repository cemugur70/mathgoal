// Identical historical/live feature builder: target outcomes and actual post-match XI are never read.
import {playerPosition,playerMinutes} from './player-profile.mjs';
export const STARTER_CHANNELS=['attack','creation','passing','defense','duels','keeper'];
export const STARTER_FEATURE_NAMES=Object.freeze([
 ...Array.from({length:11},(_,i)=>[...STARTER_CHANNELS,'missing','position'].map(c=>`xi.${i+1}.${c}`)).flat(),
 ...STARTER_CHANNELS.map(c=>`opponentXI.${c}`),...STARTER_CHANNELS.map(c=>`opponentXI.${c}.missing`),'xi.historyFraction'
]);
const SPECS={
 xg:{keys:['expected_goals'],scale:.6},goals:{keys:['goals'],scale:.6},shots:{keys:['total_shots'],scale:4},
 sot:{keys:['shots_on_target','ShotsOnTarget'],scale:2},xgot:{keys:['expected_goals_on_target_variant','expected_goals_on_target'],scale:.6},
 xa:{keys:['expected_assists'],scale:.35},chances:{keys:['chances_created','key_passes'],scale:3},assists:{keys:['assists'],scale:.35},
 passes:{keys:['accurate_passes'],scale:50},crosses:{keys:['accurate_crosses'],scale:3},longBalls:{keys:['long_balls_accurate'],scale:6},
 tackles:{keys:['matchstats.headers.tackles','tackles','won_tackle'],scale:3},interceptions:{keys:['interceptions'],scale:2},
 defensiveActions:{keys:['defensive_actions'],scale:12},clearances:{keys:['clearances'],scale:5},blocks:{keys:['shot_blocks'],scale:2},
 duels:{keys:['duel_won','duels_won'],scale:7},ground:{keys:['ground_duels_won'],scale:5},aerial:{keys:['aerials_won'],scale:4},
 dribbles:{keys:['dribbles_succeeded','won_contest'],scale:3},saves:{keys:['saves','keeper_saves'],scale:4},
 prevented:{keys:['goals_prevented'],scale:.7}
};
const PARTS={attack:[['xg',.4],['goals',.1],['shots',.15],['sot',.15],['xgot',.2]],
 creation:[['xa',.5],['chances',.35],['assists',.15]],passing:[['passes',.7],['crosses',.15],['longBalls',.15]],
 defense:[['tackles',.25],['interceptions',.2],['defensiveActions',.3],['clearances',.15],['blocks',.1]],
 duels:[['duels',.4],['ground',.2],['aerial',.2],['dribbles',.2]],keeper:[['saves',.4],['prevented',.6]]};
const stamp=v=>v==null?NaN:typeof v==='number'?v:Date.parse(v),finite=Number.isFinite;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),key=(league,id)=>`${league}:${id}`;
export function starterVector(own,opponent,historyFraction){
 const sorted=[...own].sort((a,b)=>(a.position??4)-(b.position??4)||b.minutes-a.minutes||a.id.localeCompare(b.id));
 const slots=[];for(let i=0;i<11;i++){const p=sorted[i];slots.push(...STARTER_CHANNELS.map(c=>p?.channels[c]??0),p?STARTER_CHANNELS.reduce((s,c)=>s+p.missing[c],0)/6:1,p?.position==null?-1:p.position/3);}
 const summarize=(c,missing)=>{const relevant=opponent.filter(p=>c==='keeper'?p.position===0:p.position!==0);return relevant.length?relevant.reduce((s,p)=>s+(missing?p.missing[c]:p.channels[c]),0)/relevant.length:missing?1:0;};
 return [...slots,...STARTER_CHANNELS.map(c=>summarize(c,false)),...STARTER_CHANNELS.map(c=>summarize(c,true)),historyFraction];
}
export function createStarterFeatureIndex(matches){
 const teams=new Map(),allTeams=new Map(),players=new Map(),positions=new Map(),seen=new Set();
 for(const m of matches??[]){
  const start=stamp(m.date),end=stamp(m.completedAt??m.finishedAt??m.endDate),available=finite(end)?end:start+10800000;
  if(m.id==null||seen.has(String(m.id))||m.leagueId==null||m.finished===false||m.cancelled||m.awarded||[489,114].includes(Number(m.leagueId))||
   !finite(start)||!finite(available)||available<start||!finite(m.homeScore)||!finite(m.awayScore))continue;
  seen.add(String(m.id));const fact={id:String(m.id),start,available,league:m.leagueId,home:m.home,away:m.away,players:[]},ids=new Set();
  for(const p of m.players??[]){const minutes=playerMinutes(p),id=String(p.id);
   const position=playerPosition(p);
   if(p.id!=null&&position!==null&&[String(m.home.id),String(m.away.id)].includes(String(p.teamId))){
    if(!positions.has(id))positions.set(id,[]);
    positions.get(id).push({position,teamId:String(p.teamId),fact});
   }
   if(p.id==null||ids.has(id)||!(minutes>=0)||minutes===0&&typeof p.starter!=='boolean'||![String(m.home.id),String(m.away.id)].includes(String(p.teamId)))continue;
   ids.add(id);const row={...p,id,minutes,position:playerPosition(p),fact};fact.players.push(row);
   const pk=key(m.leagueId,id);if(minutes>0){if(!players.has(pk))players.set(pk,[]);players.get(pk).push(row);}
  }
  for(const t of [m.home,m.away]){const tk=key(m.leagueId,t.id);if(!teams.has(tk))teams.set(tk,[]);teams.get(tk).push(fact);
   const id=String(t.id);if(!allTeams.has(id))allTeams.set(id,[]);allTeams.get(id).push(fact);}
 }
 for(const rows of teams.values())rows.sort((a,b)=>b.start-a.start||a.id.localeCompare(b.id));
 for(const rows of allTeams.values())rows.sort((a,b)=>b.start-a.start||a.id.localeCompare(b.id));
 for(const rows of players.values())rows.sort((a,b)=>b.fact.start-a.fact.start||a.fact.id.localeCompare(b.fact.id));
 for(const rows of positions.values())rows.sort((a,b)=>b.fact.start-a.fact.start||a.fact.id.localeCompare(b.fact.id));
 function features(target,{cutoff=target.date,formCount=10,lineup=null,analysisAt=cutoff,scenarioRosters=null,playerScenarios={}}={}){
  const before=stamp(cutoff),used=new Map();
  const eligible=f=>f.id!==String(target.id)&&f.start<before&&f.available<before;
  const track=f=>used.set(f.id,f);
  const verified=lineup&&String(lineup.matchId)===String(target.id)&&lineup.eligibleForModel===true&&
   finite(stamp(lineup.observedAt))&&stamp(lineup.observedAt)<before&&
   stamp(analysisAt)<=before&&!target.started&&!target.finished;
  function team(side){
   const t=target[side],window=(teams.get(key(target.leagueId,t.id))??[]).filter(eligible).slice(0,formCount);
   const recent=(allTeams.get(String(t.id))??[]).filter(eligible).slice(0,Math.max(formCount,10)),latest=recent[0];
   const own=f=>f.players.filter(p=>String(p.teamId)===String(t.id));
   const previousRosterIds=new Set(latest?own(latest).map(p=>String(p.id)):[]);
   let roster=latest?own(latest).filter(p=>p.starter===true):[],type=roster.length===11?'lastStarting11':'previousXI-incomplete';
   if(latest)track(latest);
   const candidates=new Map();for(const f of recent){track(f);for(const p of own(f))if(!candidates.has(p.id))candidates.set(p.id,p);}
   const sourceAbsences=verified?(lineup[side]?.unavailable??[]):[];
   for(const p of sourceAbsences)if(p.id!=null&&!candidates.has(String(p.id)))candidates.set(String(p.id),p);
   const absences=new Map(sourceAbsences.filter(p=>p.id!=null).map(p=>[String(p.id),{id:String(p.id),name:p.name,reason:p.reason??'unavailable',source:'pre-match-source',observedAt:lineup.observedAt}]));
   for(const [id,state]of Object.entries(playerScenarios)){if(state==='out'&&candidates.has(id))absences.set(id,{id,name:candidates.get(id).name,reason:'Kullanıcının sakat / eksik senaryosu',source:'user-scenario'});if(state==='in')absences.delete(id);}
   const profile=p=>{
    const rows=(players.get(key(target.leagueId,p.id))??[]).filter(r=>eligible(r.fact)).slice(0,formCount),metrics={};
    let minutes=0;for(const r of rows){track(r.fact);minutes+=r.minutes;}
    for(const [name,s]of Object.entries(SPECS)){
     let total=0,exposure=0,games=0;
     for(const r of rows){const v=s.keys.map(k=>r.stats?.[k]).find(v=>typeof v==='number'&&finite(v));if(v==null)continue;
      const decay=Math.pow(.5,(before-r.fact.available)/86400000/120);total+=v*decay;exposure+=r.minutes*decay;games++;}
     const per90=exposure?90*total/exposure:null;metrics[name]={per90,games,minutesCovered:exposure,reliability:exposure/(exposure+270)};
    }
    let pos=playerPosition(p)??rows[0]?.position??null,positionEvidence=null;
    if(pos===null){
     const known=(positions.get(String(p.id))??[]).filter(r=>eligible(r.fact));
     const prior=known.find(r=>r.teamId===String(t.id))??known[0];
     if(prior){pos=prior.position;track(prior.fact);positionEvidence={source:'prior-official-match-roster',matchId:prior.fact.id,date:new Date(prior.fact.start).toISOString(),availableAt:new Date(prior.fact.available).toISOString(),teamId:prior.teamId,position:pos};}
    }
    const channels={},missing={};
    for(const c of STARTER_CHANNELS){if(c==='keeper'&&pos!==0){channels[c]=0;missing[c]=0;continue;}
     let sum=0,weight=0;for(const [name,w]of PARTS[c]){const m=metrics[name];if(m.per90!==null){sum+=w*m.per90*m.reliability/SPECS[name].scale;weight+=w;}}
     channels[c]=clamp(weight?sum/weight:0,-3,3);missing[c]=1-weight;
    }
    return {id:String(p.id),name:p.name??rows[0]?.name??String(p.id),position:pos,positionEvidence,games:rows.length,minutes,metrics,channels,missing,
     unavailable:absences.has(String(p.id)),absence:absences.get(String(p.id))??null,inPreviousMatch:previousRosterIds.has(String(p.id)),
     eligible:!absences.has(String(p.id))&&(previousRosterIds.has(String(p.id))||playerScenarios[String(p.id)]==='in')};
   };
   const poolProfiles=[...candidates.values()].map(profile),byId=new Map(poolProfiles.map(p=>[p.id,p]));
   const baselineProfiles=roster.map(p=>byId.get(String(p.id))??profile(p)),selected=[...baselineProfiles],replacements=[];
   const priority=p=>p.minutes+90*p.games+90*(p.channels.attack+p.channels.creation+p.channels.defense+p.channels.keeper);
   for(let i=0;i<selected.length;i++)if(selected[i].unavailable){const missing=selected[i],replacement=poolProfiles.filter(p=>p.eligible&&p.position===missing.position&&!selected.some(s=>s.id===p.id)&&p.minutes>0).sort((a,b)=>priority(b)-priority(a)||a.id.localeCompare(b.id))[0];
    replacements.push({outId:missing.id,outName:missing.name,inId:replacement?.id??null,inName:replacement?.name??null,position:missing.position,reason:missing.absence.reason,source:missing.absence.source});
    selected[i]=replacement??null;
   }
   if(Array.isArray(scenarioRosters?.[side])){roster=scenarioRosters[side];type='scenario';}
   const profiles=(type==='scenario'?roster.map(p=>byId.get(String(p.id))??profile(p)):selected.filter(Boolean)).sort((a,b)=>(a.position??4)-(b.position??4)||b.minutes-a.minutes||a.id.localeCompare(b.id));
   const slots=starterVector(profiles,[],0).slice(0,88);
   const units=STARTER_CHANNELS.map(c=>{const relevant=profiles.filter(p=>c==='keeper'?p.position===0:p.position!==0);return relevant.length?relevant.reduce((s,p)=>s+p.channels[c],0)/relevant.length:0;});
   const missing=STARTER_CHANNELS.map(c=>{const relevant=profiles.filter(p=>c==='keeper'?p.position===0:p.position!==0);return relevant.length?relevant.reduce((s,p)=>s+p.missing[c],0)/relevant.length:1;});
   return {teamId:t.id,name:t.name,type,observedAt:verified?lineup.observedAt:null,sourceMatchId:latest?.id??null,sourceMatchDate:latest?new Date(latest.start).toISOString():null,
    baselineProfiles,poolProfiles,absences:[...absences.values()],replacements,ignoredSourceAbsences:!verified&&(lineup?.[side]?.unavailable?.length??0)>0,
    profiles,slots,units,missing,historyGames:window.length,coverage:Math.min(1,profiles.length/11),withHistory:profiles.filter(p=>p.games>0).length,
    note:type==='scenario'?'Kullanıcının kadro senaryosu':type==='lastStarting11'?'Bir önceki resmî maçın ilk 11’i; bilinen eksikler yerine aynı mevkiden geçmişi olan aday yedek kullanılır.':'Bir önceki resmî maçın ilk 11 kaydı eksik; eksik oyuncu uydurulmaz.'};
  }
  const h=team('home'),a=team('away');
  const vector=(own,opp)=>starterVector(own.profiles,opp.profiles,Math.min(1,own.historyGames/formCount));
  const available=[...used.values()].map(f=>f.available);if(verified)available.push(stamp(lineup.observedAt));
  return {home:vector(h,a),away:vector(a,h),teams:{home:h,away:a},evidence:{maxAvailableAt:available.length?new Date(Math.max(...available)).toISOString():null,
   matchIds:[...used.keys()].sort(),usesTargetOutcome:false,usesPostMatchLineup:false,selectionPolicy:'previous-official-xi-availability-position-v3',formCount}};
 }
 return {features};
}
