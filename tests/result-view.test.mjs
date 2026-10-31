import test from 'node:test';import assert from 'node:assert/strict';
import {renderResultComparison} from '../dist/result-view.mjs';
const format={escapeHtml:s=>String(s).replaceAll('<','&lt;'),formatPercent:n=>Number.isFinite(n)?String(n*100)+'%':'—'};
const target={finished:false,home:{name:'Galatasaray'},away:{name:'Fenerbahçe'}};
test('rendering all-match laboratory with a null upcoming result does not read homeScore',()=>{
 for(const prediction of [null,{heatmap:[]},{heatmap:[{home:2,away:2,probability:.1}]}]){
  const html=renderResultComparison({target,actual:null},prediction,format);
  assert.match(html,/Maç öncesi tahmin/);assert.doesNotMatch(html,/Gerçek skor|0 – 0|undefined/);
 }
});
test('a finished status with missing or malformed scores still renders safely',()=>{
 for(const actual of [null,{}, {homeScore:null,awayScore:0},{homeScore:'0',awayScore:0}])assert.doesNotMatch(renderResultComparison({target:{...target,finished:true},actual},null,format),/Gerçek skor/);
});
test('confirmed finished results and missing probabilities render without crashing',()=>{
 const bundle={target:{...target,finished:true},actual:{homeScore:2,awayScore:1}};
 assert.match(renderResultComparison(bundle,null,format),/Galatasaray 2 – 1 Fenerbahçe/);
 assert.match(renderResultComparison(bundle,{heatmap:[null,{home:2,away:1,probability:.1}]},format),/10%/);
});
