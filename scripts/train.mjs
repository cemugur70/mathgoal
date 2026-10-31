import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {access,readFile,writeFile,rename,readdir} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
let hasGraph=false;try{await access(new URL('../data/player-graph-source.json',import.meta.url));hasGraph=true;}catch{}
if(!hasGraph)try{hasGraph=(await readdir(new URL('../dist/data/matches/',import.meta.url))).some(name=>/^\d+\.json$/.test(name));}catch{}
const stage='../data/training-candidate.json';
const tasks=hasGraph?[['export-training-source.mjs'],['export-player-graph-source.mjs'],['build-training-data.mjs',stage],['build-player-graph-training.mjs',stage,stage],['build-starter-training.mjs',stage],['build-market-network-training.mjs',stage],['build-season-training.mjs',stage],['build-pi-training.mjs',stage]]:[['export-training-source.mjs'],['build-training-data.mjs',stage]];
for(const [script,...args] of tasks){const stageStart=performance.now();
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL(script,import.meta.url)),...args],{cwd:root,stdio:'inherit',windowsHide:true});
  child.on('error',reject);child.on('exit',resolve);
 });
 if(code!==0)process.exit(code??1);console.log('EĞİTİM_ADIMI '+JSON.stringify({script,ms:Math.round(performance.now()-stageStart)}));
}
const bytes=await readFile(new URL(stage,import.meta.url)),data=JSON.parse(bytes);
if(data.schemaVersion!==(hasGraph?6:1)||!Array.isArray(data.rows))throw Error('Eğitim adayı şeması geçersiz; yayınlanan eğitim verisi korundu.');
// The browser downloads and clones this file for every analysis: per-row player-graph coverage notes are build-only metadata, and 6 significant digits are far below feature noise.
const compact=JSON.stringify(data,(key,value)=>key==='graphCoverage'?undefined:typeof value==='number'&&!Number.isInteger(value)?Number(value.toPrecision(6)):value);
const destination=new URL('../dist/data/training.json',import.meta.url),temporary=new URL(destination.href+'.tmp');
await writeFile(temporary,compact);await rename(temporary,destination);console.log('EĞİTİM_YAYINLANDI '+JSON.stringify({id:data.id,rows:data.rows.length,schemaVersion:data.schemaVersion}));
