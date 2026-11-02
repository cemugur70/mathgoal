// Speed figures from each horse's own finishing time: seconds per 1000 m faster than the par for the breed, track, surface and distance,
// corrected by the day's track variant (going, wind) measured on every finisher that day. Positive = faster than par. Pure.
const PAR_MIN=30,VARIANT_MIN=6,OUTLIER=8;
/** "1.28.90" → 88.9 s; null when the text is not a finishing time. */
export function parseTiming(t){
 const m=/^(\d+)\.(\d{2})\.(\d{2})$/.exec(t??'');if(!m)return null;
 const s=Number(m[1])*60+Number(m[2])+Number(m[3])/100;return s>20?s:null;
}
const median=v=>{if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),h=s.length>>1;return s.length%2?s[h]:(s[h-1]+s[h])/2;};
const perKm=(seconds,distance)=>seconds*1000/distance;
/**
 * Median time per 1000 m by breed + track + surface + distance, with breed + surface + distance as the fallback for thin cells.
 * Only runs dated before `before` are used, so a later validation period never shapes its own pars.
 */
export function buildSpeedPars(runsByHorse,breedByHorse,{before='9999-12-31'}={}){
 const cells=new Map(),add=(k,v)=>(cells.get(k)??cells.set(k,[]).get(k)).push(v);
 for(const [id,runs] of runsByHorse){
  const breed=breedByHorse.get(id);if(!breed)continue;
  for(const r of runs){
   const t=parseTiming(r.timing);if(t===null||!(r.distance>0)||r.date>=before)continue;
   const pace=perKm(t,r.distance);add(`${breed}|${r.trackCode}|${r.surface}|${r.distance}`,pace);add(`${breed}|*|${r.surface}|${r.distance}`,pace);
  }
 }
 const pars=new Map();for(const [k,v] of cells)if(v.length>=PAR_MIN)pars.set(k,median(v));
 return pars;
}
const parOf=(pars,breed,r)=>pars.get(`${breed}|${r.trackCode}|${r.surface}|${r.distance}`)??pars.get(`${breed}|*|${r.surface}|${r.distance}`)??null;
/**
 * Sets `fig` on every run with a finishing time and a par: par − time − day variant, in seconds per 1000 m.
 * The variant is the median deviation of all finishers at that track, date and surface (0 below VARIANT_MIN finishers).
 */
export function attachSpeedFigures(runsByHorse,breedByHorse,pars){
 const raw=[],days=new Map();
 for(const [id,runs] of runsByHorse){
  const breed=breedByHorse.get(id);
  for(const r of runs){
   r.fig=null;const t=parseTiming(r.timing),par=breed&&r.distance>0?parOf(pars,breed,r):null;if(t===null||par===null)continue;
   const dev=perKm(t,r.distance)-par,k=`${r.trackCode}|${r.date}|${r.surface}`;raw.push([r,dev,k]);
   if(Math.abs(dev)<OUTLIER)(days.get(k)??days.set(k,[]).get(k)).push(dev);
  }
 }
 const variant=new Map([...days].map(([k,v])=>[k,v.length>=VARIANT_MIN?median(v):0]));
 let n=0;for(const [r,dev,k] of raw){r.fig=+(-(dev-(variant.get(k)??0))).toFixed(3);n++;}
 return n;
}
/** Figure summary from a horse's runs strictly before the race: best of the last 4 within a year, and the mean of the last 3. */
export function speedProfile(runs,race){
 const past=(runs||[]).filter(r=>r.date<race.date&&r.fig!=null).sort((a,b)=>b.date.localeCompare(a.date));
 const year=new Date(Date.parse(race.date)-365*86400000).toISOString().slice(0,10),recent=past.slice(0,4).filter(r=>r.date>=year),last3=past.slice(0,3);
 return {best:recent.length?Math.max(...recent.map(r=>r.fig)):null,avg:last3.length?last3.reduce((a,r)=>a+r.fig,0)/last3.length:null,last:past[0]?.fig??null,n:past.length};
}
