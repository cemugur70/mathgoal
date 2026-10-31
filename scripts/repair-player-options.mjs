import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../dist/player-ui.mjs',import.meta.url);const source=await readFile(file,'utf8');await writeFile(file,source.replace('</option value="out">','</option><option value="out">'));console.log('Kadro seçenekleri düzeltildi.');
