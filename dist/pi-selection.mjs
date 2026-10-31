import {PI_FEATURE_NAMES} from './pi-ratings.mjs';
/** Pi-rating layer selection mirrors the season gate: validation-only, test labels never select. */
export function selectPiModel(candidate,reference,context,{mode='auto',starters=null}={}){
 const before=reference.report?.validation.selected,after=candidate?.report?.validation.selected;
 const aligned=!!candidate&&JSON.stringify(reference.ranges)===JSON.stringify(candidate.ranges);
 const gain=before&&after?before.pairedCountNll-after.pairedCountNll:null;
 const covered=candidate?.training.piCoveredTrain??0,coverageOk=covered>=Math.max(70,(candidate?.counts.train??0)*.6);
 const validated=!!(candidate?.accepted&&aligned&&coverageOk&&gain>=.003&&after.exactScoreAccuracy+1e-12>=before.exactScoreAccuracy);
 const usable=context?.coverage?.status==='ready',requested=mode==='market-graph'||mode==='auto';
 const active=!!(requested&&usable&&candidate?.accepted&&(validated||mode==='market-graph'));
 const reason=!requested?'Pi-rating katmanı yalnız pazar ağı / otomatik modda değerlendirilir; seçilen model korunuyor.':!usable?'Bu maç için pi-rating geçmişi yetersiz ya da maç paketinde yok; mevcut model korundu.':active&&validated?
  'Pi-rating girdileri doğrulamada skor kaybını azalttı ve tam skor isabetini düşürmedi.':active?'Pi-rating katmanı kullanıcı seçimiyle etkin; mevcut modele üstünlük eşiğini aşmadığı için deneysel.':'Pi-rating katmanı doğrulama eşiğini aşmadı; mevcut model korundu.';
 const pi={active,validated,experimental:active&&!validated,mode,reason,alignedCohorts:aligned,validationNllGain:gain,coveredTrainingMatches:covered,context,
  featureNames:[...PI_FEATURE_NAMES],testUsedForSelection:false,
  comparison:{validation:{reference:before??null,pi:after??null},test:{reference:reference.report?.test.selected??null,pi:candidate?.report?.test.selected??null}},
  policy:'Aynı doğrulama maçlarında en az 0,003 NLL kazancı, tam skor isabetinde düşüş olmaması ve yeterli eğitim / hedef pi kapsamı; test seçimde kullanılmaz.'};
 if(!active)return {...reference,pi};
 const previous=reference.gbdt??{};
 return {...candidate,marketNetwork:reference.marketNetwork,season:reference.season,pi,gbdt:{...previous,active:true,validated:previous.validated&&validated,experimental:!(previous.validated&&validated),mode,reason:(previous.reason?previous.reason+' ':'')+reason,
  alignedCohorts:aligned,validationNllGain:gain,testUsedForSelection:false,comparison:{validation:{reference:before,gbdt:after},test:{reference:reference.report?.test.selected??null,gbdt:candidate.report?.test.selected??null}},
  featureCount:candidate.featureNames.length,featureImportance:candidate.featureImportance??[],treeCount:candidate.trees.length,parameters:candidate.training,starters,policy:pi.policy}};
}
