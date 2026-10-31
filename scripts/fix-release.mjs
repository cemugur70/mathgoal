import {readFile,writeFile} from 'node:fs/promises';import {APP_VERSION} from '../dist/release.mjs';
const app=new URL('../dist/app.mjs',import.meta.url);let s=await readFile(app,'utf8');
const a=s.indexOf('function resultComparison(p){'),b=s.indexOf('function method(){',a);
if(a<0||b<0)throw Error('Result view boundary missing');
s=s.slice(0,a)+'function resultComparison(p){return renderResultComparison(bundle,p,{escapeHtml:esc,formatPercent:pct});}\n'+s.slice(b);
if(!s.includes('import {renderResultComparison}'))s="import {renderResultComparison} from './result-view.mjs';\nimport {APP_VERSION} from './release.mjs';\n"+s;
const updater=`async function ensureCurrentVersion(pendingUrl=null){
 try{const r=await fetch('/api/health?t='+Date.now(),{cache:'no-store'});if(!r.ok)return true;const live=await r.json();if(live.uiVersion&&live.uiVersion!==APP_VERSION){if(pendingUrl)sessionStorage.setItem('mathgoal-pending-match',pendingUrl);location.reload();return false;}}catch{}return true;
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ensureCurrentVersion();});
window.addEventListener('pageshow',e=>{if(e.persisted)ensureCurrentVersion();});
`;
if(!s.includes('async function ensureCurrentVersion('))s=s.replace("$('#source-form').onsubmit=",updater+"$('#source-form').onsubmit=");
s=s.replace("async e=>{e.preventDefault();const id=parseMatchId", "async e=>{e.preventDefault();if(!await ensureCurrentVersion($('#match-url').value))return;const id=parseMatchId");
s=s.replace("load().catch(e=>{$('#loading').textContent=e.message;});", "load().then(()=>{const pending=sessionStorage.getItem('mathgoal-pending-match');if(pending){sessionStorage.removeItem('mathgoal-pending-match');$('#match-url').value=pending;$('#source-form').requestSubmit();}}).catch(e=>{$('#loading').textContent=e.message;});");
for(const name of ['model','match-input','result-view','release'])s=s.replace(new RegExp("from './"+name+"\\.mjs(?:\\?v=[^']*)?'"),"from './"+name+".mjs?v="+APP_VERSION+"'");
s=s.replace(/new Worker\('\/worker\.mjs(?:\?v=[^']*)?'/,"new Worker('/worker.mjs?v="+APP_VERSION+"'");
await writeFile(app,s);
const html=new URL('../dist/index.html',import.meta.url);let h=await readFile(html,'utf8');h=h.replace(/src="\/app\.mjs(?:\?v=[^"]*)?"/,'src="/app.mjs?v='+APP_VERSION+'"').replace(/href="\/style\.css(?:\?v=[^"]*)?"/,'href="/style.css?v='+APP_VERSION+'"').replace('MathGoal / v1.0','MathGoal / v1.0.1');await writeFile(html,h);
const worker=new URL('../dist/worker.mjs',import.meta.url);let w=await readFile(worker,'utf8');w=w.replace(/from '\.\/model\.mjs(?:\?v=[^']*)?'/,"from './model.mjs?v="+APP_VERSION+"'");await writeFile(worker,w);
const server=new URL('./server.mjs',import.meta.url);let n=await readFile(server,'utf8');if(!n.includes("import {APP_VERSION}"))n="import {APP_VERSION} from '../dist/release.mjs';\n"+n;n=n.replace("version:'1.0.0',collecting:running","version:'1.0.1',uiVersion:APP_VERSION,collecting:running").replaceAll("'cache-control':'no-cache'","'cache-control':'no-store'");await writeFile(server,n);
console.log('Null-result guard and versioned UI '+APP_VERSION+' prepared.');
