import test from 'node:test';import assert from 'node:assert/strict';
import {selectPiModel} from '../dist/pi-selection.mjs';
const ranges={train:{count:300},validation:{count:60}};
const model=(nll,exact,extra={})=>({accepted:true,ranges,counts:{train:300},training:{piCoveredTrain:250,seasonLayer:true,piLayer:extra.pi??false},featureNames:[],trees:[],
 report:{validation:{selected:{pairedCountNll:nll,exactScoreAccuracy:exact}},test:{selected:{pairedCountNll:nll}}},...extra});
const ready={coverage:{status:'ready'}};
test('pi layer activates only after a validation gain with no exact-score loss and ready target coverage',()=>{
 const reference=model(2.0,.10),better=model(1.99,.10,{pi:true});
 const chosen=selectPiModel(better,reference,ready,{mode:'auto'});assert.equal(chosen.pi.active,true);assert.equal(chosen.pi.validated,true);assert.equal(chosen.training.piLayer,true);
 assert.equal(selectPiModel(model(1.999,.10),reference,ready,{mode:'auto'}).pi.active,false,'gain below 0.003 keeps the reference');
 assert.equal(selectPiModel(model(1.9,.09),reference,ready,{mode:'auto'}).pi.active,false,'exact-score loss keeps the reference');
 assert.equal(selectPiModel(better,reference,{coverage:{status:'insufficient'}},{mode:'auto'}).pi.active,false,'missing target ratings keep the reference');
 assert.equal(selectPiModel(better,reference,null,{mode:'auto'}).pi.active,false,'bundles without pi ratings keep the reference');
 assert.equal(selectPiModel(better,reference,ready,{mode:'baseline'}).pi.active,false);
 const forced=selectPiModel(model(1.999,.10),reference,ready,{mode:'market-graph'});assert.equal(forced.pi.active,true);assert.equal(forced.pi.experimental,true);
 assert.equal(chosen.pi.testUsedForSelection,false);
});
