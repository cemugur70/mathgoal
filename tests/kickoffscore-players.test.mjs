import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {normalizeKickoffPlayerAX} from '../scripts/kickoffscore-players.mjs';
const directory=new URL('../data/kickoffscore/1557444/',import.meta.url);
const names=(await readdir(directory)).filter(f=>/^player-\d{2}\.ax\.txt$/.test(f)).sort();
const captures=new Map(await Promise.all(names.map(async file=>[file,await readFile(new URL(file,directory),'utf8')])));
const parse=(file,options={})=>normalizeKickoffPlayerAX(captures.get(file),{sourceFile:file,...options});

test('all 40 actual captures parse every captured football-stat section without unexplained text or conflicts',()=>{
 assert.equal(captures.size,40);
 const rows=names.map(file=>parse(file));
 assert.equal(new Set(rows.map(p=>p.sourcePlayerId)).size,40);
 assert.ok(rows.every(p=>p.sourceMatchId==='1557444'&&p.sourcePlayerId&&p.name&&p.teamName));
 assert.ok(rows.every(p=>p.sourceTeamId===null&&p.canonicalPlayerId===null&&p.canonicalTeamId===null));
 assert.ok(rows.every(p=>p.unparsed.length===0&&p.conflicts.length===0));
 assert.equal(rows.filter(p=>p.minutes>0).length,30,'participation is derived only from explicit Minutes Played');
 assert.equal(rows.filter(p=>p.minutes===null).length,10);
 assert.equal(rows.filter(p=>p.teamName==='Liverpool FC').length,20);
 assert.equal(rows.filter(p=>p.teamName==='Brighton & Hove Albion').length,20);
 assert.ok(rows.every(p=>p.metrics.every(m=>m.raw!==undefined&&m.rawLine&&m.key&&m.source.line>0&&m.source.axId)));
});
test('Isak preserves provider identity, minutes, rating, xG/xGOT and positive/zero/fraction observations',()=>{
 const p=parse('player-00.ax.txt');
 assert.equal(p.sourcePlayerId,'2864');assert.equal(p.sourcePlayerUrl,'https://kickoffscore.com/players/2864/alexander-isak');
 assert.equal(p.name,'Alexander Isak');assert.equal(p.teamName,'Liverpool FC');assert.equal(p.role,'Forward');assert.equal(p.position,3);
 assert.equal(p.minutes,77);assert.equal(p.rating,7.1);assert.equal(p.age,26);assert.equal(p.nationality,'Sweden');
 assert.equal(p.stats.goals,1);assert.equal(p.stats.assists,0);assert.equal(p.stats.expected_goals,.36);assert.equal(p.stats.expected_goals_on_target_variant,.91);
 assert.equal(p.stats.accurate_passes,10);assert.equal(p.statTotals.accurate_passes,14);
 const passes=p.metrics.find(m=>m.key==='accurate_passes');assert.equal(passes.displayedPercent,71);assert.equal(passes.ratio,10/14);
 assert.equal(p.stats.ball_carry_distance,80);assert.equal(p.stats.progressive_carry_distance,38.2);
 assert.equal(p.metrics.find(m=>m.key==='ball_carry_distance').unit,'m');
 assert.equal(p.stats.accurate_crosses,0);assert.equal(p.statTotals.accurate_crosses,0);
 assert.equal(p.metrics.find(m=>m.key==='accurate_crosses').ratio,null);
});
test('goalkeeper data keeps negative goals prevented and metric absence distinct from explicit zero',()=>{
 const p=parse('player-01.ax.txt');assert.equal(p.name,'Bart Verbruggen');assert.equal(p.position,0);
 assert.equal(p.minutes,95,'source includes stoppage; no forced 90-minute truncation');
 assert.equal(p.stats.saves,3);assert.equal(p.stats.goals_prevented,-.90);assert.equal(p.stats.goals_conceded,2);
 assert.equal(p.stats.saves_inside_box,3);assert.equal(p.stats.keeper_high_claim,0);
 assert.equal(Object.hasOwn(p.stats,'expected_goals'),false);assert.equal(Object.hasOwn(p.stats,'expected_goals_on_target_variant'),false);
 assert.equal(p.stats.expected_assists,0);
 const alisson=parse('player-30.ax.txt');assert.equal(alisson.stats.goals_prevented,.09);
 assert.equal(alisson.metrics.find(m=>m.key==='rating_title').raw,'7.0','display precision is preserved');
});
test('placeholder-zero unused-player panels do not fabricate minutes, a rating, goals or participation',()=>{
 const p=parse('player-29.ax.txt');assert.equal(p.name,'Jason Steele');assert.equal(p.minutes,null);assert.equal(p.rating,null);
 assert.equal(p.participation,'not-established');assert.equal(p.stats.saves,0);assert.equal(p.stats.total_shots,0);
 assert.equal(Object.hasOwn(p.stats,'minutes_played'),false);assert.equal(Object.hasOwn(p.stats,'goals'),false);
 assert.equal(p.stats.accurate_passes,0);assert.equal(p.statTotals.accurate_passes,0);assert.equal(p.heatmap.recordedActions,null);
 assert.equal(p.heatmap.unavailable,true);
});
test('success rates keep won/attempt counts separate from generic tackle counts and retain provider role',()=>{
 const p=parse('player-35.ax.txt');assert.equal(p.name,'Ryan Gravenberch');
 assert.equal(p.stats.won_tackle,1);assert.equal(p.statTotals.won_tackle,3);assert.equal(p.stats.tackles,3);
 assert.equal(p.metrics.find(m=>m.key==='won_tackle').displayedPercent,33);
 assert.equal(p.stats.accurate_opposition_half_passes,13);assert.equal(p.statTotals.accurate_opposition_half_passes,15);
 const gakpo=parse('player-39.ax.txt');assert.equal(gakpo.role,'Midfielder');assert.equal(gakpo.position,2,'external football knowledge cannot override the captured role');
});
test('heatmap and selected-shot facts are retained without replacing full-match metrics or duplicating graphical markers',()=>{
 const p=parse('player-00.ax.txt');assert.equal(p.heatmap.recordedActions,24);assert.equal(p.heatmap.direction,'left to right');
 assert.equal(p.shots.length,3);assert.deepEqual(p.shots.map(s=>s.minuteText),['19','21','27']);
 assert.equal(p.shotSample.minuteText,'27');assert.equal(p.shotSample.shotType.value,'Left foot');assert.equal(p.shotSample.result.value,'Blocked');
 assert.equal(p.shotSample.xg.value,.02);assert.equal(p.shotSample.xgot.value,null);
 assert.equal(p.stats.expected_goals,.36);assert.equal(p.stats.expected_goals_on_target_variant,.91);
 assert.equal(p.shotSample.coverage,'one-selected-shot-only');
});
test('missing provider links remain missing IDs while visible name/team metadata survive',()=>{
 const actual=captures.get('player-00.ax.txt'),withoutLink=actual.split(/\r?\n/).filter(l=>!l.includes('kickoffscore.com/players/')).join('\n');
 const p=normalizeKickoffPlayerAX(withoutLink);assert.equal(p.sourcePlayerId,null);assert.equal(p.id,null);
 assert.equal(p.sourceTeamId,null);assert.equal(p.name,'Alexander Isak');assert.equal(p.teamName,'Liverpool FC');assert.equal(p.minutes,77);
 assert.equal(p.provenance.teamIdStatus,'not-present-in-capture');assert.equal(p.eligibleForModel,false);
});
test('capture/completion cutoff gates are conservative and never imply that a post-match capture was available before kickoff',()=>{
 const raw=parse('player-00.ax.txt');assert.equal(raw.temporal.status,'unknown-time');assert.equal(raw.temporal.eligibleBeforeCutoff,false);
 const options={observedAt:'2026-10-28T10:00:00Z',matchDate:'2026-10-25T14:00:00Z'};
 const past=parse('player-00.ax.txt',{...options,cutoff:'2026-10-25T14:00:00Z'});
 assert.equal(past.temporal.eligibleBeforeCutoff,false);assert.equal(past.temporal.status,'excluded-at-cutoff');
 const later=parse('player-00.ax.txt',{...options,cutoff:'2026-10-29T00:00:00Z'});
 assert.equal(later.temporal.eligibleBeforeCutoff,true);assert.equal(later.temporal.availableAt,'2026-10-28T10:00:00.000Z');
 assert.equal(later.eligibleForModel,false,'temporal eligibility alone does not establish canonical identities or statistic equivalence');
 assert.equal(raw.provenance.sha256,parse('player-00.ax.txt').provenance.sha256);
 assert.throws(()=>normalizeKickoffPlayerAX('not a player modal'),/heading/);
});
