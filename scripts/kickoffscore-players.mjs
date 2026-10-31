import {createHash} from 'node:crypto';

// Offline parser for the saved player-modal accessibility captures. No requests,
// canonical identity guesses, minute imputation or model/archive mutation.
const SECTION_SPECS={
 'Top stats':[['Minutes Played','minutes_played'],['Goals','goals'],['Assists','assists'],['Expected goals (xG)','expected_goals'],['Saves','saves'],['Shots Total','total_shots']],
 'Advanced match statistics':[['Expected assists (xA)','expected_assists'],['Expected goals on target (xGOT)','expected_goals_on_target_variant'],
  ['Touches','touches'],['Big chances created','big_chance_created'],['Big chances missed','big_chance_missed'],
  ['Ball carries','ball_carries'],['Progressive carries','progressive_carries'],['Carry distance','ball_carry_distance'],
  ['Progressive carry distance','progressive_carry_distance'],['Ball recoveries','recoveries'],['Goals prevented','goals_prevented'],
  ['Sweeper actions','sweeper_actions'],['Successful sweeper actions','successful_sweeper_actions']],
 'Attack':[['Hit woodwork','hit_woodwork'],['Shots Total','total_shots'],['Shots On','shots_on_target'],['Successful Dribbles','dribbles_succeeded'],['Offsides','offside']],
 'Passes':[['Accurate crosses','accurate_crosses'],['Accurate long balls','long_balls_accurate'],['Opposition-half passes','accurate_opposition_half_passes'],
  ['Accurate Passes','accurate_passes'],['Total','total_passes'],['Key','key_passes']],
 'Defence':[['Tackles won','won_tackle'],['Clearances','clearances'],['Dispossessed','dispossessed'],['Possession lost','possession_lost'],
  ['Errors leading to a shot','errors_lead_to_shot'],['Errors leading to a goal','errors_lead_to_goal'],['Tackles','tackles'],['Blocks','blocks'],['Interceptions','interceptions']],
 'Duels':[['Aerial duels won','aerials_won'],['Total','duels_total'],['Won','duel_won'],['Fouls Drawn','was_fouled']],
 'Discipline':[['Fouls Committed','fouls'],['Yellow Cards','yellow_cards'],['Red Cards','red_cards']],
 'Goalkeeping':[['Saves inside the box','saves_inside_box'],['High claims','keeper_high_claim'],['Punches','punches'],['Goals Conceded','goals_conceded']]
};
const RATE_KEYS={Passes:'accurate_passes',Duels:'duel_won','Aerial duels':'aerials_won',Dribbles:'dribbles_succeeded',
 Tackles:'won_tackle','Long balls':'long_balls_accurate',Crosses:'accurate_crosses'};
const ROLE_POSITIONS={Goalkeeper:0,Defender:1,Midfielder:2,Forward:3};
const NUMBER='[+-]?\\d+(?:[.,]\\d+)?';
const VALUE=`(?:${NUMBER}(?:\\s*\\/\\s*${NUMBER})?(?:\\s*\\(\\s*${NUMBER}%\\s*\\))?(?:\\s+m\\b)?|[—–…])`;
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const time=v=>v==null?NaN:Date.parse(v);
const iso=v=>finite(time(v))?new Date(time(v)).toISOString():null;
const number=v=>{if(v==null||/[—–…]/.test(v))return null;const n=Number(String(v).replace(',','.'));return finite(n)?n:null;};

