// Comparison only: source observations remain independent, with no overwrite,
// fuzzy identity matching, probability training or model activation.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const timestamp=v=>v==null?NaN:typeof v==='number'?v:Date.parse(v);
const iso=v=>finite(timestamp(v))?new Date(timestamp(v)).toISOString():null;
const id=v=>v==null?null:String(v);
const fold=value=>String(value??'').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^\p{L}\p{N}]/gu,'');
const PLAYER_ALIASES={shots_on_target:['ShotsOnTarget'],offside:['Offsides'],tackles:['matchstats.headers.tackles'],
 blocks:['shot_blocks'],key_passes:['chances_created'],big_chance_created:['big_chance_created_team_title'],
 big_chance_missed:['big_chance_missed_title'],errors_lead_to_shot:['errors_led_to_shot'],errors_lead_to_goal:['errors_led_to_goal']};
const TEAM_ALIASES={ball_possession:['BallPossesion'],shots_on_target:['ShotsOnTarget'],shots_off_target:['ShotsOffTarget'],
 hit_woodwork:['shots_woodwork'],touches_in_opposition_box:['touches_opp_box'],big_chances:['big_chance'],
 big_chances_missed:['big_chance_missed_title'],total_passes:['passes'],crosses:['accurate_crosses'],
 long_balls:['long_balls_accurate'],ground_duels:['ground_duels_won'],aerial_duels:['aerials_won'],
 dribbles:['dribbles_succeeded'],offsides:['Offsides'],tackles:['matchstats.headers.tackles'],
 goalkeeper_saves:['keeper_saves'],throw_ins:['player_throws']};
const PERIODS={full:'All','first-half':'FirstHalf','second-half':'SecondHalf'};
function lookup(stats,key,aliases){
 for(const candidate of [key,...(aliases[key]??[])])if(Object.hasOwn(stats??{},candidate))return {key:candidate,value:stats[candidate]};
 return {key:null,value:null};
}
function counts(rows){
 const result={observed:rows.length,shared:0,equal:0,conflict:0,new:0,sourceMissing:0,unavailable:0,notComparable:0};
 for(const r of rows){
  if(r.shared)result.shared++;
  if(['equal','conflict','new'].includes(r.status))result[r.status]++;
  else if(r.status==='source-missing')result.sourceMissing++;
  else if(r.status==='unavailable')result.unavailable++;
  else result.notComparable++;
 }return result;
}
function compareMetric({key,sourceValue,sourceTotal,fotmobValue,fotmobTotal,sourceKey=key,fotmobKey,source,sourceUnit=null,period='full',notComparable=null}){
 const tolerance=(key==='rating_title'||key==='average_rating') ? 0.051 : 0.005;
 const knownSource=finite(sourceValue),knownTarget=finite(fotmobValue),shared=knownSource&&knownTarget&&!notComparable;
 const valueEqual=shared?Math.abs(sourceValue-fotmobValue)<=tolerance+1e-12:null;
 const totalEqual=shared&&finite(sourceTotal)&&finite(fotmobTotal)?Math.abs(sourceTotal-fotmobTotal)<=.005+1e-12:null;
 const status=notComparable??(!knownSource?knownTarget?'source-missing':'unavailable':!knownTarget?'new':valueEqual&&totalEqual!==false?'equal':'conflict');
 return {key,sourceKey,fotmobKey:fotmobKey??null,period,status,shared,sourceValue:knownSource?sourceValue:null,fotmobValue:knownTarget?fotmobValue:null,
  sourceTotal:finite(sourceTotal)?sourceTotal:null,fotmobTotal:finite(fotmobTotal)?fotmobTotal:null,
  sourceRatio:knownSource&&sourceTotal>0?sourceValue/sourceTotal:null,fotmobRatio:knownTarget&&fotmobTotal>0?fotmobValue/fotmobTotal:null,
  valueEqual,totalEqual,tolerance,equalityScope:totalEqual===null?'value-only':'value-and-total',
  differences:status==='conflict'?[...(valueEqual===false?['value']:[]),...(totalEqual===false?['total']:[])]:[],
  mapping:fotmobKey&&fotmobKey!==sourceKey?'explicit-label-alias':'same-key-or-source-only',
  sourceUnit,source:structuredClone(source??null),
  definitionRisk:key==='minutes_played'?'Provider minute conventions may differ.':/expected_goals|expected_assists/.test(key)?'Provider expected-value models may differ.':null,
  equivalenceValidated:false};
}

