import test from 'node:test';import assert from 'node:assert/strict';
import {parseMatchId,matchContext} from '../dist/match-input.mjs';
test('upcoming FotMob URLs accept match fragment without stats tab',()=>{
 assert.equal(parseMatchId('https://www.fotmob.com/tr/matches/juventus-vs-lecce/38ed1f#5749716:tab=h2h'),'5749716');
 for(const url of ['https://www.fotmob.com/tr/matches/galatasaray-vs-fenerbahce/2hfnrt#5904782','https://www.fotmob.com/tr/matches/galatasaray-vs-fenerbahce/2hfnrt#5904782:tab=stats','https://www.fotmob.com/match/5904782','5904782'])assert.equal(parseMatchId(url),'5904782');
 for(const url of ['https://fotmob.com.evil.test/match/5904782','javascript://fotmob.com/match/5904782','https://user:pass@fotmob.com/match/5904782','https://fotmob.com/matches/abc#5904782oops'])assert.equal(parseMatchId(url),null);
});
const raw={general:{matchId:'5904782',homeTeam:{id:8637,name:'Galatasaray'},awayTeam:{id:8695,name:'Fenerbahçe'},matchTimeUTCDate:'2026-10-26T18:30:00Z',started:false,finished:false},header:{status:{started:false,finished:false},teams:[{score:0},{score:0}]}};
test('unplayed placeholder 0–0 is never treated as an actual score',()=>{
 const c=matchContext(raw,'2026-10-26T10:00:00Z');assert.equal(c.actual,null);assert.equal(c.target.finished,false);assert.equal(c.analysisAt,'2026-10-26T10:00:00.000Z');assert.equal(c.target.date,'2026-10-26T18:30:00.000Z');
});
test('completed result is separate and retrospective cutoff is kickoff',()=>{
 const c=matchContext({...raw,general:{...raw.general,started:true,finished:true},header:{...raw.header,status:{finished:true},teams:[{score:2},{score:1}]}},'2026-10-27T10:00:00Z');assert.equal(c.actual.homeScore,2);assert.equal(c.actual.awayScore,1);assert.equal(c.analysisAt,'2026-10-26T18:30:00.000Z');
});
