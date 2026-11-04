const DAY=86400000,finite=n=>typeof n==='number'&&Number.isFinite(n),time=d=>new Date(d).getTime(),same=(a,b)=>String(a)===String(b),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function extractH2HMatches(raw){
 return (raw.content?.h2h?.matches||[]).flatMap(m=>{const id=m.id??m.matchUrl?.match(/#(\d+)/)?.[1],date=m.status?.utcTime??m.time?.utcTime;if(!id||!m.home?.id||!m.away?.id||!Number.isFinite(time(date)))return [];
  const score=m.status?.scoreStr?.match(/^\s*(\d+)\s*[-–:]\s*(\d+)\s*$/),reason=[m.status?.reason?.short,m.status?.reason?.shortKey,m.status?.reason?.longKey].filter(Boolean).join(' ');
  return [{id:String(id),date:new Date(date).toISOString(),home:{id:Number(m.home.id),name:m.home.name},away:{id:Number(m.away.id),name:m.away.name},homeScore:score?Number(score[1]):null,awayScore:score?Number(score[2]):null,leagueId:Number(m.league?.id),leagueName:m.league?.name??'',finished:m.status?.finished===true,cancelled:!!m.status?.cancelled,awarded:!!m.status?.awarded,extraTime:/\baet\b|after.?extra|extra.?time|penalt|\bpen\b/i.test(reason),url:`https://www.fotmob.com/match/${id}`,source:'H2H'}];
 });
}
export function analyzeH2H(bundle,opts={}){
 const target=bundle.target,cutoff=Math.min(...[time(target.date),time(bundle.analysisAt),time(opts.cutoff)].filter(Number.isFinite));
 const enabled=opts.h2hLayer!==false,halfLife=clamp(Number(opts.h2hHalfLife??365),90,1095),strength=clamp(Number(opts.h2hWeight??.35),0,.5),maxAgeDays=5*365.25,count=10;
 const homeBase=Math.max(.15,Number(opts.homeBase??1.4)),awayBase=Math.max(.15,Number(opts.awayBase??1.2));
 const paired=m=>m?.home&&m?.away&&((same(m.home.id,target.home.id)&&same(m.away.id,target.away.id))||(same(m.home.id,target.away.id)&&same(m.away.id,target.home.id)));
 const candidates=[...new Map([...(bundle.h2hMatches||[]),...(bundle.matches||[])].filter(paired).map(m=>[String(m.id),m])).values()],excluded=[],eligible=[];
 for(const m of candidates){const ended=time(m.completedAt??m.finishedAt??m.endDate),availableAt=Number.isFinite(ended)?ended:time(m.date)+3*3600000,ageDays=(cutoff-time(m.date))/DAY;let reason=null;
  if(same(m.id,target.id))reason='Hedef maç';else if(!Number.isFinite(time(m.date))||time(m.date)>=cutoff||availableAt>=cutoff)reason='Analiz anında sonucu bilinmiyor';else if(m.finished===false)reason='Tamamlanmadı';else if(m.cancelled)reason='İptal';else if(m.awarded)reason='Hükmen sonuç';else if(Number(m.leagueId)===489)reason='Hazırlık maçı';else if(m.extraTime||m.penaltyShootout)reason='Uzatma / penaltı';else if(!finite(m.homeScore)||!finite(m.awayScore))reason='Skor eksik';else if(ageDays>maxAgeDays)reason='Beş yıldan eski';
  if(reason){excluded.push({id:m.id,date:m.date,home:m.home,away:m.away,reason});continue;}
  const sameVenue=same(m.home.id,target.home.id),sameCompetition=same(m.leagueId,target.leagueId),decay=Math.pow(.5,ageDays/halfLife),venueWeight=sameVenue?1:.65,competitionWeight=sameCompetition?1:.6;
  eligible.push({...m,ageDays,sameVenue,sameCompetition,homeGoals:sameVenue?m.homeScore:m.awayScore,awayGoals:sameVenue?m.awayScore:m.homeScore,weight:decay*venueWeight*competitionWeight,decay,venueWeight,competitionWeight});
 }
 eligible.sort((a,b)=>time(b.date)-time(a.date));const matches=eligible.slice(0,count),weightSum=matches.reduce((s,m)=>s+m.weight,0),squared=matches.reduce((s,m)=>s+m.weight*m.weight,0),effectiveMatches=squared?weightSum*weightSum/squared:0;
 const total=(key)=>matches.reduce((s,m)=>s+m[key],0),weighted=(key)=>matches.reduce((s,m)=>s+m[key]*m.weight,0),prior=5;
 const homePosterior=(prior*homeBase+weighted('homeGoals'))/(prior+weightSum),awayPosterior=(prior*awayBase+weighted('awayGoals'))/(prior+weightSum),power=strength*Math.min(1,effectiveMatches/5);
 const usable=matches.length>=3&&effectiveMatches>=2&&weightSum>=.25;
 const factors=enabled&&usable&&strength>0?{home:clamp(Math.pow(homePosterior/homeBase,power),.9,1.1),away:clamp(Math.pow(awayPosterior/awayBase,power),.9,1.1)}:{home:1,away:1};
 return {enabled,matches,excluded,candidateCount:candidates.length,eligibleCount:eligible.length,cutoff:new Date(cutoff).toISOString(),halfLife,strength,power,weightSum,effectiveMatches,usable,status:!enabled?'disabled':!usable?'insufficient':'ready',factors,homeBase,awayBase,homePosterior,awayPosterior,priorGames:prior,
  summary:{homeWins:matches.filter(m=>m.homeGoals>m.awayGoals).length,draws:matches.filter(m=>m.homeGoals===m.awayGoals).length,awayWins:matches.filter(m=>m.homeGoals<m.awayGoals).length,homeGoals:total('homeGoals'),awayGoals:total('awayGoals'),homeAverage:matches.length?total('homeGoals')/matches.length:null,awayAverage:matches.length?total('awayGoals')/matches.length:null,sameVenue:matches.filter(m=>m.sameVenue).length},
  reason:!enabled?'H2H kapalı; diğer model katmanları korunur.':!usable?'En az 3 tamamlanmış maç, 2 etkin örnek ve yeterli güncellik gerekiyor.':'Son 10 resmi H2H; güncellik, saha yönü ve turnuva ağırlığıyla küçültülmüş etki.',
  notes:['Skorlar hedefteki ev ve deplasman takımlarının perspektifine çevrilir.','Son beş yıl içindeki en yeni 10 resmi karşılaşma kullanılır; aynı saha yönü daha yüksek ağırlıktadır.','Bir yıllık yarı ömür, beş maçlık mevcut-model öncülü ve en fazla ±%10 gol yoğunluğu düzeltmesi kullanılır.','Hükmen, iptal, hazırlık, uzatma/penaltı ve analiz anında tamamlanmamış maçlar dışlanır.','Etki şiddeti bir skor olasılığı veya doğruluk yüzdesi değildir. H2H katmanı sezgiseldir ve bağımsız doğrulanmamıştır.']};
}
