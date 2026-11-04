// Surprise model: the chance that a race is won by a long shot (final ganyan >= 10), from pre-race information only, and the
// "surprise candidates" — horses outside the AGF top 3 that the win model rates well above their AGF share. Pure.
export const SURPRISE_ODDS=10;
export const SURPRISE_FEATURES=['bias','field','handicap','maiden','groupOrSale','shortTerm','arab','turf','agfFavourite','agfMissing','modelTop','modelEntropy'];
/** Pre-race inputs of one race; `probs` = win-model probabilities of `rows` (runners with `agf`). */
export function surpriseInputs(race,rows,probs){
 const agf=rows.map(r=>r.agf>0?r.agf:0),sum=agf.reduce((a,v)=>a+v,0),has=sum>0&&agf.filter(v=>v>0).length>=rows.length*.8;
 const top=Math.max(...probs),entropy=-probs.reduce((a,p)=>a+(p>0?p*Math.log(p):0),0)/Math.log(Math.max(rows.length,2));
 return [1,Math.log(rows.length),race.family==='HAND'?1:0,race.family==='MAIDEN'?1:0,race.family==='GROUP'||race.family==='SAT'?1:0,race.family==='KV'?1:0,
  race.breed==='AR'?1:0,race.surface==='TURF'?1:0,has?Math.max(...agf)/sum:0,has?0:1,top,entropy];
}
/** L2 logistic regression by Newton steps on [{x, y}]. */
export function fitLogistic(data,{l2=1,iterations=25}={}){
 const k=data[0]?.x.length??SURPRISE_FEATURES.length;let w=new Array(k).fill(0);
 for(let it=0;it<iterations;it++){
  const g=new Array(k).fill(0),H=Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>i===j&&i>0?l2:0));
  for(let i=1;i<k;i++)g[i]-=l2*w[i];
  for(const {x,y} of data){const p=sigmoid(dot(w,x)),r=p*(1-p);for(let i=0;i<k;i++){g[i]+=(y-p)*x[i];for(let j=0;j<k;j++)H[i][j]+=r*x[i]*x[j];}}
  const step=solve(H,g);w=w.map((v,i)=>v+step[i]);if(Math.max(...step.map(Math.abs))<1e-6)break;
 }
 return w;
}
export const surpriseRisk=(x,w)=>sigmoid(dot(w,x));
export const RISK_LEVELS=[[.22,'yüksek'],[.12,'orta'],[0,'düşük']];
export const riskLevel=p=>RISK_LEVELS.find(([t])=>p>=t)[1];
/** Program numbers of the surprise candidates: outside the AGF top 3, model probability >= minProb and >= ratio × AGF share. */
export function surpriseCandidates(rows,probs,{minProb=.08,ratio=1.5}={}){
 const sum=rows.reduce((a,r)=>a+(r.agf>0?r.agf:0),0);if(!sum)return [];
 const rank=rows.map((r,i)=>i).sort((a,b)=>(rows[b].agf||0)-(rows[a].agf||0)),top3=new Set(rank.slice(0,3));
 return rows.filter((r,i)=>!top3.has(i)&&probs[i]>=minProb&&probs[i]>=ratio*((r.agf||0)/sum)).map(r=>r.number);
}
/** Area under the ROC curve of risks against outcomes. */
export function auc(items){
 const s=[...items].sort((a,b)=>a.p-b.p);let rank=0,pos=0,sumPos=0;
 for(let i=0;i<s.length;){let j=i;while(j<s.length&&s[j].p===s[i].p)j++;const r=(i+1+j)/2;for(let k=i;k<j;k++)if(s[k].y){pos++;sumPos+=r;}i=j;}
 const neg=s.length-pos;return pos&&neg?(sumPos-pos*(pos+1)/2)/(pos*neg):null;
}
const sigmoid=z=>1/(1+Math.exp(-z)),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function solve(A,b){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;[M[c],M[p]]=[M[p],M[c]];const d=M[c][c]||1e-12;
  for(let r=0;r<n;r++)if(r!==c){const f=M[r][c]/d;for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k];}}
 return M.map((r,i)=>r[n]/(r[i]||1e-12));
}
