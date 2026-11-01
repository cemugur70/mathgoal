// Normalizes cached liderform program pages into race / entry / past-run rows. Pure; shared by the database build and tests.
export const SURFACES={TURF:'Çim',DIRT:'Kum',AWT:'Sentetik'};
/** liderform race_type → TJK short label as rendered on the site (HAND-16 → HAN-16, ST-7 → KV-7, COND-3 → ŞRT-3). */
export function raceLabel(type){
 const t=String(type||'');let m;
 if(m=t.match(/^HAND-(\d+)$/))return 'HAN-'+m[1];
 if(m=t.match(/^COND-(\d+)$/))return 'ŞRT-'+m[1];
 if(m=t.match(/^ST-(\d+)$/))return 'KV-'+m[1];
 if(m=t.match(/^SELPLATE-(\d+)$/))return 'SAT-'+m[1];
 return {MAIDEN:'Maiden','SHORTTERM-HAND22':'KV-HND22','MAIDEN-SELPLATE':'Maiden/Satış','G3-HAND':'G3 Handikap',OPEN:'Açık',LISTED:'Listed',STAKES:'Stakes',AMATEUR:'Amatör'}[t]??(t||null);
}
/** Coarse class family used for rule lookup: HAND, COND, KV, MAIDEN, SAT, GROUP or OTHER, plus its number when present. */
export function raceClass(type){
 const t=String(type||''),num=Number(t.match(/(\d+)$/)?.[1])||null;
 const family=/^HAND-/.test(t)?'HAND':/^COND-/.test(t)?'COND':/^ST-|^SHORTTERM/.test(t)?'KV':/^MAIDEN$/.test(t)?'MAIDEN':/SELPLATE/.test(t)?'SAT':/^(GR-|G\d|LISTED|STAKES|OPEN|O\d)/.test(t)?'GROUP':'OTHER';
 return {family,number:family==='KV'&&/SHORTTERM/.test(t)?22:num};
}
const nums=s=>String(s).split(/[,-]/).map(v=>v.trim()).filter(Boolean);
/**
 * Finishing order from the official pool dividends text. GANYAN gives the winner(s) (several on a dead heat);
 * the longest ordered pool (SIRALI İKİLİ a/b, ÜÇLÜ BAHİS a/b/c, TABELA a/b/c/d) gives the places behind it when it agrees with GANYAN.
 */
export function parseBetsResult(text){
 // Pools are "NAME(args): amount"; only the bare GANYAN pool is the win pool ("6'LI GANYAN", "3'LÜ GANYAN" span several races).
 const pools=[...String(text||'').matchAll(/([^():]*?)\(([^)]*)\)/g)].map(m=>({name:m[1].replace(/^.*TL\s*/,'').replace(/^[\d.,\s]+/,'').trim(),args:m[2]}));
 const winners=pools.filter(p=>p.name==='GANYAN').flatMap(p=>nums(p.args));
 if(!winners.length)return null;
 let order=[winners[0]];
 for(const name of ['SIRALI İKİLİ','ÜÇLÜ BAHİS','TABELA BAHİS','TABELA']){
  const p=pools.find(x=>x.name===name),seq=p?p.args.split('/').map(v=>v.trim()):[];
  if(seq.length>order.length&&seq.every(v=>/^\d+[A-Z]?$/.test(v))&&winners.includes(seq[0]))order=seq;
 }
 return {winners:[...new Set(winners)],order,deadHeat:new Set(winners).size>1};
}
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
/** One cached race page → {race, entries, runs}. `runs` are the horses' previous starts as printed on that day's program (strictly before the race date). */
export function normalizeRacePage(page,{date,city,number}){
 const r=(page?.raceTimeList||[]).find(x=>Number(x.race_number)===Number(number));
 if(!r||!Array.isArray(page.raceData))return null;
 const id=String(r.id),cls=raceClass(r.race_type),result=r.race_status==='RESULT'?parseBetsResult(r.bets_result):null;
 const race={id,date:r.meeting_date||date,city,trackCode:r.track?.track_code||null,number:Number(number),time:r.race_time_gmt,status:r.race_status,breed:r.race_breed,
  surface:r.surface,surfaceLabel:SURFACES[r.surface]??r.surface,distance:num(r.distance_meters),type:r.race_type,label:raceLabel(r.race_type),family:cls.family,classNumber:cls.number,
  age:r.eligibility_age,gender:r.eligibility_gender,going:r.going,weather:r.weather,temperature:num(r.temperature),prize1:num(r.prizes?.places?.find(p=>p.place===1)?.value),
  betsResult:r.bets_result,winners:result?.winners??null,order:result?.order??null,deadHeat:result?.deadHeat??false};
 const entries=page.raceData.map(e=>{
  const placeIndex=race.order?race.order.indexOf(String(e.horse_number)):-1;
  return {raceId:id,horseId:num(e.horse?.id),number:String(e.horse_number),start:num(e.horse_start),status:e.entry_status,name:e.horse?.name,age:num(e.horse?.age),sex:e.horse?.gender,
   origin:e.horse?.country_origin,sire:e.horse?.sire_name,dam:e.horse?.dam_name,damSire:e.horse?.dam_sire_name,jockeyId:num(e.jockey?.id),jockey:e.jockey?.name,kg:num(e.jockey?.weight_kg),
   apprentice:e.jockey?.is_apprentice===true,trainer:e.trainer_name,owner:e.owner_name,handicap:num(e.handicap?.now),handicapPrev:num(e.handicap?.prev),point:num(e.point?.now),pointPrev:num(e.point?.prev),
   daysOff:num(e.days_off),odds:num(e.odds_tjk),agf1:num(e.agf1?.percent),agf1Rank:num(e.agf1?.position),agf2:num(e.agf2?.percent),equipment:(e.equipment?.now||e.equipments||[]).join(','),
   // Only finishing positions confirmed by the dividends text are set here; other places come from later past-run records.
   place:race.winners?.includes(String(e.horse_number))?1:placeIndex>0?placeIndex+1:null,comment:e.comments_preview?.[0]?.text??null};
 });
 const runs=page.raceData.flatMap(e=>(e.races||[]).filter(x=>x.meeting_date&&x.meeting_date<race.date).map(x=>({horseId:num(e.horse?.id),date:x.meeting_date,trackCode:x.track?.track_code||null,
  place:num(x.horse_place),surface:x.surface,distance:num(x.distance_meters),handicap:num(x.handicap),timing:x.timing||null,ahead:x.distance_ahead||null})));
 return {race,entries,runs};
}
