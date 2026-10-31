import {readFile} from 'node:fs/promises';
const p=JSON.parse(await readFile('data/osimhen-next.json','utf8')).props.pageProps.data;
console.log('profile keys',Object.keys(p));for(const k of ['statSeasons','traits','playerTraits','careerHistory','recentMatches','stats','shotmap','seasonStats'])console.log(k,JSON.stringify(p[k])?.slice(0,2000));
const b=JSON.parse(await readFile('dist/data/bundle.json','utf8'));const m=b.matches.filter(m=>m.home.id===8637||m.away.id===8637).at(-1);const raw=JSON.parse(await readFile('data/cache/matchDetails-'+m.id+'.json','utf8'));
console.log('Osimhen match stats',JSON.stringify(raw.content.playerStats['687681']).slice(0,5000));
const t=JSON.parse(await readFile('data/cache/matchDetails-5904782.json','utf8')).content.lineup;console.log('lineupkeys',Object.keys(t));for(const key of ['homeTeam','awayTeam']){console.log(key,Object.keys(t[key]));for(const p of ['unavailable','unavailablePlayers','subs','bench'])if(t[key][p])console.log(p,JSON.stringify(t[key][p]).slice(0,2300));}
const r=await fetch('https://www.fotmob.com/players/687681');console.log('canonical',r.status,r.url,(await r.text()).length);
