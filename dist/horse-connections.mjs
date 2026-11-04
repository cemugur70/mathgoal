// Jockey and trainer form: wins against the wins expected from field size (1/field per start), decayed with a one-year
// half-life and shrunk towards par. Updated with each race day's results, read for later races only. Pure.
// Jockey edge: the same against the AGF share of the mount (skill beyond the horses the jockey gets), overall and per breed;
// the breed edge is relative to the jockey's overall edge. Of the jockey effects tested (recent form, horse pair, distance, breed),
// only these two repeated from 2021–2023 to 2024–2026.
const HALF_LIFE_DAYS=365,PRIOR=5,EDGE_PRIOR=3,DAY=86400000;
export function createConnectionStats(){
 const stats=new Map();
 const decay=(s,date)=>{const f=Math.pow(.5,(Date.parse(date)-Date.parse(s.date))/DAY/HALF_LIFE_DAYS);s.w*=f;s.e*=f;s.date=date;};
 const lift=(key,date,prior=PRIOR)=>{const s=stats.get(key);if(!s)return 0;decay(s,date);return Math.log((s.w+prior)/(s.e+prior));};
 const add=(key,date,w,e)=>{const s=stats.get(key)??stats.set(key,{w:0,e:0,date}).get(key);decay(s,date);s.w+=w;s.e+=e;};
 return {
  /** Applies one finished race. */
  update(race,entries){
   const rs=entries.filter(e=>e.status!=='NONRUNNER'),win=new Set(race.winners||[]);if(rs.length<2||!win.size)return;
   // Market expectation only when every runner has an AGF share; otherwise the field-size par.
   const agf=rs.every(e=>e.agf1>0)?rs.reduce((a,e)=>a+e.agf1,0):0;
   for(const e of rs){
    const w=win.has(e.number)?1/win.size:0,par=1/rs.length;
    if(e.jockeyId){add('j'+e.jockeyId,race.date,w,par);const m=agf?e.agf1/agf:par;add('m'+e.jockeyId,race.date,w,m);add('b'+e.jockeyId+'|'+race.breed,race.date,w,m);}
    if(e.trainer)add('t'+e.trainer,race.date,w,par);
   }
  },
  /** Log ratio of (decayed) wins to expected wins; 0 = par or unknown. */
  get(race,entry){
   const j=entry.jockeyId,edge=j?lift('m'+j,race.date,EDGE_PRIOR):0;
   return {jockey:j?lift('j'+j,race.date):0,trainer:entry.trainer?lift('t'+entry.trainer,race.date):0,
    jockeyEdge:edge,jockeyBreed:j?lift('b'+j+'|'+race.breed,race.date,EDGE_PRIOR)-edge:0};
  },
 };
}
