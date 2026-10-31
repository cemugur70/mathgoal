// Pre-match co-appearance graph descriptors. These are training inputs, not scores
// or claims about individual duels. No target lineup or target statistics are read.
export const PLAYER_GRAPH_FEATURE_NAMES=Object.freeze(['poolXg','poolCreation','finishingQuality','opponentDefense',
  'opponentKeeper','scoringConcentration','continuity','encounteredOpponentAttack','encounteredOpponentDefense',
  'sharedOpponentOverlap','historyFraction','missingFraction']);
const DAY=86400000,HALF_LIFE=120,PRIOR_MINUTES=270,MAX_OPPONENT_PLAYERS=24;
const METRICS={xg:['expected_goals'],xgot:['expected_goals_on_target_variant','expected_goals_on_target'],
  xa:['expected_assists'],keyPasses:['chances_created','key_passes'],
  defensiveActions:['defensive_actions'],tackles:['matchstats.headers.tackles','tackles','won_tackle'],
  interceptions:['interceptions'],goalsPrevented:['goals_prevented']};
const KEYS=Object.keys(METRICS),M=KEYS.length;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const stamp=v=>v==null?NaN:typeof v==='number'?v:Date.parse(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const key=(league,id)=>`${league}:${id}`;
const idOrder=(a,b)=>String(a).localeCompare(String(b),'en');
const clip=v=>finite(v)?clamp(v,-2,2):0;
function metric(stats,aliases){for(const alias of aliases)if(finite(stats?.[alias]))return stats[alias];return null;}
function position(record){
  if(record.isGoalkeeper)return 0;const raw=record.position??record.usualPosition??record.usualPlayingPositionId;
  return raw!=null&&[0,1,2,3].includes(Number(raw))?Number(raw):null;
}
function beforeIndex(rows,cutoff){
  let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].start<cutoff)lo=mid+1;else hi=mid;}return lo;
}
function timelineOrder(a,b){return a.start-b.start||idOrder(a.matchId??a.id,b.matchId??b.id);}
function select(rows,cutoff,count,targetId){
  const result=[];for(let i=beforeIndex(rows,cutoff)-1;i>=0&&result.length<count;i--){const row=rows[i];
    if(row.availableAt<cutoff&&String(row.matchId??row.id)!==targetId)result.push(row);
  }return result;
}
function weightedJaccard(a,b){
  let intersection=0,union=0;for(const id of new Set([...a.keys(),...b.keys()])){const x=a.get(id)??0,y=b.get(id)??0;intersection+=Math.min(x,y);union+=Math.max(x,y);}
  return union>0?intersection/union:null;
}
function combine(profile,specs){
  let numerator=0,observedWeight=0,coverage=0;
  for(const [name,weight,scale=1]of specs){const m=profile.metrics[name];
    if(m?.rate!==null&&finite(m?.rate)){numerator+=weight*m.rate*m.reliability/scale;observedWeight+=weight;}
    coverage+=weight*(m?.coverage??0);
  }
  return {value:observedWeight?numerator/observedWeight:null,coverage:clamp(coverage,0,1)};
}
const ATTACK=[['xg',.8],['xa',.2]],CREATION=[['xa',.7],['keyPasses',.3,4]],DEFENSE=[['defensiveActions',.5,12],['tackles',.3,3],['interceptions',.2,2]];
const defenseRole=position=>position===1?1:position===2?.4:position===3?.1:0;

