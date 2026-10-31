import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,copyFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const api=await import('../scripts/player-history-collection.mjs').catch(error=>{
  if(error.code==='ERR_MODULE_NOT_FOUND')return {};
  throw error;
});
const cutoff='2026-10-26T16:00:00.000Z';
const target={id:'9999999',date:cutoff,home:{id:1,name:'Current'},away:{id:2,name:'Away'}};
const roster={home:{starters:[{id:10001,name:'Player'}],bench:[],unavailable:[]},away:{starters:[],bench:[],unavailable:[]}};
function appearance(id,date='2026-10-20T16:00:00Z',extra={}) {
  return {id,teamId:1,teamName:'Current',opponentTeamId:2,opponentTeamName:'Away',isHomeTeam:true,
    matchDate:{utcTime:date},leagueId:71,homeScore:1,awayScore:0,minutesPlayed:90,playedInMatch:true,...extra};
}
function detail(a,playerId=10001) {
  const team={id:a.teamId,name:a.teamName},opponent={id:a.opponentTeamId,name:a.opponentTeamName};
  return {id:String(a.id),date:a.matchDate.utcTime,home:a.isHomeTeam?team:opponent,away:a.isHomeTeam?opponent:team,
    homeScore:a.homeScore,awayScore:a.awayScore,leagueId:a.leagueId,finished:true,
    players:[{id:playerId,teamId:a.teamId,minutes:a.minutesPlayed,stats:{minutes_played:a.minutesPlayed,goals:0}}]};
}
function collect(options={}) {
  assert.equal(typeof api.collectPlayerHistories,'function','Player-history collector must be implemented');
  return api.collectPlayerHistories({target,lineup:roster,cutoff,requested:5,baseMatches:[],
    loadProfile:async()=>({data:{id:10001,recentMatches:[],initialMatchesPage:{matches:[]}},source:'https://www.fotmob.com/players/10001'}),
    loadPage:async()=>{throw Error('Unexpected page request');},loadMatch:async()=>{throw Error('Unexpected match request');},...options});
}

test('selects latest played appearances across clubs and excludes future, target and unused-bench rows',async()=>{
  const old=appearance('100001','2026-10-15T16:00:00Z',{teamId:3,teamName:'Previous'});
  const recent=appearance('100002');
  const rows=[appearance(target.id),appearance('100003','2026-10-27T16:00:00Z'),appearance('100004',undefined,{minutesPlayed:0,playedInMatch:false}),appearance('100005',undefined,{leagueId:489}),appearance('100006',undefined,{leagueId:114}),old,recent,recent];
  const byId=new Map([old,recent].map(a=>[a.id,detail(a)]));
  const result=await collect({loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:rows}},source:'https://www.fotmob.com/players/10001'}),loadMatch:async id=>byId.get(id)});
  const history=result.playerHistories['10001'];
  assert.deepEqual(history.matches.map(m=>m.id),['100002','100001']);
  assert.equal(history.matches[1].teamId,3);
  assert.equal(history.status,'exhausted');
  assert.equal(history.sourceExhausted,true);
  assert.deepEqual(result.playerHistoryMatches.map(m=>m.id).sort(),['100001','100002']);
});

test('retains a missing recent detail slot instead of replacing it with an older available match',async()=>{
  const rows=[appearance('100003','2026-10-23T16:00:00Z'),appearance('100002'),appearance('100001','2026-10-10T16:00:00Z')];
  const result=await collect({requested:2,loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:rows}}}),loadMatch:async id=>{
    if(id==='100003')throw Error('HTTP 503');return detail(rows.find(r=>r.id===id));
  }});
  const h=result.playerHistories['10001'];
  assert.deepEqual(h.matches.map(m=>m.id),['100003','100002']);
  assert.equal(h.matches[0].detailStatus,'unavailable');
  assert.equal(h.matches[0].minutes,90);
  assert.match(h.matches[0].reason,/503/);
  assert.equal(h.status,'partial');
  assert.equal(result.playerHistoryMatches.some(m=>m.id==='100001'),false);
});

