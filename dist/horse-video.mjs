// Reads the TJK race-video graphics from raw RGB frames (864×486): the running-order strip (saddle-cloth boxes, leader first,
// top 10 only) and the sectional box (leader's time at each 200 m mark). Digits are matched against glyph templates. Pure.
export const FRAME={width:864,height:486};
const STRIP={x0:220,pitch:56.5,w:40,y0:382,y1:405,slots:10},CLOCK={x0:668,x1:836,y0:22,y1:100},GRID={w:10,h:14};
const px=(f,x,y)=>{const i=(y*FRAME.width+x)*3;return [f[i],f[i+1],f[i+2]];};
const spread=p=>Math.max(...p)-Math.min(...p),dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const median=v=>{const s=[...v].sort((a,b)=>a-b);return s[s.length>>1];};

/** Binary glyphs (left to right) inside a rectangle; `ink(p)` says whether a pixel belongs to text. */
export function glyphs(frame,{x0,x1,y0,y1},ink){
 const cols=[];for(let x=x0;x<=x1;x++){let c=0;for(let y=y0;y<=y1;y++)if(ink(px(frame,x,y)))c++;cols.push(c);}
 const out=[];let a=null;
 for(let i=0;i<=cols.length;i++){const on=i<cols.length&&cols[i]>0;if(on&&a===null)a=i;if(!on&&a!==null){out.push([x0+a,x0+i-1]);a=null;}}
 return out.map(([ga,gb])=>{
  let top=y1,bot=y0;for(let x=ga;x<=gb;x++)for(let y=y0;y<=y1;y++)if(ink(px(frame,x,y))){top=Math.min(top,y);bot=Math.max(bot,y);}
  const w=gb-ga+1,h=bot-top+1,bits=[];
  for(let gy=0;gy<GRID.h;gy++)for(let gx=0;gx<GRID.w;gx++){
   const xa=ga+Math.floor(gx*w/GRID.w),xb=ga+Math.max(Math.floor((gx+1)*w/GRID.w)-1,Math.floor(gx*w/GRID.w)),ya=top+Math.floor(gy*h/GRID.h),yb=top+Math.max(Math.floor((gy+1)*h/GRID.h)-1,Math.floor(gy*h/GRID.h));
   let on=0,n=0;for(let x=xa;x<=xb;x++)for(let y=ya;y<=yb;y++){n++;if(ink(px(frame,x,y)))on++;}bits.push(on*2>=n?1:0);
  }
  return {x:ga,w,h,bits:bits.join('')};
 });
}
/** Best template label for a glyph, or null when nothing is close (Hamming distance over the 10×14 grid). */
export function classify(g,templates,maxDistance=28){
 let best=null;for(const [label,list] of Object.entries(templates))for(const t of list){let d=0;for(let i=0;i<t.length;i++)if(t[i]!==g.bits[i])d++;if(!best||d<best.d)best={label,d};}
 return best&&best.d<=maxDistance?best.label:null;
}
/** The strip's boxes at the vertical offset that reads the most of them (tracks place the strip a few pixels apart). */
export function stripBoxes(frame){
 let best=[];for(const dy of [0,-3,-2,-4,-1,1,-5,2]){const b=stripBoxesAt(frame,dy);if(b.length>best.length)best=b;}
 return best;
}
/** Background colour and white-digit glyphs per slot, until the first slot without a box. */
function stripBoxesAt(frame,dy){
 const out=[],y0=STRIP.y0+dy,y1=STRIP.y1+dy;
 for(let s=0;s<STRIP.slots;s++){
  const a=Math.round(STRIP.x0+s*STRIP.pitch),b=a+STRIP.w-1,edge=[];
  for(let x=a+3;x<=b-3;x++)edge.push(px(frame,x,y0+1),px(frame,x,y1-1));
  const bg=[0,1,2].map(k=>median(edge.map(p=>p[k]))),uniform=median(edge.map(p=>dist(p,bg)))<28;
  if(!uniform||(spread(bg)<45&&Math.max(...bg)>70))break;
  // White digits; on light boxes (sky blue, yellow) the contrast is lower, so the threshold follows the box.
  const floor=Math.max(175,Math.min(...bg)+35),contrast=.6*dist([255,255,255],bg),ink=p=>Math.min(...p)>floor&&dist(p,bg)>contrast;
  // A real box holds one or two digit-sized glyphs; video showing through an empty slot does not.
  const gs=glyphs(frame,{x0:a+2,x1:b-2,y0:y0+2,y1:y1-2},ink);
  if(!gs.length||gs.length>2||gs.some(g=>g.h<13||g.h>18||g.w<5||g.w>16))break;
  out.push({slot:s,bg,glyphs:gs});
 }
 return out;
}
/** Running order from the strip (saddle-cloth numbers, leader first); null when a box cannot be read. */
export function readStrip(frame,templates){
 const boxes=stripBoxes(frame);if(!boxes.length)return [];
 const order=[];
 for(const b of boxes){const d=b.glyphs.map(g=>classify(g,templates.strip));if(!d.length||d.some(x=>x===null))return null;order.push(Number(d.join('')));}
 return order;
}
/** Text lines of the sectional box as glyph lists (light text on dark bands found row by row; at most two lines). */
export function clockGlyphs(frame){
 const dark=[];
 for(let y=CLOCK.y0;y<=CLOCK.y1;y++){const v=[];for(let x=CLOCK.x0+20;x<=CLOCK.x1-6;x+=5)v.push(Math.max(...px(frame,x,y)));dark.push(median(v)<115);}
 const bands=[];let a=null,gap=0;
 for(let i=0;i<=dark.length;i++){
  if(i<dark.length&&dark[i]){if(a===null)a=i;gap=0;continue;}
  if(a!==null&&i<dark.length&&++gap<=3)continue;
  if(a!==null){const b=i-1-gap;if(b-a+1>=14&&b-a+1<=24)bands.push([CLOCK.y0+a,CLOCK.y0+b]);a=null;gap=0;}
 }
 const lines=bands.slice(0,2).map(([y0,y1])=>glyphs(frame,{x0:CLOCK.x0,x1:CLOCK.x1,y0,y1},p=>Math.min(...p)>165));
 while(lines.length<2)lines.push(null);
 return lines;
}
/**
 * One race from its frames ({t, order, clock}): the leader's time at each 200 m mark, the video offset of the start, and the running
 * order at every mark and 400 m from home. Readings that conflict with the field or with the neighbouring marks are dropped.
 * `field` = program numbers of the runners, `winnerTime` = official time in seconds (the last point of the leader's path).
 */
