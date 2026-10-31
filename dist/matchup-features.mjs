// One-to-one player matchups derived from the two pre-match starting-XI vectors (starter-features.mjs slot layout).
// No outcome, rating or post-match lineup is read: the inputs are the same strictly-prior player channels the XI layer uses.
import {STARTER_CHANNELS} from './starter-features.mjs';
const SLOT=STARTER_CHANNELS.length+2,SLOTS=11,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const MATCHUP_FEATURE_NAMES=Object.freeze(['attackVsDefenseMean','attackVsDefenseBest','attackVsDefenseWin','creationVsMidfieldMean','creationVsMidfieldWin',
 'midfieldDuelsMean','passingVsPressMean','defenseVsAttackMean','defenseVsAttackWin','keeperVsAttack','starAttackerDiff','outfieldStrengthDiff','pairCoverage','missingFraction'].map(n=>'matchup.'+n));
export const MATCHUP_POLICY=Object.freeze({version:'xi-role-pairing-v1',pairing:'Aynı roldeki oyuncular kendi kanalına göre sıralanır ve sırayla karşı rolün en güçlüsünden başlayarak eşlenir.',
 pairs:{attack:'forvet hücumu ↔ rakip defans savunması',creation:'orta saha üretimi ↔ rakip orta saha savunması',duels:'orta saha mücadelesi ↔ rakip orta saha mücadelesi',defense:'defans savunması ↔ rakip forvet hücumu',keeper:'kaleci ↔ rakip forvet hücumu'}});
const channel=Object.fromEntries(STARTER_CHANNELS.map((c,i)=>[c,i]));
function role(position){if(!(position>=0))return null;return position<1/6?'keeper':position<.5?'defense':position<5/6?'midfield':'forward';}
/** Players from one side's 101-value starter vector; empty and fully missing slots are skipped. */
export function xiPlayers(vector){
 if(!Array.isArray(vector)||vector.length<SLOT*SLOTS)return [];
 const out=[];for(let i=0;i<SLOTS;i++){const b=i*SLOT,missing=vector[b+STARTER_CHANNELS.length],r=role(vector[b+STARTER_CHANNELS.length+1]);
  if(!r||!(missing<1))continue;const p={role:r,weight:1-missing};for(const c of STARTER_CHANNELS)p[c]=vector[b+channel[c]];out.push(p);}
 return out;
}
/** Rank-to-rank pairing: strongest own player against the strongest opponent in the opposing role. */
function pairUp(own,opp,ownKey,oppKey){
 const a=[...own].sort((x,y)=>y[ownKey]-x[ownKey]),b=[...opp].sort((x,y)=>y[oppKey]-x[oppKey]),n=Math.min(a.length,b.length);
 if(!n)return null;let sum=0,weight=0,wins=0,best=-Infinity;
 for(let i=0;i<n;i++){const w=Math.min(a[i].weight,b[i].weight),d=a[i][ownKey]-b[i][oppKey];sum+=w*d;weight+=w;if(d>0)wins+=w;best=Math.max(best,d);}
 return weight>0?{mean:sum/weight,win:wins/weight-.5,best,n,weight}:null;
}
const of=(players,r)=>players.filter(p=>p.role===r),avg=(xs,f)=>{const w=xs.reduce((s,p)=>s+p.weight,0);return w>0?xs.reduce((s,p)=>s+p.weight*f(p),0)/w:null;};
const strength=p=>p.attack+p.creation+p.passing+p.defense+p.duels;
/** Own-perspective matchup vector; every value is bounded and missing evidence is neutral with an explicit missing fraction. */
export function matchupVector(ownVector,oppVector){
 const own=xiPlayers(ownVector),opp=xiPlayers(oppVector);
 const attack=pairUp(of(own,'forward'),of(opp,'defense'),'attack','defense'),creation=pairUp(of(own,'midfield'),of(opp,'midfield'),'creation','defense');
 const duels=pairUp(of(own,'midfield'),of(opp,'midfield'),'duels','duels'),defense=pairUp(of(own,'defense'),of(opp,'forward'),'defense','attack');
 const ownOutfield=own.filter(p=>p.role!=='keeper'),oppOutfield=opp.filter(p=>p.role!=='keeper'),keeper=of(own,'keeper')[0],oppForwards=of(opp,'forward');
 const passing=avg(ownOutfield,p=>p.passing),press=avg(oppOutfield,p=>p.duels),oppAttack=avg(oppForwards,p=>p.attack);
 const ownStar=Math.max(-Infinity,...ownOutfield.map(p=>p.attack)),oppStar=Math.max(-Infinity,...oppOutfield.map(p=>p.attack));
 const ownStrength=avg(ownOutfield,strength),oppStrength=avg(oppOutfield,strength);
 const parts=[attack,creation,duels,defense],known=[...parts,passing!=null&&press!=null,keeper&&oppAttack!=null,Number.isFinite(ownStar)&&Number.isFinite(oppStar),ownStrength!=null&&oppStrength!=null].filter(Boolean).length;
 const c=v=>clamp(v,-1,1);
 return [attack?c(attack.mean):0,attack?c(attack.best):0,attack?attack.win:0,creation?c(creation.mean):0,creation?creation.win:0,duels?c(duels.mean):0,
  passing!=null&&press!=null?c(passing-press):0,defense?c(defense.mean):0,defense?defense.win:0,keeper&&oppAttack!=null?c(keeper.keeper-oppAttack):0,
  Number.isFinite(ownStar)&&Number.isFinite(oppStar)?c(ownStar-oppStar):0,ownStrength!=null&&oppStrength!=null?c((ownStrength-oppStrength)/2):0,
  Math.min(own.length,opp.length)/SLOTS,1-known/8];
}
export const neutralMatchup=()=>MATCHUP_FEATURE_NAMES.map(n=>n.endsWith('missingFraction')?1:0);