test('uses three workers and shares detail downloads between different roster players',async()=>{
  const rows=[appearance('100001')],calls=[];
  const lineup={home:{starters:[{id:10001},{id:10002},{id:10003}],bench:[{id:10004}],unavailable:[{id:10001}]}};
  let active=0,peak=0;
  const result=await collect({lineup,requested:1,loadProfile:async id=>{
    active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;
    return {data:{id:Number(id),initialMatchesPage:{matches:rows}}};
  },loadMatch:async id=>{calls.push(id);await new Promise(r=>setTimeout(r,5));const d=detail(rows[0]);d.players=[10001,10002,10003,10004].map(p=>({...d.players[0],id:p}));return d;}});
  assert.equal(Object.keys(result.playerHistories).length,4);
  assert.deepEqual(calls,['100001']);
  assert.ok(peak<=3);assert.ok(peak>1);
  assert.equal(result.playerHistoryMatches.length,1);
});

test('reads validated source pagination and distinguishes exhausted from incomplete history',async()=>{
  const a=appearance('100001'),url='https://pub.fotmob.com/prod/db/api/player/10001/matches?before=1';
  const calls=[];
  const result=await collect({loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[],previous:url}}}),loadPage:async u=>{
    calls.push(u);return {data:{matches:[a]},source:u,sha256:'page-digest',cached:true};
  },loadMatch:async()=>detail(a)});
  assert.deepEqual(calls,[url]);assert.equal(result.playerHistories['10001'].status,'exhausted');
  assert.equal(result.playerHistories['10001'].sources.some(s=>s.sha256==='page-digest'),true);
});

test('stops repeated pagination, no-progress pages, unsafe paths, and page-budget exhaustion',async t=>{
  const safe='https://pub.fotmob.com/prod/db/api/player/10001/matches?before=1';
  for(const [name,next,page,expected,policy] of [
    ['repeat',safe,{matches:[appearance('100001')],previous:safe},'repeated-page',{}],
    ['no progress',safe,{matches:[],previous:safe.replace('=1','=2')},'no-progress',{}],
    ['unsafe host','https://example.com/prod/db/api/player/10001/matches',null,'invalid-page-url',{}],
    ['wrong player',safe.replace('10001','10002'),null,'invalid-page-url',{}],
    ['credentials','https://name:secret@pub.fotmob.com/prod/db/api/player/10001/matches',null,'invalid-page-url',{}],
    ['page budget',safe,{matches:[appearance('100001')],previous:safe.replace('=1','=2')},'page-budget',{maxPages:1}]
  ])await t.test(name,async()=>{
    const result=await collect({policy,loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[],previous:next}}}),loadPage:async()=>({data:page}),loadMatch:async()=>detail(appearance('100001'))});
    assert.equal(result.playerHistories['10001'].status,'partial');
    assert.equal(result.playerHistories['10001'].reason,expected);
  });
});

test('a global time budget aborts outstanding requests and still returns partial histories',{timeout:2000},async()=>{
  let aborted=false;
  const result=await collect({policy:{durationMs:15},loadProfile:async(id,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true});
  })});
  assert.equal(aborted,true);
  assert.equal(result.playerHistories['10001'].reason,'time-budget');
  assert.equal(result.playerHistories['10001'].status,'partial');
});

test('malformed pages, profile identity mismatch, and match identity mismatch remain explicit partial failures',async t=>{
  await t.test('profile identity',async()=>{
    const r=await collect({loadProfile:async()=>({data:{id:10002,initialMatchesPage:{matches:[]}}})});
    assert.match(r.playerHistories['10001'].reason,/identity/);
  });
  await t.test('page shape',async()=>{
    const r=await collect({loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[],previous:'https://pub.fotmob.com/prod/db/api/player/10001/matches'}}}),loadPage:async()=>({data:{notMatches:[]}})});
    assert.equal(r.playerHistories['10001'].reason,'malformed-page');
  });
  await t.test('detail identity',async()=>{
    const a=appearance('100001');
    const r=await collect({requested:1,loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[a]}}}),loadMatch:async()=>detail({...a,id:'100002'})});
    assert.equal(r.playerHistoryMatches.length,0);assert.equal(r.playerHistories['10001'].matches[0].detailStatus,'unavailable');
    assert.match(r.playerHistories['10001'].matches[0].reason,/identity/);
  });
});

test('source profiles without usable historical summaries do not invent complete histories',async()=>{
  const result=await collect({loadProfile:async()=>({data:{id:10001}})});
  assert.equal(result.playerHistories['10001'].status,'partial');
  assert.equal(result.playerHistories['10001'].reason,'malformed-profile');
});

