import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerExplorerIndex,explorerGraph,PLAYER_STAT_CATEGORIES,statCategory,metricLabel} from '../dist/player-explorer-data.mjs';
const team=id=>({id,name:`Takım ${id}`});
const player=(id,teamId,minutes=90,extra={})=>({id,teamId,name:`Oyuncu ${id}`,position:id%4,minutes,starter:true,
 stats:{minutes_played:minutes,goals:0,expected_goals:.2,accurate_passes:30,rating_title:7},statTotals:{accurate_passes:40},...extra});
const match=(id,day,h,a,players,extra={})=>({id:String(id),date:`2026-10-${String(day).padStart(2,'0')}T12:00:00Z`,home:team(h),away:team(a),
 homeScore:2,awayScore:1,finished:true,leagueId:71,players,...extra});
function fixture(){
 const m11=match(11,20,1,2,[...Array.from({length:8},(_,i)=>player(101+i,1)),...Array.from({length:8},(_,i)=>player(201+i,2))]);
 const m12=match(12,18,2,3,[player(201,2),player(202,2),player(301,3),player(302,3)]);
 const m13=match(13,16,3,4,[player(301,3),player(302,3),player(401,4),player(402,4)]);
 const m14=match(14,10,4,2,[player(101,4,60,{stats:{minutes_played:60,goals:null,accurate_passes:60},statTotals:{}}),player(201,2)]);
 const bundle={target:{id:'9000000',date:'2026-11-01T18:00:00Z',home:team(1),away:team(2)},analysisAt:'2026-10-30T12:00:00Z',
  matches:[m11,m12,m13,m14],playerMetricInventory:[{key:'accurate_passes',title:'Accurate passes',group:'Passing',type:'fractionWithPercentage'},
   {key:'rating_title',title:'FotMob rating',group:'Top stats',type:'double'}],
  targetLineup:{matchId:'9000000',home:{id:1,starters:[{id:101,name:'Çağlar Şahin',position:3}],bench:[{id:9991,name:'Henüz oynamayan',position:1}],unavailable:[]},
   away:{id:2,starters:[{id:201,name:'Oyuncu 201',position:3}],bench:[],unavailable:[]}}};
 return bundle;
}

test('strict normalized evidence excludes target/future/unfinished/awarded/friendly rows and nonappearances',()=>{
 const b=fixture(),baseline=createPlayerExplorerIndex(b),copy=structuredClone(b.matches[0]);
 b.matches.push({...copy,id:b.target.id},{...copy,id:'future',date:'2026-11-02T12:00:00Z'},
  {...copy,id:'overlap',date:'2026-10-30T11:30:00Z'},{...copy,id:'unfinished',finished:false},
  {...copy,id:'awarded',awarded:true},{...copy,id:'cancelled',cancelled:true},
  {...copy,id:'friendly',leagueId:489},{...copy,id:'national-friendly',leagueId:114});
 b.matches[0].players.push(player(8881,1,0),player(8882,1,null,{stats:{minutes_played:null}}),player(8883,999,90));
 const index=createPlayerExplorerIndex(b,{byId:{101:{games:1000,minutes:100000,xg90:999}}});
 assert.equal(index.matches.size,4);assert.equal(index.coverage.appearanceCount,baseline.coverage.appearanceCount);
 assert.equal(index.nodes.has('player:8881'),false);assert.equal(index.nodes.has('player:8882'),false);assert.equal(index.nodes.has('player:8883'),false);
 assert.ok(index.profile(101).xg90<1);assert.equal(index.cutoff,b.analysisAt.replace('Z','.000Z'));
});

