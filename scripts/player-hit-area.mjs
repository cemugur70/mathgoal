import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),file=new URL('dist/player-ui.mjs',root);let source=await readFile(file,'utf8');source=source.replace('<circle cx="610" cy="${y}" r="14"','<rect x="540" y="${y-17}" width="88" height="34" fill="transparent"/><circle cx="610" cy="${y}" r="14"');await writeFile(file,source);
for(const path of ['dist/app.mjs','dist/player-ui.mjs','dist/model.mjs','dist/worker.mjs','dist/release.mjs','dist/index.html']){const f=new URL(path,root);const text=await readFile(f,'utf8');await writeFile(f,text.replaceAll('2026-10-26.5','2026-10-26.6'));}
console.log('Oyuncu-maç düğümlerinin tıklama alanı genişletildi.');
