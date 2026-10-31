import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../dist/simulation-ui.mjs',import.meta.url);
let source=await readFile(file,'utf8');
source=source.replace('Eksik ölçüm öncülde kalır.', 'xG ve gol ölçümlerinin ikisi de eksikse golcü ağırlığı bilinmiyor kalır; gol takım adına gösterilebilir.');
source=source.replace('const coverageText=p=>', 'const coverageText=(p,team)=>');
source=source.replace('Takımın son ${input.formCount} maçında:', 'Takımın son ${team.coverage.historyCount} maçında:');
source=source.replaceAll('coverageText(p)', 'coverageText(p,team)');
await writeFile(file,source);
