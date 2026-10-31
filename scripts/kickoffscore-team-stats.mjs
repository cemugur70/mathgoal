// Parse only observed team-stat AX text, never a guessed API payload.
const GROUPS=['Top stats','Shots','Passes','Duels','Discipline','Attack','Defence','Goalkeeping'];
const defs={
 'Top stats':['Ball possession','Expected goals (xG)','Total shots','Shots on target','Touches in opposition box','Big chances','Big chances missed','Accurate passes','Fouls','Yellow cards','Corner kicks'],
 Shots:['Total shots','Shots off target','Shots on target','Blocked shots','Hit woodwork','Shots inside box','Shots outside box'],
 Passes:['Total passes','Accurate passes','Crosses','Long balls','Passes in the final third','Final third entries','Through balls','Throw-ins','Free kicks','Offsides'],
 Duels:['Duels','Ground duels','Aerial duels','Dribbles','Dispossessed','Fouled in final third'],
 Discipline:['Fouls','Yellow cards','Red cards'],
 Attack:['Expected goals (xG)','Expected goals on target (xGOT)','Big chances','Big chances scored','Big chances missed','Touches in opposition box','Corner kicks','Attacks','Attack share','Dangerous attacks','Dangerous attack share','Safe possession','Safe possession share'],
 Defence:['Tackles','Tackles won','Interceptions','Clearances','Recoveries','Errors leading to a shot','Errors leading to a goal'],
 Goalkeeping:['Goalkeeper saves','Big saves','Goals prevented','Goal kicks','Average rating']
};
const aliases={'Expected goals (xG)':'expected_goals','Expected goals on target (xGOT)':'expected_goals_on_target','Corner kicks':'corners','Ball possession':'ball_possession'};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const number='[-+]?\\d+(?:[.,]\\d+)?';
const value=`(?:${number}(?:\\s*/\\s*${number})?(?:\\s*\\(\\s*${number}\\s*%\\s*\\))?(?:\\s*%)?|[—–])`;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function amount(raw){
 const normalized=raw.trim().replaceAll(',','.');
 if(/^[—–]$/.test(normalized))return {value:null,total:null,displayedPercent:null,unit:null,raw};
 const fraction=normalized.match(new RegExp(`^(${number})\\s*/\\s*(${number})`));
 const percent=normalized.match(/\(\s*([-+]?\d+(?:\.\d+)?)\s*%\s*\)/);
 const barePercent=!percent&&normalized.endsWith('%');
 return {value:fraction?Number(fraction[1]):Number.parseFloat(normalized),total:fraction?Number(fraction[2]):null,
  displayedPercent:percent?Number(percent[1]):barePercent?Number.parseFloat(normalized):null,
  unit:barePercent?'percent':'count',raw};
}
function nodesFromAX(text){
 return text.split(/\r?\n/).flatMap((raw,index)=>{const m=raw.match(/^(\s*)(\d+) (text|heading|container|checkbox|slider|tab) (.*)$/);
  return m?[{axId:Number(m[2]),role:m[3],text:m[4],line:index+1,indent:m[1].length,raw}]:[];});
}
function nameKey(label){return aliases[label]??label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}

