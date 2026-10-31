// Final asset normalization and optional static detail exports; no source data invented.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const file=new URL('../dist/app.mjs',import.meta.url);let source=await readFile(file,'utf8');
source=source.replace('<span><i></i></span><span><i></i></span>','<span><i></i>${esc(short(t.home.name))}</span><span><i></i>${esc(short(t.away.name))}</span>');
source=source.replace("${String(n.id)===String(bundle.target.home.id)?'MUN':'BOU'}","${({10260:'MUN',8678:'BOU'})[n.id]||short(n.name).replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase()}");
source=source.replace('>GEÇMİŞE DÖNÜK TAHMİN<',">${t.finished?'GEÇMİŞE DÖNÜK TAHMİN':'MAÇ ÖNCESİ MODEL'}<");
source=source.replace('<span class="league-icon">PL</span>','<span class="league-icon">${Number(t.leagueId)===47?\'PL\':\'●\'}</span>');
source=source.replace('role="img" aria-label="${nodes.length}', 'role="${mini?\'img\':\'group\'}" aria-label="${nodes.length}');
source=source.replace("'Physical metrics':'Fiziksel veriler'","'Physical metrics':'Fiziksel veriler','Physical performance':'Fiziksel veriler'");
source=source.replace("physical_metrics_distance_covered:'Kat edilen mesafe'","physical_metrics_distance_covered:'Kat edilen mesafe (m)'").replace("physical_metrics_running:'Koşu'","physical_metrics_running:'Koşu mesafesi (m)'").replace("physical_metrics_sprinting:'Sprint mesafesi'","physical_metrics_sprinting:'Sprint mesafesi (m)'").replace("physical_metrics_walking:'Yürüme mesafesi'","physical_metrics_walking:'Yürüme mesafesi (m)'");
await writeFile(file,source);
const bundle=JSON.parse(await readFile(new URL('../dist/data/bundle.json',import.meta.url),'utf8'));
const {history}=await import('../dist/model.mjs');
await mkdir(new URL('../dist/data/details/',import.meta.url),{recursive:true});
for(const t of [bundle.target.home,bundle.target.away])for(const r of history(bundle.matches,t.id,bundle.analysisAt??bundle.target.date,10,bundle.target.id))await copyFile(new URL(`../data/cache/matchDetails-${r.id}.json`,import.meta.url),new URL(`../dist/data/details/${r.id}.json`,import.meta.url));
console.log('Uygulama ve son 10 maçın ham veri çıktıları hazır.');