function fixtureCrosswalk(k,f){
 const checks={sourceFixtureId:!!id(k?.sourceMatchId),canonicalFixtureId:!!id(f?.id),
  explicitCanonicalHome:!!id(k?.home?.canonicalId)&&id(k.home.canonicalId)===id(f?.home?.id),
  explicitCanonicalAway:!!id(k?.away?.canonicalId)&&id(k.away.canonicalId)===id(f?.away?.id),
  distinctSourceTeams:!!id(k?.home?.id)&&!!id(k?.away?.id)&&id(k.home.id)!==id(k.away.id),
  exactKickoff:finite(timestamp(k?.date))&&timestamp(k.date)===timestamp(f?.date),
  homeScore:Number.isInteger(k?.homeScore)&&k.homeScore>=0&&k.homeScore===f?.homeScore,
  awayScore:Number.isInteger(k?.awayScore)&&k.awayScore>=0&&k.awayScore===f?.awayScore,
  optionalCanonicalFixture:k?.canonicalMatchId==null||id(k.canonicalMatchId)===id(f?.id),
  optionalCanonicalLeague:k?.canonicalLeagueId==null||id(k.canonicalLeagueId)===id(f?.leagueId)};
 return {matched:Object.values(checks).every(Boolean),checks,failed:Object.entries(checks).filter(([,v])=>!v).map(([name])=>name),
  sourceMatchId:id(k?.sourceMatchId),canonicalMatchId:id(f?.id),sourceDate:k?.date??null,canonicalDate:f?.date??null,
  home:{sourceId:id(k?.home?.id),canonicalId:id(k?.home?.canonicalId),sourceName:k?.home?.name??null,canonicalName:f?.home?.name??null},
  away:{sourceId:id(k?.away?.id),canonicalId:id(k?.away?.canonicalId),sourceName:k?.away?.name??null,canonicalName:f?.away?.name??null},
  method:'explicit-canonical-team-map+exact-kickoff+oriented-score',fuzzyMatching:false};
}
function teamOwnership(player,k){
 const sides=[k.home,k.away],sourceId=id(player.sourceTeamId??player.teamId),explicit=id(player.canonicalTeamId);
 let matches=[],method=null;
 if(sourceId!==null){matches=sides.filter(t=>id(t.id)===sourceId);method='source-team-id';}
 else if(player.teamName){matches=sides.filter(t=>fold(t.name)===fold(player.teamName));method='exact-source-team-name';}
 if(matches.length===1){
  if(sourceId!==null&&player.teamName&&fold(player.teamName)!==fold(matches[0].name))return {canonicalTeamId:null,reason:'contradicting-source-team-label'};
  const canonical=id(matches[0].canonicalId);if(explicit!==null&&explicit!==canonical)return {canonicalTeamId:null,reason:'contradicting-player-team-map'};
  return {canonicalTeamId:canonical,sourceTeamId:id(matches[0].id),method};
 }
 if(explicit!==null&&sides.filter(t=>id(t.canonicalId)===explicit).length===1&&sourceId===null)return {canonicalTeamId:explicit,sourceTeamId:null,method:'explicit-player-team-map'};
 return {canonicalTeamId:null,sourceTeamId:sourceId,reason:matches.length>1?'ambiguous-source-team':'unmapped-source-team'};
}
function playerCrosswalk(k,f,aliases){
 const normalized=(f.players??[]).filter(p=>p?.id!=null),source=k.players??[],rows=[];
 for(const p of source){
  const sourcePlayerId=id(p.sourcePlayerId??p.id),ownership=teamOwnership(p,k),sameTeam=normalized.filter(candidate=>id(candidate.teamId)===ownership.canonicalTeamId);
  const explicit=aliases.filter(a=>id(a.canonicalTeamId)===ownership.canonicalTeamId&&
   (a.sourcePlayerId!=null?id(a.sourcePlayerId)===sourcePlayerId:a.sourceName!=null&&fold(a.sourceName)===fold(p.name)));
  let candidates=[],method='exact-normalized-name-and-team',reason=null;
  if(!ownership.canonicalTeamId)reason=ownership.reason;
  else if(explicit.length>1)reason='ambiguous-explicit-alias';
  else if(explicit.length===1){
   const alias=explicit[0];candidates=sameTeam.filter(candidate=>alias.canonicalPlayerId!=null?id(candidate.id)===id(alias.canonicalPlayerId):
    alias.canonicalName!=null&&fold(candidate.name)===fold(alias.canonicalName));method='explicit-verified-alias';
   if(!candidates.length)reason='explicit-alias-not-found-on-team';
  }else if(!fold(p.name))reason='missing-player-name';
  else candidates=sameTeam.filter(candidate=>fold(candidate.name)===fold(p.name));
  const unique=[...new Map(candidates.map(c=>[id(c.id),c])).values()];
  if(!reason)reason=unique.length===1?null:unique.length>1?'ambiguous-name-on-team':'no-exact-name-on-team';
  rows.push({sourcePlayerId,sourceName:p.name??null,sourceTeamId:ownership.sourceTeamId??null,canonicalTeamId:ownership.canonicalTeamId,
   canonicalPlayerId:reason?null:id(unique[0].id),canonicalName:reason?null:unique[0].name,
   status:reason?'unresolved':'matched',reason,method,teamMethod:ownership.method??null,
   candidates:unique.map(c=>({id:id(c.id),name:c.name})),alias:method==='explicit-verified-alias'?structuredClone(explicit[0]):null});
 }
 const seen=new Map();for(const row of rows)if(row.status==='matched'){
  const key=`${row.canonicalTeamId}:${row.canonicalPlayerId}`;if(!seen.has(key))seen.set(key,[]);seen.get(key).push(row);
 }
 for(const group of seen.values())if(group.length>1)for(const row of group){row.status='unresolved';row.reason='ambiguous-canonical-player-reuse';row.canonicalPlayerId=null;row.canonicalName=null;}
 return rows;
}

