import {MARKET_NETWORK_FEATURE_NAMES} from './market-network.mjs';
export function selectMarketNetworkModel(candidate,reference,context,{mode='auto',starters=null}={}){
 const before=reference.report?.validation.selected,after=candidate?.report?.validation.selected;
 const aligned=!!candidate&&JSON.stringify(reference.ranges)===JSON.stringify(candidate.ranges);
 const gain=before&&after?before.pairedCountNll-after.pairedCountNll:null;
 const covered=candidate?.training.networkCoveredTrain??0,coverageOk=covered>=Math.max(70,(candidate?.counts.train??0)*.6);
 const validated=!!(candidate?.accepted&&aligned&&coverageOk&&gain>=.003&&after.exactScoreAccuracy+1e-12>=before.exactScoreAccuracy);
 const usable=context?.coverage.status==='ready',requested=mode==='market-graph'||mode==='auto';
 const active=!!(requested&&usable&&candidate?.accepted&&(validated||mode==='market-graph'));
 const reason=!requested?'Pazar ağı açıklayıcı olarak gösteriliyor; seçilen model korunuyor.':!usable?'Bu maç için ağ desteği yetersiz; mevcut model korundu.':active&&validated?
  'Pazar ağı doğrulamada skor kaybını azalttı ve tam skor isabetini düşürmedi.':active?'Pazar ağı kullanıcı seçimiyle etkin; mevcut modele üstünlük eşiğini aşmadığı için deneysel.':'Pazar ağı doğrulama eşiğini aşmadı; mevcut model korundu.';
 const network={active,validated,experimental:active&&!validated,mode,reason,alignedCohorts:aligned,validationNllGain:gain,coveredTrainingMatches:covered,context,
  featureNames:[...MARKET_NETWORK_FEATURE_NAMES],testUsedForSelection:false,
  comparison:{validation:{reference:before??null,network:after??null},test:{reference:reference.report?.test.selected??null,network:candidate?.report?.test.selected??null}},
  policy:'Aynı doğrulama maçlarında en az 0,003 NLL kazancı, tam skor isabetinde düşüş olmaması ve yeterli eğitim / hedef ağ kapsamı; test seçimde kullanılmaz.'};
 if(!active)return {...reference,marketNetwork:network};
 return {...candidate,marketNetwork:network,gbdt:{active:true,validated,experimental:!validated,mode,reason,alignedCohorts:aligned,validationNllGain:gain,
  testUsedForSelection:false,comparison:{validation:{reference:before,gbdt:after},test:{reference:reference.report?.test.selected??null,gbdt:candidate.report?.test.selected??null}},
  featureCount:candidate.featureNames.length,featureImportance:candidate.featureImportance??[],treeCount:candidate.trees.length,parameters:candidate.training,starters,policy:network.policy}};
}
