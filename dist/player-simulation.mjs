import {buildPlayerProfile,playerMetricEvidence,playerPosition,playerMinutes} from './player-profile.mjs';
import {rosterForTeam,selectEligiblePlayerMatches,createTeamHistoryLookup} from './player-history.mjs';
import {createStarterFeatureIndex,starterVector} from './starter-features.mjs';
import {predictGbdt} from './gbdt-training.mjs';
import {lineupMeans,playerContributionReport} from './player-contribution.mjs';
import {MARKETS,marketProbability,asianProbabilities} from './market-model.mjs';
import {createSimulationMarketAccumulator} from './simulation-markets.mjs';

// A separate scenario model. None of these coefficients are fitted probabilities.
const CHANNELS=['attack','creation','defense','keeper'];
const SPECS={
  attack:[['xg90',.60,.2],['goals90',.25,.2],['shots90',.15,1]],
  creation:[['xa90',.50,.2],['keyPasses90',.30,1],['passes90',.20,10]],
  defense:[['tackles90',.40,1],['interceptions90',.35,1],['defensiveActions90',.25,3]],
  keeper:[['goalsPrevented90',1,.2]]
};
const ROLES={attack:[0,.15,.6,1],creation:[0,.2,1,.5],defense:[0,1,.4,.1],keeper:[1,0,0,0]};
const NAMES=['Kaleci','Defans','Orta saha','Forvet'];
const POLICY={duration:90,maxSubstitutions:5,maxWindows:3,maxSubstitutionsPerWindow:3,windows:[55,68,80],windowProbabilities:[.25,.45,.30],
  substitutionPrior:.35,substitutionPriorStarts:3,referenceMinimumGames:3,referenceMinimumMinutes:180,
  metricReferenceMinimum:5,maxGoalFactor:1.35,maxIterations:100000,
  channelMetrics:SPECS,roleWeights:ROLES,goalCoefficients:{attack:.20,creation:.12,opponentDefense:-.16,opponentKeeper:-.12},
  scorerPriorMinutes:270,scorerMinimumWeight:.02,scorerBlend:{xg:.7,goals:.3},
  formationMinimums:{defenders:3,midfielders:2,forwards:1},formationPolicy:'official-role-distribution-or-manual-minimums-v2',
  method:'league-relative-player-deltas-v2'};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const zeros=()=>Object.fromEntries(CHANNELS.map(c=>[c,0]));
const median=xs=>{const s=[...xs].sort((a,b)=>a-b),n=s.length;return n?s[Math.floor(n/2)]/2+s[Math.floor((n-1)/2)]/2:null;};
const identity=p=>String(p.playerId??p.id);

/** Comparison metrics, reference medians and historical minute weights share one competition. */
function simulationScope(bundle,count,options){
  const times=[bundle.target?.date,bundle.analysisAt,options.cutoff].map(v=>Date.parse(v)).filter(Number.isFinite);
  const cutoff=times.length?Math.min(...times):NaN,leagueId=bundle.target?.leagueId;
  const eligible=[...selectEligiblePlayerMatches(bundle,cutoff,bundle.target?.id).values()];
  const meta=bundle.leagueCoverage,seasonKnown=String(meta?.leagueId)===String(leagueId)&&
    typeof meta?.season==='string'&&!!meta.season.trim()&&Array.isArray(meta.expectedMatchIds)&&Date.parse(meta.cutoff)===cutoff;
  const expected=seasonKnown?new Set(meta.expectedMatchIds.map(String)):null;
  const matches=eligible.filter(m=>leagueId!=null&&String(m.leagueId)===String(leagueId)&&(!expected||expected.has(String(m.id))));
  const byPlayer=new Map(),recordsByMatch=new Map(),inventory=new Map((bundle.playerMetricInventory??[]).map(m=>[m.key,m]));
  for(const match of matches){
    const seen=new Set(),records=new Map();
    for(const record of match.players??[]){
      const id=record.id==null?null:String(record.id),minutes=playerMinutes(record);
      if(!id||seen.has(id)||!(minutes>0)||![String(match.home.id),String(match.away.id)].includes(String(record.teamId)))continue;
      seen.add(id);records.set(id,record);
      const home=String(record.teamId)===String(match.home.id),row={record,match,minutes,
        opponent:home?match.away:match.home,venue:home?'home':'away',opponentFactor:1,opponentHistoryCount:0};
      if(!byPlayer.has(id))byPlayer.set(id,[]);byPlayer.get(id).push(row);
    }
    recordsByMatch.set(String(match.id),records);
  }
  const profiles=[],byId=new Map();
  for(const [id,rows]of byPlayer){
    rows.sort((a,b)=>Date.parse(b.match.date)-Date.parse(a.match.date)||String(a.match.id).localeCompare(String(b.match.id)));
    const selected=rows.slice(0,count),latest=selected[0];
    const team=String(latest.record.teamId)===String(latest.match.home.id)?latest.match.home:latest.match.away;
    const profile=buildPlayerProfile(team,id,selected,inventory);profiles.push(profile);byId.set(id,profile);
  }
  const acquired=new Set(matches.map(m=>String(m.id))),missing=expected?[...expected].filter(id=>!acquired.has(id)):[];
  const withStats=new Set([...recordsByMatch].filter(([,records])=>records.size>0).map(([id])=>id));
  const missingStats=expected?[...expected].filter(id=>!withStats.has(id)):[];
  const status=!seasonKnown?'unknown':missing.length||missingStats.length?'partial':'complete';
  return {cutoff,leagueId,season:seasonKnown?meta.season:null,profiles,byId,matches,recordsByMatch,
    allLookup:createTeamHistoryLookup(eligible),leagueLookup:createTeamHistoryLookup(matches),
    // An unknown season never silently turns archive coverage into a league reference cohort.
    refs:references(seasonKnown?profiles:[]),coverage:{status,reason:!seasonKnown?'season-evidence-missing':missing.length?'league-records-missing':missingStats.length?'league-player-records-missing':null,
      leagueId:leagueId??null,season:seasonKnown?meta.season:null,matchCount:matches.length,referencePlayers:seasonKnown?profiles.length:0,
      expected:expected?.size??null,withPlayerStats:withStats.size,missingMatchIds:missing,missingPlayerStatsMatchIds:missingStats,
      cutoff:Number.isFinite(cutoff)?new Date(cutoff).toISOString():null}};
}