function temporalGate(k,f,fixture,{cutoff,targetId,observedAt,completedAt}){
 const observed=[observedAt,k.observedAt,k.provenance?.observedAt,
  ...(k.players??[]).map(p=>p.provenance?.observedAt??p.temporal?.observedAt),
  ...(k.teamStats??[]).map(m=>m.source?.observedAt)].map(timestamp).filter(finite);
 const observedTime=observed.length?Math.max(...observed):NaN,start=timestamp(k.date),givenCompletion=timestamp(completedAt??k.completedAt??f.completedAt??f.finishedAt??f.endDate);
 const completion=finite(givenCompletion)?givenCompletion:finite(start)?start+3*3600000:NaN;
 const available=finite(observedTime)&&finite(completion)?Math.max(observedTime,completion):NaN,before=timestamp(cutoff??k.cutoff);
 const targetExcluded=targetId!=null&&[id(f.id),id(k.sourceMatchId),id(k.canonicalMatchId)].includes(id(targetId));
 const completeAllowed=k.finished!==false&&!k.cancelled&&!k.awarded&&f.finished===true&&!f.cancelled&&!f.awarded;
 const temporallyEligible=finite(available)&&finite(before)&&completion>=start&&available<before;
 return {observedAt:finite(observedTime)?new Date(observedTime).toISOString():null,completionAt:finite(completion)?new Date(completion).toISOString():null,
  completionBasis:finite(givenCompletion)?'explicit-completion':'conservative-kickoff-plus-three-hours',
  availableAt:finite(available)?new Date(available).toISOString():null,cutoff:finite(before)?new Date(before).toISOString():null,
  targetExcluded,temporallyEligible,eligibleAsPriorFact:!!(fixture.matched&&!targetExcluded&&temporallyEligible&&completeAllowed),
  eligibleForModel:false,status:targetExcluded?'target-excluded':!completeAllowed?'unfinished-cancelled-or-awarded':
   !finite(available)||!finite(before)?'unknown-time':!temporallyEligible?'unavailable-at-cutoff':fixture.matched?'prior-fact-review-only':'fixture-mismatch',
  reason:'Temporal and identity checks permit comparison/review only; no metric equivalence, overwrite or trained-feature admission is granted.'};
}
function groupedTeamObservations(observations){
 const groups=new Map();for(const m of observations??[]){const period=m.period??null,key=`${period}:${m.key}`;
  if(!groups.has(key))groups.set(key,{key:m.key,period,observations:[]});groups.get(key).observations.push(m);
 }return [...groups.values()];
}

