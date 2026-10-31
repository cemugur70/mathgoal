import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readSourceFields} from '../scripts/json-source-stream.mjs';
import {hashJsonRows,writeJsonRowsAtomic} from '../scripts/json-source-stream.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('source streaming preserves selected records across chunks and skips archive metadata',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'mathgoal-stream-'));
 try{
  const file=path.join(dir,'source.json'),record={id:'a',name:'İsim 😀 \\"[,]{}',stats:{x:[1,null,2]},nested:[{text:'z'.repeat(70000)}]};
  const source={schemaVersion:1,id:'old-id',metadata:{matches:[{id:'ignore'}],text:'x'.repeat(100000)},matches:[record,{id:'b'}],playerHistoryMatches:[{id:'c'}],tail:'[]{}'};
  await writeFile(file,JSON.stringify(source));
  const fields=[];for await(const field of readSourceFields(file,{arrays:['matches','playerHistoryMatches'],scalars:['schemaVersion','id']}))fields.push(field);
  assert.deepEqual(fields,[{key:'schemaVersion',value:1},{key:'id',value:'old-id'},{key:'matches',value:record},{key:'matches',value:{id:'b'}},{key:'playerHistoryMatches',value:{id:'c'}}]);
  const metadata={schemaVersion:4,policy:'prior'},rows=Array.from({length:20},(_,i)=>({...record,id:String(i)}));
  assert.equal(hashJsonRows(metadata,rows),createHash('sha256').update(JSON.stringify({...metadata,rows})).digest('hex'));
  await writeJsonRowsAtomic(file,{...metadata,rows});assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{...metadata,rows});
  await writeFile(file,'{"matches":[{"id":"bad"}');
  await assert.rejects(async()=>{for await(const field of readSourceFields(file,{arrays:['matches']}))void field;},/Incomplete/);
 }finally{
  assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));
  assert.ok(path.basename(dir).startsWith('mathgoal-stream-'));
  await rm(dir,{recursive:true,force:true});
 }
});