test('malformed individual appearance rows prevent a false complete or exhausted selection',async()=>{
  const good=appearance('100001'),bad=appearance('100002',undefined,{leagueId:undefined});
  const result=await collect({loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[good,bad]}}}),loadMatch:async()=>detail(good)});
  const h=result.playerHistories['10001'];
  assert.equal(h.status,'partial');assert.equal(h.reason,'malformed-appearance');
  assert.equal(h.selectionComplete,false);assert.deepEqual(h.matches.map(m=>m.id),['100001']);
  assert.ok(h.rejectedAppearances.some(row=>row.id==='100002'&&row.reason==='missing-league'));
});

test('unknown minutes stay unknown when the source explicitly proves an appearance',async()=>{
  const a=appearance('100001',undefined,{minutesPlayed:null});
  const m=detail(a);m.players[0].minutes=null;
  const result=await collect({requested:1,loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[a]}}}),loadMatch:async()=>m});
  const h=result.playerHistories['10001'];
  assert.equal(h.matches.length,1);assert.equal(h.matches[0].minutes,null);
  assert.equal(h.status,'partial');assert.equal(h.reason,'missing-minutes');
  assert.equal(h.matches[0].detailStatus,'available');
});

test('collector-to-model preserves the latest source-proven appearance with unknown minutes',async()=>{
  const {analyzePlayers}=await import('../dist/player-model.mjs');
  const latest=appearance('100009','2026-10-25T16:00:00Z',{minutesPlayed:null});
  const older=Array.from({length:5},(_,i)=>appearance(String(100008-i),new Date(Date.UTC(2026,9,24-i,16)).toISOString()));
  const summaries=[latest,...older],matches=summaries.map(row=>detail(row));
  const enrichment=await collect({requested:5,baseMatches:matches,
    loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:summaries}}})});
  const analysis=analyzePlayers({target,analysisAt:cutoff,matches,...enrichment,
    targetLineup:{matchId:target.id,home:{...roster.home,id:1},away:{...roster.away,id:2}}},{formCount:5});
  const player=analysis.byId['10001'];
  assert.deepEqual(player.matches.map(m=>m.matchId),['100009','100008','100007','100006','100005']);
  assert.equal(player.matches[0].minutes,null);
  assert.equal(player.historyCoverage.status,'partial');
  assert.equal(player.historyCoverage.reason,'missing-minutes');
  assert.equal(player.historyCoverage.missingMinuteSlots,1);
  assert.equal(enrichment.playerHistories['10001'].matches[0].playedInMatch,true);
});

test('collector-to-model never admits detailed evidence with conflicting selected team identity',async()=>{
  const {analyzePlayers}=await import('../dist/player-model.mjs');
  const latest=appearance('100009','2026-10-25T16:00:00Z');
  const older=Array.from({length:4},(_,i)=>appearance(String(100008-i),new Date(Date.UTC(2026,9,24-i,16)).toISOString()));
  const candidate=detail(latest);candidate.home={id:3,name:'Contradictory club'};candidate.players[0].teamId=3;
  const matches=older.map(row=>detail(row));
  const enrichment=await collect({requested:5,baseMatches:matches,
    loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[latest,...older]}}}),loadMatch:async()=>candidate});
  assert.equal(enrichment.playerHistoryMatches.some(match=>match.id===latest.id),false);
  const selected=enrichment.playerHistories['10001'].matches[0];
  assert.equal(selected.teamId,1);assert.equal(selected.detailStatus,'unavailable');
  assert.equal(selected.reason,'match-identity-mismatch');
  const analysis=analyzePlayers({target,analysisAt:cutoff,matches,...enrichment,
    targetLineup:{matchId:target.id,home:{...roster.home,id:1},away:{...roster.away,id:2}}},{formCount:5});
  const player=analysis.byId['10001'],slot=player.matches.find(match=>match.matchId===latest.id);
  assert.equal(slot.teamId,1);assert.equal(slot.playedForTeam.id,1);
  assert.equal(slot.detailStatus,'unavailable');assert.equal(slot.detailReason,'match-identity-mismatch');
  assert.equal(player.historyCoverage.status,'partial');
});

