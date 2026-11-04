// Sire surface preference: how the offspring of a horse's sire run on the race surface against their own overall level, from
// every past run of every offspring (program "last runs"), shrunk towards zero. Reads advance through the runs in date order, so
// calls must come in non-decreasing race date (the walk-forward replay order); only runs strictly before the race date count. Pure.
import {surfaceGroup} from './horse-model.mjs';
const SURFACE_INDEX={DIRT:0,TURF:1,AWT:2};
export function createSirePreference(runsByHorse,sireByHorse,{prior=30,minRuns=20}={}){
 // Flat date-sorted run list (sire number, surface, place score) kept in typed arrays.
 const sires=new Map(),list=[];
 for(const [h,runs] of runsByHorse){const name=sireByHorse.get(h);if(!name)continue;
  const s=sires.get(name)??sires.set(name,sires.size).get(name);
  for(const r of runs){const g=SURFACE_INDEX[surfaceGroup(r.surface)];if(g!==undefined&&r.place>0)list.push([r.date,s,g,1/r.place]);}}
 list.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 const dates=list.map(x=>x[0]),sire=Int32Array.from(list,x=>x[1]),surf=Uint8Array.from(list,x=>x[2]),score=Float64Array.from(list,x=>x[3]);
 // Per sire: [sum, n] overall then per surface.
 const sum=new Float64Array(sires.size*4),n=new Int32Array(sires.size*4);let at=0;
 return {
  /** Shrunk mean place score of the sire's offspring on this surface minus their overall mean; 0 when unknown. */
  get(date,sireName,surface){
   for(;at<dates.length&&dates[at]<date;at++){const k=sire[at]*4;sum[k]+=score[at];n[k]++;sum[k+1+surf[at]]+=score[at];n[k+1+surf[at]]++;}
   const s=sires.get(sireName),g=SURFACE_INDEX[surfaceGroup(surface)];if(s===undefined||g===undefined)return 0;
   const k=s*4;if(n[k]<minRuns)return 0;const m=sum[k]/n[k];
   return (sum[k+1+g]+prior*m)/(n[k+1+g]+prior)-m;
  },
 };
}
