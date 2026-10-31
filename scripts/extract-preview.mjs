import {readFile,writeFile,mkdir} from 'node:fs/promises';
const bundle=JSON.parse(await readFile(new URL('../data/rea-evidence-bundle.json',import.meta.url),'utf8'));
let found;
const requested=process.argv[2];
function findEvidence(v){if(!v||typeof v!=='object')return null;if(v.evidence_id===requested)return v;for(const value of Object.values(v)){const found=findEvidence(value);if(found)return found;}return null;}
function visit(v){if(!v||typeof v!=='object')return;if(v.data_base64&&v.media_type==='image/png')found=v;for(const x of Object.values(v))if(typeof x==='object')visit(x);}
const selected=requested?findEvidence(bundle):bundle;
if(!selected)throw Error('Requested evidence not present: '+requested);
visit(selected);if(!found)throw Error('REA screenshot not present');await mkdir(new URL('../screenshots/',import.meta.url),{recursive:true});await writeFile(new URL('../screenshots/mathgoal-live.png',import.meta.url),Buffer.from(found.data_base64,'base64'));console.log('screenshots/mathgoal-live.png');