test('unknown appearance status and mismatched historical team identity remain explicit',async t=>{
  await t.test('unknown appearance',async()=>{
    const a=appearance('100001',undefined,{minutesPlayed:null,playedInMatch:undefined});
    const result=await collect({loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[a]}}})});
    const h=result.playerHistories['10001'];
    assert.equal(h.status,'partial');assert.equal(h.matches.length,0);
    assert.ok(h.rejectedAppearances.some(row=>row.reason==='unknown-appearance'));
  });
  await t.test('historical team mismatch',async()=>{
    const a=appearance('100001'),m=detail(a);m.home={id:3,name:'Different club'};
    const result=await collect({requested:1,loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[a]}}}),loadMatch:async()=>m});
    const h=result.playerHistories['10001'];
    assert.equal(h.status,'partial');assert.equal(h.matches[0].reason,'match-identity-mismatch');
    assert.equal(h.matches[0].detailStatus,'unavailable');
  });
});

test('a failed later page preserves known earlier appearance slots and their available details',async()=>{
  const a=appearance('100001');
  const result=await collect({loadProfile:async()=>({data:{id:10001,initialMatchesPage:{matches:[a],previous:'https://pub.fotmob.com/prod/db/api/player/10001/matches?before=1'}}}),
    loadPage:async()=>{throw Error('page HTTP 502');},loadMatch:async()=>detail(a)});
  const h=result.playerHistories['10001'];
  assert.equal(h.status,'partial');assert.equal(h.selectionComplete,false);
  assert.match(h.reason,/502/);assert.deepEqual(h.matches.map(m=>m.id),['100001']);
  assert.equal(h.matches[0].detailStatus,'available');
});

test('retained history never crosses player or cutoff identity',async t=>{
  const slot={...api.normalizeAppearanceSummary(appearance('100001'),{cutoff,targetId:target.id}),detailStatus:'unavailable',reason:'old missing detail'};
  for(const [name,playerId,priorCutoff] of [['different player','10002',cutoff],['different cutoff','10001','2026-10-25T16:00:00Z']])await t.test(name,async()=>{
    const previous={playerId,cutoff:priorCutoff,requested:5,status:'partial',selectionComplete:false,matches:[slot],sources:[{source:'https://www.fotmob.com/players/10001',sha256:'previous-source-digest'}]};
    const result=await collect({previousHistories:{'10001':previous},loadProfile:async()=>{throw Error('HTTP 503');}});
    const h=result.playerHistories['10001'];
    assert.equal(h.retainedFromPrevious,false);assert.deepEqual(h.matches,[]);
    assert.deepEqual(h.knownAppearances,[]);assert.equal(h.sources.some(source=>source.sha256==='previous-source-digest'),false);
    assert.equal(h.status,'partial');assert.equal(h.selectionComplete,false);
  });
});

test('league coverage uses authoritative season fixture IDs, completion gates and observed player statistics separately',()=>{
  assert.equal(typeof api.buildLeagueCoverage,'function','League coverage must be implemented');
  const fixture=(id,date,extra={})=>({id,status:{finished:true,utcTime:date,...extra}});
  const league={details:{id:71,selectedSeason:'2026/2027'},fixtures:{allMatches:[
    fixture('100001','2026-10-20T16:00:00Z'),fixture('100002','2026-10-21T16:00:00Z'),fixture('100003','2026-10-22T16:00:00Z'),
    fixture('100004','2026-10-26T15:00:00Z'),fixture('100005','2026-10-20T16:00:00Z',{cancelled:true}),fixture(target.id,'2026-10-20T16:00:00Z')
  ]}};
  const m=detail(appearance('100001')),empty=detail(appearance('100002'));empty.players=[];
  const wrongSeason=detail(appearance('100099','2025-01-01T16:00:00Z'));
  const r=api.buildLeagueCoverage(league,[m,empty,wrongSeason],{cutoff,targetId:target.id});
  assert.equal(r.season,'2026/2027');assert.equal(r.leagueId,71);
  assert.deepEqual(r.expectedMatchIds,['100001','100002','100003']);
  assert.deepEqual(r.acquiredMatchIds,['100001','100002']);
  assert.deepEqual(r.playerStatsMatchIds,['100001']);
  assert.deepEqual(r.missingMatchIds,['100003']);assert.equal(r.complete,false);
});

