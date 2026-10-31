import {readFile,writeFile} from 'node:fs/promises';
const b=JSON.parse(await readFile('dist/data/bundle.json','utf8'));const m=b.matches.filter(m=>m.home.id===8637||m.away.id===8637).at(-1);const raw=JSON.parse(await readFile('data/cache/matchDetails-'+m.id+'.json','utf8'));
console.log('sample player',JSON.stringify(Object.values(raw.content.playerStats||{})[0]).slice(0,6500));console.log('lineup',JSON.stringify(raw.content.lineup).slice(0,1800));
const target=JSON.parse(await readFile('data/cache/matchDetails-5904782.json','utf8'));console.log('targetLineup',JSON.stringify(target.content.lineup).slice(0,5000));
const response=await fetch('https://www.fotmob.com/tr/players/687681/victor-osimhen');const html=await response.text();await writeFile('data/osimhen-page.html',html);const match=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
console.log('html',response.status,html.length,!!match);if(match){const data=JSON.parse(match[1]);await writeFile('data/osimhen-next.json',JSON.stringify(data));console.log('nextProps',Object.keys(data.props?.pageProps||{}));console.log('next sample',JSON.stringify(data.props?.pageProps).slice(0,3500));}