function tokens(text){
 return String(text).split(/\r?\n/).flatMap((raw,i)=>{
  const match=raw.match(/^(\s*)(\d+)\s+(AXWebArea|definition list|content list|heading|text|container|image|link|checkbox|button)\b\s*(.*)$/);
  return match?[{axId:match[2],role:match[3],text:match[4],line:i+1,depth:match[1].length,raw}]:[];
 });
}
function urlFrom(value){const match=String(value).match(/(?:https:\/\/)?kickoffscore\.com\/[^\s",]+/);return match?'https://'+match[0].replace(/^https:\/\//,''):null;}
function parsedValue(raw){
 const n=raw.match(new RegExp(`^\\s*(${NUMBER})(?:\\s*\\/\\s*(${NUMBER}))?(?:\\s*\\(\\s*(${NUMBER})%\\s*\\))?(?:\\s+(m))?\\s*$`));
 if(!n)return {value:null,total:null,displayedPercent:null,ratio:null,unit:null};
 const value=number(n[1]),total=n[2]===undefined?null:number(n[2]);
 return {value,total,displayedPercent:n[3]===undefined?null:number(n[3]),ratio:total>0?value/total:null,unit:n[4]??null};
}
function temporalContext(options){
 const observedAt=iso(options.observedAt),matchDate=iso(options.matchDate),cutoff=iso(options.cutoff),completedAt=iso(options.completedAt);
 const assumedEnd=completedAt??(matchDate?new Date(time(matchDate)+3*3600000).toISOString():null);
 const availableAt=observedAt&&assumedEnd?new Date(Math.max(time(observedAt),time(assumedEnd))).toISOString():null;
 const eligible=!!(availableAt&&cutoff&&time(availableAt)<time(cutoff));
 return {observedAt,matchDate,completedAt,completionBasis:completedAt?'provided-completion':matchDate?'conservative-start-plus-three-hours':'unknown',
  availableAt,cutoff,eligibleBeforeCutoff:eligible,status:eligible?'eligible-observation':availableAt&&cutoff?'excluded-at-cutoff':'unknown-time',
  reason:eligible?null:availableAt&&cutoff?'Capture or completion was not available before cutoff.':'Capture, match or cutoff timestamp is not supplied by this AX capture.'};
}

/** Normalize only facts visible in one saved KickoffScore player modal. */
export function normalizeKickoffPlayerAX(text,options={}){
 const sourceText=String(text??''),all=tokens(sourceText),head=all.find(n=>n.role==='heading'&&/, Value: 2(?:,|$)/.test(n.text));
 if(!head)throw Error('KickoffScore player-modal heading is absent.');
 const name=head.text.replace(/, Value: 2(?:,.*)?$/,''),profile=all.find(n=>n.line>head.line&&n.role==='link'&&/kickoffscore\.com\/players\/\d+\//.test(n.text));
 const sourcePlayerUrl=profile?urlFrom(profile.text):null,sourcePlayerId=sourcePlayerUrl?.match(/\/players\/(\d+)\//)?.[1]??null;
 const matchUrl=urlFrom(sourceText.match(/Browser tab:[^\r\n]*/)?.[0]??all[0]?.text??''),sourceMatchId=matchUrl?.match(/\/match\/[^/]+\/(\d+)/)?.[1]??null;
 const afterHead=all.filter(n=>n.line>head.line),teamText=afterHead.find(n=>n.role==='text'&&(!profile||n.line>profile.line));
 const teamName=teamText?.text??null;
 const teamLink=afterHead.find(n=>n.role==='link'&&/kickoffscore\.com\/teams\/\d+\//.test(n.text));
 const sourceTeamUrl=teamLink?urlFrom(teamLink.text):null,sourceTeamId=sourceTeamUrl?.match(/\/teams\/(\d+)\//)?.[1]??null;
 const ratingNode=[...all].reverse().find(n=>n.line<head.line&&n.role==='container'&&/^Rating\s+[\d.]+$/.test(n.text));
 const rating=ratingNode?number(ratingNode.text.replace(/^Rating\s+/,'')):null;
 const definition=label=>{const at=afterHead.findIndex(n=>n.role==='container'&&n.text===label);if(at<0)return null;
  return afterHead.slice(at+1).find(n=>n.role==='text'&&n.text!==label)??null;};
 const roleNode=definition('Position'),role=roleNode&&!/^[—–…]$/.test(roleNode.text)?roleNode.text:null;
 const nationalityNode=definition('Nationality'),ageNode=definition('Age');
 const shirtNode=afterHead.find(n=>/Shirt number \d+/.test(n.text));
 const metrics=[],stats={},statTotals={},conflicts=[],unparsed=[],sections=[];
 const source=(node,extra={})=>({provider:'KickoffScore',sourceMatchId,sourcePlayerId,matchUrl,playerUrl:sourcePlayerUrl,
  axId:node.axId,line:node.line,sourceFile:options.sourceFile??null,...extra});
 function add(key,label,section,valueRaw,node,override={}){
  const entry={key,label,section,...parsedValue(valueRaw),...override,raw:valueRaw,rawLine:node.raw,source:source(node)};
  if(Object.hasOwn(stats,key)&&stats[key]!==entry.value){conflicts.push({key,previous:stats[key],next:entry.value,source:source(node)});stats[key]=null;}
  else if(!conflicts.some(c=>c.key===key))stats[key]=entry.value;
  if(entry.total!==null){if(Object.hasOwn(statTotals,key)&&statTotals[key]!==entry.total){conflicts.push({key,totalConflict:true,previous:statTotals[key],next:entry.total,source:source(node)});statTotals[key]=null;}else statTotals[key]=entry.total;}
  metrics.push(entry);
 }
 if(ratingNode)add('rating_title','Rating','Identity',ratingNode.text.replace(/^Rating\s+/,''),ratingNode);
 let section=null;
 for(const node of afterHead){
  if(node.role==='button'&&node.text==='Close')break;
  if(node.role==='heading'&&/, Value: 4(?:,|$)/.test(node.text)){section=node.text.replace(/, Value: 4(?:,.*)?$/,'');continue;}
  if(!section||node.text===section)continue;
  if(section==='Success rates'&&node.role==='container'){
   const match=node.text.match(/^([^:]+):\s*([+-]?\d+(?:[.,]\d+)?)%,\s*([\d.,]+)\/([\d.,]+)$/);
   if(match){
    const label=match[1],key=RATE_KEYS[label]??'source_rate_'+label.toLowerCase().replace(/[^a-z0-9]+/g,'_');
    add(key,label,section,`${match[3]}/${match[4]}`,node,{displayedPercent:number(match[2])});
    sections.push({section,text:node.text,source:source(node)});
   }else if(/%|\d+\//.test(node.text))unparsed.push({section,text:node.text,source:source(node)});
   continue;
  }
  if(node.role!=='text'||!SECTION_SPECS[section])continue;
  const body=node.text.replace(/\s*KickoffScore\s*·.*$/,'').trim();if(!body||body==='Close')continue;
  sections.push({section,text:body,source:source(node)});
  const specs=SECTION_SPECS[section],lookup=new Map(specs.map(([label,key])=>[label.toLowerCase(),key]));
  const labels=specs.map(([label])=>label).sort((a,b)=>b.length-a.length).map(escape).join('|');
  const regex=section==='Top stats'?new RegExp(`(${VALUE})\\s+(${labels})(?=$|\\s)`,'gi'):new RegExp(`(${labels})\\s+(${VALUE})(?=$|\\s)`,'gi');
  let match,last=0,unmatched='';
  while((match=regex.exec(body))){
   unmatched+=body.slice(last,match.index)+' ';last=match.index+match[0].length;
   const label=section==='Top stats'?match[2]:match[1],valueRaw=section==='Top stats'?match[1]:match[2];
   add(lookup.get(label.toLowerCase()),label,section,valueRaw,node);
  }
  unmatched=(unmatched+body.slice(last)).trim();if(unmatched)unparsed.push({section,text:unmatched,source:source(node)});
 }
 const heatmapNode=afterHead.find(n=>n.role==='image'&&/\d+ recorded actions/.test(n.text));
 const heatmapUnavailable=afterHead.some(n=>n.role==='text'&&n.text==='Heatmap data is unavailable for this player.');
 const heatmap=heatmapNode?{recordedActions:Number(heatmapNode.text.match(/(\d+) recorded actions/)[1]),
  direction:heatmapNode.text.match(/Attacks (.*)$/)?.[1]??null,raw:heatmapNode.text,source:source(heatmapNode)}:{recordedActions:null,direction:null,unavailable:heatmapUnavailable};
 // Marker checkboxes are repeated by two graphical projections. Retain one fact per
 // player/team/minute/result, and never mix the selected shot's xG into match totals.
 const markerMap=new Map();
 for(const node of afterHead.filter(n=>n.role==='checkbox'&&n.text.startsWith('Description: '))){
  const m=node.text.match(/^Description: (.*), (.*), (\d+(?:\+\d+)?)[′’'], (.*), Value: ([01])$/);if(!m)continue;
  const marker={name:m[1],teamName:m[2],minuteText:m[3],result:m[4],selected:m[5]==='1',raw:node.text,source:source(node)};
  const k=[marker.name,marker.teamName,marker.minuteText,marker.result].join('|');if(!markerMap.has(k))markerMap.set(k,marker);
 }
 const shots=[...markerMap.values()],selectedShot=shots.find(s=>s.selected)??null;
 let shotSample=null;
 const shotHeading=afterHead.findIndex(n=>n.role==='heading'&&/^Shot map, Value: 4/.test(n.text));
 if(shotHeading>=0){
  const region=[];for(let i=shotHeading+1;i<afterHead.length;i++){const n=afterHead[i];if(n.role==='heading'&&!/^Shot map, Value: 4/.test(n.text))break;region.push(n);}
  const pair=(label)=>{const at=region.findIndex(n=>n.role==='container'&&n.text===label);if(at<0)return null;
   const valueNode=region.slice(at+1).find(n=>n.role==='text'&&n.text!==label);return valueNode?{value:valueNode.text,raw:valueNode.text,source:source(valueNode)}:null;};
  const numberBefore=label=>{const at=region.findIndex(n=>n.role==='container'&&n.text===label);if(at<0)return null;
   const n=[...region.slice(0,at)].reverse().find(n=>n.role==='text'&&/^([+-]?[\d.]+|—)$/.test(n.text));return n?{value:number(n.text),raw:n.text,source:source(n)}:null;};
  shotSample={minuteText:selectedShot?.minuteText??region.find(n=>n.role==='text'&&/^\d+(?:\+\d+)?[′’']$/.test(n.text))?.text??null,
   shotType:pair('Shot type'),situation:pair('Situation'),result:pair('Result'),xg:numberBefore('xG'),xgot:numberBefore('xGOT'),
   coverage:'one-selected-shot-only'};
 }
 const temporal=temporalContext(options),minutes=Object.hasOwn(stats,'minutes_played')?stats.minutes_played:null;
 return {provider:'KickoffScore',sourceMatchId,sourcePlayerId,sourceTeamId,sourcePlayerUrl,sourceTeamUrl,
  id:sourcePlayerId,teamId:sourceTeamId,canonicalPlayerId:null,canonicalTeamId:null,name,teamName,role,position:ROLE_POSITIONS[role]??null,
  nationality:nationalityNode&&!/^[—–…]$/.test(nationalityNode.text)?nationalityNode.text:null,
  age:ageNode&&/^\d+$/.test(ageNode.text)?Number(ageNode.text):null,
  shirtNumber:shirtNode?.text.match(/Shirt number (\d+)/)?.[1]??null,minutes,rating,
  participation:minutes>0?'observed-minutes':'not-established',stats,statTotals,metrics,heatmap,shots,shotSample,sections,unparsed,conflicts,temporal,
  eligibleForModel:false,provenance:{provider:'KickoffScore',kind:'saved-authenticated-ui-accessibility',sourceFile:options.sourceFile??null,
   sourceUrl:matchUrl,profileUrl:sourcePlayerUrl,observedAt:temporal.observedAt,sha256:createHash('sha256').update(sourceText).digest('hex'),
   identityNamespace:'kickoffscore',teamIdStatus:sourceTeamId?'source-url':'not-present-in-capture',
   limitations:['Source player IDs are KickoffScore IDs, not FotMob IDs. Team IDs are not inferred from names or AX node IDs.',
    'Missing Minutes Played remains null. Placeholder zero metrics do not prove a bench player participated.',
    'The capture itself supplies no observation time or kickoff time; historical use requires explicit temporal evidence.',
    'Selected-shot xG/xGOT and heatmap summaries remain separate from full-match player statistics.',
    'No canonical crosswalk, period equivalence or historical-model eligibility is established by this parser.']}};
}
