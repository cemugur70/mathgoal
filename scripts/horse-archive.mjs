// Loads data/horse/horses.db into race / entry / past-run structures shared by the walk-forward and the race predictor.
export function loadHorseArchive(db){
 const ent=new Map();
 for(const e of db.prepare('SELECT * FROM entries').all())(ent.get(e.race_id)??ent.set(e.race_id,[]).get(e.race_id)).push({raceId:e.race_id,horseId:e.horse_id,number:e.number,start:e.start,status:e.status,name:e.name,
  age:e.age,sex:e.sex,kg:e.kg,apprentice:e.apprentice===1,handicap:e.handicap,point:e.point,daysOff:e.days_off,odds:e.odds,agf1:e.agf1,place:e.place});
 const races=db.prepare('SELECT * FROM races ORDER BY date,city,number').all().map(r=>({race:{id:r.id,date:r.date,city:r.city,number:r.number,status:r.status,breed:r.breed,surface:r.surface,distance:r.distance,
  type:r.type,label:r.label,family:r.family,classNumber:r.class_number,gender:r.gender,age:r.age,winners:r.winners?r.winners.split(','):null},entries:ent.get(r.id)||[]}));
 const runsByHorse=new Map();
 for(const u of db.prepare('SELECT * FROM runs ORDER BY date').all())(runsByHorse.get(u.horse_id)??runsByHorse.set(u.horse_id,[]).get(u.horse_id)).push({date:u.date,place:u.place,surface:u.surface,distance:u.distance,trackCode:u.track_code});
 const range=db.prepare('SELECT min(date) "from",max(date) "to" FROM races').get();
 return {races,runsByHorse,range:{from:range.from,to:range.to}};
}
