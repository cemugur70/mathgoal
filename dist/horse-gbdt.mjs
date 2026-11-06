// Race-grouped gradient-boosted trees over the Obsidian features, with a Plackett-Luce objective on the known finishing prefix.
// Training works on binned features; a stored tree set compares raw values against the same bin edges, so both give the same split.
import {blendMarket} from './horse-model.mjs';

export const TREE_PARAMS={depth:4,lambda:20,minH:40,lr:.03,colsample:.6,topK:4,bins:64,seed:7};

/** Quantile bin edges per feature, from every third training race. */
export function binEdges(races,bins=TREE_PARAMS.bins){
 const K=races.find(r=>r.rows.length)?.rows[0].x.length??0,edges=[];
 for(let f=0;f<K;f++){const v=[];for(let r=0;r<races.length;r+=3)for(const x of races[r].rows)v.push(x.x[f]);v.sort((a,b)=>a-b);
  const e=[];for(let q=1;q<bins;q++){const c=v[Math.floor(q*v.length/bins)];if(c!==undefined&&(!e.length||c>e[e.length-1]))e.push(c);}edges.push(e);}
 return edges;
}
/** Index of the first edge at or above the value, so `bin <= t` means `value <= edges[t]`. */
function binOf(e,v){let lo=0,hi=e.length;while(lo<hi){const m=(lo+hi)>>1;if(v>e[m])lo=m+1;else hi=m;}return lo;}
/**
 * Flat training rows. `orders` holds each race's known finishing prefix as row offsets: 1st, 2nd, ... while every next place is known and unique.
 * A dead heat for first place leaves it empty, and that race then trains on the shared win only.
 */
export function buildDataset(races,edges){
 const K=edges.length,N=races.reduce((a,r)=>a+r.rows.length,0),bins=new Uint8Array(N*K),start=new Int32Array(races.length+1),y=new Float64Array(N),orders=[];let o=0;
 races.forEach((r,ri)=>{start[ri]=o;const n=r.rows.filter(x=>r.winners.includes(x.number)).length,ord=[];
  if(n===1){ord.push(r.rows.findIndex(x=>r.winners.includes(x.number)));for(let pl=2;pl<=r.rows.length;pl++){const hit=r.rows.flatMap((x,i)=>x.place===pl?[i]:[]);if(hit.length!==1)break;ord.push(hit[0]);}}
  orders.push(ord);
  for(const x of r.rows){for(let f=0;f<K;f++)bins[o*K+f]=binOf(edges[f],x.x[f]);y[o]=r.winners.includes(x.number)?1/n:0;o++;}});
 start[races.length]=o;
 return {N,K,bins,start,y,orders,widths:Uint8Array.from(edges,e=>e.length)};
}
/** Mean winner log-loss of raw scores. */
function softmaxLoss(D,F){
 let l=0;const S=D.start.length-1;
 for(let ri=0;ri<S;ri++){const a=D.start[ri],b=D.start[ri+1];let top=-Infinity,z=0,w=0;for(let i=a;i<b;i++)if(F[i]>top)top=F[i];for(let i=a;i<b;i++){const e=Math.exp(F[i]-top);z+=e;if(D.y[i]>0)w+=e;}l-=Math.log(w/z);}
 return l/S;
}
/** Gradient and diagonal Hessian: one softmax stage per known place up to topK, each over the runners still left. */
function gradients(D,F,g,h,topK){
 g.fill(0);h.fill(0);const S=D.start.length-1,ex=new Float64Array(64),alive=new Uint8Array(64);
 for(let ri=0;ri<S;ri++){
  const a=D.start[ri],b=D.start[ri+1],n=b-a,ord=D.orders[ri];
  if(topK>1&&ord.length>0){
   alive.fill(1,0,n);
   const stages=Math.min(topK,ord.length,n-1);
   for(let s=0;s<stages;s++){let top=-Infinity,z=0;for(let i=0;i<n;i++)if(alive[i]&&F[a+i]>top)top=F[a+i];for(let i=0;i<n;i++)if(alive[i]){ex[i]=Math.exp(F[a+i]-top);z+=ex[i];}
    for(let i=0;i<n;i++)if(alive[i]){const p=ex[i]/z;g[a+i]+=p-(i===ord[s]?1:0);h[a+i]+=Math.max(p*(1-p),1e-9);}alive[ord[s]]=0;}
  }else{
   let top=-Infinity,z=0;for(let i=a;i<b;i++)if(F[i]>top)top=F[i];for(let i=a;i<b;i++){ex[i-a]=Math.exp(F[i]-top);z+=ex[i-a];}
   for(let i=a;i<b;i++){const p=ex[i-a]/z;g[i]=p-D.y[i];h[i]=Math.max(p*(1-p),1e-9);}
  }
 }
}
/** Appends one tree in preorder: a split's left child is the next node and `r` holds the right child; `f` is -1 at a leaf. */
function growTree(D,g,h,features,P,T){
 const HG=new Float64Array(65),HH=new Float64Array(65),all=new Int32Array(D.N);for(let i=0;i<D.N;i++)all[i]=i;
 const grow=(rows,d)=>{
  const node=T.f.length;T.f.push(-1);T.t.push(0);T.r.push(0);T.v.push(0);
  let G=0,H=0;for(const i of rows){G+=g[i];H+=h[i];}T.v[node]=-P.lr*G/(H+P.lambda);if(d>=P.depth||H<2*P.minH)return;
  const parent=G*G/(H+P.lambda);let best=1e-6,bf=-1,bt=0;
  for(const f of features){HG.fill(0);HH.fill(0);for(const i of rows){const b=D.bins[i*D.K+f];HG[b]+=g[i];HH[b]+=h[i];}
   let gl=0,hl=0;const m=D.widths[f];for(let b=0;b<m;b++){gl+=HG[b];hl+=HH[b];if(hl<P.minH)continue;const hr=H-hl;if(hr<P.minH)break;const gr=G-gl,gain=gl*gl/(hl+P.lambda)+gr*gr/(hr+P.lambda)-parent;if(gain>best){best=gain;bf=f;bt=b;}}}
  if(bf<0)return;
  let nl=0;for(const i of rows)if(D.bins[i*D.K+bf]<=bt)nl++;const L=new Int32Array(nl),R=new Int32Array(rows.length-nl);let a=0,c=0;for(const i of rows){if(D.bins[i*D.K+bf]<=bt)L[a++]=i;else R[c++]=i;}
  T.f[node]=bf;T.t[node]=bt;grow(L,d+1);T.r[node]=T.f.length;grow(R,d+1);};
 grow(all,0);
}
/** Adds the tree that starts at `root` to the scores of a binned dataset. */
function addTree(T,root,D,F){for(let i=0;i<D.N;i++){let n=root;const base=i*D.K;while(T.f[n]>=0)n=D.bins[base+T.f[n]]<=T.t[n]?n+1:T.r[n];F[i]+=T.v[n];}}
/**
 * Boosts `trees` trees over the given feature indices. With `valid`, `curve` lists [trees, validation log-loss] every `every` trees.
 * Returns flat node arrays, so a prefix of the trees can be taken without refitting.
 */