test('fixture and appearance identities deduplicate cycles while global players retain former-club ownership',()=>{
 const b=fixture();b.playerHistoryMatches=[{...structuredClone(b.matches[0]),homeScore:99}];
 b.matches.push(b.matches[0]);b.matches[0].players.push(b.matches[0].players[0]);
 const index=createPlayerExplorerIndex(b),p=index.nodes.get('player:101');
 assert.equal(index.matches.size,4);assert.equal(index.matchPlayers(11).length,16);
 assert.equal(index.playerMatches(101).length,2);assert.equal(index.nodes.has('player:1:101'),false);
 assert.equal(p.teamId,'1');assert.deepEqual(new Set(p.clubIds),new Set(['1','4']));
 assert.equal(index.edges.get('appearance:101:14').teamId,'4');assert.equal(index.edges.get('appearance:101:11').teamId,'1');
 assert.equal(index.profile(101,4).games,1);assert.equal(index.profile(101,4).minutes,60);
 assert.equal(index.profile(101).matches.find(m=>m.matchId==='14').playedForTeam.id,4);
 assert.equal(index.matches.get('11').homeScore,2,'base fixture evidence owns duplicate identity');
 assert.ok([...index.edges.values()].every(e=>['appearance','fixture'].includes(e.relation)));
});

test('roster-only roots do not fabricate appearances or import current profile totals',()=>{
 const b=fixture(),index=createPlayerExplorerIndex(b,{byId:{9991:{goals:25,minutes:900}}});
 const node=index.nodes.get('player:9991'),p=index.profile(9991);
 assert.equal(node.games,0);assert.equal(node.minutes,0);assert.equal(p.games,0);assert.equal(p.goals,null);
 assert.equal(index.playerMatches(9991).length,0);assert.equal(index.adjacency.get('player:9991').length,0);
 assert.equal(p.historyCoverage.status,'archive-only');
 assert.deepEqual(explorerGraph(index,{rootId:'player:9991'}).nodes.map(n=>n.id),['player:9991']);
});

test('recursive expansion follows other players into their other matches and closes cycles deterministically',()=>{
 const index=createPlayerExplorerIndex(fixture()),options={rootId:'player:101',expandedIds:['player:201','player:301'],playersPerMatch:4,matchLimit:10};
 const a=explorerGraph(index,options),b=explorerGraph(index,options),ids=new Set(a.nodes.map(n=>n.id));
 assert.deepEqual(a,b);assert.ok(ids.has('match:12'));assert.ok(ids.has('match:13'));assert.ok(ids.has('player:401'));
 assert.equal(ids.size,a.nodes.length);assert.equal(new Set(a.edges.map(e=>e.id)).size,a.edges.length);
 assert.ok(a.edges.every(e=>ids.has(e.source)&&ids.has(e.target)));
 assert.ok(a.edges.some(e=>e.source==='player:301'&&e.target==='match:13'));
 assert.ok(!a.edges.some(e=>e.source.startsWith('player:')&&e.target.startsWith('player:')),'no invented player duel edges');
});

test('initial match participants are sampled across both teams; expanded matches reveal the full proven group',()=>{
 const index=createPlayerExplorerIndex(fixture());
 const compact=explorerGraph(index,{rootId:'player:101',matchLimit:1,playersPerMatch:4});
 const playerNodes=compact.nodes.filter(n=>n.kind==='player');
 assert.equal(playerNodes.length,4);assert.ok(playerNodes.some(p=>p.teamId==='1'));assert.ok(playerNodes.some(p=>p.teamId==='2'));
 assert.ok(playerNodes.some(p=>p.playerId==='101'));assert.equal(index.matchPlayers('match:11').length,16);
 const expanded=explorerGraph(index,{rootId:'player:101',matchLimit:1,playersPerMatch:4,expandedIds:['match:11']});
 assert.equal(expanded.nodes.filter(n=>n.kind==='player').length,16);
 assert.equal(expanded.edges.filter(e=>e.relation==='appearance').length,16);
 assert.equal(compact.truncated,true);assert.ok(compact.omittedNodeCount>=12);
});

test('node budgets preserve the root and connected evidence; unreachable expansions create no orphans',()=>{
 const index=createPlayerExplorerIndex(fixture());
 for(const maxNodes of [1,2,7,15]){
  const graph=explorerGraph(index,{rootId:'player:101',maxNodes,playersPerMatch:8,expandedIds:['player:201','player:301','team:4','player:9991']});
  assert.ok(graph.nodes.length<=maxNodes);assert.equal(graph.nodes[0].id,'player:101');
  const seen=new Set(['player:101']);for(let n=0;n<graph.nodes.length;n++)for(const e of graph.edges)if(seen.has(e.source)||seen.has(e.target)){seen.add(e.source);seen.add(e.target);}
  assert.equal(seen.size,graph.nodes.length);assert.ok(!graph.nodes.some(n=>n.id==='player:9991'));
  assert.equal(graph.truncated,true);assert.ok(graph.omittedNodeCount>0);
 }
 const noTeams=explorerGraph(index,{rootId:'player:101',showTeams:false});assert.ok(noTeams.nodes.every(n=>n.kind!=='team'));
 assert.deepEqual(explorerGraph(index,{rootId:'player:unknown'}),{nodes:[],edges:[],truncated:false,omittedNodeCount:0});
});

