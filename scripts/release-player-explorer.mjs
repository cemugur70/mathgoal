import {readFile,writeFile,readdir} from 'node:fs/promises';
const dist=new URL('../dist/',import.meta.url);
for(const name of await readdir(dist)){if(!/\.(mjs|html)$/.test(name))continue;const file=new URL(name,dist);await writeFile(file,(await readFile(file,'utf8')).replaceAll('2026-10-27.1','2026-10-27.2'));}
