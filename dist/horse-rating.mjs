// Horse opponent network ("örümcek ağı") and opponent-adjusted strength ratings. Pure; replayed chronologically so every
// prediction only sees races finished before it.
export const DISTANCE_BUCKETS=['kisa','mil','orta','uzun'];
/** ≤1300 m kısa · 1301–1600 mil · 1601–2000 orta · 2001+ uzun. */
export const distanceBucket=m=>!(m>0)?null:m<=1300?'kisa':m<=1600?'mil':m<=2000?'orta':'uzun';
const runner=e=>e.status!=='NONRUNNER';
/**
 * Finishing information usable for comparisons: the contiguous known prefix of places (1, 2, 3 … with dead heats sharing a place)
 * and, behind it, everybody else as an unordered group. Places known only beyond a gap are not used, because the horses in the gap are unknown.
 */
export function finishingPrefix(entries){
 const rs=entries.filter(runner),known=rs.filter(e=>e.place>0).sort((a,b)=>a.place-b.place),prefix=[];
 for(const e of known){if(e.place<=prefix.length+1)prefix.push(e);else break;}
 const inPrefix=new Set(prefix.map(e=>e.number));
 return {prefix,rest:rs.filter(e=>!inPrefix.has(e.number)),runners:rs};
}
/** +1 when a finished ahead of b, -1 behind, 0 dead heat, null when the data cannot tell. */
export function compareFinish(a,b,prefixSize){
 const pa=a.place>0&&a.place<=prefixSize?a.place:null,pb=b.place>0&&b.place<=prefixSize?b.place:null;
 if(pa!==null&&pb!==null)return pa<pb?1:pa>pb?-1:0;
 if(pa!==null&&b.place==null)return 1;if(pb!==null&&a.place==null)return -1;
 if(a.place>0&&b.place>0)return a.place<b.place?1:a.place>b.place?-1:0;
 return null;
}

export const RATING_POLICY={lr:.35,lrSurface:.25,lrDistance:.25,lrKg:.004,minLrShare:.3,experience:4,halfLifeDays:540};
const DAY=86400000;
/**
 * Online Plackett–Luce ratings. A horse's strength in a race is base + surface offset + distance offset + β_breed·(kg − race mean).
 * Each finished race moves every runner by its log-likelihood gradient, so beating strong opponents counts more than beating weak ones
 * and strength propagates through common opponents. Offsets are re-centred on the horse's own starts, so they express relative
 * preference (a horse seen on one surface only has no surface preference) and base stays its overall ability.
 * Ratings shrink toward 0 with a half-life over long absences.
 */
export function createHorseRatingEngine(policy=RATING_POLICY){
 const horses=new Map(),kgBeta={};let updates=0;
 const decay=(h,date)=>h&&h.last?Math.pow(.5,Math.max(0,(Date.parse(date)-Date.parse(h.last))/DAY)/policy.halfLifeDays):1;
 function components(e,race,meanKg){
  const h=horses.get(e.horseId),f=decay(h,race.date),b=distanceBucket(race.distance);
  const base=(h?.base??0)*f,surface=(h?.surface[race.surface]??0)*f,distance=(h?.distance[b]??0)*f,kg=e.kg>0&&meanKg>0?(kgBeta[race.breed]??0)*(e.kg-meanKg):0;
  return {base,surface,distance,kg,total:base+surface+distance+kg,starts:h?.n??0,surfaceStarts:h?.surfaceN[race.surface]??0,distanceStarts:h?.distanceN[b]??0};
 }
 const meanKgOf=rs=>{const v=rs.map(e=>e.kg).filter(x=>x>0);return v.length?v.reduce((a,x)=>a+x,0)/v.length:0;};
 /** Win probabilities from current ratings (softmax of strengths); `temperature` scales the strengths. */
 function predict(race,entries,{temperature=1}={}){
  const rs=entries.filter(runner),meanKg=meanKgOf(rs),cs=rs.map(e=>components(e,race,meanKg)),m=Math.max(...cs.map(c=>c.total*temperature));
  const ex=cs.map(c=>Math.exp(c.total*temperature-m)),z=ex.reduce((a,x)=>a+x,0);
  return rs.map((e,i)=>({number:e.number,horseId:e.horseId,...cs[i],prob:ex[i]/z}));
 }
 /** Plackett–Luce gradient over the known finishing prefix; the unordered rest only enters the denominators. */
 function gradient(strengths,prefixIdx){
  const n=strengths.length,g=new Array(n).fill(0),left=new Set(strengths.map((_,i)=>i));
  for(const w of prefixIdx){
   if(left.size<2)break;
   const m=Math.max(...[...left].map(i=>strengths[i]));let z=0;for(const i of left)z+=Math.exp(strengths[i]-m);
   for(const i of left)g[i]-=Math.exp(strengths[i]-m)/z;g[w]+=1;left.delete(w);
  }
  return g;
 }
 function update(race,entries){
  const {prefix,runners:rs}=finishingPrefix(entries);if(!prefix.length||rs.length<2)return false;
  const meanKg=meanKgOf(rs),cs=rs.map(e=>components(e,race,meanKg)),idx=new Map(rs.map((e,i)=>[e.number,i]));
  const g=gradient(cs.map(c=>c.total),prefix.map(e=>idx.get(e.number))),b=distanceBucket(race.distance);
  let kgGrad=0;
  rs.forEach((e,i)=>{
   if(e.kg>0&&meanKg>0)kgGrad+=g[i]*(e.kg-meanKg);
   if(e.horseId==null)return;
   let h=horses.get(e.horseId);
   if(!h){h={base:0,surface:{},distance:{},surfaceN:{},distanceN:{},n:0,last:null};horses.set(e.horseId,h);}
   const f=decay(h,race.date);h.base*=f;for(const k in h.surface)h.surface[k]*=f;for(const k in h.distance)h.distance[k]*=f;
   const lr=policy.lr*Math.max(policy.minLrShare,1/Math.sqrt(1+h.n/policy.experience));
   h.base+=lr*g[i];h.surface[race.surface]=(h.surface[race.surface]??0)+lr*policy.lrSurface/policy.lr*g[i];
   if(b)h.distance[b]=(h.distance[b]??0)+lr*policy.lrDistance/policy.lr*g[i];
   h.n++;h.surfaceN[race.surface]=(h.surfaceN[race.surface]??0)+1;if(b)h.distanceN[b]=(h.distanceN[b]??0)+1;h.last=race.date;
   // Re-centre offsets on the horse's own start mix so they stay relative preferences.
   for(const [map,counts] of [[h.surface,h.surfaceN],[h.distance,h.distanceN]]){
    const tot=Object.values(counts).reduce((a,x)=>a+x,0);if(!tot)continue;const mean=Object.entries(map).reduce((a,[k,v])=>a+v*(counts[k]??0),0)/tot;
    for(const k in map)map[k]-=mean;h.base+=mean;
   }
  });
  kgBeta[race.breed]=(kgBeta[race.breed]??0)+policy.lrKg*kgGrad;updates++;
  return true;
 }
 return {predict,update,horse:id=>horses.get(id)??null,kgBeta:()=>({...kgBeta}),size:()=>horses.size,updates:()=>updates};
}