test('public collector CLI writes personal history separately and records authoritative league coverage',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'mathgoal-collection-'));
  try {
    await Promise.all(['scripts','dist'].map(name=>mkdir(path.join(directory,name))));
    const files=['scripts/collect.mjs','scripts/enrich-player-histories.mjs','scripts/player-profile.mjs','scripts/player-history-collection.mjs','scripts/fotmob-source.mjs',
      'scripts/train.mjs','scripts/json-source-stream.mjs','scripts/export-training-source.mjs','scripts/export-player-graph-source.mjs','scripts/build-training-data.mjs','scripts/build-player-graph-training.mjs','scripts/build-starter-training.mjs','scripts/build-market-network-training.mjs','scripts/build-season-training.mjs','scripts/build-pi-training.mjs','scripts/train-queue.mjs',
      'dist/player-data.mjs','dist/match-data.mjs','dist/h2h-model.mjs','dist/match-input.mjs'];
    for(const file of files)await copyFile(new URL('../'+file,import.meta.url),path.join(directory,file));
    for(const file of await readdir(new URL('../dist/',import.meta.url)))if(file.endsWith('.mjs'))await copyFile(new URL('../dist/'+file,import.meta.url),path.join(directory,'dist',file));
    const team={id:1,name:'Current'},away={id:2,name:'Away'},previous={id:3,name:'Previous'};
    const sourceMatch=(id,date,home,finished=true)=>({general:{matchId:id,matchTimeUTCDate:date,homeTeam:home,awayTeam:away,leagueId:71,leagueName:'League',finished,started:finished},
      header:{teams:[{score:finished?1:null},{score:finished?0:null}],status:{finished}},content:{lineup:{lineupType:'standard',homeTeam:{...home,starters:[{id:10001,name:'Player',usualPlayingPositionId:3}]},awayTeam:{...away,starters:[]}},
        playerStats:finished?{'10001':{id:10001,name:'Player',teamId:home.id,usualPosition:3,stats:[{title:'Top stats',stats:{Minutes:{key:'minutes_played',stat:{value:90,type:'integer'}},Goals:{key:'goals',stat:{value:0,type:'integer'}}}}]}}:{}}});
    const rawTarget=sourceMatch('9999999','2024-01-20T16:00:00Z',team);
    const rawBase=sourceMatch('100001','2024-01-10T16:00:00Z',team),rawExtra=sourceMatch('100000','2023-12-20T16:00:00Z',previous);
    const fixture={id:'100001',home:team,away,status:{finished:true,utcTime:rawBase.general.matchTimeUTCDate}};
    const a=appearance('100001',rawBase.general.matchTimeUTCDate),older=appearance('100000',rawExtra.general.matchTimeUTCDate,{teamId:3,teamName:'Previous'});
    const responses={target:rawTarget,base:rawBase,extra:rawExtra,fixture,profile:{id:10001,initialMatchesPage:{matches:[a,older]}},league:{details:{id:71,selectedSeason:'2023/2024'},fixtures:{allMatches:[fixture]}}};
    await writeFile(path.join(directory,'responses.json'),JSON.stringify(responses));
    await writeFile(path.join(directory,'network-fixture.mjs'),`import {readFile} from 'node:fs/promises';
const d=JSON.parse(await readFile(new URL('./responses.json',import.meta.url),'utf8'));
globalThis.fetch=async input=>{
 const u=new URL(input);
 if(u.pathname==='/api/data/matchDetails'){const body=[d.target,d.base,d.extra].find(match=>String(match.general.matchId)===u.searchParams.get('matchId'));if(!body)throw Error('Unexpected match '+u);return Response.json(body);}
 if(u.pathname==='/api/data/teams')return Response.json({details:{name:u.searchParams.get('id')==='1'?'Current':'Away'},fixtures:{allFixtures:{fixtures:[d.fixture]}}});
 if(u.pathname==='/api/data/leagues')return Response.json(d.league);
 if(u.pathname==='/players/10001')return new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{data:d.profile}}})+'</script>');
 throw Error('Unexpected network request '+u);
};`);
    const run=spawnSync(process.execPath,['--import',pathToFileURL(path.join(directory,'network-fixture.mjs')).href,'scripts/collect.mjs','9999999'],{cwd:directory,encoding:'utf8',timeout:15000,env:{...process.env,MATHGOAL_TRAINING_DETACH:'0'}});
    assert.equal(run.status,0,run.stderr+'\n'+run.stdout);
    assert.ok(!run.stdout.includes('EĞİTİM_YAYINLANDI'),'collect reports success without waiting for retraining');
    assert.ok(run.stdout.includes('Eğitim arka planda güncelleniyor'));assert.ok(JSON.parse(await readFile(path.join(directory,'data/training.pending'),'utf8')).matchId==='9999999');
    const queued=spawnSync(process.execPath,['scripts/train-queue.mjs'],{cwd:directory,encoding:'utf8',timeout:15000});
    assert.equal(queued.status,0,queued.stderr+queued.stdout);assert.ok(queued.stdout.includes('EĞİTİM_YAYINLANDI'),'the queue publishes the retrained artifact');
    assert.equal(JSON.parse(await readFile(path.join(directory,'data/training-status.json'),'utf8')).state,'published');
    await assert.rejects(readFile(path.join(directory,'data/training.pending')));await assert.rejects(readFile(path.join(directory,'data/training.lock')));
    assert.equal(JSON.parse(await readFile(path.join(directory,'dist/data/training.json'),'utf8')).schemaVersion,6);
    const bundle=JSON.parse(await readFile(path.join(directory,'dist/data/matches/9999999.json'),'utf8'));
    assert.deepEqual(bundle.matches.map(m=>m.id),['100001']);
    assert.deepEqual(bundle.playerHistoryMatches?.map(m=>m.id),['100000']);
    assert.deepEqual(bundle.playerHistories?.['10001']?.matches.map(m=>m.id),['100001','100000']);
    assert.equal(bundle.leagueCoverage?.season,'2023/2024');
    assert.deepEqual(bundle.leagueCoverage.expectedMatchIds,['100001']);
    assert.equal(bundle.leagueCoverage.complete,true);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory,'dist/data/bundle.json'),'utf8')),bundle);
    const latest={target:{id:'8888888'},note:'Preserve caller-selected latest match'};
    await writeFile(path.join(directory,'dist/data/bundle.json'),JSON.stringify(latest));
    await writeFile(path.join(directory,'offline.mjs'),`globalThis.fetch=async()=>{throw Error('Targeted enrichment unexpectedly used network');};`);
    const enrich=spawnSync(process.execPath,['--import',pathToFileURL(path.join(directory,'offline.mjs')).href,'scripts/enrich-player-histories.mjs','9999999'],{cwd:directory,encoding:'utf8',timeout:15000,env:{...process.env,MATHGOAL_TRAINING_DETACH:'0'}});
    assert.equal(enrich.status,0,enrich.stderr+'\n'+enrich.stdout);
    const updated=JSON.parse(await readFile(path.join(directory,'dist/data/matches/9999999.json'),'utf8'));
    assert.deepEqual(updated.matches,bundle.matches);
    assert.deepEqual(updated.playerHistories['10001'].matches.map(m=>m.id),['100001','100000']);
    assert.deepEqual(updated.playerHistoryMatches.map(m=>m.id),['100000']);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory,'dist/data/bundle.json'),'utf8')),latest);

    const missing=api.normalizeAppearanceSummary(appearance('100009','2024-01-19T16:00:00Z'),{cutoff:updated.analysisAt,targetId:'9999999'});
    updated.playerHistories['10001']={...updated.playerHistories['10001'],matches:[{...missing,detailStatus:'unavailable',reason:'HTTP 404'},...updated.playerHistories['10001'].matches],
      status:'partial',reason:'detail-unavailable',selectionComplete:true,
      sources:[...updated.playerHistories['10001'].sources,{source:'https://www.fotmob.com/players/10001',sha256:'old-source-digest',observedAt:'2024-01-20T17:00:00Z'}]};
    await writeFile(path.join(directory,'dist/data/matches/9999999.json'),JSON.stringify(updated));
    await rm(path.join(directory,'data/cache/playerProfile-10001.json'));
    await writeFile(path.join(directory,'profile-failure.mjs'),`globalThis.fetch=async()=>new Response('Source unavailable',{status:503});`);
    const retry=()=>spawnSync(process.execPath,['--import',pathToFileURL(path.join(directory,'profile-failure.mjs')).href,'scripts/enrich-player-histories.mjs','9999999'],{cwd:directory,encoding:'utf8',timeout:15000,env:{...process.env,MATHGOAL_TRAINING_DETACH:'0'}});
    const failed=retry();assert.equal(failed.status,0,failed.stderr+'\n'+failed.stdout);
    const preserved=JSON.parse(await readFile(path.join(directory,'dist/data/matches/9999999.json'),'utf8')).playerHistories['10001'];
    assert.deepEqual(preserved.matches.map(m=>m.id),['100009','100001','100000']);
    assert.equal(preserved.matches[0].reason,'HTTP 404');
    assert.equal(preserved.matches[0].retainedFromPrevious,true);
    assert.equal(preserved.retainedFromPrevious,true);
    assert.equal(preserved.status,'partial');assert.equal(preserved.selectionComplete,false);
    assert.match(preserved.reason,/503/);assert.ok(preserved.sources.some(source=>source.sha256==='old-source-digest'));
    const repeated=retry();assert.equal(repeated.status,0,repeated.stderr+'\n'+repeated.stdout);
    const twice=JSON.parse(await readFile(path.join(directory,'dist/data/matches/9999999.json'),'utf8')).playerHistories['10001'];
    assert.equal(twice.knownAppearances.length,preserved.knownAppearances.length);
    assert.equal(twice.sources.length,preserved.sources.length);

    await writeFile(path.join(directory,'profile-complete.mjs'),`globalThis.fetch=async()=>new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{data:${JSON.stringify({id:10001,initialMatchesPage:{matches:[a]}})}}}})+'</script>');`);
    const completed=spawnSync(process.execPath,['--import',pathToFileURL(path.join(directory,'profile-complete.mjs')).href,'scripts/enrich-player-histories.mjs','9999999'],{cwd:directory,encoding:'utf8',timeout:15000,env:{...process.env,MATHGOAL_TRAINING_DETACH:'0'}});
    assert.equal(completed.status,0,completed.stderr+'\n'+completed.stdout);
    const refreshed=JSON.parse(await readFile(path.join(directory,'dist/data/matches/9999999.json'),'utf8')).playerHistories['10001'];
    assert.deepEqual(refreshed.matches.map(m=>m.id),['100001']);
    assert.ok(refreshed.knownAppearances.some(m=>m.id==='100009'&&m.reason==='HTTP 404'));
    assert.ok(refreshed.sources.some(source=>source.sha256==='old-source-digest'));
    assert.equal(refreshed.knownAppearances.some(m=>'knownAppearances' in m||'sources' in m||'matches' in m),false);
    const beforeFull=JSON.parse(await readFile(path.join(directory,'dist/data/matches/9999999.json'),'utf8'));
    beforeFull.provenance.sources.push({url:'https://www.fotmob.com/api/data/matchDetails?matchId=100000',sha256:'old-extra-response-digest',bytes:123});
    await writeFile(path.join(directory,'dist/data/matches/9999999.json'),JSON.stringify(beforeFull));
    await rm(path.join(directory,'data/cache/playerProfile-10001.json'));
    await writeFile(path.join(directory,'full-profile-failure.mjs'),`import './network-fixture.mjs';const fixtureFetch=globalThis.fetch;globalThis.fetch=(input,options)=>new URL(input).pathname.startsWith('/players/')?Promise.resolve(new Response('Source unavailable',{status:503})):fixtureFetch(input,options);`);
    const fullRetry=spawnSync(process.execPath,['--import',pathToFileURL(path.join(directory,'full-profile-failure.mjs')).href,'scripts/collect.mjs','9999999'],{cwd:directory,encoding:'utf8',timeout:15000,env:{...process.env,MATHGOAL_TRAINING_DETACH:'0'}});
    assert.equal(fullRetry.status,0,fullRetry.stderr+'\n'+fullRetry.stdout);
    const recollected=JSON.parse(await readFile(path.join(directory,'dist/data/matches/9999999.json'),'utf8'));
    assert.deepEqual(recollected.matches.map(m=>m.id),['100001']);
    assert.deepEqual(recollected.playerHistoryMatches.map(m=>m.id),['100000']);
    assert.equal(recollected.playerHistories['10001'].status,'partial');
    assert.equal(recollected.playerHistories['10001'].selectionComplete,false);
    assert.equal(recollected.playerHistories['10001'].retainedFromPrevious,true);
    assert.ok(recollected.playerHistories['10001'].knownAppearances.some(m=>m.id==='100009'));
    assert.ok(recollected.playerHistories['10001'].sources.some(s=>s.sha256==='old-source-digest'));
    assert.equal(recollected.provenance.sources.filter(s=>s.sha256==='old-extra-response-digest').length,1);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory,'dist/data/bundle.json'),'utf8')),recollected);

    const oldNormalizedDetail=recollected.matches.find(match=>match.id==='100001');
    const newBase=sourceMatch('100002','2024-01-15T16:00:00Z',team);
    const newFixture={...fixture,id:'100002',status:{finished:true,utcTime:newBase.general.matchTimeUTCDate}};
    await writeFile(path.join(directory,'responses.json'),JSON.stringify({...responses,base:newBase,fixture:newFixture,league:{details:{id:71,selectedSeason:'2023/2024'},fixtures:{allMatches:[newFixture]}}}));
    for(const file of ['teams-1.json','teams-2.json','leagues-71.json'])await rm(path.join(directory,'data/cache',file));
    const omitted=spawnSync(process.execPath,['--import',pathToFileURL(path.join(directory,'full-profile-failure.mjs')).href,'scripts/collect.mjs','9999999'],{cwd:directory,encoding:'utf8',timeout:15000,env:{...process.env,MATHGOAL_TRAINING_DETACH:'0'}});
    assert.equal(omitted.status,0,omitted.stderr+'\n'+omitted.stdout);
    const withoutOldFixture=JSON.parse(await readFile(path.join(directory,'dist/data/matches/9999999.json'),'utf8'));
    assert.deepEqual(withoutOldFixture.matches.map(match=>match.id),['100002']);
    assert.deepEqual(withoutOldFixture.playerHistoryMatches.find(match=>match.id==='100001'),oldNormalizedDetail);
    assert.ok(withoutOldFixture.playerHistories['10001'].matches.some(match=>match.id==='100001'&&match.retainedFromPrevious));
    assert.equal(withoutOldFixture.playerHistories['10001'].status,'partial');
    const {analyzePlayers}=await import('../dist/player-model.mjs');
    const oldSlot=analyzePlayers(withoutOldFixture,{formCount:5}).byId['10001'].matches.find(match=>match.matchId==='100001');
    assert.equal(oldSlot.detailStatus,'available');assert.equal(oldSlot.stats.goals,0);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory,'dist/data/bundle.json'),'utf8')),withoutOldFixture);
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('real profile and pagination HTTP adapters propagate the enrichment abort to outstanding local requests',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'mathgoal-transport-'));
  try {
    await Promise.all(['scripts','dist'].map(name=>mkdir(path.join(directory,name))));
    for(const file of ['scripts/player-profile.mjs','dist/player-data.mjs'])await copyFile(new URL('../'+file,import.meta.url),path.join(directory,file));
    const source=`import assert from 'node:assert/strict';
import http from 'node:http';
import {getPlayerProfile,getPlayerHistoryPage} from './scripts/player-profile.mjs';
let arrived;const ready=new Promise(resolve=>arrived=resolve);let requests=0;
const server=http.createServer((req,res)=>{if(++requests===2)arrived();});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const nativeFetch=globalThis.fetch,signals=[];
globalThis.fetch=(url,options)=>{signals.push(options.signal);return nativeFetch('http://127.0.0.1:'+server.address().port+'/',options);};
const controller=new AbortController(),guard=setTimeout(()=>controller.abort(Error('test transport guard')),1000);
try {
 const pending=[getPlayerProfile('10001',{signal:controller.signal}),getPlayerHistoryPage('https://pub.fotmob.com/prod/db/api/player/10001/matches',{signal:controller.signal})];
 await ready;controller.abort(Error('enrichment-deadline'));
 const results=await Promise.allSettled(pending);
 assert.equal(signals.length,2);assert.ok(signals.every(signal=>signal.aborted));
 assert.ok(results.every(result=>result.status==='rejected'&&result.reason.message==='enrichment-deadline'));
} finally {clearTimeout(guard);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
`;
    const result=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:directory,encoding:'utf8',timeout:4000});
    assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
  } finally {await rm(directory,{recursive:true,force:true});}
});
