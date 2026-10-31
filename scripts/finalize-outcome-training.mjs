import {readFile,writeFile,readdir} from 'node:fs/promises';
const dist=new URL('../dist/',import.meta.url);
for(const name of await readdir(dist)){
 if(!/\.(mjs|html)$/.test(name))continue;
 const file=new URL(name,dist),source=await readFile(file,'utf8');
 await writeFile(file,source.replaceAll('2026-10-26.11','2026-10-26.12'));
}
const ui=new URL('../dist/training-ui.mjs',import.meta.url);let source=await readFile(ui,'utf8');
source=source.replace('<th>TAKIM TABANI</th>','<th>HAM POISSON TABANI</th>');
source=source.replace('Test tamamlandıktan sonra yayınlanan model, hedef maçtan önceki ${t.training.finalRefitCount} uygun maçla tekrar eğitilir;', '${t.training.finalRefitCount>0?\'Test tamamlandıktan sonra yayınlanan model, hedef maçtan önceki \'+t.training.finalRefitCount+\' uygun maçla tekrar eğitilir;\':\'Doğrulama seçimine göre taban katsayılar korunur;\'}');
await writeFile(ui,source);
