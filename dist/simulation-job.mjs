// Own exactly one simulation worker. Invalidated callbacks cannot publish results.
export function createSimulationJob({createWorker,onState}) {
 let generation=0,owned=null;
 function release(){if(owned){owned.terminate();owned=null;}}
 function cancel(){generation++;if(owned){release();onState({status:'cancelled'});}}
 function start(input,settings){
  cancel();const jobId=++generation;
  onState({status:'running'});
  try{
   const worker=createWorker();owned=worker;
   const finish=state=>{if(generation!==jobId||owned!==worker)return;release();onState(state);};
   worker.onmessage=e=>{if(e.data?.jobId!==jobId)return;finish(e.data.error?{status:'error',error:e.data.error}:{status:'complete',result:e.data.result});};
   worker.onerror=e=>{e.preventDefault?.();finish({status:'error',error:'Simülasyon çalıştırılamadı. Yeniden deneyin.'});};
   worker.onmessageerror=()=>finish({status:'error',error:'Simülasyon cevabı okunamadı.'});
   worker.postMessage({jobId,input,settings});
  }catch(error){if(generation!==jobId)return;release();onState({status:'error',error:error.message});}
 }
 return {start,cancel};
}