function teamParticipation(window,teamId,playerId){
  const rows=[];
  for(const match of window){
    const record=(match.players??[]).find(p=>String(p.id)===String(playerId)&&String(p.teamId)===String(teamId));
    const minutes=record?playerMinutes(record):null;if(!(minutes>0))continue;
    rows.push({matchId:match.id,minutes,starter:record.starter===true,starterKnown:typeof record.starter==='boolean'});
  }
  return {games:rows.length,minutes:rows.reduce((s,r)=>s+r.minutes,0),starts:rows.filter(r=>r.starter).length,
    subAppearances:rows.filter(r=>r.starterKnown&&!r.starter).length,windowGames:window.length,matches:rows};
}

function selectionFor(participation){
  const n=participation.windowGames,g=participation.games,s=participation.starts,b=participation.subAppearances;
  return {starterSelectionWeight:(s+.5)/(n+1)+.25*(n?clamp(participation.minutes/(90*n),0,1):0),
    benchEntryWeight:.03+.75*(b+.5)/(n+2)+.20*(g+.5)/(n+2)+.05*(s+.5)/(n+2)};
}

function scorerFor(profile,position,refs){
  const xg=playerMetricEvidence(profile,'xg90'),goals=playerMetricEvidence(profile,'goals90');
  const observed=[[xg,.7],[goals,.3]].filter(([e])=>finite(e.value));
  if(position===0||!observed.length)return {goalWeight:null,goalEvidence:{xg,goals,rawRate:null,reliability:0,prior:null,reason:position===0?'goalkeeper-excluded':'missing-scoring-metrics'}};
  const weight=observed.reduce((s,[,w])=>s+w,0),rawRate=observed.reduce((s,[e,w])=>s+Math.max(0,e.value)*w,0)/weight;
  const exposure=Math.min(...observed.map(([e])=>e.minutesCovered)),reliability=exposure/(exposure+270);
  const rx=refs.get(`${position}:xg90`),rg=refs.get(`${position}:goals90`);
  const priorEvidence=[[rx,.7],[rg,.3]].filter(([r])=>r?.count>=5&&finite(r.median));
  const prior=priorEvidence.length?priorEvidence.reduce((s,[r,w])=>s+Math.max(0,r.median)*w,0)/priorEvidence.reduce((s,[,w])=>s+w,0):[0,.05,.15,.35][position]??.15;
  return {goalWeight:Math.max(.02,reliability*rawRate+(1-reliability)*prior),goalEvidence:{xg,goals,rawRate,minutesCovered:exposure,
    reliability,prior,priorSource:priorEvidence.length?'same-league-position-median':'explicit-position-prior',observedWeight:weight,
    reason:observed.length===2?null:'partial-scoring-metrics'}};
}

function references(profiles){
  const groups=new Map(),seen=new Set();
  for(const p of profiles){
    const id=identity(p);if(seen.has(id)||!(p.games>=3&&p.minutes>=180)||![0,1,2,3].includes(p.position))continue;
    seen.add(id);
    for(const key of new Set(Object.values(SPECS).flat().map(s=>s[0]))){
      const e=playerMetricEvidence(p,key);if(!finite(e.value))continue;
      const group=`${p.position}:${key}`;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(e.value);
    }
  }
  return new Map([...groups].map(([key,values])=>[key,{count:values.length,median:median(values)}]));
}

