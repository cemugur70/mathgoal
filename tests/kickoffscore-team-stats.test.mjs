import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseKickoffTeamStatsAX} from '../scripts/kickoffscore-team-stats.mjs';
const base=new URL('../data/kickoffscore/1557444/',import.meta.url);
const read=async file=>parseKickoffTeamStatsAX(await readFile(new URL(file,base),'utf8'),{sourceFile:file,observedAt:'2026-10-28T15:58:46Z'});
const get=(d,key,group)=>d.metrics.find(m=>m.key===key&&(!group||m.group===group));
test('observed full-match pairs, zero, fractions and displayed percentages are retained',async()=>{
 const d=await read('stats-all.ax.txt');assert.equal(d.period,'full');assert.equal(d.provenance.sourceMatchId,'1557444');
 assert.deepEqual(get(d,'ball_possession').values,[36,64]);assert.deepEqual(get(d,'expected_goals','Top stats').values,[1.2,1.32]);
 assert.deepEqual(get(d,'total_shots','Shots').values,[13,17]);assert.deepEqual(get(d,'red_cards').values,[0,0]);
 const cross=get(d,'crosses');assert.deepEqual(cross.values,[2,5]);assert.deepEqual(cross.totals,[5,23]);assert.deepEqual(cross.displayedPercent,[40,22]);
 const passes=get(d,'accurate_passes','Passes');assert.deepEqual(passes.values,[225,485]);assert.deepEqual(passes.totals,[null,null]);assert.deepEqual(passes.displayedPercent,[69,84]);
 assert.deepEqual(get(d,'goals_prevented').values,[.09,-.75]);assert.ok(d.metrics.every(m=>m.source.line>0&&Number.isInteger(m.source.axId)));
 assert.equal(d.rawGroups.filter(g=>g.unparsed).length,0);
});
test('halves keep absent metrics absent and are not confused with full chart values',async()=>{
 const a=await read('stats-first-half.ax.txt'),b=await read('stats-second-half.ax.txt');
 assert.equal(a.period,'first-half');assert.equal(b.period,'second-half');
 assert.deepEqual(get(a,'total_shots','Shots').values,[9,8]);assert.deepEqual(get(b,'total_shots','Shots').values,[4,9]);
 assert.deepEqual(get(a,'expected_goals','Attack').values,[.77,.8]);assert.deepEqual(get(b,'expected_goals','Attack').values,[.43,.52]);
 assert.deepEqual(get(b,'shots_on_target','Shots').values,[0,0]);assert.equal(get(a,'red_cards'),undefined);assert.equal(get(b,'attacks'),undefined);
 assert.equal(a.progression.period,'full');assert.equal(a.progression.selectedMinute,90);assert.equal(a.progression.estimated,true);
 assert.deepEqual(a.progression.teams.map(t=>t.value),[1,1.36]);assert.equal(a.progression.isTeamTotalReplacement,false);
 assert.ok(a.warnings.some(s=>s.includes('remains full match')));
});
test('shot-map player values do not become team metrics and unknown content is retained',async()=>{
 const raw=await readFile(new URL('stats-all.ax.txt',base),'utf8');
 const d=parseKickoffTeamStatsAX(raw.replace('13 Total shots 17 6 Shots off target','13 Total shots 17 Unpublished metric 123 6 Shots off target'));
 assert.ok(d.rawGroups.some(g=>g.group==='Shots'&&g.unparsed==='Unpublished metric 123'));
 assert.equal(d.metrics.some(m=>m.label==='Shot type'||m.label==='Situation'),false);
 assert.equal(d.metrics.some(m=>m.values.includes(.02)),false);
 assert.deepEqual(get(d,'expected_goals','Attack').values,[1.2,1.32]);
});
test('missing values remain null, no selected period is guessed, wrong-tab modal is rejected',()=>{
 const ax='0 AXWebArea X\n\t1 tab (selected, settable, boolean) Stats, Value: 1\n\t2 heading Shots, Value: 3\n\t3 text — Total shots 0';
 const d=parseKickoffTeamStatsAX(ax);assert.equal(d.period,null);assert.deepEqual(d.metrics[0].values,[null,0]);
 assert.deepEqual(parseKickoffTeamStatsAX(ax.replace(') Stats,',') Lineup,')).metrics,[]);
});
