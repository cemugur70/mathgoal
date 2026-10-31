import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {normalizeKickoffPlayerAX} from '../scripts/kickoffscore-players.mjs';
import {parseKickoffTeamStatsAX} from '../scripts/kickoffscore-team-stats.mjs';
import {compareKickoffWithFotMob} from '../scripts/kickoffscore-compare.mjs';
const directory=new URL('../data/kickoffscore/1557444/',import.meta.url);
const archive=JSON.parse(await readFile(new URL('../dist/data/matches/5868108.json',import.meta.url),'utf8'));
const fotmob=[...(archive.matches??[]),...(archive.playerHistoryMatches??[])].find(m=>String(m.id)==='5795492');
if(!fotmob)throw Error('Verified FotMob fixture 5795492 is absent from the local archive.');
const sourcePlayers=await Promise.all((await readdir(directory)).filter(f=>/^player-\d{2}\.ax\.txt$/.test(f)).sort().map(async file=>
 normalizeKickoffPlayerAX(await readFile(new URL(file,directory),'utf8'),{sourceFile:file})));
const teamStats=(await Promise.all(['stats-all.ax.txt','stats-first-half.ax.txt','stats-second-half.ax.txt'].map(async file=>
 parseKickoffTeamStatsAX(await readFile(new URL(file,directory),'utf8'),{sourceFile:file})))).flatMap(p=>p.metrics);
const fixture=()=>({kickoffMatch:{sourceMatchId:'1557444',date:'2026-10-25T14:00:00Z',
 home:{id:40,name:'Liverpool FC',canonicalId:8650},away:{id:51,name:'Brighton & Hove Albion',canonicalId:10204},
 homeScore:2,awayScore:0,players:structuredClone(sourcePlayers),teamStats:structuredClone(teamStats)},fotmobMatch:structuredClone(fotmob)});
const player=(report,name)=>report.players.find(p=>p.crosswalk.sourceName===name);

