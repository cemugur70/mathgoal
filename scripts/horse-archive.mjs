// Loads data/horse/horses.db into race / entry / past-run structures shared by the walk-forward and the race predictor.
// Only the used columns are read, row by row: materialising every column of every entry at once tripled peak memory.
export function loadHorseArchive(db){
 // Jockey and trainer names repeat on every entry; one shared string per name keeps the publisher well inside its heap cap.
 const ent=new Map(),names=new Map(),intern=v=>v==null?v:names.get(v)??(names.set(v,v),v);
 for(const e of db.prepare('SELECT race_id,horse_id,number,start,status,name,age,sex,sire,jockey_id,jockey,trainer,kg,apprentice,handicap,point,days_off,odds,agf1,place FROM entries').iterate())
  (ent.get(e.race_id)??ent.set(e.race_id,[]).get(e.race_id)).push({raceId:e.race_id,horseId:e.horse_id,number:e.number,start:e.start,status:e.status,name:e.name,
  age:e.age,sex:e.sex,sire:intern(e.sire),jockeyId:e.jockey_id,jockey:intern(e.jockey),trainer:intern(e.trainer),kg:e.kg,apprentice:e.apprentice===1,handicap:e.handicap,point:e.point,daysOff:e.days_off,odds:e.odds,agf1:e.agf1,place:e.place});
 // Workout profile per runner (absent in a database built before gallop pages were collected).
 const gallop=new Map(),hasGallops=db.prepare("SELECT 1 FROM sqlite_master WHERE name='gallops'").get();
 if(hasGallops)for(const g of db.prepare('SELECT race_id,number,n,scored,best,avg,days FROM gallops').iterate())gallop.set(g.race_id+'|'+g.number,{n:g.n,scored:g.scored,best:g.best,avg:g.avg,days:g.days});
 for(const list of ent.values())for(const e of list)e.gallop=gallop.get(e.raceId+'|'+e.number)??null;
 const meta=key=>db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value??null,gallopPars=JSON.parse(meta('gallopPars')??'null');
 const races=[];
 for(const r of db.prepare('SELECT id,date,city,number,time,status,breed,surface,distance,type,label,family,class_number,gender,age,winners,result_order FROM races ORDER BY date,city,number').iterate())
  races.push({race:{id:r.id,date:r.date,city:r.city,number:r.number,time:r.time,status:r.status,breed:r.breed,surface:r.surface,distance:r.distance,
  type:r.type,label:r.label,family:r.family,classNumber:r.class_number,gender:r.gender,age:r.age,winners:r.winners?r.winners.split(','):null,order:r.result_order?r.result_order.split('/'):null},entries:ent.get(r.id)||[]});
 const runsByHorse=new Map();
 for(const u of db.prepare('SELECT horse_id,date,place,surface,distance,track_code,timing FROM runs ORDER BY date').iterate())(runsByHorse.get(u.horse_id)??runsByHorse.set(u.horse_id,[]).get(u.horse_id)).push({date:u.date,place:u.place,surface:u.surface,distance:u.distance,trackCode:u.track_code,timing:u.timing});
 // Breed from the horse profiles, else from the races the horse ran in (speed pars are per breed).
 const breedByHorse=new Map();
 for(const h of db.prepare("SELECT id,breed FROM horses WHERE breed IS NOT NULL UNION ALL SELECT DISTINCT e.horse_id,r.breed FROM entries e JOIN races r ON r.id=e.race_id WHERE r.breed IN ('TB','AR')").iterate())if(!breedByHorse.has(h.id))breedByHorse.set(h.id,h.breed);
 // Sire per horse (profile, else program page), for the sire surface preference.
 const sireByHorse=new Map();
 for(const h of db.prepare('SELECT id,sire FROM horses WHERE sire IS NOT NULL UNION ALL SELECT DISTINCT horse_id,sire FROM entries WHERE sire IS NOT NULL').iterate())if(!sireByHorse.has(h.id))sireByHorse.set(h.id,intern(h.sire));
 const range=db.prepare('SELECT min(date) "from",max(date) "to" FROM races').get();
 return {races,runsByHorse,breedByHorse,sireByHorse,gallopPars,range:{from:range.from,to:range.to}};
}