export function compareKickoffWithFotMob({kickoffMatch:k,fotmobMatch:f,playerAliases=[],...options}={}){
 k=k??{};f=f??{};const fixture=fixtureCrosswalk(k,f),temporal=temporalGate(k,f,fixture,options);
 const result={schemaVersion:1,providers:{source:'KickoffScore',reference:'FotMob'},status:fixture.matched?'compared':'fixture-mismatch',
  fixtureCrosswalk:fixture,playerCrosswalk:[],players:[],teamMetrics:[],summary:{},temporal,
  eligibleForModel:false,trained:false,merged:false,modelEffect:'none',
  limitations:['Numeric agreement is not proof of identical provider definitions or independent evidence.',
   'Exact accent/punctuation-normalized names and an explicit oriented team map are required; no nickname, substring or fuzzy match is inferred.',
   'Observed source-only measurements remain separate observations. Conflicting values never overwrite FotMob.',
   'Placeholder zero statistics without positive observed minutes are not admitted as player appearances.',
   'Full-match and half-match team observations are compared only against their corresponding reference periods.']};
 if(!fixture.matched){result.summary={matchedPlayers:0,unresolvedPlayers:0,playerMetrics:counts([]),teamMetrics:counts([])};return result;}
 const aliases=Array.isArray(playerAliases)?playerAliases:[],crosswalk=playerCrosswalk(k,f,aliases);result.playerCrosswalk=crosswalk;
 for(let i=0;i<(k.players??[]).length;i++){
  const sourcePlayer=k.players[i],link=crosswalk[i],reference=link.status==='matched'?(f.players??[]).find(p=>id(p.id)===link.canonicalPlayerId&&id(p.teamId)===link.canonicalTeamId):null;
  const played=finite(sourcePlayer.minutes)&&sourcePlayer.minutes>0,rows=[],usedReferenceKeys=new Set();
  for(const [sourceKey,value]of Object.entries(sourcePlayer.stats??{})){
   const found=lookup(reference?.stats,sourceKey,PLAYER_ALIASES);if(found.key)usedReferenceKeys.add(found.key);
   const evidence=(sourcePlayer.metrics??[]).filter(m=>m.key===sourceKey),conflicted=(sourcePlayer.conflicts??[]).some(c=>c.key===sourceKey);
   rows.push(compareMetric({key:sourceKey,sourceValue:value,sourceTotal:sourcePlayer.statTotals?.[sourceKey],fotmobValue:found.value,
    fotmobTotal:found.key?reference?.statTotals?.[found.key]:null,sourceKey,fotmobKey:found.key,source:evidence,
    sourceUnit:evidence.find(e=>e.unit)?.unit??null,
    notComparable:link.status!=='matched'?'identity-unresolved':!played?'participation-unverified':conflicted?'source-conflict':null}));
  }
  result.players.push({crosswalk:structuredClone(link),sourceMinutes:sourcePlayer.minutes??null,referenceMinutes:reference?.minutes??null,
   participationEstablished:played,metrics:rows,counts:counts(rows),
   fotmobOnlyMetrics:reference?Object.entries(reference.stats??{}).filter(([key])=>!usedReferenceKeys.has(key)).map(([key,value])=>({key,value,total:reference.statTotals?.[key]??null})):[]});
 }
 for(const group of groupedTeamObservations(k.teamStats)){
  const periodKey=PERIODS[group.period],reference=periodKey?(f.periods?.[periodKey]??(periodKey==='All'?f.stats:null)):null;
  const found=lookup(reference,group.key,TEAM_ALIASES),target=found.value;
  for(const side of [0,1]){
   const values=group.observations.map(m=>m.values?.[side]).filter(finite),totals=group.observations.map(m=>m.totals?.[side]).filter(finite);
   const uniqueValues=[...new Set(values)],uniqueTotals=[...new Set(totals)],internalConflict=uniqueValues.length>1||uniqueTotals.length>1;
   const row=compareMetric({key:group.key,sourceValue:values[0]??null,sourceTotal:totals[0]??null,fotmobValue:target?.values?.[side],fotmobTotal:target?.totals?.[side],
    sourceKey:group.key,fotmobKey:found.key,source:group.observations,period:group.period,sourceUnit:group.observations.find(m=>m.units?.[side])?.units?.[side]??null,
    notComparable:!periodKey?'period-unverified':!reference?'reference-period-unavailable':internalConflict?'source-conflict':null});
   result.teamMetrics.push({...row,side:side===0?'home':'away',canonicalTeamId:id(side===0?f.home.id:f.away.id),
    observationCount:group.observations.length,duplicateObservations:Math.max(0,group.observations.length-1),referencePeriodAvailable:!!reference});
  }
 }
 result.summary={matchedPlayers:crosswalk.filter(c=>c.status==='matched').length,unresolvedPlayers:crosswalk.filter(c=>c.status!=='matched').length,
  sourcePlayers:(k.players??[]).length,sourceParticipatingPlayers:(k.players??[]).filter(p=>p.minutes>0).length,
  playerMetrics:counts(result.players.flatMap(p=>p.metrics)),teamMetrics:counts(result.teamMetrics),
  sourceTeamMetricObservations:k.teamStats?.length??0,uniqueTeamMetricPeriodPairs:result.teamMetrics.length/2};
 return result;
}
