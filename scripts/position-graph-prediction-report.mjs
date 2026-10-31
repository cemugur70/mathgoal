import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../dist/app.mjs',import.meta.url);let source=await readFile(file,'utf8');
const before="$('#view-overview').insertAdjacentHTML('afterbegin',trainingHtml(bundle,result,{esc,number,pct,date}));";
const after="const learningReport=trainingHtml(bundle,result,{esc,number,pct,date}),learningAnchor=$('#view-overview .metric-strip');if(learningAnchor)learningAnchor.insertAdjacentHTML('afterend',learningReport);else $('#view-overview').insertAdjacentHTML('beforeend',learningReport);";
if(!source.includes(before))throw Error('Training report anchor missing');
await writeFile(file,source.replace(before,after));
