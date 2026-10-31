import {SEASON_FEATURE_NAMES} from './season-features.mjs';
/** Season layer selection mirrors the market-network gate: validation-only, test labels never select. */
export function selectSeasonModel(candidate,reference,context,{mode='auto',starters=null}={}){
 const before=reference.report?.validation.selected,after=candidate?.report?.validation.selected;
 const aligned=!!candidate&&JSON.stringify(reference.ranges)===JSON.stringify(candidate.ranges);
 const gain=before&&after?before.pairedCountNll-after.pairedCountNll:null;
 const covered=candidate?.training.seasonCoveredTrain??0,coverageOk=covered>=Math.max(70,(candidate?.counts.train??0)*.6);
 const validated=!!(candidate?.accepted&&aligned&&coverageOk&&gain>=.003&&after.exactScoreAccuracy+1e-12>=before.exactScoreAccuracy);
 const usable=context?.coverage.status==='ready',requested=mode==='market-graph'||mode==='auto';
 const active=!!(requested&&usable&&candidate?.accepted&&(validated||mode==='market-graph'));
 const reason=!requested?'Sezon katmanı yalnız pazar ağı / otomatik modda değerlendirilir; seçilen model korunuyor.':!usable?'Bu maç için sezon-içi lig kapsamı yetersiz; mevcut model korundu.':active&&validated?
  'Sezon-içi lig girdileri doğrulamada skor kaybını azalttı ve tam skor isabetini düşürmedi.':active?'Sezon katmanı kullanıcı seçimiyle etkin; mevcut modele üstünlük eşiğini aşmadığı için deneysel.':'Sezon katmanı doğrulama eşiğini aşmadı; mevcut model korundu.';
 const season={active,validated,experimental:active&&!validated,mode,reason,alignedCohorts:aligned,validationNllGain:gain,coveredTrainingMatches:covered,context,
  featureNames:[...SEASON_FEATURE_NAMES],testUsedForSelection:false,
  comparison:{validation:{reference:before??null,season:after??null},test:{reference:reference.report?.test.selected??null,season:candidate?.report?.test.selected??null}},
  policy:'Aynı doğrulama maçlarında en az 0,003 NLL kazancı, tam skor isabetinde düşüş olmaması ve yeterli eğitim / hedef sezon kapsamı; test seçimde kullanılmaz.'};
 if(!active)return {...reference,season};
 const previous=reference.gbdt??{};
 return {...candidate,marketNetwork:reference.marketNetwork,season,gbdt:{...previous,active:true,validated:previous.validated&&validated,experimental:!(previous.validated&&validated),mode,reason:(previous.reason?previous.reason+' ':'')+reason,
  alignedCohorts:aligned,validationNllGain:gain,testUsedForSelection:false,comparison:{validation:{reference:before,gbdt:after},test:{reference:reference.report?.test.selected??null,gbdt:candidate.report?.test.selected??null}},
  featureCount:candidate.featureNames.length,featureImportance:candidate.featureImportance??[],treeCount:candidate.trees.length,parameters:candidate.training,starters,policy:season.policy}};
}
