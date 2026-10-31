import test from 'node:test';import assert from 'node:assert/strict';
import {piUpdate,ratingToGoals,createPiRatingIndex,PI_FEATURE_NAMES,PI_POLICY} from '../dist/pi-ratings.mjs';
const H=3600000,DAY=24*H,start=Date.UTC(2026,7,1,18),iso=t=>new Date(t).toISOString(),team=id=>({id,name:'T'+id});
const fixture=(id,t,h,a,hg,ag,extra={})=>({id:String(id),date:iso(t),completedAt:iso(t+2*H),home:team(h),away:team(a),homeScore:hg,awayScore:ag,leagueId:71,finished:true,...extra});
test('one update follows Constantinou & Fenton: error-weighted home / away moves and gamma cross-learning',()=>{
 const zero={home:0,away:0,matches:0},u=piUpdate(zero,zero,3,0),psi=PI_POLICY.c*Math.log10(1+3);
 assert.equal(u.expected,0);assert.ok(Math.abs(u.home.home-psi*PI_POLICY.lambda)<1e-12);assert.ok(Math.abs(u.home.away-psi*PI_POLICY.lambda*PI_POLICY.gamma)<1e-12);
 assert.ok(Math.abs(u.away.away+psi*PI_POLICY.lambda)<1e-12);assert.ok(Math.abs(u.away.home+psi*PI_POLICY.lambda*PI_POLICY.gamma)<1e-12);
 assert.equal(u.home.matches,1);assert.equal(ratingToGoals(0),0);assert.ok(Math.abs(ratingToGoals(3)-9)<1e-12);assert.ok(Math.abs(ratingToGoals(-3)+9)<1e-12);
 const exact=piUpdate({home:1,away:0,matches:5},{home:0,away:0,matches:5},Math.round(ratingToGoals(1)*1000)/1000,0);assert.ok(Math.abs(exact.home.home-1)<1e-3,'a result matching the expectation barely moves ratings');
});
test('ratings are strictly as of the cutoff: target, future, late-completed and friendly results never apply',()=>{
 const rows=[];let id=1;for(let i=0;i<30;i++){rows.push(fixture(id++,start+i*DAY,1,2,2,0),fixture(id++,start+i*DAY+H,3,4,0,1));}
 const cutoff=start+40*DAY,target={id:'target',date:iso(cutoff),home:team(1),away:team(4),leagueId:71};
 const a=createPiRatingIndex(rows).features(target,{cutoff:iso(cutoff)});
 assert.equal(a.home.length,PI_FEATURE_NAMES.length);assert.ok([...a.home,...a.away].every(v=>Number.isFinite(v)&&Math.abs(v)<=3));
 assert.ok(a.ratings.home.home>0&&a.ratings.away.away>0,'strong home team 1 and strong away team 4');assert.equal(a.coverage.status,'ready');
 assert.ok(Date.parse(a.evidence.maxAvailableAt)<cutoff);assert.ok(Math.abs(a.home[6]+a.away[6])<1e-12,'expected goal difference is mirrored');
 const leaky=[...rows,fixture('target',cutoff,1,4,0,9),fixture('future',cutoff+DAY,1,4,0,9),fixture('late',cutoff-H,1,4,0,9,{completedAt:iso(cutoff+H)}),fixture('friendly',cutoff-5*DAY,1,4,0,9,{leagueId:489})];
 assert.deepEqual(createPiRatingIndex(leaky).features(target,{cutoff:iso(cutoff)}).home,a.home);
});
test('replay is deterministic for any query order and unknown teams are neutral with missing evidence',()=>{
 const rows=Array.from({length:40},(_,i)=>fixture(i,start+i*DAY,1+i%4,1+(i+1)%4,i%3,(i+1)%2)),index=createPiRatingIndex(rows);
 const t=k=>({id:'q'+k,date:iso(start+k*DAY+12*H),home:team(1),away:team(2)}),later=index.features(t(35)),earlier=index.features(t(10)),again=index.features(t(35));
 assert.deepEqual(again.home,later.home);assert.deepEqual(createPiRatingIndex(rows).features(t(10)).home,earlier.home);
 const unknown=index.features({id:'u',date:iso(start+50*DAY),home:team(99),away:team(98)});assert.equal(unknown.coverage.status,'insufficient');assert.equal(unknown.home.at(-1),1);assert.ok(unknown.home.slice(0,7).every(v=>v===0));
});
