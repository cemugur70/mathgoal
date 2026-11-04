import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {parsePlayerPage} from '../dist/player-data.mjs';
const cache=new URL('../data/cache/',import.meta.url);
export async function getPlayerProfile(id,{signal}={}){
 signal?.throwIfAborted();
 if(!/^\d{4,12}$/.test(String(id)))throw Error('Geçersiz oyuncu kimliği.');const file=new URL('playerProfile-'+id+'.json',cache);
 try{const info=await stat(file);if(Date.now()-info.mtimeMs<900000){const result=JSON.parse(await readFile(file,{encoding:'utf8',signal}));signal?.throwIfAborted();if(String(result.data?.id)!==String(id))throw Error('Oyuncu önbelleği kimliği eşleşmiyor.');return {...result,cached:true};}}catch(error){if(signal?.aborted)throw signal.reason;if(error.code!=='ENOENT')throw error;}
 const deadline=AbortSignal.timeout(25000);
 const source=`https://www.fotmob.com/players/${id}`,response=await fetch(source,{signal:signal?AbortSignal.any([signal,deadline]):deadline});if(!response.ok)throw Error('Oyuncu kaynak sayfası HTTP '+response.status);
 const html=await response.text(),data=parsePlayerPage(html,id);signal?.throwIfAborted();const result={source,observedAt:new Date().toISOString(),sha256:createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html),data,modelUsage:'Güncel profil görüntüsü; sezon/kariyer toplamları geçmiş maç tahminine verilmez. Model, tarih sınırından önceki tekil maç performanslarını kullanır.'};await mkdir(cache,{recursive:true});await writeFile(file,JSON.stringify(result));return {...result,cached:false};
}

export async function getPlayerHistoryPage(source,{signal}={}) {
 signal?.throwIfAborted();
 const file=new URL('playerMatches-'+createHash('sha256').update(source).digest('hex')+'.json',cache);
 try {
  const info=await stat(file);
  if(Date.now()-info.mtimeMs<900000) {
   const snapshot=JSON.parse(await readFile(file,{encoding:'utf8',signal}));signal?.throwIfAborted();
   if(snapshot.source!==source)throw Error('Oyuncu geçmişi önbellek kaynağı eşleşmiyor.');
   return {...snapshot,cached:true};
  }
 } catch(error) {if(signal?.aborted)throw signal.reason;if(error.code!=='ENOENT')throw error;}
 const deadline=AbortSignal.timeout(25000);
 const response=await fetch(source,{signal:signal?AbortSignal.any([signal,deadline]):deadline,redirect:'error',headers:{accept:'application/json'}});
 if(!response.ok)throw Error('Oyuncu geçmişi HTTP '+response.status);
 const bytes=await response.text(),data=JSON.parse(bytes);signal?.throwIfAborted();
 const result={source,observedAt:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:Buffer.byteLength(bytes),data};
 await mkdir(cache,{recursive:true});await writeFile(file,JSON.stringify(result));return {...result,cached:false};
}
