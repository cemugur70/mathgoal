import {trainOutcomeModel,OUTCOME_FEATURE_NAMES} from './outcome-training.mjs';
import {PLAYER_GRAPH_FEATURE_NAMES} from './player-graph-features.mjs';
export const GRAPH_OUTCOME_FEATURE_NAMES=Object.freeze([...OUTCOME_FEATURE_NAMES,...PLAYER_GRAPH_FEATURE_NAMES.map(name=>'graph.'+name)]);
export const GRAPH_SELECTION_POLICY=Object.freeze({minimumValidationNllGain:.003,minimumTrainingCoverage:.6,minimumCoveredTrainingMatches:70,
 minimumTargetHistory:3,minimumTargetMinuteCoverage:.6,maximumTargetMissingFraction:.5,requireNonDecreasingValidationExactScore:true});
const time=v=>typeof v==='number'?v:Date.parse(v);
const valid=v=>Array.isArray(v)&&v.length===PLAYER_GRAPH_FEATURE_NAMES.length&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=2);
const neutral=()=>PLAYER_GRAPH_FEATURE_NAMES.map(name=>name==='missingFraction'?1:0);
export function graphRow(row){
 const maximum=time(row.graphFeatureMaxAvailableAt),temporal=Number.isFinite(maximum)&&maximum<time(row.date);
 const h=temporal&&valid(row.homeGraphFeatures)?row.homeGraphFeatures:neutral(),a=temporal&&valid(row.awayGraphFeatures)?row.awayGraphFeatures:neutral();
 return {...row,homeFeatures:Array.isArray(row.homeFeatures)?[...row.homeFeatures,...h]:null,
  awayFeatures:Array.isArray(row.awayFeatures)?[...row.awayFeatures,...a]:null,
  featureMaxAvailableAt:temporal?new Date(Math.max(maximum,time(row.featureMaxAvailableAt))).toISOString():row.featureMaxAvailableAt};
}
export function trainPlayerGraphModels(rows,options){
 const baseline=trainOutcomeModel(rows,options),expanded=rows.map(graphRow);
 const candidate=trainOutcomeModel(expanded,{...options,featureNames:GRAPH_OUTCOME_FEATURE_NAMES});
 const trainRange=baseline.ranges.train;
 const qualified=rows.filter(r=>Number(r.formCount)===Number(options.formCount??10)&&String(r.id)!==String(options.targetId)&&
  time(r.date)>=time(trainRange.firstDate)&&time(r.date)<=time(trainRange.lastDate)&&
  time(r.availableAt)<time(options.cutoff)&&(baseline.scope.type!=='league'||String(r.leagueId)===String(baseline.scope.leagueId))&&
  time(r.graphFeatureMaxAvailableAt)<time(r.date)&&valid(r.homeGraphFeatures)&&valid(r.awayGraphFeatures)&&
  r.homeGraphFeatures.at(-1)<=GRAPH_SELECTION_POLICY.maximumTargetMissingFraction&&r.awayGraphFeatures.at(-1)<=GRAPH_SELECTION_POLICY.maximumTargetMissingFraction).length;
 const aligned=JSON.stringify(baseline.ranges)===JSON.stringify(candidate.ranges)&&baseline.counts.train===candidate.counts.train&&baseline.counts.test===candidate.counts.test;
 const before=baseline.report?.validation.selected,after=candidate.report?.validation.selected;
 const gain=before&&after?before.pairedCountNll-after.pairedCountNll:null;
 const coverageOk=qualified>=Math.max(GRAPH_SELECTION_POLICY.minimumCoveredTrainingMatches,baseline.counts.train*GRAPH_SELECTION_POLICY.minimumTrainingCoverage);
 const exactOk=before&&after&&after.exactScoreAccuracy+1e-12>=before.exactScoreAccuracy;
 const accepted=!!(aligned&&coverageOk&&candidate.accepted&&gain>=GRAPH_SELECTION_POLICY.minimumValidationNllGain&&exactOk);
 const reason=accepted?'Oyuncu ağı, aynı doğrulama maçlarında skor kaybını azalttı; tam skor isabeti düşmedi.':!aligned?'Karşılaştırma örneklemleri eşleşmedi; takım modeli korundu.':!coverageOk?'Eğitim oyuncu ağı kapsamı yetersiz; takım modeli korundu.':!exactOk?'Doğrulamada tam skor isabeti azaldı; takım modeli korundu.':'Oyuncu ağının doğrulama kazancı eşiği aşmadı; takım modeli korundu.';
 return {baseline,candidate,accepted,reason,comparison:{policy:GRAPH_SELECTION_POLICY,alignedCohorts:aligned,coveredTrainingMatches:qualified,
  validationNllGain:gain,validation:{baseline:before??null,graph:after??null},
  test:{baseline:baseline.report?.test.selected??null,graph:candidate.report?.test.selected??null},
  testUsedForSelection:false,note:'Aynı arşiv üzerinde geliştirilen zaman sıralı iç karşılaştırma; bağımsız gelecek başarı kanıtı değildir.'}};
}
export function selectPlayerGraphModel(models,features,{mode='auto'}={}){
 const usable=features&&['home','away'].every(side=>{
  const c=features.coverage?.[side];return valid(features[side])&&c?.historyGames>=GRAPH_SELECTION_POLICY.minimumTargetHistory&&
   c.minuteCoverage>=GRAPH_SELECTION_POLICY.minimumTargetMinuteCoverage&&c.missingFraction<=GRAPH_SELECTION_POLICY.maximumTargetMissingFraction;
 });
 const experimental=mode==='graph'&&!models.accepted&&!!models.candidate.accepted;
 const active=!!(mode!=='baseline'&&usable&&(models.accepted||experimental)),chosen=active?models.candidate:models.baseline;
 const reason=mode==='baseline'?'Takım modeli seçildi.':active&&experimental?'Deneysel oyuncu ağı modeli seçildi; otomatik doğrulama eşiği aşılmadı.':active?models.reason:models.accepted?'Bu maçın oyuncu ağı kapsamı yetersiz; doğrulanmış takım modeli kullanıldı.':models.reason;
 return {...chosen,version:active?'player-graph-outcome-v1':chosen.version,
  playerGraph:{active,validated:models.accepted,mode,status:active?experimental?'experimental':'active':mode==='baseline'?'disabled':models.accepted?'target-coverage-insufficient':'baseline-retained',
   reason,
   featureNames:[...PLAYER_GRAPH_FEATURE_NAMES],comparison:models.comparison,
   targetCoverage:features?.coverage??null,targetEvidence:features?.evidence??null,targetFeatures:features?{home:features.home,away:features.away}:null,
   baselineReference:{accepted:models.baseline.accepted,coefficients:models.baseline.coefficients,featureNames:models.baseline.featureNames,shape:models.baseline.shape},usesTargetLineup:false},
  reason:active?reason:chosen.reason};
}
