import {starterVector,STARTER_FEATURE_NAMES} from './starter-features.mjs';
import {GRAPH_OUTCOME_FEATURE_NAMES} from './player-graph-training.mjs';
import {predictGbdt} from './gbdt-training.mjs';
import {goalProbabilities} from './outcome-training.mjs';
const PREFIX=GRAPH_OUTCOME_FEATURE_NAMES.length,END=PREFIX+STARTER_FEATURE_NAMES.length;
export function lineupMeans(model,input,lineups){const out={};
 for(const side of ['home','away']){const original=input[side+'Features'];
  const x=[...original.slice(0,PREFIX),...starterVector(lineups[side],lineups[side==='home'?'away':'home'],original[END-1]),...original.slice(END)];
  out[side]=predictGbdt(model,input[side+'Base'],x);}
 return out;
}
function winProbability(means,side,shape){const h=goalProbabilities(means.home,80,shape),a=goalProbabilities(means.away,80,shape);let win=0,mass=0;
 for(let i=0;i<h.length;i++)for(let j=0;j<a.length;j++){const p=h[i]*a[j];mass+=p;if(side==='home'?i>j:j>i)win+=p;}return mass?win/mass:0;}
const credible=p=>p&&p.games>=2&&p.minutes>=90&&[0,1,2,3].includes(p.position);
export function optimizeAbsenceReplacements(model,input,starters){
 const current=Object.fromEntries(['home','away'].map(s=>[s,[...starters.teams[s].profiles]]));
 for(const side of ['home','away']){const team=starters.teams[side],other=side==='home'?'away':'home';
  for(const replacement of team.replacements){if(!replacement.inId)continue;const selected=current[side],ids=new Set(selected.map(p=>p.id));let best=null;
   for(const p of team.poolProfiles.filter(p=>p.eligible!==false&&p.position===replacement.position&&credible(p)&&(!ids.has(p.id)||p.id===replacement.inId))){
    const roster=selected.map(q=>q.id===replacement.inId?p:q),means=lineupMeans(model,input,{...current,[side]:roster}),score=means[side]-means[other];
    if(!best||score>best.score+1e-12||Math.abs(score-best.score)<1e-12&&p.id.localeCompare(best.p.id)<0)best={p,roster,score};}
   if(best){replacement.inId=best.p.id;replacement.inName=best.p.name;replacement.selection='gbdt-net-goal-counterfactual';current[side]=best.roster;}
  }
  team.profiles=current[side].sort((a,b)=>(a.position??4)-(b.position??4)||b.minutes-a.minutes||a.id.localeCompare(b.id));
 }
 starters.home=starterVector(current.home,current.away,starters.home.at(-1));starters.away=starterVector(current.away,current.home,starters.away.at(-1));
 return starters;
}
export function playerContributionReport(model,starters,{lineups=null}={}){
 const input=model.gbdt?.targetInput;if(!input||!starters)return null;
 const current=lineups??Object.fromEntries(['home','away'].map(s=>[s,starters.teams[s].profiles]));
 const actual=lineupMeans(model,input,current),rows=[];
 for(const side of ['home','away']){
  const team=starters.teams[side],other=side==='home'?'away':'home',selected=current[side],ids=new Set(selected.map(p=>p.id));
  for(const p of team.poolProfiles??team.profiles){
   const absence=team.absences?.find(a=>a.id===p.id),replacement=team.replacements?.find(r=>r.outId===p.id),isSelected=ids.has(p.id),candidates=isSelected?
    (team.poolProfiles??[]).filter(q=>q.id!==p.id&&q.position===p.position&&q.eligible!==false&&!q.unavailable&&!ids.has(q.id)&&credible(q)):
    selected.filter(q=>q.position===p.position&&credible(q)&&(!replacement?.inId||q.id===replacement.inId));
   let best=null;for(const q of candidates){const roster=selected.map(r=>r.id===(isSelected?p.id:q.id)?isSelected?q:p:r),means=lineupMeans(model,input,{...current,[side]:roster});
    const score=means[side]-means[other];if(!best||score>best.score+1e-12||Math.abs(score-best.score)<1e-12&&q.id.localeCompare(best.player.id)<0)best={player:q,means,score};}
   const supported=credible(p)&&!!best,withPlayer=isSelected?actual:best?.means,withoutPlayer=isSelected?best?.means:actual;
   rows.push({teamId:team.teamId,teamName:team.name,side,playerId:p.id,name:p.name,position:p.position,selected:isSelected,unavailable:!!absence,
    absence:absence??null,historyOnly:p.eligible===false&&!absence,games:p.games,minutes:p.minutes,supported,comparisonPlayerId:best?.player.id??null,comparisonPlayer:best?.player.name??null,
    ownGoalContribution:supported?withPlayer[side]-withoutPlayer[side]:null,
    opponentGoalsAvoided:supported?withoutPlayer[other]-withPlayer[other]:null,
    netGoalContribution:supported?withPlayer[side]-withoutPlayer[side]+withoutPlayer[other]-withPlayer[other]:null,
    winProbabilityDelta:supported?winProbability(withPlayer,side,model.shape??null)-winProbability(withoutPlayer,side,model.shape??null):null,
    withPlayer:supported?withPlayer:null,withoutPlayer:supported?withoutPlayer:null,
    reason:supported?'Aynı ağaçlar ve sabit diğer oyuncularla, aynı mevki değişikliği kıyası.':!credible(p)?'Oyuncu için en az iki maç / 90 dakika geçmişi yok.':'Geçmişi yeterli aynı mevki kıyas oyuncusu yok.'});
  }
 }
 const healthy=Object.fromEntries(['home','away'].map(s=>[s,starters.teams[s].baselineProfiles??current[s]]));
 const complete=['home','away'].every(s=>healthy[s].length===11&&current[s].length===11);
 const healthyMeans=complete?lineupMeans(model,input,healthy):null;
 return {version:'gbdt-counterfactual-xi-v1',rows,selectedMeans:actual,healthyPreviousXI:healthyMeans,
  absenceImpact:healthyMeans?{home:actual.home-healthyMeans.home,away:actual.away-healthyMeans.away}:null,
  policy:'Her oyuncu için aynı mevki karşılaştırması; en az iki maç / 90 dakika gözlem. GBDT gol farkı ve galibiyet olasılığı farkı gösterilir. Aday yedek seçimi kendi gol beklentisi − rakip gol beklentisini en çok yükselten geçmişli oyuncudur.',
  note:'Bu, modelin kadro değişikliğine duyarlılığıdır; oyuncunun gerçek veya nedensel katkısının ölçümü değildir. Etkiler birbirine eklenmez; etkileşimler nedeniyle toplamları takım etkisine eşit olmak zorunda değildir. Eksik veri sıfır katkı sayılmaz.'};
}
