const finite=n=>typeof n==='number'&&Number.isFinite(n);
const playerIdentity=p=>({id:Number(p.id),name:String(p.name||''),position:finite(p.usualPlayingPositionId)?p.usualPlayingPositionId:finite(p.usualPosition)?p.usualPosition:p.isGoalkeeper?0:null});
export function normalizeMatchPlayers(raw,inventory=new Map()) {
 const starters=new Map();for(const team of [raw.content?.lineup?.homeTeam,raw.content?.lineup?.awayTeam])for(const p of team?.starters||[])starters.set(String(p.id),{...playerIdentity(p),teamId:Number(team.id)});
 const unique=new Map();for(const p of Object.values(raw.content?.playerStats||{})){
  if(!p?.id||!p.teamId)continue;const stats={},statTotals={};
  for(const group of p.stats||[])for(const [title,item]of Object.entries(group?.stats||{})){
   if(!item?.key||item.stat?.type==='boolean')continue;const key=item.key;stats[key]=finite(item.stat?.value)?item.stat.value:null;
   if(finite(item.stat?.total))statTotals[key]=item.stat.total;
   if(!inventory.has(key))inventory.set(key,{key,title,group:group.title,type:item.stat?.type??null});
  }
  const starter=starters.get(String(p.id));unique.set(String(p.id),{...playerIdentity(p),position:starter?.position??playerIdentity(p).position,teamId:Number(p.teamId),isGoalkeeper:!!p.isGoalkeeper,starter:!!starter,minutes:stats.minutes_played??null,stats,statTotals});
 }return [...unique.values()];
}
export function normalizeTargetLineup(raw,{target,collectedAt}) {
 const source=raw.content?.lineup;if(!source)return null;
 const type=source.confirmed===true||source.isConfirmed===true?'confirmed':source.lineupType==='lastStarting11'?'lastStarting11':source.lineupType==='predicted'?'predicted':'unconfirmed';
 const side=team=>({id:Number(team?.id),name:team?.name??'',formation:team?.formation??null,starters:(team?.starters||[]).map(playerIdentity),bench:(team?.subs||[]).map(playerIdentity),unavailable:(team?.unavailable||[]).map(p=>({...playerIdentity(p),reason:p.unavailability?.type??'unavailable',expectedReturn:p.unavailability?.expectedReturn??null}))});
 return {matchId:String(target.id),type,source:source.source??null,observedAt:collectedAt,eligibleForModel:target.started!==true&&target.finished!==true&&target.cancelled!==true&&Date.parse(collectedAt)<Date.parse(target.date),home:side(source.homeTeam),away:side(source.awayTeam)};
}
export function parsePlayerPage(html,id){
 const match=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);if(!match)throw Error('FotMob oyuncu verisi sayfada bulunamadı.');
 const data=JSON.parse(match[1]).props?.pageProps?.data;if(String(data?.id)!==String(id))throw Error('Oyuncu kimliği kaynakla eşleşmiyor.');return data;
}
