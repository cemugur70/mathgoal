// Merges completed matches from another training-source file (e.g. collected past seasons) into data/training-source.json.
// Existing matches are never replaced; a conflicting score or team pairing aborts without writing.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [extraPath,targetPath='data/training-source.json']=process.argv.slice(2);
if(!extraPath)throw Error('Kullanım: node scripts/merge-training-archive.mjs <ek-arşiv.json> [hedef]');
const target=JSON.parse(await readFile(targetPath,'utf8')),extra=JSON.parse(await readFile(extraPath,'utf8'));
const merged=new Map(target.matches.map(m=>[String(m.id),m]));let added=0;
for(const m of extra.matches??[]){
 if(!m?.id||!m.home?.id||!m.away?.id||!Number.isFinite(Date.parse(m.date))||!Number.isInteger(m.homeScore)||!Number.isInteger(m.awayScore)||m.finished===false||m.cancelled||m.awarded)continue;
 const old=merged.get(String(m.id));
 if(old){if(old.homeScore!==m.homeScore||old.awayScore!==m.awayScore||String(old.home.id)!==String(m.home.id)||String(old.away.id)!==String(m.away.id))throw Error('Çelişen maç sonucu: '+m.id);continue;}
 merged.set(String(m.id),m);added++;
}
const known=new Set((target.sources??[]).filter(s=>s.season).map(s=>`${s.leagueId}:${s.season}`));
target.sources=[...(target.sources??[]),...(extra.sources??[]).filter(s=>s.season&&!known.has(`${s.leagueId}:${s.season}`))];
target.matches=[...merged.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||String(a.id).localeCompare(String(b.id)));
target.sourceId=createHash('sha256').update(JSON.stringify(target.matches)).digest('hex');target.createdAt=new Date().toISOString();
await writeFile(targetPath+'.tmp',JSON.stringify(target));await rename(targetPath+'.tmp',targetPath);
console.log(JSON.stringify({added,matches:target.matches.length,seasonSources:target.sources.filter(s=>s.season).length}));
