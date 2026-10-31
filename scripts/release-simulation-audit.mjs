import {readFile,writeFile,readdir} from 'node:fs/promises';
const dist=new URL('../dist/',import.meta.url);
for(const file of await readdir(dist)){
 if(!/\.(mjs|html)$/.test(file))continue;
 const path=new URL(file,dist),source=await readFile(path,'utf8');
 let next=source.replaceAll('2026-10-26.10','2026-10-26.11');
 if(file==='index.html'&&!next.includes('rel="icon"'))next=next.replace('<title>','<link rel="icon" type="image/svg+xml" href="/favicon.svg"><title>');
 await writeFile(path,next);
}
const testFile=new URL('../tests/player-collection.test.mjs',import.meta.url);
let test=await readFile(testFile,'utf8');
test=test.replaceAll(/'--import',path\.join\(directory,('[^']+\.mjs')\)/g,"'--import',pathToFileURL(path.join(directory,$1)).href");
await writeFile(testFile,test);
