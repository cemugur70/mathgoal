// Workout (galop) features from a race's liderform gallop page: each runner's last ten workouts before the race. Pure.
// A workout time is compared with the median time of the same kind of workout (track, breed, workout type, workout length, going,
// effort, checkpoint), so a fast easy gallop on a wet track scores like a fast one anywhere else.
export const GALLOP_DISTANCES=[400,600,800,1000,1200];
/** Pars come from workouts before this date, so 2026 races are scored with pars that never saw them. */
export const GALLOP_PARS_BEFORE='2026-01-01';
const DAY=86400000,MIN_PAR=30,CAP=8;
const HARD=new Set(['ALLOUT','DRIVING']);
const effortOf=w=>HARD.has(w.effort)?'H':'E',lengthOf=w=>Math.max(0,...Object.keys(w.times||{}).map(Number));
// Most specific par first; going and effort are dropped when a group is too small.
const keys=(w,breed,d)=>{const l=lengthOf(w);return [[w.track,breed,w.type,l,w.going??'-',effortOf(w),d],[w.track,breed,w.type,l,'*',effortOf(w),d],[w.track,breed,w.type,l,'*','*',d]].map(k=>k.join('|'));};

/** Median time per workout kind (plain object, stored with the archive) from unique `{breed,workout}` items dated before `before`. */
export function buildGallopPars(items,{before=GALLOP_PARS_BEFORE}={}){
 const groups=new Map();
 for(const {breed,workout:w} of items){if(!breed||!(w.date<before))continue;
  for(const d of GALLOP_DISTANCES){const t=w.times?.[d];if(!(t>0))continue;for(const k of keys(w,breed,d))(groups.get(k)??groups.set(k,[]).get(k)).push(t);}}
 const pars={};
 for(const [k,v] of groups)if(v.length>=MIN_PAR){v.sort((a,b)=>a-b);pars[k]=v[v.length>>1];}
 return pars;
}

/** Percent faster than par (capped), averaged over the workout's checkpoints; null when no par fits. */
export function workoutScore(w,breed,pars){
 const s=[];
 for(const d of GALLOP_DISTANCES){const t=w.times?.[d];if(!(t>0))continue;const par=keys(w,breed,d).map(k=>pars[k]).find(Boolean);
  if(par)s.push(Math.max(-CAP,Math.min(CAP,100*(par-t)/par)));}
 return s.length?s.reduce((a,v)=>a+v,0)/s.length:null;
}

/**
 * A runner's workout profile for a race: best and recent-average (last three) score over workouts in the last `window` days, the
 * number of workouts in that window, and days since the last workout. Only workouts strictly before the race date count.
 */
export function gallopProfile(workouts,race,breed,pars,{window=45}={}){
 const t0=Date.parse(race.date),past=(workouts||[]).filter(w=>w.date<race.date).sort((a,b)=>b.date.localeCompare(a.date));
 const recent=past.filter(w=>(t0-Date.parse(w.date))/DAY<=window),scored=recent.map(w=>workoutScore(w,breed,pars)).filter(v=>v!==null);
 const r1=v=>v===null?null:Math.round(v*100)/100;
 return {n:recent.length,scored:scored.length,best:r1(scored.length?Math.max(...scored):null),avg:r1(scored.length?scored.slice(0,3).reduce((a,v)=>a+v,0)/Math.min(3,scored.length):null),
  days:past.length?Math.round((t0-Date.parse(past[0].date))/DAY):null};
}
