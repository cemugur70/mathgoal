// These parsers read saved UI evidence. They never authenticate or make requests.
export function parseKickoffScoreGrid(text){
 const cells=[...String(text).matchAll(/\bcell (\d+\+?)-(\d+\+?):\s*(<)?(\d+(?:\.\d+)?)%/g)].map(m=>({home:m[1],away:m[2],isBucket:m[1].endsWith('+')||m[2].endsWith('+'),
  probability:m[3]?null:Number(m[4])/100,lower:m[3]?0:Number(m[4])/100,upper:Number(m[4])/100,upperExclusive:!!m[3],display:(m[3]??'')+m[4]+'%'}));
 const top=[...String(text).matchAll(/\bcontainer (\d+)-(\d+):\s*(<)?(\d+(?:\.\d+)?)%/g)].map(m=>({home:Number(m[1]),away:Number(m[2]),probability:m[3]?null:Number(m[4])/100,display:(m[3]??'')+m[4]+'%'}));
 return {cells,top,rounded:true,normalized:false,kind:'external-model-output',verifiedAsOf:false,
  warning:'Rounded percentages, censored <1% cells and 5+ buckets are retained literally; they are not exact probabilities or exact-score cells.'};
}
export function parseKickoffShot(record){
 const text=String(record.detail??''),label=String(record.label??''),m=label.match(/^(.*), (.*), (\d+)(?:\+(\d+))?[′’'], (.*)$/);
 const field=name=>{const re=new RegExp('\\btext '+name+'\\r?\\n\\s*\\d+ text ([^\\r\\n]+)');return text.match(re)?.[1]??null;};
 const xg=text.match(/\btext ([\d.]+|—)\r?\n\s*\d+ container xG\r?\n/),xgot=text.match(/\btext ([\d.]+|—)\r?\n\s*\d+ container xGOT\r?\n/);
 const num=v=>v==null||v==='—'?null:Number(v);
 return {id:record.id,label,playerName:m?.[1]??null,teamName:m?.[2]??null,minute:m?Number(m[3]):null,addedMinute:m?.[4]?Number(m[4]):0,
  result:m?.[5]??null,shotType:field('Shot type'),situation:field('Situation'),xg:num(xg?.[1]),xgot:num(xgot?.[1]),
  displayedPosition:{leftPercent:num(record.left?.replace('%','')),topPercent:num(record.top?.replace('%','')),system:'rendered-shot-map-percent'},
  ownGoal:null,warning:'Goal markers alone do not establish own-goal attribution; no tracking coordinates inferred.'};
}
export function visibleAXLines(text){
 return String(text).split(/\r?\n/).flatMap((raw,i)=>{const m=raw.match(/^\s*(\d+) (text|heading|link|cell|container|image) (.+)$/);return m?[{axId:Number(m[1]),role:m[2],text:m[3],line:i+1}]:[];});
}
export function extractKickoffSection(text){
 // Use the observed main-content scope; don't retain account menus or page chrome.
 const lines=String(text).split(/\r?\n/),start=lines.findIndex(l=>l.includes('container Description: Main content'));
 let end=lines.length;if(start>=0){const depth=lines[start].match(/^\s*/)[0].length;for(let i=start+1;i<lines.length;i++){const m=lines[i].match(/^(\s*)\d+ /);if(m&&m[1].length<=depth){end=i;break;}}}
 const content=start>=0?lines.slice(start,end).join('\n'):String(text),rows=visibleAXLines(content);
 return {headings:rows.filter(n=>n.role==='heading').map(n=>n.text.replace(/, Value: \d+.*$/,'')),
  observations:rows.filter(n=>['text','cell','link','image'].includes(n.role)&&n.text&&!/^© |KickoffScore is an independent|IP Geolocation|www\.gambleaware/.test(n.text)),
  hasLoadingPlaceholder:/text (?:Loading|.*Loading (?:media|commentary|xG))/i.test(content),mainContentObserved:start>=0};
}
