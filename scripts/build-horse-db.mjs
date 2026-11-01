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
CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);`);
const insRace=db.prepare('INSERT OR REPLACE INTO races VALUES('+Array(25).fill('?').join(',')+')'),insEntry=db.prepare('INSERT OR REPLACE INTO entries VALUES('+Array(31).fill('?').join(',')+')');
const insRun=db.prepare('INSERT OR IGNORE INTO runs VALUES(?,?,?,?,?,?,?,?,?)');
const files=(await readdir(cache)).filter(f=>/^program-\d{4}-\d{2}-\d{2}-[a-z]+-\d+\.json\.gz$/.test(f)).sort();let races=0,skipped=0;
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
// Places outside the dividend pools come from the same horse's later program pages (one start per horse per day and track).
db.exec(`UPDATE entries SET place=(SELECT u.place FROM runs u JOIN races r ON r.id=entries.race_id WHERE u.horse_id=entries.horse_id AND u.date=r.date AND u.track_code=r.track_code),place_source='later-program'
 WHERE place IS NULL AND EXISTS(SELECT 1 FROM runs u JOIN races r ON r.id=entries.race_id WHERE u.horse_id=entries.horse_id AND u.date=r.date AND u.track_code=r.track_code AND u.place IS NOT NULL);
CREATE INDEX entries_horse ON entries(horse_id);CREATE INDEX races_date ON races(date);CREATE INDEX races_type ON races(type,surface);`);
const ins=db.prepare('INSERT INTO meta VALUES(?,?)');ins.run('builtAt',new Date().toISOString());ins.run('source','liderform.com.tr public program pages (SSR __NEXT_DATA__)');ins.run('files',String(files.length));
db.exec('COMMIT');
const q=s=>db.prepare(s).get();
console.log(JSON.stringify({races,skipped,entries:q('SELECT count(*) n FROM entries').n,horses:q('SELECT count(DISTINCT horse_id) n FROM entries').n,
 withWinner:q("SELECT count(*) n FROM races WHERE winners IS NOT NULL").n,placed:q('SELECT count(*) n FROM entries WHERE place IS NOT NULL').n,range:q('SELECT min(date) a,max(date) b FROM races')}));
db.close();await rename(tmp,file);
