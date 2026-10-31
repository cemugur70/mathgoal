import {readFile,writeFile} from 'node:fs/promises';
const app=new URL('../dist/app.mjs',import.meta.url);let source=await readFile(app,'utf8');
source=source.replace("history.replaceState(null,'',url);testRun=null;recalc();", "window.history.replaceState(null,'',url);testRun=null;recalc();");await writeFile(app,source);
const html=new URL('../dist/index.html',import.meta.url);await writeFile(html,(await readFile(html,'utf8')).replace('MathGoal / v1.3.0','MathGoal / v1.4.0'));
const server=new URL('server.mjs',import.meta.url);await writeFile(server,(await readFile(server,'utf8')).replace("version:'1.3.0'","version:'1.4.0'"));
