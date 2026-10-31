import {runSimulation} from './player-simulation.mjs?v=2026-10-31.1';
self.onmessage=({data})=>{
 const {jobId,input,settings}=data;
 try{self.postMessage({jobId,result:runSimulation(input,settings)});}
 catch(error){self.postMessage({jobId,error:error.message||'Simülasyon hesaplanamadı.'});}
};