/** Retain duplicate top/detailed observations separately; never infer absent halves. */
export function parseKickoffTeamStatsAX(text,{sourceFile=null,observedAt=null}={}){
 if(typeof text!=='string')throw new TypeError('AX text must be a string');
 const nodes=nodesFromAX(text),warnings=[],metrics=[],rawGroups=[];
 const matchId=text.match(/kickoffscore\.com\/match\/[^\s/#?]+\/(\d+)/)?.[1]??null;
 const url=matchId?`https://kickoffscore.com/match/${text.match(/kickoffscore\.com\/match\/([^\s/#?]+)\//)?.[1]}/${matchId}`:null;
 const selected=nodes.find(n=>n.role==='checkbox'&&/^(All|1st Half|2nd Half), Value: 1$/.test(n.text));
 const period=selected?({'All':'full','1st Half':'first-half','2nd Half':'second-half'}[selected.text.split(',')[0]]):null;
 const statsSelected=nodes.some(n=>n.role==='tab'&&/\(selected,[^)]*\) Stats, Value: 1$/.test(n.text));
 const provenance={provider:'KickoffScore',method:'authenticated-visible-AX',sourceFile,observedAt,sourceMatchId:matchId,url};
 if(!statsSelected){warnings.push('Stats tab selection is not established; no team observations parsed.');return {schemaVersion:1,period,metrics,rawGroups,progression:null,provenance,warnings};}
 if(!period)warnings.push('Period not observed; no full-match period assumed.');
 let group=null;const sections=new Map();
 for(const n of nodes){
  if(n.role==='container'&&n.text==='Top stats')group='Top stats';
  else if(n.role==='container'&&(n.text==='Shot map'||n.text==='xG progression'))group=null;
  else if(n.role==='heading'){
   const title=n.text.replace(/, Value: \d+$/,'');
   if(GROUPS.includes(title))group=title;
   else if(n.indent<=4)group=null;
  }
  if(group&&n.role==='text'&&n.text!==group){if(!sections.has(group))sections.set(group,[]);sections.get(group).push(n);}
 }
 for(const [group,items]of sections){
  const raw=items.map(n=>n.text).join(' ').replace(/\s+/g,' ').trim();let residual=raw;
  const ranges=[];
  for(const label of defs[group]){
   // Possession alone renders label, home, away. All other paired metrics render home, label, away.
   const re=label==='Ball possession'?new RegExp(`${esc(label)}\\s+(${value})\\s+(${value})(?=\\s|$)`,'g'):
    new RegExp(`(${value})\\s+${esc(label)}\\s+(${value})(?=\\s|$)`,'g');
   for(const match of raw.matchAll(re)){
    const home=amount(match[1]),away=amount(match[2]);
    const start=items.find(n=>n.text.includes(label))??items[0];
    const unit=home.unit==='percent'||away.unit==='percent'?'percent':/xG|Average rating|Goals prevented/.test(label)?'decimal':'count';
    metrics.push({key:nameKey(label),label,group,period,values:[home.value,away.value],totals:[home.total,away.total],
     units:[home.value===null?null:unit,away.value===null?null:unit],displayedPercent:[home.displayedPercent,away.displayedPercent],
     display:[home.raw,away.raw],raw:match[0],source:{...provenance,axId:start.axId,line:start.line}});
    ranges.push([match.index,match.index+match[0].length]);
   }
  }
  for(const [start,end]of ranges.sort((a,b)=>b[0]-a[0]))residual=residual.slice(0,start)+' '.repeat(end-start)+residual.slice(end);
  residual=residual.trim();
  rawGroups.push({group,period,raw,unparsed:residual||null,source:{...provenance,line:items[0].line,axIds:items.map(n=>n.axId)}});
  if(residual)warnings.push(`Unparsed ${group} content retained verbatim.`);
 }
 const progressionStart=nodes.findIndex(n=>n.role==='container'&&n.text==='xG progression');let progression=null;
 if(progressionStart>=0){
  const root=nodes[progressionStart],part=[];
  for(let i=progressionStart+1;i<nodes.length&&nodes[i].indent>root.indent;i++)part.push(nodes[i]);
  const teams=part.filter(n=>n.role==='text'&&/^.+\s[-+]?\d+(?:\.\d+)?$/.test(n.text)).map(n=>{const m=n.text.match(/^(.+)\s([-+]?\d+(?:\.\d+)?)$/);return {name:m[1],value:Number(m[2]),source:{line:n.line,axId:n.axId}};});
  const minute=part.find(n=>n.role==='slider')?.text.match(/Value: (\d+)/)?.[1];
  progression={kind:'cumulative-xg-chart',period:'full',selectedMinute:minute==null?null:Number(minute),estimated:part.some(n=>n.text==='Includes estimated xG'),
   teams,raw:part.map(n=>n.raw).join('\n'),source:{...provenance,line:root.line,axId:root.axId},isTeamTotalReplacement:false};
  if(progression.estimated)warnings.push('xG progression includes estimated xG; it is separate from reported team xG and is not a replacement.');
  if(progression.period!==period)warnings.push('xG progression remains full match while the selected team-stat period differs.');
 }
 return {schemaVersion:1,period,metrics,rawGroups,progression,provenance,warnings};
}