export function boostTrees(train,features,{trees,valid=null,every=100,...over}){
 const P={...TREE_PARAMS,...over},F=new Float64Array(train.N),Fv=valid?new Float64Array(valid.N):null,g=new Float64Array(train.N),h=new Float64Array(train.N),T={f:[],t:[],r:[],v:[]},roots=[],curve=[];
 let s=P.seed;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
 for(let k=1;k<=trees;k++){
  gradients(train,F,g,h,P.topK);
  const cols=features.filter(()=>rnd()<P.colsample),root=T.f.length;roots.push(root);growTree(train,g,h,cols.length?cols:features,P,T);
  addTree(T,root,train,F);if(Fv)addTree(T,root,valid,Fv);
  if(Fv&&k%every===0)curve.push([k,softmaxLoss(valid,Fv)]);
 }
 return {roots:Int32Array.from(roots),f:Int16Array.from(T.f),t:Uint8Array.from(T.t),r:Int32Array.from(T.r),v:Float64Array.from(T.v),curve};
}
/** The first `count` trees as a JSON-ready set, with the bin edges they split on. */
export function packTrees(model,edges,count=model.roots.length){
 const end=count<model.roots.length?model.roots[count]:model.f.length;
 return {edges,roots:Array.from(model.roots.subarray(0,count)),f:Array.from(model.f.subarray(0,end)),t:Array.from(model.t.subarray(0,end)),r:Array.from(model.r.subarray(0,end)),v:Array.from(model.v.subarray(0,end),x=>+x.toFixed(7))};
}
/** A stored tree set ready for scoring: raw thresholds instead of bin indices. */
export function unpackTrees({edges,roots,f,t,r,v}){
 const thr=new Float64Array(f.length);for(let n=0;n<f.length;n++)if(f[n]>=0)thr[n]=edges[f[n]][t[n]];
 return {roots:Int32Array.from(roots),f:Int16Array.from(f),r:Int32Array.from(r),v:Float64Array.from(v),thr};
}
/** Softmax over the summed tree scores of one race. A value above the threshold goes right, the same way a binned value does. */
export function treeProbabilities(rows,T){
 const s=rows.map(({x})=>{let a=0;for(let j=0;j<T.roots.length;j++){let n=T.roots[j];while(T.f[n]>=0)n=x[T.f[n]]>T.thr[n]?T.r[n]:n+1;a+=T.v[n];}return a;}),top=Math.max(...s),ex=s.map(v=>Math.exp(v-top)),z=ex.reduce((a,v)=>a+v,0);
 return ex.map(v=>v/z);
}
/** Floors market-free logit probabilities, so they can take the second column of the same two-column blend as AGF. */
export const logitColumn=probs=>probs.map(v=>Math.max(v,1e-6));
/**
 * The site's win probabilities for one race. A race with AGF: all-feature trees × AGF. Without AGF, also before it appears: market-free trees × market-free logit.
 * `stage` = {agf:{trees,blend},free:{trees,blend}}; `logit` must be the market-free probabilities when the race has no AGF.
 */
export function ensembleProbabilities(rows,logit,agf,stage){
 const market=agf.some(v=>v>0),part=market?stage.agf:stage.free;
 return blendMarket(treeProbabilities(rows,part.trees),market?agf:logitColumn(logit),part.blend);
}
const unpackStage=s=>({agf:{blend:s.agf.blend,trees:unpackTrees(s.agf.trees)},free:{blend:s.free.blend,trees:unpackTrees(s.free.trees)}});
/** Reads a stored ensemble; null when there is no file or it was trained on a different feature list, and the caller then keeps the market blend. */
export function loadEnsemble(text,featureNames){
 if(!text)return null;
 const data=JSON.parse(text);if(data.featureNames?.join()!==featureNames.join())return null;
 return {validation:unpackStage(data.validation),live:unpackStage(data.live),report:data.report};
}
