// Rebuilds data/horse/horses.db (SQLite) from the cached liderform program pages. Safe to rerun while collection continues.
import {readdir,readFile,rm,rename} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {normalizeRacePage} from '../dist/horse-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse'),cache=path.join(dir,'cache');
const file=path.join(dir,'horses.db'),tmp=file+'.tmp';await rm(tmp,{force:true});
const db=new DatabaseSync(tmp);
db.exec(`PRAGMA journal_mode=OFF;PRAGMA synchronous=OFF;
CREATE TABLE races(id TEXT PRIMARY KEY,date TEXT,city TEXT,track_code TEXT,number INT,time TEXT,status TEXT,breed TEXT,surface TEXT,distance INT,type TEXT,label TEXT,family TEXT,class_number INT,
 age TEXT,gender TEXT,going TEXT,weather TEXT,temperature REAL,prize1 REAL,bets_result TEXT,winners TEXT,result_order TEXT,dead_heat INT,field_size INT);
CREATE TABLE entries(race_id TEXT,horse_id INT,number TEXT,start INT,status TEXT,name TEXT,age INT,sex TEXT,origin TEXT,sire TEXT,dam TEXT,dam_sire TEXT,jockey_id INT,jockey TEXT,kg REAL,apprentice INT,
 trainer TEXT,owner TEXT,handicap REAL,handicap_prev REAL,point REAL,point_prev REAL,days_off INT,odds REAL,agf1 REAL,agf1_rank INT,agf2 REAL,equipment TEXT,place INT,place_source TEXT,comment TEXT,PRIMARY KEY(race_id,number));
CREATE TABLE runs(horse_id INT,date TEXT,track_code TEXT,place INT,surface TEXT,distance INT,handicap REAL,timing TEXT,ahead TEXT,PRIMARY KEY(horse_id,date,track_code));
CREATE TABLE horses(id INT PRIMARY KEY,name TEXT,origin TEXT,breed TEXT,sex TEXT,color TEXT,foaling_date TEXT,foaling_year INT,death_date TEXT,import_type TEXT,import_date TEXT,
 country_exported TEXT,sire TEXT,sire_origin TEXT,dam TEXT,dam_origin TEXT,dam_sire TEXT,dam_sire_origin TEXT,handicap REAL,trainer TEXT,owner TEXT,prize_try REAL,prize TEXT,
 starts_turf INT,starts_dirt INT,starts_awt INT,starts_tapeta INT,last_race TEXT,observed_at TEXT);
CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);`);
const insRace=db.prepare('INSERT OR REPLACE INTO races VALUES('+Array(25).fill('?').join(',')+')'),insEntry=db.prepare('INSERT OR REPLACE INTO entries VALUES('+Array(31).fill('?').join(',')+')');
const insRun=db.prepare('INSERT OR IGNORE INTO runs VALUES(?,?,?,?,?,?,?,?,?)');
// Only settled days enter the archive; today's pages (cached by the live predictor) could otherwise leak into training.
const today=new Date().toISOString().slice(0,10);
const files=(await readdir(cache)).filter(f=>/^program-\d{4}-\d{2}-\d{2}-[a-z]+-\d+\.json\.gz$/.test(f)&&f.slice(8,18)<today).sort();let races=0,skipped=0;
db.exec('BEGIN');
for(const f of files){
 const [,date,city,number]=f.match(/^program-(\d{4}-\d{2}-\d{2})-([a-z]+)-(\d+)\.json\.gz$/);
 const n=normalizeRacePage(JSON.parse(gunzipSync(await readFile(path.join(cache,f)))),{date,city,number});
 if(!n){skipped++;continue;}
 const {race:r,entries,runs}=n,field=entries.filter(e=>!/SCRATCH|NON_?RUNNER|WITHDRAWN/i.test(e.status||'')).length;
 insRace.run(r.id,r.date,r.city,r.trackCode,r.number,r.time,r.status,r.breed,r.surface,r.distance,r.type,r.label,r.family,r.classNumber,r.age,r.gender,r.going,r.weather,r.temperature,r.prize1,
  r.betsResult,r.winners&&r.winners.join(','),r.order&&r.order.join('/'),r.deadHeat?1:0,field);
 for(const e of entries)insEntry.run(e.raceId,e.horseId,e.number,e.start,e.status,e.name,e.age,e.sex,e.origin,e.sire,e.dam,e.damSire,e.jockeyId,e.jockey,e.kg,e.apprentice?1:0,e.trainer,e.owner,
  e.handicap,e.handicapPrev,e.point,e.pointPrev,e.daysOff,e.odds,e.agf1,e.agf1Rank,e.agf2,e.equipment,e.place,e.place===null?null:'dividends',e.comment);
 for(const x of runs)insRun.run(x.horseId,x.date,x.trackCode,x.place,x.surface,x.distance,x.handicap,x.timing,x.ahead);
 races++;
}
// Profiles (pedigree, prize, career starts per surface) from the public horse pages, when collected.
const profiles=path.join(dir,'profiles'),insHorse=db.prepare('INSERT OR REPLACE INTO horses VALUES('+Array(29).fill('?').join(',')+')');let profileCount=0;
for(const f of await readdir(profiles).catch(()=>[])){
 if(!/^\d+\.json\.gz$/.test(f))continue;
 const {horse:h,observedAt}=JSON.parse(gunzipSync(await readFile(path.join(profiles,f))));if(!h)continue;
 const s=h.surfaces||{};
 insHorse.run(h.id,h.name,h.country_origin,h.breed,h.gender,h.color,h.foaling_date,h.foaling_year,h.death_date,h.import_type,h.import_date,h.country_exported,h.sire_name,h.sire_country_origin,
  h.dam_name,h.dam_country_origin,h.dam_sire_name,h.dam_sire_country_origin,h.handicap,h.trainer_name,h.owner_name,(h.prize||[]).find(p=>p.currency==='TRY')?.value??null,JSON.stringify(h.prize||[]),
  s.turf??null,s.dirt??null,s.awt??null,s.tapeta??null,h.last_race,observedAt);
 profileCount++;
}
// A start on the pooled "KARMA" card is also listed under its real track; keep only the real one.
db.exec(`DELETE FROM runs WHERE track_code='TUR_KRM' AND EXISTS(SELECT 1 FROM runs u WHERE u.horse_id=runs.horse_id AND u.date=runs.date AND u.track_code<>'TUR_KRM')`);
// Places outside the dividend pools come from the same horse's later program pages (one start per horse per day and track).
db.exec(`UPDATE entries SET place=(SELECT u.place FROM runs u JOIN races r ON r.id=entries.race_id WHERE u.horse_id=entries.horse_id AND u.date=r.date AND u.track_code=r.track_code),place_source='later-program'
 WHERE place IS NULL AND EXISTS(SELECT 1 FROM runs u JOIN races r ON r.id=entries.race_id WHERE u.horse_id=entries.horse_id AND u.date=r.date AND u.track_code=r.track_code AND u.place IS NOT NULL);
CREATE INDEX entries_horse ON entries(horse_id);CREATE INDEX races_date ON races(date);CREATE INDEX races_type ON races(type,surface);
CREATE VIEW horse_stats AS SELECT horse_id,count(*) starts,sum(place=1) wins,sum(place<=2) top2,sum(place<=3) top3,round(1.0*sum(place=1)/count(*),3) win_rate,
 sum(surface='TURF') turf,sum(surface='TURF' AND place=1) turf_wins,sum(surface='DIRT') dirt,sum(surface='DIRT' AND place=1) dirt_wins,
 sum(surface IN('AWT','TAPETA')) synthetic,sum(surface IN('AWT','TAPETA') AND place=1) synthetic_wins,min(date) first_run,max(date) last_run FROM runs GROUP BY horse_id;`);
const ins=db.prepare('INSERT INTO meta VALUES(?,?)');ins.run('builtAt',new Date().toISOString());ins.run('source','liderform.com.tr public program pages (SSR __NEXT_DATA__)');ins.run('files',String(files.length));
db.exec('COMMIT');
const q=s=>db.prepare(s).get();
console.log(JSON.stringify({races,skipped,entries:q('SELECT count(*) n FROM entries').n,horses:q('SELECT count(DISTINCT horse_id) n FROM entries').n,profiles:profileCount,runs:q('SELECT count(*) n FROM runs').n,
 withWinner:q("SELECT count(*) n FROM races WHERE winners IS NOT NULL").n,placed:q('SELECT count(*) n FROM entries WHERE place IS NOT NULL').n,range:q('SELECT min(date) a,max(date) b FROM races')}));
db.close();await rename(tmp,file);
