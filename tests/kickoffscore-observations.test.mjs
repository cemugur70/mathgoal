import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parseKickoffScoreGrid,parseKickoffShot} from '../scripts/kickoffscore-observations.mjs';
const base=new URL('../data/kickoffscore/1557444/',import.meta.url);
test('observed score grid keeps censored cells and aggregate buckets, without probability invention',async()=>{
 const grid=parseKickoffScoreGrid(await readFile(new URL('predictions-correct-score.ax.txt',base),'utf8'));
 assert.equal(grid.cells.length,36);assert.equal(grid.top.length,5);assert.equal(grid.cells.find(c=>c.home==='2'&&c.away==='0').probability,.04);
 const censored=grid.cells.find(c=>c.home==='0'&&c.away==='5+');assert.equal(censored.probability,null);assert.equal(censored.upper,.01);assert.equal(censored.upperExclusive,true);assert.equal(censored.isBucket,true);assert.equal(grid.verifiedAsOf,false);
});
test('all shot details retain absent xGOT and display-coordinate semantics',async()=>{
 const raw=JSON.parse(await readFile(new URL('shots-rendered.json',base),'utf8'));const shots=raw.shots.map(parseKickoffShot);
 assert.equal(shots.length,31);assert.equal(shots[0].playerName,'Cody Gakpo');assert.equal(shots[0].minute,8);assert.equal(shots[0].shotType,'Right foot');
 assert.equal(shots.at(-1).addedMinute,5);assert.equal(shots.at(-1).xgot,null);assert.equal(shots.at(-1).xg,.02);assert.equal(shots.at(-1).ownGoal,null);
 assert.ok(shots.every(s=>s.displayedPosition.leftPercent>=0&&s.displayedPosition.leftPercent<=100));
 assert.equal(shots.filter(s=>s.xg===null).length,1);assert.equal(shots.find(s=>s.playerName==='Pascal Groß').xg,null);
 assert.ok(raw.shots.every(s=>s.selectionVerified&&s.detail.includes('checkbox Description: '+s.label+', Value: 1')));
});