function strengthFor(profile,position,refs){
  const strength=zeros(),channelCoverage=zeros(),evidence=[];
  for(const channel of CHANNELS){
    if(!ROLES[channel][position])continue;
    for(const [key,weight,floor] of SPECS[channel]){
      const e=playerMetricEvidence(profile,key),ref=refs.get(`${position}:${key}`);
      const reason=!finite(e.value)?'missing-metric':!(ref?.count>=5)?'insufficient-reference':null;
      const reliability=reason?0:e.minutesCovered/(e.minutesCovered+180)*Math.min(1,e.games/3)*clamp(e.coverage,0,1);
      const relative=reason?null:clamp((e.value-ref.median)/(Math.abs(ref.median)+floor),-1,1);
      strength[channel]+=reason?0:weight*relative*reliability;
      channelCoverage[channel]+=reason?0:weight*clamp(e.coverage,0,1);
      evidence.push({channel,...e,referenceCount:ref?.count??0,referenceMedian:ref?.median??null,weight,relative,reliability,reason});
    }
  }
  return {strength,channelCoverage,evidence};
}

function substitutionFor(profile){
  const starts=(profile?.matches??[]).filter(m=>m.starter===true&&finite(m.minutes)&&m.minutes>0);
  const exits=starts.filter(m=>m.minutes<87);
  const exitWindows=[0,0,0];
  for(const m of exits){const minute=Math.min(90,m.minutes),index=POLICY.windows.reduce((best,n,i)=>Math.abs(n-minute)<Math.abs(POLICY.windows[best]-minute)?i:best,0);exitWindows[index]++;}
  return {probability:(exits.length+3*.35)/(starts.length+3),
    typicalMinute:clamp((exits.reduce((s,m)=>s+Math.min(90,m.minutes),0)+68)/(exits.length+1),50,82),
    windowProbabilities:POLICY.windowProbabilities.map((p,i)=>(exitWindows[i]+3*p)/(exits.length+3)),
    starts:starts.length,observedExits:exits.length,exitWindows,prior:.35,priorStarts:3};
}

function units(players,weights){
  const values=zeros(),coverage=zeros();
  for(const channel of CHANNELS){
    let total=0,covered=0,value=0;
    for(const p of players){
      const weight=(weights?.[p.id]??1)*(ROLES[channel][p.position]??0);
      if(!(weight>0))continue;
      total+=weight;value+=weight*(p.strength?.[channel]??0);covered+=weight*(p.channelCoverage?.[channel]??0);
    }
    if(total>0){values[channel]=value/total;coverage[channel]=covered/total;}
  }
  return {values,coverage};
}

