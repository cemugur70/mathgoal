import {readFile,writeFile,readdir,stat,rename} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {normalizeKickoffPlayerAX} from './kickoffscore-players.mjs';
import {parseKickoffTeamStatsAX} from './kickoffscore-team-stats.mjs';
import {parseKickoffScoreGrid,parseKickoffShot,extractKickoffSection} from './kickoffscore-observations.mjs';
import {compareKickoffWithFotMob} from './kickoffscore-compare.mjs';
import {renderKickoffReport} from './kickoffscore-report.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceId=process.argv[2]??'1557444';if(sourceId!=='1557444')throw Error('Only the inspected source fixture 1557444 has a reviewed identity mapping.');
const dir=path.join(root,'data/kickoffscore',sourceId),files=(await readdir(dir)).filter(f=>f.endsWith('.ax.txt')&&!f.includes('-description-')).sort();
const captures=await Promise.all(files.map(async name=>{const bytes=await readFile(path.join(dir,name)),s=await stat(path.join(dir,name));return {name,text:bytes.toString(),observedAt:s.mtime.toISOString(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}));
const get=name=>{const c=captures.find(c=>c.name===name);if(!c)throw Error('Missing capture '+name);return c;};
const observedAt=captures.map(c=>c.observedAt).sort().at(-1),overview=get('overview.ax.txt').text;
const clock=overview.match(/Date & Time ([A-Za-z]+ \d+, \d+) at (\d+:\d+)/),score=overview.match(/heading Liverpool FC (\d+)-(\d+) Brighton & Hove Albion: Result/);
if(!clock||!score||!overview.includes('/teams/40/liverpool')||!overview.includes('/teams/51/brighton'))throw Error('Fixture identity not established by observed overview.');
const date=new Date(clock[1]+' '+clock[2]+' GMT+0300').toISOString();
if(date!=='2026-10-25T14:00:00.000Z')throw Error('Observed fixture date differs from the reviewed crosswalk.');
const match={sourceMatchId:sourceId,provider:'KickoffScore',url:'https://kickoffscore.com/match/liverpool-vs-brighton/1557444',date,
 home:{id:'40',name:'Liverpool FC',canonicalId:8650},away:{id:'51',name:'Brighton & Hove Albion',canonicalId:10204},homeScore:Number(score[1]),awayScore:Number(score[2]),finished:overview.includes('Full Time'),
 identityBasis:'Reviewed public fixture: source team links 40/51, Oct 25 2026 17:00 Europe/Istanbul; FotMob 5795492 at 14:00Z, same orientation and 2–0 result.'};
const periods=['all','first-half','second-half'].map(p=>{const c=get(`stats-${p}.ax.txt`);return parseKickoffTeamStatsAX(c.text,{sourceFile:c.name,observedAt:c.observedAt});});
match.teamStats=periods.flatMap(p=>p.metrics);
match.players=captures.filter(c=>/^player-\d\d\.ax\.txt$/.test(c.name)).map(c=>normalizeKickoffPlayerAX(c.text,{sourceFile:c.name,observedAt:c.observedAt,matchDate:date}));
const shotSource=JSON.parse(await readFile(path.join(dir,'shots-rendered.json'),'utf8'));
if(!shotSource.shots.every(s=>s.selectionVerified&&s.detail.includes('checkbox Description: '+s.label+', Value: 1')))throw Error('A shot selection was not proven by its selected UI marker.');
const shots=shotSource.shots.map(parseKickoffShot),scoreCapture=get('predictions-correct-score.ax.txt');
// Attribution requires the explicit event log, not the goal marker's credited team.
if(/text P\.\s*Groß[\s\S]{0,120}text Own Goal/.test(overview))for(const shot of shots)if(shot.playerName==='Pascal Groß'&&shot.minute===17){
 shot.ownGoal=true;shot.attribution={sourceFile:'overview.ax.txt',basis:'explicit Own Goal event at 17 minutes',creditedTeam:shot.teamName,playerTeam:'Brighton & Hove Albion'};}
const externalForecasts={provider:'KickoffScore',reportedAsPreMatch:true,publishedAt:null,verifiedAsOf:false,observedAt,
 scoreGrid:parseKickoffScoreGrid(scoreCapture.text),families:captures.filter(c=>c.name.startsWith('predictions-')).map(c=>({name:c.name,...extractKickoffSection(c.text)})),
 policy:'External model outputs retained for comparison. Not historical ground-truth facts, not mixed into MathGoal learned means or simulation.'};
const odds=JSON.parse(await readFile(path.join(dir,'odds-tables.json'),'utf8')).filter(r=>!r.category?.startsWith('Description:'));
let fotmob=null;for(const file of await readdir(path.join(root,'dist/data/matches'))){if(!file.endsWith('.json'))continue;const b=JSON.parse(await readFile(path.join(root,'dist/data/matches',file),'utf8'));
 fotmob=[...(b.matches??[]),...(b.playerHistoryMatches??[])].find(m=>String(m.id)==='5795492');if(fotmob)break;}
if(!fotmob)throw Error('Reviewed FotMob counterpart 5795492 is absent.');
const comparison=compareKickoffWithFotMob({kickoffMatch:match,fotmobMatch:fotmob,observedAt});
const sections=captures.filter(c=>!/^player-|^shot-/.test(c.name)).map(c=>({name:c.name,observedAt:c.observedAt,...extractKickoffSection(c.text)}));
const graphs={},graphManifest=[];for(const name of ['average-positions-rendered','xg-progression-rendered','momentum-rendered','player-heatmaps-rendered']){
 const bytes=await readFile(path.join(dir,name+'.json')),s=await stat(path.join(dir,name+'.json'));graphs[name]=JSON.parse(bytes.toString());
 graphManifest.push({name:name+'.json',observedAt:s.mtime.toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}
const outcomeCaptureDate=[observedAt,...graphManifest.map(m=>m.observedAt)].sort().at(-1);
const archive={schemaVersion:1,provider:'KickoffScore',capturedAt:outcomeCaptureDate,access:'User-authorized Pro browser session; visible UI only; no session secrets retained',match,periods,shots,externalForecasts,odds,sections,graphs,comparison,
 policy:{modelActivated:false,automatedCollectionEstablished:false,sourceIdNamespace:'KickoffScore IDs differ from FotMob IDs',
  historicalObservationRule:'Only after both capture and match completion, only with verified identity, never for the same target match. Existing source values are not overwritten.',
  unknownAsOfRule:'Season leaders, current table, injury snapshots, trends and external forecasts need an as-of timestamp before use as historical model features.',
  missingRule:'Absent/unknown measurements remain null; unused bench placeholders do not establish zero minutes.',
  validationRule:'One observed fixture cannot establish predictive improvement. New feature effects need separate chronological validation.'},
 issues:[
  {kind:'xg-definition',detail:'Reported match xG 1.20–1.32 differs from the explicitly estimated progression 1.00–1.36. Preserve both definitions.'},
  {kind:'current-season-contamination',detail:'Prediction player panel shows Isak season goals 5; Pre Match Stats season leaders shows 6 after this game. The latter is not a proven pre-kickoff snapshot.'},
  {kind:'h2h-summary-conflict',detail:'Overview prose says 6 Liverpool wins/3 Brighton/1 draw; H2H list and panel show 5/4/1 for ten meetings. Recompute from dated fixtures and tournament filters.'},
  {kind:'shot-count-definition',detail:'31 map markers vs 30 total shots. An own-goal marker is present; retain attribution separately and never assume all markers count as attempts.'},
  {kind:'probability-rounding',detail:'Score cells are rounded, <1% censored and 5+ aggregated. No precision or normalization is invented.'},
  {kind:'spatial-definition',detail:'Average positions describe recorded ball touches; displayed shot positions and chart pixels are not tracking data or an observed pass network.'}
 ],
 summary:{roster:match.players.length,knownMinutePlayers:match.players.filter(p=>p.minutes!==null).length,playerMetricTypes:new Set(match.players.flatMap(p=>Object.keys(p.stats))).size,
  playerMetricObservations:match.players.reduce((n,p)=>n+p.metrics.length,0),teamMetricTypes:new Set(periods[0].metrics.map(m=>m.key)).size,
  teamObservations:match.teamStats.length,shots:shots.length,predictionFamilies:9,forecastViews:externalForecasts.families.length,scoreBuckets:externalForecasts.scoreGrid.cells.length,
  oddsSubmarkets:odds.length,oddsRows:odds.reduce((n,m)=>n+m.tables.reduce((n,t)=>n+Math.max(0,t.length-1),0),0),captures:captures.length,
  playerHeatmaps:graphs['player-heatmaps-rendered'].filter(p=>p.rendered.length).length,heatmapBins:graphs['player-heatmaps-rendered'].reduce((n,p)=>n+p.rendered.reduce((n,h)=>n+h.bins.length,0),0)},
 manifest:captures.map(({text,...meta})=>meta),graphManifest};
const out=path.join(dir,'normalized.json');await writeFile(out+'.tmp',JSON.stringify(archive,null,2));await rename(out+'.tmp',out);
await writeFile(path.join(dir,'evaluation.html'),renderKickoffReport(archive));
console.log(JSON.stringify({output:out,summary:archive.summary,comparison:comparison.summary,identity:comparison.fixtureCrosswalk,issues:archive.issues.length},null,2));
