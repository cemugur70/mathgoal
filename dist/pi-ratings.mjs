// Pi-ratings (Constantinou & Fenton, 2013, J. Quantitative Analysis in Sports 9(1)) replayed strictly as of each cutoff.
// Every team has a home and an away rating expressed on a goal-difference scale; only completed competitive results before the cutoff update them.
const finite=v=>typeof v==='number'&&Number.isFinite(v),stamp=v=>v==null?NaN:typeof v==='number'?v:Date.parse(v),LAG=10800000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const PI_POLICY=Object.freeze({version:'pi-ratings-cf2013-v1',lambda:.035,gamma:.7,b:10,c:3,
 note:'Yayımlanmış λ=0,035, γ=0,7, b=10, c=3 parametreleri; test sonuçlarına göre ayarlanmadı. Hazırlık, iptal ve hükmen maçlar dışlanır.'});
export const PI_FEATURE_NAMES=Object.freeze(['ownVenueRating','opponentVenueRating','ownHomeRating','ownAwayRating','opponentHomeRating','opponentAwayRating',
 'expectedGoalDifference','ownMatches','opponentMatches','missingFraction'].map(n=>'pi.'+n));
/** Expected goal difference implied by a single rating. */
export const ratingToGoals=r=>Math.sign(r)*(PI_POLICY.b**(Math.abs(r)/PI_POLICY.c)-1);
/** One pi-rating update; returns the new ratings for both teams (pure, for tests and replay). */
export function piUpdate(home,away,homeGoals,awayGoals,{lambda=PI_POLICY.lambda,gamma=PI_POLICY.gamma,c=PI_POLICY.c}={}){
 const expected=ratingToGoals(home.home)-ratingToGoals(away.away),observed=homeGoals-awayGoals,error=Math.abs(observed-expected);
 const psi=c*Math.log10(1+error),psiHome=observed>expected?psi:-psi,psiAway=observed<expected?psi:-psi;
 const nextHomeHome=home.home+psiHome*lambda,nextAwayAway=away.away+psiAway*lambda;
 return {home:{home:nextHomeHome,away:home.away+(nextHomeHome-home.home)*gamma,matches:home.matches+1},
  away:{home:away.home+(nextAwayAway-away.away)*gamma,away:nextAwayAway,matches:away.matches+1},expected,observed};
}
export function createPiRatingIndex(matches,{lambda=PI_POLICY.lambda,gamma=PI_POLICY.gamma}={}){
 const byId=new Map(),conflicts=new Set();
 for(const m of matches??[]){if(m?.id==null||!m.home?.id||!m.away?.id||String(m.home.id)===String(m.away.id)||m.finished===false||m.cancelled||m.awarded||[489,114].includes(Number(m.leagueId))||![m.homeScore,m.awayScore].every(v=>Number.isInteger(v)&&v>=0&&v<=100)||!finite(stamp(m.date)))continue;
  const id=String(m.id),previous=byId.get(id);if(previous&&(m.homeScore!==previous.homeScore||m.awayScore!==previous.awayScore||String(m.home.id)!==String(previous.home.id)||String(m.away.id)!==String(previous.away.id))){conflicts.add(id);continue;}
  if(!previous)byId.set(id,m);
 }
 for(const id of conflicts)byId.delete(id);
 // Replay in completion order; ties broken by kickoff then id so the result is deterministic.
 const events=[...byId.values()].map(m=>{const start=stamp(m.date),end=stamp(m.completedAt??m.finishedAt??m.endDate);return {id:String(m.id),start,available:finite(end)&&end>=start?end:start+LAG,home:String(m.home.id),away:String(m.away.id),hg:m.homeScore,ag:m.awayScore};})
  .sort((a,b)=>a.available-b.available||a.start-b.start||a.id.localeCompare(b.id));
 let ratings=new Map(),pointer=0,lastCutoff=-Infinity,lastApplied=null;
 const get=id=>ratings.get(id)??{home:0,away:0,matches:0};
 function advance(before,excludeId){
  if(before<lastCutoff){ratings=new Map();pointer=0;lastApplied=null;}
  while(pointer<events.length&&events[pointer].available<before&&events[pointer].start<before){const e=events[pointer++];if(e.id===excludeId)continue;
   const u=piUpdate(get(e.home),get(e.away),e.hg,e.ag,{lambda,gamma});ratings.set(e.home,u.home);ratings.set(e.away,u.away);lastApplied=e.available;}
  lastCutoff=before;
 }
 return {size:events.length,features(target,{cutoff=target.date}={}){
  const before=stamp(cutoff);if(!finite(before))throw Error('Pi-rating kesim zamanı geçersiz.');
  // The target itself can never be applied: it is excluded explicitly and, being unfinished at the cutoff, it is not yet available.
  advance(before,String(target.id));
  const h=get(String(target.home.id)),a=get(String(target.away.id)),expected=ratingToGoals(h.home)-ratingToGoals(a.away),missing=(h.matches?0:.5)+(a.matches?0:.5);
  const side=(own,opp,venueOwn,venueOpp,gd)=>[clamp(own[venueOwn],-3,3),clamp(opp[venueOpp],-3,3),clamp(own.home,-3,3),clamp(own.away,-3,3),clamp(opp.home,-3,3),clamp(opp.away,-3,3),clamp(gd/3,-1,1),Math.min(own.matches,38)/38,Math.min(opp.matches,38)/38,missing];
  return {home:side(h,a,'home','away',expected),away:side(a,h,'away','home',-expected),ratings:{home:{...h},away:{...a}},expectedGoalDifference:expected,
   coverage:{status:h.matches>=3&&a.matches>=3?'ready':'insufficient',homeMatches:h.matches,awayMatches:a.matches},
   evidence:{maxAvailableAt:lastApplied==null?null:new Date(lastApplied).toISOString(),appliedMatches:pointer,usesTargetOutcome:false}};
 }};
}