export function summarizeRace(frames,{distance,field,winnerTime=null}){
 const runners=new Set(field),sorted=[...field].sort((a,b)=>a-b).join(',');
 const valid=frames.filter(f=>f.order?.length&&new Set(f.order).size===f.order.length&&f.order.every(n=>runners.has(n))&&f.order.join(',')!==sorted.split(',').slice(0,f.order.length).join(','));
 if(valid.length<10)return {ok:false,reason:'strip'};
 const lastStrip=valid.at(-1).t;
 // Sectional marks: most frequent reading per mark that keeps every 200 m between 10.5 and 16.5 s.
 const seen=new Map();
 for(const f of frames){if(f.t>lastStrip+1)break;for(const c of f.clock||[])if(c&&c.meters%200===0&&c.meters<distance){const k=c.meters,v=seen.get(k)??seen.set(k,new Map()).get(k),e=v.get(c.seconds)??{n:0,first:f.t};e.n++;v.set(c.seconds,e);}}
 const marks=[];let prev={m:0,s:0};
 for(const m of [...seen.keys()].sort((a,b)=>a-b)){
  const options=[...seen.get(m)].filter(([,e])=>e.n>=2).sort((a,b)=>b[1].n-a[1].n);
  const pick=options.find(([s])=>{const per200=(s-prev.s)/(m-prev.m)*200;return per200>=(prev.m?10.5:11)&&per200<=(prev.m?16.5:18);});
  if(pick){marks.push({m,s:pick[0],first:pick[1].first});prev={m,s:pick[0]};}
 }
 if(marks.length<2)return {ok:false,reason:'clock',marks};
 const offset=median(marks.map(x=>x.first-x.s));
 // Leader distance as a function of race time, through the marks and the official finish.
 const path=[{m:0,s:0},...marks,...(winnerTime>prev.s?[{m:distance,s:winnerTime}]:[])];
 const timeAt=m=>{for(let i=1;i<path.length;i++)if(path[i].m>=m){const a=path[i-1],b=path[i];return a.s+(b.s-a.s)*(m-a.m)/(b.m-a.m);}return null;};
 const orderAt=s=>{if(s===null)return null;const t=s+offset,near=valid.filter(f=>Math.abs(f.t-t)<=0.75);if(!near.length)return null;
  // The longest reading wins (the strip can be partly hidden), then the most frequent one.
  const votes=new Map();for(const f of near){const k=f.order.join(',');votes.set(k,(votes.get(k)??0)+1);}
  return [...votes].map(([k,n])=>({order:k.split(',').map(Number),n})).sort((a,b)=>b.order.length-a.order.length||b.n-a.n)[0].order;};
 const points=[...marks.map(x=>x.m),distance-400].filter((m,i,a)=>m>0&&a.indexOf(m)===i).sort((a,b)=>a-b);
 return {ok:true,offset:+offset.toFixed(2),splits:marks.map(({m,s})=>[m,s]),positions:points.map(m=>({m,order:orderAt(timeAt(m))})).filter(p=>p.order)};
}

/** Sectional box lines as {meters, seconds}: "600 M 00'36"75" → {meters:600, seconds:36.75}; unreadable lines are null. */
export function readClock(frame,templates){
 return clockGlyphs(frame).map(line=>{
  if(!line)return null;
  // Tall glyphs are digits or "M"; short ones are the minute/second marks.
  const tall=line.filter(g=>g.h>=9&&g.h<=14&&g.w>=4),labels=tall.map(g=>classify(g,templates.clock));if(labels.some(l=>l===null))return null;
  const m=labels.indexOf('M');if(m<1)return null;
  const meters=Number(labels.slice(0,m).join('')),digits=labels.slice(m+1).join('');
  if(!/^\d{6}$/.test(digits)||!(meters>=100&&meters<=4000))return null;
  return {meters,seconds:Number(digits.slice(0,2))*60+Number(digits.slice(2,4))+Number(digits.slice(4))/100};
 });
}
