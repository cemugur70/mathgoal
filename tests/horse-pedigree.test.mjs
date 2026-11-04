import test from 'node:test';
import assert from 'node:assert/strict';
import {createSirePreference} from '../dist/horse-pedigree.mjs';

test('sire surface preference: offspring better on turf, only runs before the race date', () => {
 const runs=new Map(),sires=new Map();
 for(let h=1;h<=10;h++){sires.set(h,'S');runs.set(h,[{date:'2025-01-01',place:1,surface:'TURF'},{date:'2025-02-01',place:5,surface:'DIRT'},{date:'2025-03-01',place:4,surface:'AWT'}]);}
 runs.set(11,[{date:'2026-05-01',place:1,surface:'DIRT'}]);sires.set(11,'S');
 const p=createSirePreference(runs,sires,{prior:5,minRuns:20});
 assert.equal(p.get('2025-01-15','S','TURF'),0,'too few offspring runs yet');
 const turf=p.get('2026-01-01','S','TURF'),dirt=p.get('2026-01-01','S','DIRT'),tapeta=p.get('2026-01-01','S','TAPETA');
 assert.ok(turf>0&&dirt<0&&tapeta<0);assert.equal(p.get('2026-01-01','unknown','TURF'),0);
 assert.equal(p.get('2026-04-30','S','DIRT'),dirt,'the 2026-05-01 run is not seen yet');
});