/** Snapshot and index normalized official fixtures once, across all competitions. */
export function createPlayerGraphFeatureIndex(matches){
  const facts=new Map(),teams=new Map(),players=new Map();let appearanceCount=0;
  for(const raw of matches??[]){
    if(raw?.id==null||raw.home?.id==null||raw.away?.id==null||String(raw.home.id)===String(raw.away.id)||raw.leagueId==null||
      raw.cancelled||raw.awarded||raw.finished===false||[489,114].includes(Number(raw.leagueId))||!finite(raw.homeScore)||!finite(raw.awayScore))continue;
    const id=String(raw.id),start=stamp(raw.date),recorded=stamp(raw.completedAt??raw.finishedAt??raw.endDate),availableAt=finite(recorded)?recorded:start+3*3600000;
    if(facts.has(id)||!finite(start)||!finite(availableAt)||availableAt<start)continue;
    const fact={id,start,availableAt,leagueId:String(raw.leagueId),homeId:String(raw.home.id),awayId:String(raw.away.id),players:[]},seen=new Set();
    for(const record of raw.players??[]){
      const pid=record.id==null?null:String(record.id),teamId=String(record.teamId),minutes=finite(record.minutes)?record.minutes:metric(record.stats,['minutes_played']);
      if(!pid||seen.has(pid)||!(minutes>0)||![fact.homeId,fact.awayId].includes(teamId))continue;
      seen.add(pid);const values=KEYS.map(name=>metric(record.stats,METRICS[name]));
      const row={playerId:pid,teamId,position:position(record),minutes,values,start,availableAt,matchId:id};
      fact.players.push(row);appearanceCount++;
      const pk=key(fact.leagueId,pid);if(!players.has(pk))players.set(pk,[]);players.get(pk).push(row);
    }
    facts.set(id,fact);
    for(const teamId of [fact.homeId,fact.awayId]){const tk=key(fact.leagueId,teamId);if(!teams.has(tk))teams.set(tk,[]);teams.get(tk).push(fact);}
  }
  for(const rows of [...teams.values(),...players.values()])rows.sort(timelineOrder);
  const contexts=new Map();
  function context(leagueId,cutoff,count,targetId,rootPair){
    const ck=`${leagueId}:${cutoff}:${count}:${targetId}:${rootPair}`;
    if(contexts.has(ck)){const previous=contexts.get(ck);contexts.delete(ck);contexts.set(ck,previous);return previous;}
    const queriedPlayers=new Map(),queriedTeams=new Map(),pools=new Map(),usedMatches=new Set(),usedPlayers=new Set();let maxAvailableAt=-Infinity;
    const decay=availableAt=>Math.pow(.5,Math.max(0,(cutoff-availableAt)/DAY)/HALF_LIFE);
    const track=row=>{usedMatches.add(String(row.matchId??row.id));maxAvailableAt=Math.max(maxAvailableAt,row.availableAt);};
    function recentTeam(teamId){
      if(!queriedTeams.has(teamId)){const rows=select(teams.get(key(leagueId,teamId))??[],cutoff,count,targetId);rows.forEach(track);queriedTeams.set(teamId,rows);}return queriedTeams.get(teamId);
    }
    function profile(playerId){
      if(queriedPlayers.has(playerId))return queriedPlayers.get(playerId);
      const rows=select(players.get(key(leagueId,playerId))??[],cutoff,count,targetId),sums=Array(M).fill(0),exposure=Array(M).fill(0),games=Array(M).fill(0);
      let allMinutes=0,minutes=0,pairSum=0,pairMinutes=0,pairGames=0;
      for(const row of rows){
        track(row);const w=decay(row.availableAt),mins=row.minutes*w;allMinutes+=mins;minutes+=row.minutes;
        for(let i=0;i<M;i++)if(finite(row.values[i])){sums[i]+=row.values[i]*w;exposure[i]+=mins;games[i]++;}
        if(finite(row.values[0])&&finite(row.values[1])){pairSum+=(row.values[1]-row.values[0])*w;pairMinutes+=mins;pairGames++;}
      }
      const metrics=Object.fromEntries(KEYS.map((name,i)=>[name,{rate:exposure[i]>0?sums[i]*90/exposure[i]:null,
        reliability:exposure[i]/(exposure[i]+PRIOR_MINUTES),minutesCovered:exposure[i],games:games[i],coverage:allMinutes?exposure[i]/allMinutes:0}]));
      const result={playerId,position:rows[0]?.position??null,games:rows.length,minutes,decayedMinutes:allMinutes,metrics,
        finishing:{rate:pairMinutes?pairSum*90/pairMinutes:null,reliability:pairMinutes/(pairMinutes+PRIOR_MINUTES),
          coverage:allMinutes?pairMinutes/allMinutes:0,minutesCovered:pairMinutes,games:pairGames}};
      queriedPlayers.set(playerId,result);usedPlayers.add(playerId);return result;
    }
    function pool(teamId){
      if(pools.has(teamId))return pools.get(teamId);
      const window=recentTeam(teamId),participation=new Map(),encounters=new Map(),opponents=new Map(),lineups=[];
      let expectedWeight=0,actualWeight=0,decaySum=0;
      for(const fact of window){
        const w=decay(fact.availableAt),opponent=fact.homeId===teamId?fact.awayId:fact.homeId,lineup=new Map();
        expectedWeight+=90*w;decaySum+=w;opponents.set(opponent,(opponents.get(opponent)??0)+w);
        for(const row of fact.players){const mins=row.minutes*w;
          if(row.teamId===teamId){actualWeight+=mins;participation.set(row.playerId,(participation.get(row.playerId)??0)+mins);lineup.set(row.playerId,Math.min(1,row.minutes/90));}
          else encounters.set(row.playerId,(encounters.get(row.playerId)??0)+mins);
        }
        lineups.push({weights:lineup,weight:w,minuteCoverage:fact.players.filter(p=>p.teamId===teamId).reduce((s,p)=>s+p.minutes,0)/990});
      }
      const denominator=Math.max(expectedWeight,actualWeight/11,1e-12);
      const members=[...participation].map(([id,weight])=>({id,weight:weight/denominator,profile:profile(id)}));
      const cohort=[...encounters].sort((a,b)=>b[1]-a[1]||idOrder(a[0],b[0])).slice(0,MAX_OPPONENT_PLAYERS)
        .map(([id,weight])=>({id,weight,profile:profile(id)}));
      let xgSum=0,xgCoverage=0,creationSum=0,creationCoverage=0,finishingSum=0,finishingCoverage=0,outfieldWeight=0;
      let defenseSum=0,defenseCoverage=0,defenseWeight=0,keeperSum=0,keeperCoverage=0,keeperWeight=0;
      const scoring=[];
      for(const p of members){
        if(p.profile.position!==0){
          outfieldWeight+=p.weight;const xg=p.profile.metrics.xg,creation=combine(p.profile,CREATION),finish=p.profile.finishing;
          if(xg.rate!==null){const contribution=p.weight*xg.rate*xg.reliability;xgSum+=contribution;scoring.push(Math.max(0,contribution));}
          xgCoverage+=p.weight*xg.coverage;
          if(creation.value!==null)creationSum+=p.weight*creation.value;creationCoverage+=p.weight*creation.coverage;
          if(finish.rate!==null)finishingSum+=p.weight*finish.rate*finish.reliability;finishingCoverage+=p.weight*finish.coverage;
        }
        const rw=p.weight*defenseRole(p.profile.position),defense=combine(p.profile,DEFENSE);defenseWeight+=rw;
        if(defense.value!==null)defenseSum+=rw*defense.value;defenseCoverage+=rw*defense.coverage;
        if(p.profile.position===0){const gp=p.profile.metrics.goalsPrevented;keeperWeight+=p.weight;
          if(gp.rate!==null)keeperSum+=p.weight*gp.rate*gp.reliability;keeperCoverage+=p.weight*gp.coverage;}
      }
      const outDenom=Math.max(10,outfieldWeight),defDenom=Math.max(5.5,defenseWeight),keeperDenom=Math.max(1,keeperWeight);
      let continuitySum=0,continuityWeight=0;
      for(let i=1;i<lineups.length;i++)if(lineups[i-1].minuteCoverage>=.5&&lineups[i].minuteCoverage>=.5){
        const j=weightedJaccard(lineups[i-1].weights,lineups[i].weights),w=(lineups[i-1].weight+lineups[i].weight)/2;
        if(j!==null){continuitySum+=j*w;continuityWeight+=w;}
      }
      let encounterAttack=0,encounterAttackWeight=0,encounterAttackCoverage=0,encounterDefense=0,encounterDefenseWeight=0,encounterDefenseCoverage=0;
      for(const p of cohort){
        if(p.profile.position!==0){const attack=combine(p.profile,ATTACK);encounterAttackWeight+=p.weight;
          if(attack.value!==null)encounterAttack+=p.weight*attack.value;encounterAttackCoverage+=p.weight*attack.coverage;}
        const rw=p.weight*defenseRole(p.profile.position),defense=combine(p.profile,DEFENSE);encounterDefenseWeight+=rw;
        if(defense.value!==null)encounterDefense+=rw*defense.value;encounterDefenseCoverage+=rw*defense.coverage;
      }
      const scoringTotal=scoring.reduce((s,n)=>s+n,0),xgCov=clamp(xgCoverage/outDenom,0,1);
      const result={teamId,window,members,cohort,opponents,
        raw:{poolXg:xgCoverage>0?xgSum/2:null,poolCreation:creationCoverage>0?creationSum/1.5:null,
          finishingQuality:finishingCoverage>0?finishingSum/Math.max(outfieldWeight,1)/.25:null,
          defense:defenseCoverage>0?defenseSum/Math.max(defenseWeight,1):null,
          keeper:keeperCoverage>0?keeperSum/keeperDenom/.5:null,
          scoringConcentration:xgCov>=.4&&scoringTotal>0?scoring.reduce((s,n)=>s+(n/scoringTotal)**2,0):null,
          continuity:continuityWeight?continuitySum/continuityWeight:null,
          encounteredOpponentAttack:encounterAttackCoverage>0?encounterAttack/Math.max(encounterAttackWeight,1e-12)/.3:null,
          encounteredOpponentDefense:encounterDefenseCoverage>0?encounterDefense/Math.max(encounterDefenseWeight,1e-12):null},
        cover:{poolXg:xgCov,poolCreation:clamp(creationCoverage/outDenom,0,1),finishingQuality:clamp(finishingCoverage/outDenom,0,1),
          defense:clamp(defenseCoverage/defDenom,0,1),keeper:clamp(keeperCoverage/keeperDenom,0,1),
          scoringConcentration:xgCov>=.4&&scoringTotal>0?xgCov:0,
          continuity:window.length>=2?clamp(continuityWeight/Math.max(decaySum,1e-12),0,1):0,
          encounteredOpponentAttack:encounterAttackWeight?clamp(encounterAttackCoverage/encounterAttackWeight,0,1):0,
          encounteredOpponentDefense:encounterDefenseWeight?clamp(encounterDefenseCoverage/encounterDefenseWeight,0,1):0},
        historyFraction:window.length?clamp(window.length/count*(decaySum/window.length)*Math.min(1,actualWeight/Math.max(11*expectedWeight,1e-12)),0,1):0,
        minuteCoverage:window.length?clamp(actualWeight/Math.max(11*expectedWeight,1e-12),0,1):0};
      pools.set(teamId,result);return result;
    }
    const ctx={pool,usedMatches,usedPlayers,get maxAvailableAt(){return maxAvailableAt;}};
    contexts.set(ck,ctx);if(contexts.size>16)contexts.delete(contexts.keys().next().value);return ctx;
  }
  return {coverage:{matchCount:facts.size,appearanceCount,leagueCount:new Set([...facts.values()].map(f=>f.leagueId)).size,
      relationship:'confirmed-opponent-team-co-appearance',notes:'Aynı maçta karşı takımda oynama kanıtı; birebir düello veya pas bağlantısı iddiası değildir.'},
    features(target,{cutoff,formCount=10}={}){
      const date=stamp(target?.date),requested=stamp(cutoff),before=finite(requested)?Math.min(date,requested):date;
      if(!finite(before)||target?.id==null||target?.home?.id==null||target?.away?.id==null||target.leagueId==null||String(target.home.id)===String(target.away.id))throw new Error('Oyuncu ağı özellikleri için geçerli hedef, lig ve zaman kesimi gerekli.');
      const count=[5,10].includes(Number(formCount))?Number(formCount):10,targetId=String(target.id),leagueId=String(target.leagueId);
      const ctx=context(leagueId,before,count,targetId,`${target.home.id}:${target.away.id}`),h=ctx.pool(String(target.home.id)),a=ctx.pool(String(target.away.id));
      const overlap=h.window.length&&a.window.length?weightedJaccard(h.opponents,a.opponents):null;
      const vector=(own,opponent)=>{
        const raw={poolXg:own.raw.poolXg,poolCreation:own.raw.poolCreation,finishingQuality:own.raw.finishingQuality,
          opponentDefense:opponent.raw.defense,opponentKeeper:opponent.raw.keeper,scoringConcentration:own.raw.scoringConcentration,
          continuity:own.raw.continuity,encounteredOpponentAttack:own.raw.encounteredOpponentAttack,
          encounteredOpponentDefense:own.raw.encounteredOpponentDefense,sharedOpponentOverlap:overlap};
        const coverage={...own.cover,opponentDefense:opponent.cover.defense,opponentKeeper:opponent.cover.keeper,
          sharedOpponentOverlap:overlap===null?0:Math.min(h.window.length/count,a.window.length/count)};
        const names=PLAYER_GRAPH_FEATURE_NAMES.slice(0,10),missingFraction=1-names.reduce((s,name)=>s+(coverage[name]??0),0)/names.length;
        return {values:[...names.map(name=>clip(raw[name])),own.historyFraction,clamp(missingFraction,0,1)],
          coverage:{historyGames:own.window.length,requested:count,playerCount:own.members.length,opponentPlayerCount:own.cohort.length,
            minuteCoverage:own.minuteCoverage,historyFraction:own.historyFraction,missingFraction,features:Object.fromEntries(names.map(name=>[name,coverage[name]??0]))},
          evidence:{teamId:own.teamId,teamMatchIds:own.window.map(f=>f.id),playerIds:own.members.map(p=>p.id),
            secondHopPlayerIds:own.cohort.map(p=>p.id),metricValues:raw,
            relationship:'confirmed-opponent-team-co-appearance',unknownFutureLineup:true}};
      };
      const home=vector(h,a),away=vector(a,h),maximum=finite(ctx.maxAvailableAt)?new Date(ctx.maxAvailableAt).toISOString():null;
      return {home:home.values,away:away.values,featureNames:[...PLAYER_GRAPH_FEATURE_NAMES],cutoff:new Date(before).toISOString(),
        coverage:{home:home.coverage,away:away.coverage,leagueId,formCount:count},
        evidence:{home:home.evidence,away:away.evidence,maxAvailableAt:maximum,matchCount:ctx.usedMatches.size,playerCount:ctx.usedPlayers.size,
          matchIds:[...ctx.usedMatches].sort(idOrder),halfLifeDays:HALF_LIFE,priorMinutes:PRIOR_MINUTES,maxOpponentPlayers:MAX_OPPONENT_PLAYERS,
          notes:'Profiller ve takım pencereleri yalnız hedef ligden, zaman kesiminden önce tamamlanan maçlardan gelir. Metrikler 270 dakikalık sıfır katkı öncülüne küçültülen eğitim girdileridir; null bilinmeyen ölçüm, sayısal 0 ise bilinmeyen girdinin nötr kodlaması olabilir. Hedefin gerçek kadrosu ve istatistikleri okunmaz.'}};
    }
  };
}
