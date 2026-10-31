import {backtest} from './model.mjs?v=2026-10-31.2';
self.onmessage=e=>{try{self.postMessage(backtest(e.data.bundle,{...e.data.options,limit:60}));}catch(error){self.postMessage({error:error.message});}};