/** Produce only serializable roster facts; archives stay on the main thread. */
export function prepareSimulation(bundle,analysis,options={}){
  const playerAnalysis=analysis?.playerAnalysis??analysis;
  const rawMeans=analysis?.baselinePrediction?.poissonMeans;
  const baseMeans=rawMeans?{home:rawMeans.home,away:rawMeans.away}:null;
  const count=[5,10].includes(Number(playerAnalysis?.formCount))?Number(playerAnalysis.formCount):10;
  const scope=simulationScope(bundle,count,options),refs=scope.refs;
  const scenarios=options.playerScenarios??{},teams=[];
  const starterIndex=createStarterFeatureIndex([...(bundle.matches??[]),...(bundle.playerHistoryMatches??[])]);
  const starterContext=analysis?.training?.gbdt?.starters??starterIndex.features(bundle.target,{cutoff:analysis?.target?.date??scope.cutoff,formCount:count,lineup:bundle.targetLineup,analysisAt:bundle.analysisAt,playerScenarios:scenarios});
  for(const side of ['home','away']){
    const team=bundle.target[side],id=String(team.id),source=playerAnalysis?.teams?.[id];
    const profiles=source?.players??[],byId=new Map(profiles.map(p=>[identity(p),p]));
    const allWindow=scope.allLookup.recent(id,scope.cutoff,count,bundle.target.id),leagueWindow=scope.leagueLookup.recent(id,scope.cutoff,count,bundle.target.id);
    const prior=starterContext.teams[side],selectedIds=new Set(prior.profiles.map(p=>p.id)),roster=new Map(prior.poolProfiles.map(p=>[p.id,{id:p.id,name:p.name,position:p.position,positionEvidence:p.positionEvidence,
      rosterGroups:[selectedIds.has(p.id)?'starters':'bench',...(!p.eligible?['unavailable']:[])],availability:p.eligible?'listed':'unavailable',unavailableReason:p.absence?.reason??(!p.inPreviousMatch?'Önceki maç kadrosunda yok; oynayabilir seçimi kullanıcı varsayımı gerektirir.':null)}])),players=[];
    const compact=(profile,listed)=>{
      const pid=String(listed?.id??profile.playerId??profile.id),position=playerPosition(listed??profile)??profile?.position??null;
      const scopedProfile=scope.byId.get(pid)??{id:pid,metrics:{},matches:[]};
      const evidence=strengthFor(scopedProfile,position,refs);
      const participation=teamParticipation(allWindow,id,pid),leagueParticipation=teamParticipation(leagueWindow,id,pid),selection=selectionFor(participation);
      const unavailable=listed?.availability==='unavailable'||listed?.rosterGroups?.includes('unavailable');
      const eligible=scenarios[pid]!=='out'&&(!unavailable||scenarios[pid]==='in');
      return {id:pid,name:listed?.name??profile.name??pid,position,positionEvidence:listed?.positionEvidence??null,positionName:NAMES[position]??'Bilinmiyor',
        sourceGroup:listed?.rosterGroups?.includes('starters')?'starters':'bench',eligible,
        unavailableReason:scenarios[pid]==='out'?'Kullanıcının dışarıda senaryosu':unavailable&&scenarios[pid]!=='in'?listed.unavailableReason??'Kaynakta eksik':null,
        scenario:scenarios[pid]??null,historyCoverage:profile.historyCoverage??null,games:profile.games??0,minutes:profile.minutes??0,
        teamGames:participation.games,teamMinutes:participation.minutes,teamStarts:participation.starts,teamSubAppearances:participation.subAppearances,
        strengthScope:{leagueId:scope.leagueId??null,season:scope.season,status:scope.coverage.status,
          reason:!scopedProfile.games?'same-league-player-history-missing':scope.coverage.reason,
          games:scopedProfile.games??0,minutes:scopedProfile.minutes??0,teamGames:leagueParticipation.games,
          teamMinutes:leagueParticipation.minutes,teamHistoryCount:leagueWindow.length},
        ...evidence,substitution:substitutionFor({matches:participation.matches}),...selection,selectionWeight:selection.benchEntryWeight,
        ...scorerFor(scopedProfile,position,refs)};
    };
    for(const [pid,listed] of roster){
      if(!listed.rosterGroups.some(g=>g==='starters'||g==='bench'))continue;
      const profile=byId.get(pid)??{id:pid,metrics:{},matches:[]};players.push(compact(profile,listed));
    }
    const historicalIds=new Set(leagueWindow.flatMap(m=>(m.players??[]).filter(p=>String(p.teamId)===id&&playerMinutes(p)>0).map(p=>String(p.id))));
    const historical=[...historicalIds].map(pid=>compact(byId.get(pid)??scope.byId.get(pid)??{id:pid},null));
    const historicalWeights=Object.fromEntries(historical.map(p=>[p.id,p.strengthScope.teamMinutes]));
    const baseline=units(historical,historicalWeights);
    const defaultLineup=prior.profiles.map(p=>p.id),replacements=[...prior.replacements];
    for(let n=0;n<defaultLineup.length;n++){
      const missing=players.find(p=>p.id===defaultLineup[n]);if(missing.eligible)continue;
      const candidate=players.filter(p=>p.eligible&&p.position===missing.position&&!defaultLineup.includes(p.id)).sort((a,b)=>b.starterSelectionWeight-a.starterSelectionWeight||a.id.localeCompare(b.id))[0];
      if(candidate){defaultLineup[n]=candidate.id;replacements.push({outId:missing.id,outName:missing.name,inId:candidate.id,inName:candidate.name,reason:missing.unavailableReason});}
    }
    const officialMatch=allWindow.find(m=>String(m.id)===String(prior.sourceMatchId));
    const officialIds=(officialMatch?.players??[]).filter(p=>String(p.teamId)===id&&p.starter===true).map(p=>String(p.id));
    const baselineIds=new Set(prior.baselineProfiles.map(p=>p.id));
    const recordedEnd=Date.parse(officialMatch?.completedAt??officialMatch?.finishedAt??officialMatch?.endDate);
    const officialLineup=officialIds.length===11&&new Set(officialIds).size===11&&baselineIds.size===11&&officialIds.every(pid=>baselineIds.has(pid))?{
      matchId:String(officialMatch.id),date:officialMatch.date,availableAt:new Date(Number.isFinite(recordedEnd)?recordedEnd:Date.parse(officialMatch.date)+10800000).toISOString(),
      starters:prior.baselineProfiles.map(p=>({id:p.id,position:p.position}))}:null;
    teams.push({id,name:team.name,side,players,defaultLineup,replacements,baseline,officialLineup,previousMatch:{id:prior.sourceMatchId,date:prior.sourceMatchDate,type:prior.type},
      absenceEvidence:{observedAt:prior.observedAt,ignoredPostCutoffSource:prior.ignoredSourceAbsences,absences:prior.absences},
      coverage:{rosterPlayers:players.length,withHistory:players.filter(p=>p.games>0).length,
        completeHistory:players.filter(p=>p.historyCoverage?.status==='complete').length,
        historyCount:allWindow.length,strengthScope:{...scope.coverage,teamHistoryCount:leagueWindow.length,
          teamMinutes:Object.values(historicalWeights).reduce((s,n)=>s+n,0)}}});
  }
  const limitations=[
    'Ayrı bir kadro senaryosu; mevcut maç tahminini değiştirmez. Katsayılar kalibre edilmiş değildir.',
    'Eksik metrik veya yetersiz lig/mevki referansı nötr öncülde kalır; gözlenmiş sıfır olarak sayılmaz.',
    'Değişiklikler geçmiş süre alışkanlıklarına ve açık öncüllere dayanır; teknik direktör kararını öngörmez.',
    '90 dakika; en fazla 5 aynı mevki değişikliği, 3 pencere, pencere başına en fazla 3 değişiklik. Normal kaleci değişimi, kart, sakatlık ve uzatma yok.',
    'Birim gücü, lig/mevki referansları ve geçmiş dakika dağılımı hedef lig kapsamındadır; kupa/Avrupa metrikleri karşılaştırmaya karışmaz.',
    'Golcü ağırlığı gözlenen xG/gol oranını 270 dakikalık mevki öncülüne küçültür; gözlenmeyen metrikler bilinmiyor kalır.',
    'Örnek maç ve golcü ataması bir senaryo çekimidir; en sık skorla aynı olmak zorunda değildir.'
  ];
  if(bundle.target.finished||bundle.target.started||Date.parse(bundle.analysisAt)>Date.parse(bundle.target.date))limitations.push('Geçmiş/başlamış maçın sonradan görülen kadrosu senaryodur; başlama öncesi doğrulanmış tahmin değildir.');
  let gbdtScenario=null;
  if(analysis?.training?.gbdt?.active){
    const f=starterIndex.features(bundle.target,{cutoff:analysis.target.date,formCount:count,
      scenarioRosters:Object.fromEntries(teams.map(t=>[t.side,t.players.map(p=>({id:p.id,name:p.name,position:p.position}))]))});
    const model=analysis.training;
    gbdtScenario={model:{kind:model.kind,trees:model.trees,learningRate:model.learningRate,shape:model.shape},reference:model.gbdt.targetInput,starters:starterContext,
      profiles:Object.fromEntries(teams.map(t=>[t.id,Object.fromEntries(f.teams[t.side].profiles.map(p=>[p.id,p]))]))};
    limitations[0]='GBDT ilk 11 senaryosu: sahadaki oyuncular değiştikçe aynı ağaçlar yeniden değerlendirilir; genel bakış tahminini değiştirmez.';
  }
  return {version:'player-simulation-v3',matchId:String(bundle.target.id),cutoff:new Date(scope.cutoff).toISOString(),formCount:playerAnalysis?.formCount??10,
    goalShape:analysis?.baselinePrediction?.goalShape??null,
    training:analysis?.training?structuredClone(analysis.training):null,
    lineupType:'previousMatchXI',baseMeans,teams,gbdtScenario,marketAnalysis:analysis?.marketAnalysis??null,policy:structuredClone(POLICY),
    coverage:{league:structuredClone(scope.coverage),strengthScope:structuredClone(scope.coverage),
      leagueId:scope.leagueId??null,season:scope.season},limitations};
}