/**
 * Head-to-head index over finished races ("kim kimi hangi şartlarda geçti"). Only races strictly before `cutoff` are used.
 */
export function createMeetingIndex(races){
 const byHorse=new Map();
 races.forEach((x,ri)=>{const {prefix,runners:rs}=finishingPrefix(x.entries);if(!prefix.length)return;x.prefixSize=prefix.length;for(const e of rs)if(e.horseId!=null)(byHorse.get(e.horseId)??byHorse.set(e.horseId,[]).get(e.horseId)).push(ri);});
 const entryOf=(x,id)=>x.entries.find(e=>e.horseId===id&&runner(e));
 function meetings(a,b,cutoff){
  const ra=byHorse.get(a)||[],rb=new Set(byHorse.get(b)||[]),out=[];
  for(const ri of ra){
   if(!rb.has(ri))continue;const x=races[ri];if(!(x.race.date<cutoff))continue;
   const ea=entryOf(x,a),eb=entryOf(x,b),r=compareFinish(ea,eb,x.prefixSize);if(r===null)continue;
   out.push({date:x.race.date,city:x.race.city,surface:x.race.surface,distance:x.race.distance,label:x.race.label,result:r,placeA:ea.place??null,placeB:eb.place??null,kgA:ea.kg,kgB:eb.kg,field:x.entries.filter(runner).length});
  }
  return out.sort((p,q)=>q.date.localeCompare(p.date));
 }
 /** Net score of a against every opponent it has a decided result with: +1 ahead, -1 behind. */
 function opponents(a,cutoff){
  const score=new Map();
  for(const ri of byHorse.get(a)||[]){
   const x=races[ri];if(!(x.race.date<cutoff))continue;const ea=entryOf(x,a);
   for(const eb of x.entries){if(eb.horseId===a||!runner(eb)||eb.horseId==null)continue;const r=compareFinish(ea,eb,x.prefixSize);if(r===null||r===0)continue;
    const s=score.get(eb.horseId)??{net:0,n:0};s.net+=r;s.n++;score.set(eb.horseId,s);}
  }
  return score;
 }
 /** Every pair of a field: direct meetings plus common-opponent evidence (a vs c compared with b vs c). */
 function fieldNetwork(entries,cutoff){
  const rs=entries.filter(e=>runner(e)&&e.horseId!=null),opp=new Map(rs.map(e=>[e.horseId,opponents(e.horseId,cutoff)])),pairs=[];
  for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){
   const a=rs[i],b=rs[j],direct=meetings(a.horseId,b.horseId,cutoff),oa=opp.get(a.horseId),ob=opp.get(b.horseId);let common=0,indirect=0;
   for(const [c,sa] of oa){if(c===b.horseId||!ob.has(c))continue;const sb=ob.get(c);common++;indirect+=Math.sign(sa.net/sa.n-sb.net/sb.n);}
   pairs.push({a:a.number,b:b.number,aName:a.name,bName:b.name,aheadA:direct.filter(m=>m.result>0).length,aheadB:direct.filter(m=>m.result<0).length,meetings:direct,commonOpponents:common,indirect});
  }
  return pairs;
 }
 return {meetings,opponents,fieldNetwork};
}
