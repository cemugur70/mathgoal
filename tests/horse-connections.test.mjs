import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectionStats} from '../dist/horse-connections.mjs';

const field=(jockeyAgf)=>[{number:'1',status:'RUNNER',jockeyId:1,trainer:'A',agf1:jockeyAgf},{number:'2',status:'RUNNER',jockeyId:2,trainer:'B',agf1:100-jockeyAgf}];

test('jockey edge rewards wins above the AGF share of the mount, per breed relative to overall', () => {
 const c=createConnectionStats();
 // Jockey 1 wins five Arabian races on 20% AGF outsiders and loses two thoroughbred races on 50% horses.
 for(let d=1;d<=5;d++)c.update({date:`2026-01-0${d}`,breed:'AR',winners:['1']},field(20));
 for(let d=1;d<=2;d++)c.update({date:`2026-02-0${d}`,breed:'TB',winners:['2']},field(50));
 const ar=c.get({date:'2026-03-01',breed:'AR'},{jockeyId:1,trainer:'A'}),tb=c.get({date:'2026-03-01',breed:'TB'},{jockeyId:1,trainer:'A'});
 assert.ok(ar.jockeyEdge>0,'5 wins against 1 + 1 expected');
 assert.equal(ar.jockeyEdge,tb.jockeyEdge);
 assert.ok(ar.jockeyBreed>0&&tb.jockeyBreed<0);
 // Field-size form: 5 wins in 7 two-horse races is above the 3.5 par.
 assert.ok(ar.jockey>0);
 // Unknown jockey: neutral.
 assert.deepEqual(c.get({date:'2026-03-01',breed:'AR'},{jockeyId:null,trainer:null}),{jockey:0,trainer:0,jockeyEdge:0,jockeyBreed:0});
});