export function validateSimulationLineups(input,lineups={}){
  if(!Array.isArray(input?.teams)||input.teams.length!==2||input.teams[0].id===input.teams[1].id)throw new Error('İki farklı takımın kadrosu gerekiyor.');
  const result={};
  for(const team of input.teams){
    const ids=lineups?.[team.id]??team.defaultLineup;
    if(!Array.isArray(ids)||ids.length!==11)throw new Error(`${team.name}: kadro tam 11 oyuncu olmalı.`);
    const selected=ids.map(String),byId=new Map(team.players.map(p=>[p.id,p]));
    if(new Set(selected).size!==11)throw new Error(`${team.name}: aynı oyuncu iki kez seçilemez.`);
    const players=selected.map(id=>byId.get(id));
    if(players.some(p=>!p||!p.eligible))throw new Error(`${team.name}: kadroda uygun olmayan veya başka takıma ait oyuncu var.`);
    const unknown=players.filter(p=>![0,1,2,3].includes(p.position));
    if(unknown.length)throw new Error(`${team.name}: mevkisi doğrulanamayan oyuncular: ${unknown.map(p=>p.name??p.id).join(', ')}. Bu oyuncuların yerine mevkisi bilinen bir oyuncu seçin.`);
    if(players.filter(p=>p.position===0).length!==1)throw new Error(`${team.name}: kadroda tam bir kaleci olmalı.`);
    const reference=team.officialLineup,cutoff=Date.parse(input.cutoff),roleCounts=ps=>[0,1,2,3].map(role=>ps.filter(p=>p.position===role).length);
    const verified=reference&&String(reference.matchId)!==String(input.matchId)&&Number.isFinite(cutoff)&&Date.parse(reference.date)<cutoff&&
      Date.parse(reference.availableAt)>=Date.parse(reference.date)&&Date.parse(reference.availableAt)<cutoff&&reference.starters?.length===11&&
      new Set(reference.starters.map(p=>String(p.id))).size===11&&reference.starters.every(p=>[0,1,2,3].includes(p.position))&&roleCounts(reference.starters)[0]===1;
    const followsOfficialRoles=verified&&roleCounts(players).every((count,i)=>count===roleCounts(reference.starters)[i]);
    if(!followsOfficialRoles&&(players.filter(p=>p.position===1).length<3||players.filter(p=>p.position===2).length<2||players.filter(p=>p.position===3).length<1))
      throw new Error(`${team.name}: makul diziliş için en az 3 defans, 2 orta saha ve 1 forvet gerekiyor.`);
    result[team.id]=selected;
  }
  return result;
}