test('actual fixture requires exact kickoff, explicit oriented team crosswalk and scores; provider IDs are distinct',()=>{
 const args=fixture(),r=compareKickoffWithFotMob(args);assert.equal(r.status,'compared');assert.equal(r.fixtureCrosswalk.matched,true);
 assert.equal(r.fixtureCrosswalk.sourceMatchId,'1557444');assert.equal(r.fixtureCrosswalk.canonicalMatchId,'5795492');
 for(const edit of [a=>a.kickoffMatch.date='2026-10-25T14:01:00Z',a=>a.kickoffMatch.home.canonicalId=10204,
  a=>a.kickoffMatch.away.canonicalId=null,a=>a.kickoffMatch.homeScore=3,a=>a.kickoffMatch.canonicalMatchId='other',
  a=>a.kickoffMatch.home.id=a.kickoffMatch.away.id]){
  const a=fixture();edit(a);const rejected=compareKickoffWithFotMob(a);
  assert.equal(rejected.status,'fixture-mismatch');assert.equal(rejected.players.length,0);assert.equal(rejected.teamMetrics.length,0);assert.equal(rejected.eligibleForModel,false);
 }
});
test('exact accent/punctuation matching is team-specific and never expands nicknames or missing name parts',()=>{
 const r=compareKickoffWithFotMob(fixture());assert.equal(r.summary.matchedPlayers,35);assert.equal(r.summary.unresolvedPlayers,5);
 assert.equal(player(r,'Ronald Araújo').crosswalk.status,'matched');
 assert.equal(player(r,'Malick Yalcouyé').crosswalk.canonicalPlayerId,null);
 assert.equal(player(r,'Alisson').crosswalk.canonicalPlayerId,null);assert.equal(player(r,'Joe Gomez').crosswalk.canonicalPlayerId,null);
 const a=fixture(),isak=a.kickoffMatch.players.find(p=>p.name==='Alexander Isak');
 // Coincidental equality between namespaces does not identify a player.
 isak.sourcePlayerId=String(a.fotmobMatch.players.find(p=>p.name==='Lewis Dunk').id);
 assert.equal(player(compareKickoffWithFotMob(a),'Alexander Isak').crosswalk.canonicalPlayerId,'690107');
 a.fotmobMatch.players.push({...a.fotmobMatch.players.find(p=>p.name==='Alexander Isak'),id:'other-team',teamId:10204});
 assert.equal(player(compareKickoffWithFotMob(a),'Alexander Isak').crosswalk.canonicalPlayerId,'690107');
});
test('explicit aliases are auditable, constrained to the canonical team, and do not enable ambiguous reuse',()=>{
 const a=fixture(),fm=a.fotmobMatch.players.find(p=>p.name==='Alisson Becker');
 a.playerAliases=[{sourcePlayerId:'280',canonicalPlayerId:String(fm.id),canonicalTeamId:'8650',reason:'Explicit caller-verified profile crosswalk'}];
 let r=compareKickoffWithFotMob(a);assert.equal(player(r,'Alisson').crosswalk.status,'matched');assert.equal(player(r,'Alisson').crosswalk.method,'explicit-verified-alias');
 a.playerAliases[0].canonicalTeamId='10204';r=compareKickoffWithFotMob(a);assert.equal(player(r,'Alisson').crosswalk.canonicalPlayerId,null);
 const b=fixture(),isak=b.fotmobMatch.players.find(p=>p.name==='Alexander Isak');
 b.fotmobMatch.players.push({...isak,id:'ambiguous-duplicate'});
 assert.equal(player(compareKickoffWithFotMob(b),'Alexander Isak').crosswalk.reason,'ambiguous-name-on-team');
 const c=fixture();c.kickoffMatch.players.push({...structuredClone(c.kickoffMatch.players.find(p=>p.name==='Alexander Isak')),sourcePlayerId:'other-source-id'});
 assert.ok(compareKickoffWithFotMob(c).playerCrosswalk.filter(p=>p.sourceName==='Alexander Isak').every(p=>p.canonicalPlayerId===null));
});
test('real player disagreements and genuinely new observations remain visible without overwriting either source',()=>{
 const a=fixture(),before=JSON.stringify(a),r=compareKickoffWithFotMob(a),p=player(r,'Alexander Isak');
 assert.equal(p.metrics.find(m=>m.key==='expected_goals').status,'conflict');
 assert.equal(p.metrics.find(m=>m.key==='expected_goals').sourceValue,.36);assert.equal(p.metrics.find(m=>m.key==='expected_goals').fotmobValue,.4);
 assert.equal(p.metrics.find(m=>m.key==='expected_goals_on_target_variant').status,'equal');
 assert.equal(p.metrics.find(m=>m.key==='ball_carry_distance').status,'new');
 assert.equal(p.metrics.find(m=>m.key==='ball_carry_distance').fotmobKey,null,'carry distance is not total running distance');
 assert.ok(p.metrics.find(m=>m.key==='aerials_won').differences.includes('total'));
 assert.equal(JSON.stringify(a),before);assert.equal(r.merged,false);assert.equal(r.trained,false);assert.equal(r.eligibleForModel,false);
});
test('rounded rating tolerance differs from numeric metric tolerance and fraction totals are independently checked',()=>{
 const a=fixture(),isak=a.fotmobMatch.players.find(p=>p.name==='Alexander Isak');
 isak.stats.rating_title=7.15;isak.stats.expected_goals=.365;
 let p=player(compareKickoffWithFotMob(a),'Alexander Isak');
 assert.equal(p.metrics.find(m=>m.key==='rating_title').status,'equal');assert.equal(p.metrics.find(m=>m.key==='expected_goals').status,'equal');
 isak.stats.rating_title=7.152;isak.stats.expected_goals=.366;isak.statTotals.accurate_passes=15;
 p=player(compareKickoffWithFotMob(a),'Alexander Isak');assert.equal(p.metrics.find(m=>m.key==='rating_title').status,'conflict');
 assert.equal(p.metrics.find(m=>m.key==='expected_goals').status,'conflict');
 const passes=p.metrics.find(m=>m.key==='accurate_passes');assert.equal(passes.valueEqual,true);assert.equal(passes.totalEqual,false);assert.equal(passes.status,'conflict');
});
test('missing and unknown-participation zeros are not promoted to shared facts or new appearances',()=>{
 const a=fixture(),r=compareKickoffWithFotMob(a),steele=player(r,'Jason Steele');
 assert.equal(steele.participationEstablished,false);assert.equal(steele.counts.shared,0);assert.equal(steele.counts.new,0);
 assert.ok(steele.metrics.every(m=>m.status==='participation-unverified'));
 const isak=a.kickoffMatch.players.find(p=>p.name==='Alexander Isak');isak.stats.expected_goals=null;
 const value=player(compareKickoffWithFotMob(a),'Alexander Isak').metrics.find(m=>m.key==='expected_goals');
 assert.equal(value.status,'source-missing');assert.equal(value.sourceValue,null);assert.equal(value.shared,false);
});
test('team periods, numerator/attempt aliases and duplicate source observations are kept separate and scoped',()=>{
 const r=compareKickoffWithFotMob(fixture());
 const full=r.teamMetrics.find(m=>m.key==='expected_goals'&&m.period==='full'&&m.side==='home');
 const first=r.teamMetrics.find(m=>m.key==='expected_goals'&&m.period==='first-half'&&m.side==='home');
 assert.equal(full.sourceValue,1.2);assert.equal(full.status,'equal');assert.equal(first.sourceValue,.77);assert.equal(first.status,'equal');
 assert.ok(full.observationCount>1,'top/detailed duplicate observations do not become extra independent metrics');
 const crosses=r.teamMetrics.find(m=>m.key==='crosses'&&m.period==='full'&&m.side==='home');
 assert.equal(crosses.sourceValue,2);assert.equal(crosses.sourceTotal,5);assert.equal(crosses.totalEqual,true);
 const duels=r.teamMetrics.find(m=>m.key==='duels'&&m.period==='full'&&m.side==='home');
 assert.equal(duels.fotmobKey,null,'source duel share must not silently become a count of won duels');
 const a=fixture();a.kickoffMatch.teamStats.push({...structuredClone(a.kickoffMatch.teamStats[0]),period:null});
 const unknown=compareKickoffWithFotMob(a).teamMetrics.find(m=>m.period===null);assert.equal(unknown.status,'period-unverified');
});
test('source identity checks and observed/completion cutoff gates keep this report out of historical target features',()=>{
 const a=fixture();a.observedAt='2026-10-28T12:00:00Z';a.cutoff='2026-10-25T14:00:00Z';
 let r=compareKickoffWithFotMob(a);assert.equal(r.temporal.temporallyEligible,false);assert.equal(r.temporal.eligibleAsPriorFact,false);
 a.cutoff='2026-10-29T00:00:00Z';r=compareKickoffWithFotMob(a);assert.equal(r.temporal.eligibleAsPriorFact,true);assert.equal(r.eligibleForModel,false);
 a.targetId='5795492';r=compareKickoffWithFotMob(a);assert.equal(r.temporal.targetExcluded,true);assert.equal(r.temporal.eligibleAsPriorFact,false);
 const b=fixture();b.kickoffMatch.players[0].sourceTeamId='51';
 assert.equal(compareKickoffWithFotMob(b).playerCrosswalk[0].reason,'contradicting-source-team-label');
 assert.equal(compareKickoffWithFotMob(fixture()).temporal.status,'unknown-time');
});
