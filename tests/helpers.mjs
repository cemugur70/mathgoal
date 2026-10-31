export const team = (id, name = `Team ${id}`) => ({id, name});

export function player(id, teamId, minutes = 90, extra = {}) {
  return {id, teamId, name: `Player ${id}`, position: 3, starter: true, minutes,
    stats: {minutes_played: minutes, goals: 0, assists: 0, expected_goals: .2,
      expected_assists: .1, total_shots: 2, chances_created: 1,
      accurate_passes: 20, defensive_actions: 4, tackles: 1, interceptions: 1,
      rating_title: 7}, ...extra};
}

export function match(id, date, home = team(1), away = team(2), players = [], extra = {}) {
  return {id: String(id), date: new Date(date).toISOString(), home, away,
    homeScore: 1, awayScore: 0, leagueId: 71, finished: true, players, ...extra};
}

export function bundle(matches = [], extra = {}) {
  const date = '2026-11-01T18:00:00.000Z';
  return {target: {id:'9000000', date, home:team(1), away:team(2), leagueId:71,
    started:false, finished:false}, analysisAt:date, matches, playerMetricInventory:[], ...extra};
}

export function forecastBundle() {
  const rows = [];
  for(let day=1;day<=5;day++) {
    for(const side of [1,2]) {
      const players=[];
      for(let number=1;number<=11;number++) {
        const id=side*100+number, minutes=side===1&&number===11?60:90;
        const position=number===1?0:number<=5?1:number<=9?2:3;
        const p=player(id,side,minutes,{position,isGoalkeeper:position===0});
        if(number===1)p.stats.goals_prevented=.1;
        if(side===1&&number===11){p.stats.expected_goals=.7;p.stats.goals=1;}
        players.push(p);
      }
      if(side===1)players.push(player(112,1,30,{starter:false,
        stats:{minutes_played:30,goals:0,assists:0,expected_goals:.01,expected_assists:.01,
          total_shots:0,chances_created:0,accurate_passes:5,defensive_actions:1,tackles:0,interceptions:0}}));
      rows.push(match(`${side}${day}`,`2026-10-0${day}T12:00:00Z`,team(side),team(side+10),players));
    }
  }
  const b=bundle(rows);
  b.targetLineup={matchId:b.target.id,type:'confirmed',observedAt:'2026-11-01T17:00:00Z',eligibleForModel:true,
    home:{id:1,starters:Array.from({length:11},(_,i)=>({id:101+i,name:`Player ${101+i}`,position:i===0?0:i<5?1:i<9?2:3})),bench:[{id:112,name:'Player 112',position:3}],unavailable:[]},
    away:{id:2,starters:Array.from({length:11},(_,i)=>({id:201+i,name:`Player ${201+i}`,position:i===0?0:i<5?1:i<9?2:3})),bench:[],unavailable:[]}};
  return b;
}
