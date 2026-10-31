const finite=v=>typeof v==='number'&&Number.isFinite(v);
/** Measurement ownership is shared by the table, numeric sorting and CSV export. */
export function playerStatMeasure(row,key,{mode='sum',meta={},fractionEvidence}={}){
 const metric=row.metrics?.[key],type=meta.type??metric?.type??'';
 // Fraction-with-percentage stores a count numerator. It is not itself a percentage.
 const nonCount=!/fraction/i.test(type)&&(/rating|percentage|percent|accuracy|speed|distance|height|weight|fantasy|plus_minus|minutes_played/i.test(key)||/^(boolean|percentage|percent|speed|distance)$/i.test(type));
 let value=null,paired=null;
 if(row.raw){
  value=row.stats?.[key];const total=row.statTotals?.[key];
  if(finite(value)&&value>=0&&finite(total)&&total>0&&value<=total)paired={numerator:value,total,games:1,coverage:1};
  if(mode==='per90'&&!nonCount)value=finite(value)&&row.minutes>0?value*90/row.minutes:null;
 }else{
  value=key==='minutes_played'?(mode==='average'?metric?.average:metric?.sum):mode==='sum'?(metric?.sum??metric?.minuteWeightedAverage??metric?.average):mode==='average'?metric?.average:nonCount?metric?.minuteWeightedAverage??metric?.average:metric?.per90;
  if(mode==='sum'&&fractionEvidence)paired=fractionEvidence(row.playerId,key);
 }
 return {value:finite(value)?value:null,paired:mode==='sum'&&paired?.total>0?paired:null,nonCount};
}
