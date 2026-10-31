import test from 'node:test';import assert from 'node:assert/strict';
import {piPanelHtml} from '../dist/pi-ui.mjs';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const number=(v,n=1)=>Number.isFinite(v)?v.toLocaleString('tr-TR',{maximumFractionDigits:n,minimumFractionDigits:n}):'—';
const target={id:'1',date:'2026-10-26T18:30:00.000Z',home:{id:1,name:'Galatasaray'},away:{id:2,name:'Fenerbahçe <x>'}};
const pi={cutoff:target.date,archiveMatches:10073,expectedGoalDifference:.42,coverage:{status:'ready'},ratings:{home:{home:1.21,away:.64,matches:82},away:{home:1.05,away:.88,matches:92}}};
test('pi panel shows venue ratings, matches, expected goal difference and layer status',()=>{
 const html=piPanelHtml({piRatings:pi},{target,pi,training:{pi:{active:true,experimental:true,reason:'Deneysel.'}}},{esc,number});
 assert.match(html,/Galatasaray/);assert.match(html,/Fenerbahçe &lt;x&gt;/,'team names are escaped');
 assert.match(html,/\+1,21/);assert.match(html,/\+0,88/);assert.match(html,/82/);assert.match(html,/92/);
 assert.match(html,/\+0,42/);assert.match(html,/Galatasaray yaklaşık 0,42 gol üstün/);assert.match(html,/MODELDE DENEYSEL/);assert.match(html,/10\.073/);
});
test('pi panel falls back to the stored ratings, asks old bundles to re-run, and flags thin coverage',()=>{
 assert.match(piPanelHtml({piRatings:pi},{target,pi:null,training:{}},{esc,number}),/MODELDE DEĞERLENDİRİLMEDİ/);
 assert.equal(piPanelHtml({piRatings:{...pi,cutoff:'2026-10-20T00:00:00.000Z'}},{target,pi:null,training:{}},{esc,number}),'','ratings for another cutoff are not shown');
 assert.match(piPanelHtml({},{target,pi:null,training:{}},{esc,number}),/yeniden analiz edin/);
 assert.match(piPanelHtml({piRatings:pi},{target,pi:{...pi,expectedGoalDifference:.03,coverage:{status:'insufficient'}},training:{}},{esc,number}),/yaklaşık denk[\s\S]*3 maçtan az/);
});
