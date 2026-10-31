import {createReadStream} from 'node:fs';
import {open,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export function hashJsonRows(metadata,rows){
 const hash=createHash('sha256');hash.update(JSON.stringify(metadata).slice(0,-1)+',"rows":[');
 for(let i=0;i<rows.length;i++){if(i)hash.update(',');hash.update(JSON.stringify(rows[i]));}
 return hash.update(']}').digest('hex');
}

export async function writeJsonRowsAtomic(destination,data){
 const {rows,...metadata}=data,temporary=destination instanceof URL?new URL(destination.href+'.tmp'):destination+'.tmp';
 const output=await open(temporary,'w');
 try{
  await output.writeFile(JSON.stringify(metadata).slice(0,-1)+',"rows":[');
  let buffer='';
  for(let i=0;i<rows.length;i++){buffer+=(i?',':'')+JSON.stringify(rows[i]);if(buffer.length>=64*1024){await output.writeFile(buffer);buffer='';}}
  await output.writeFile(buffer+']}');
 }finally{await output.close();}
 await rename(temporary,destination);
}

// Only retain one selected array element. Large archive metadata is skipped.
export async function* readSourceFields(file,{arrays=[],scalars=[]}={}){
 const arrayKeys=new Set(arrays),scalarKeys=new Set(scalars);
 let depth=0,quoted=false,escaped=false,keyExpected=false,keyToken='',keyReading=false,key=null;
 let selectedArray=null,item='',itemActive=false,scalar='',scalarActive=false,started=false,closed=false;
 for await(const chunk of createReadStream(file,{encoding:'utf8',highWaterMark:64*1024})){
  for(const c of chunk){
   if(closed){if(!/\s/.test(c))throw Error('Trailing source JSON content');continue;}
   if(!started){if(/\s/.test(c))continue;if(c!=='{')throw Error('Source JSON must be an object');started=true;depth=1;keyExpected=true;continue;}
   if(!quoted&&selectedArray&&depth===2&&(c===','||c===']')){
    if(itemActive){yield {key:selectedArray,value:JSON.parse(item)};item='';itemActive=false;}
   }
   if(!quoted&&scalarActive&&depth===1&&(c===','||c==='}')){
    yield {key,value:JSON.parse(scalar)};scalar='';scalarActive=false;
   }
   if(!quoted&&depth===1&&keyExpected&&c==='"'){keyReading=true;keyToken='';keyExpected=false;}
   if(!quoted&&selectedArray&&depth===2&&!itemActive&&c!==','&&c!==']'&&!/\s/.test(c))itemActive=true;
   if(!quoted&&depth===1&&key!==null&&!keyReading&&!scalarActive&&scalarKeys.has(key)&&c!==':'&&c!==','&&c!=='}'&&!/\s/.test(c))scalarActive=true;
   if(keyReading)keyToken+=c;
   if(itemActive)item+=c;
   if(scalarActive)scalar+=c;
   if(quoted){
    if(escaped)escaped=false;
    else if(c==='\\')escaped=true;
    else if(c==='"'){
     quoted=false;
     if(keyReading){key=JSON.parse(keyToken);keyReading=false;}
    }
    continue;
   }
   if(c==='"'){quoted=true;continue;}
   if(c==='['||c==='{'){
    if(depth===1&&c==='['&&arrayKeys.has(key))selectedArray=key;
    depth++;
   }else if(c===']'||c==='}'){
    if(depth===2&&c===']')selectedArray=null;
    depth--;
    if(depth===0)closed=true;
    if(depth<0)throw Error('Invalid source JSON nesting');
   }else if(c===','&&depth===1){keyExpected=true;key=null;}
  }
 }
 if(!closed||quoted||depth!==0)throw Error('Incomplete source JSON');
}