function randomSource(seed){let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function weightedChoice(values,weight,random){
  const total=values.reduce((s,v)=>s+Math.max(0,weight(v)),0);if(!(total>0))return null;
  let at=random()*total;for(const v of values){at-=Math.max(0,weight(v));if(at<0)return v;}return values.at(-1);
}
function poisson(lambda,random){
  // Independent small Poissons add exactly; splitting avoids exp underflow.
  let total=0;
  while(lambda>0){const part=Math.min(20,lambda),limit=Math.exp(-part);let p=1,k=0;do{k++;p*=random();}while(p>limit);total+=k-1;lambda-=part;}
  return total;
}
function gamma(shape,random){
  if(shape<1)return gamma(shape+1,random)*Math.pow(Math.max(Number.MIN_VALUE,random()),1/shape);
  const d=shape-1/3,c=1/Math.sqrt(9*d);
  for(;;){
    const x=Math.sqrt(-2*Math.log(Math.max(Number.MIN_VALUE,random())))*Math.cos(2*Math.PI*random());
    let v=1+c*x;if(v<=0)continue;v=v*v*v;
    const u=random();if(u<1-.0331*x*x*x*x||Math.log(Math.max(Number.MIN_VALUE,u))<.5*x*x+d*(1-v+Math.log(v)))return d*v;
  }
}
function schedule(team,lineup,random){
  const byId=new Map(team.players.map(p=>[p.id,p])),used=new Set(lineup),bench=team.players.filter(p=>p.eligible&&!used.has(p.id)&&p.position!==0);
  const windows=[55,68,80].map(minute=>minute+Math.floor(random()*7)-3);
  const candidates=lineup.map(id=>byId.get(id)).filter(p=>p.position!==0&&bench.some(b=>b.position===p.position))
    .filter(p=>random()<clamp(p.substitution?.probability??.35,0,1))
    .map(p=>({player:p,priority:random()})).sort((a,b)=>a.priority-b.priority);
  const events=[],windowCounts=[0,0,0];
  for(const c of candidates){
    if(events.length>=5)break;
    const incoming=weightedChoice(bench.filter(p=>!used.has(p.id)&&p.position===c.player.position),p=>p.benchEntryWeight??p.selectionWeight??1,random);
    if(!incoming)continue;used.add(incoming.id);
    const available=[0,1,2].filter(i=>windowCounts[i]<3);
    const window=weightedChoice(available,i=>c.player.substitution?.windowProbabilities?.[i]??POLICY.windowProbabilities[i],random);
    if(window==null)continue;windowCounts[window]++;
    events.push({type:'substitution',time:windows[window],minute:windows[window],window,side:team.side,teamId:team.id,outId:c.player.id,outName:c.player.name,inId:incoming.id,inName:incoming.name});
  }
  return events.sort((a,b)=>a.time-b.time||a.outId.localeCompare(b.outId));
}
function comparison(team,lineup){
  const byId=new Map(team.players.map(p=>[p.id,p])),selected=units(lineup.map(id=>byId.get(id))),historical=team.baseline??{values:zeros(),coverage:zeros()},delta=zeros();
  for(const c of CHANNELS)if(historical.coverage?.[c]>0)delta[c]=selected.values[c]-(historical.values?.[c]??0);
  return {teamId:team.id,name:team.name,selected:selected.values,historical:{...historical.values},delta,coverage:selected.coverage,historicalCoverage:{...historical.coverage}};
}
function phaseMeans(input,comparisons){
  const factor=(own,opponent)=>Math.exp(clamp(.20*own.delta.attack+.12*own.delta.creation-.16*opponent.delta.defense-.12*opponent.delta.keeper,-Math.log(1.35),Math.log(1.35)));
  return {home:input.baseMeans.home*factor(comparisons[0],comparisons[1]),away:input.baseMeans.away*factor(comparisons[1],comparisons[0])};
}
export function gbdtPhaseMeans(input,current){
 const g=input.gbdtScenario;if(!g)throw Error('GBDT senaryo girdisi yok.');
 const own=side=>{const t=input.teams.find(t=>t.side===side);return current[t.id].map(id=>g.profiles[t.id][id]).filter(Boolean);};
 const home=own('home'),away=own('away'),out={};
 const revised=lineupMeans(g.model,g.reference,{home,away});
 for(const side of ['home','away']){
  const original=g.reference[side+'Features'],base=g.reference[side+'Base'];
  const initial=predictGbdt(g.model,base,original),scenario=revised[side];
  out[side]=input.baseMeans[side]*(initial?scenario/initial:1);
 }
 return out;
}
export function simulationContributions(input,current){const g=input.gbdtScenario;if(!g)return null;
 const lineups=Object.fromEntries(input.teams.map(t=>[t.side,current[t.id].map(id=>g.profiles[t.id][id]).filter(Boolean)]));
 return playerContributionReport({...g.model,gbdt:{targetInput:g.reference}},g.starters,{lineups});
}

/** Seeded Monte Carlo over phase-specific on-pitch units and ordinary substitutions. */
export function runSimulation(input,{iterations=10000,seed=1,lineups={}}={}){
  if(!Number.isInteger(iterations)||iterations<1||iterations>100000)throw new Error('Tekrar sayısı 1–100.000 arasında tam sayı olmalı.');
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Tohum 0–4.294.967.295 arasında tam sayı olmalı.');
  // Prepared application means are capped at 4.5; this guard bounds arbitrary imported jobs.
  if(!input.baseMeans||!['home','away'].every(s=>finite(input.baseMeans[s])&&input.baseMeans[s]>=0&&input.baseMeans[s]<=100))throw new Error('Geçerli takım taban gol ortalamaları bulunamadı (0–100).');
  if(input.goalShape!=null&&(!finite(input.goalShape)||input.goalShape<.1||input.goalShape>1000))throw new Error('Geçerli gol dağılım şekli gerekli.');
  const selected=validateSimulationLineups(input,lineups),random=randomSource(seed),histogram=new Map(),counts={home:0,draw:0,away:0,over25:0,under25:0,btts:0},totals={home:0,away:0};
  const marketRandom=randomSource((seed^0x9e3779b9)>>>0),marketSummary=createSimulationMarketAccumulator();
  const usage=new Map(input.teams.flatMap(t=>t.players.map(p=>[`${t.id}:${p.id}`,{teamId:t.id,playerId:p.id,name:p.name,starts:0,appearances:0,totalMinutes:0}])));
  const byTeam=Object.fromEntries(input.teams.map(t=>[t.id,new Map(t.players.map(p=>[p.id,p]))]));
  const initialComparisons=input.teams.map(t=>comparison(t,selected[t.id]));
  // Same-position replacements preserve each role denominator. Update the four deltas
  // directly instead of rebuilding Maps and averaging 22 profiles in every phase.
  const roleTotals=Object.fromEntries(input.teams.map(t=>[t.id,Object.fromEntries(CHANNELS.map(c=>[c,selected[t.id].reduce((s,id)=>s+(ROLES[c][byTeam[t.id].get(id).position]??0),0)]))]));
  const teamIndex=new Map(input.teams.map((t,n)=>[t.id,n]));
  const phaseCache=new Map(),gbdtMeans=current=>{
    const key=input.teams.map(t=>[...current[t.id]].sort().join(',')).join('|');
    if(!phaseCache.has(key)){if(phaseCache.size>12000)phaseCache.clear();phaseCache.set(key,gbdtPhaseMeans(input,current));}
    return phaseCache.get(key);
  };
  let sample=null;
  for(let iteration=0;iteration<iterations;iteration++){
    // One latent rate per team and match preserves the trained negative-binomial
    // variance even when substitutions divide the game into unequal phases.
    const rate=input.goalShape?{home:gamma(input.goalShape,random)/input.goalShape,away:gamma(input.goalShape,random)/input.goalShape}:{home:1,away:1};
    const substitutions=input.teams.flatMap(t=>schedule(t,selected[t.id],random)).sort((a,b)=>a.minute-b.minute||a.teamId.localeCompare(b.teamId));
    const current=Object.fromEntries(input.teams.map(t=>[t.id,[...selected[t.id]]])),minutes=Object.fromEntries(input.teams.map(t=>[t.id,Object.fromEntries(t.players.map(p=>[p.id,0]))]));
    const comparisons=initialComparisons.map(c=>({delta:{...c.delta}}));
    const score={home:0,away:0},events=iteration===0?[...substitutions]:null;
    const halfScore={home:0,away:0};let firstGoal=null,firstTime=Infinity,firstTeamId=null;
    const boundaries=[...new Set(substitutions.map(s=>s.minute)),90];let from=0;
    for(const to of boundaries){
      const means=input.gbdtScenario?gbdtMeans(current):phaseMeans(input,comparisons),duration=to-from;
      for(const team of input.teams){
        for(const id of current[team.id])minutes[team.id][id]+=duration;
        const goals=poisson(means[team.side]*rate[team.side]*duration/90,random);score[team.side]+=goals;
        for(let n=0;n<goals;n++){
          // Open interval (from,to): every scorer belongs to this phase's lineup.
          // Even RNG=0 gets an interior timestamp; UI minutes are ceil(time).
          // Separate RNG preserves all existing scores, substitutions and replay draws.
          const timeRandom=events?random:marketRandom;
          const padding=Math.min(duration/4,1e-7),time=clamp(from+duration*timeRandom(),from+padding,to-padding),minute=Math.ceil(time);
          if(time<=45)halfScore[team.side]++;
          if(time<firstTime||time===firstTime&&team.id.localeCompare(firstTeamId)<0){firstTime=time;firstGoal=team.side;firstTeamId=team.id;}
          if(events){
           const scorer=weightedChoice(current[team.id].map(id=>byTeam[team.id].get(id)).filter(p=>p.position!==0),p=>p.goalWeight??0,random);
           events.push({type:'goal',time,minute,side:team.side,teamId:team.id,playerId:scorer?.id??null,name:scorer?.name??null});
          }
        }
      }
      for(const s of substitutions.filter(e=>e.minute===to)){
        current[s.teamId][current[s.teamId].indexOf(s.outId)]=s.inId;
        const index=teamIndex.get(s.teamId),team=input.teams[index],outgoing=byTeam[s.teamId].get(s.outId),incoming=byTeam[s.teamId].get(s.inId);
        for(const c of CHANNELS)if(team.baseline?.coverage?.[c]>0&&roleTotals[s.teamId][c]>0)
          comparisons[index].delta[c]+=((incoming.strength?.[c]??0)-(outgoing.strength?.[c]??0))*(ROLES[c][outgoing.position]??0)/roleTotals[s.teamId][c];
      }
      from=to;
    }
    for(const team of input.teams)for(const p of team.players){const u=usage.get(`${team.id}:${p.id}`),m=minutes[team.id][p.id];u.starts+=selected[team.id].includes(p.id)?1:0;u.appearances+=m>0?1:0;u.totalMinutes+=m;}
    totals.home+=score.home;totals.away+=score.away;counts[score.home>score.away?'home':score.home<score.away?'away':'draw']++;
    counts[score.home+score.away>2?'over25':'under25']++;if(score.home>0&&score.away>0)counts.btts++;
    const key=`${score.home}:${score.away}`;if(!histogram.has(key))histogram.set(key,{home:score.home,away:score.away,count:0});histogram.get(key).count++;
    marketSummary.record({home:score.home,away:score.away,homeHalf:halfScore.home,awayHalf:halfScore.away,firstGoal});
    if(events)sample={homeGoals:score.home,awayGoals:score.away,events:events.sort((a,b)=>a.time-b.time||Number(a.type==='goal')-Number(b.type==='goal')||a.teamId.localeCompare(b.teamId)),lineups:structuredClone(selected),minutes};
  }
  const rows=[...histogram.values()].map(r=>({...r,probability:r.count/iterations})).sort((a,b)=>a.home-b.home||a.away-b.away);
  return {version:input.version,matchId:input.matchId,formCount:input.formCount,iterations,seed,lineups:structuredClone(selected),
    goalShape:input.goalShape??null,training:input.training??null,
    means:{home:totals.home/iterations,away:totals.away/iterations},probabilities:Object.fromEntries(Object.entries(counts).map(([key,n])=>[key,n/iterations])),
    histogram:rows,topScores:[...rows].sort((a,b)=>b.count-a.count||a.home-b.home||a.away-b.away).slice(0,10),sample,
    contributions:simulationContributions(input,selected),
    bettingSummary:marketSummary.finish(),
    marketProbabilities:MARKETS.filter(m=>['goals','score'].includes(m.group)).map(m=>({id:m.id,home:marketProbability(m,rows),away:marketProbability(m,rows,'away')})),
    usage:[...usage.values()].map(({totalMinutes,...u})=>({...u,averageMinutes:totalMinutes/iterations,appearanceProbability:u.appearances/iterations})),
    comparisons:initialComparisons,coverage:structuredClone(input.coverage??{}),policy:structuredClone(input.policy??POLICY),limitations:[...(input.limitations??[])]};
}
