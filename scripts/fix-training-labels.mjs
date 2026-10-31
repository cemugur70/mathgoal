import {readFile,writeFile} from 'node:fs/promises';
const app=new URL('../dist/app.mjs',import.meta.url);let source=await readFile(app,'utf8');
source=source.replace('${result.neighbors.length} benzer maç katkısı',"${result.training?.accepted?'Geçmiş sonuçlarla öğrenildi':result.neighbors.length+' benzer maç katkısı'}");
await writeFile(app,source);
const ui=new URL('../dist/training-ui.mjs',import.meta.url);let html=await readFile(ui,'utf8');
html=html.replace('c.away===actual.awayScore)?.probability)}','c.away===actual.awayScore)?.probability,2)}');
await writeFile(ui,html);