test('profile and inspector returns are fresh, preserve unknown counts and use paired fraction evidence',()=>{
 const b=fixture(),before=JSON.stringify(b),index=createPlayerExplorerIndex(b),p=index.profile(101),passes=p.metrics.accurate_passes;
 assert.equal(p.games,2);assert.equal(p.minutes,150);assert.equal(p.goals,0,'only the one observed goal count is summed');
 assert.equal(p.metrics.goals.games,1);assert.equal(p.metrics.rating_title.sum,null);
 assert.equal(p.metrics.rating_title.per90,null);assert.equal(passes.sum,90);
 assert.equal(passes.pairedNumerator,30);assert.equal(passes.pairedTotal,40);assert.equal(passes.ratio,.75);assert.equal(passes.pairedCoverage,.5);
 assert.deepEqual(index.fractionEvidence(101,'accurate_passes'),{numerator:30,total:40,ratio:.75,games:1,selectedGames:2,coverage:.5});
 assert.equal(index.fractionEvidence(101,'absent').ratio,null);
 p.matches[0].stats.goals=999;index.matchPlayers(11)[0].stats.goals=777;index.playerMatches(101)[0].stats.goals=888;
 assert.equal(index.profile(101).goals,0);assert.equal(JSON.stringify(b),before);
});

test('Turkish search, category inference and source-title fallback preserve unknown statistics',()=>{
 const index=createPlayerExplorerIndex(fixture());
 assert.equal(index.findPlayers('caglar sahin')[0].playerId,'101');assert.equal(index.findPlayers('ÇAĞLAR')[0].playerId,'101');
 assert.equal(index.findPlayers('9991')[0].playerId,'9991');assert.equal(index.findPlayers('',2).length,2);
 assert.equal(statCategory('accurate_passes'),'passing');assert.equal(statCategory('goals_prevented'),'keeper');
 assert.equal(statCategory('new_source_metric',{title:'Provider fact',group:'Duels'}),'duels');
 assert.equal(statCategory('unknown_metric',{title:'Unknown',group:'Unknown'}),'other');
 assert.equal(metricLabel('expected_goals'),'Beklenen gol (xG)');assert.equal(metricLabel('new_source_metric',{title:'Provider fact'}),'Provider fact');
 assert.deepEqual(PLAYER_STAT_CATEGORIES.find(c=>c.id==='attack').keys.slice(0,3),['goals','expected_goals','expected_goals_on_target_variant']);
 assert.equal(statCategory('expected_goals_on_target_variant'),'attack');assert.equal(statCategory('expected_assists'),'passing');
 assert.equal(metricLabel('unseen_key'),'unseen_key');assert.ok(PLAYER_STAT_CATEGORIES.some(c=>c.id==='other'));
});

test('five/ten selection is personal across eligible appearances and remains bounded for graph expansion',()=>{
 const b=fixture();for(let d=1;d<=10;d++)b.matches.push(match(100+d,d,1,5,[player(101,1,20),player(501,5)]));
 const five=createPlayerExplorerIndex(b,null,{formCount:5}),ten=createPlayerExplorerIndex(b,null,{formCount:10});
 assert.equal(five.profile(101).games,5);assert.equal(ten.profile(101).games,10);
 assert.equal(five.playerMatches(101).length,5);assert.equal(ten.nodes.get('player:101').games,10);
 assert.equal(five.playerMatches(101,{limit:100}).length,12);
 assert.ok(explorerGraph(ten,{rootId:'player:101',matchLimit:3}).nodes.filter(n=>n.kind==='match').length<=3);
});
