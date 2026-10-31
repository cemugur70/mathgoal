import {ratingToGoals} from './pi-ratings.mjs';
// Team strength panel: the pi ratings stored with the bundle at collection time, shown whether or not the model selected the pi layer.
const signed=(v,number,digits=2)=>(v>0?'+':v<0?'−':'')+number(Math.abs(v),digits);
export function piPanelHtml(bundle,result,{esc,number}){
 const target=result?.target,stored=bundle?.piRatings;
 const pi=result?.pi??(stored&&target&&Date.parse(stored.cutoff)===Date.parse(target.date)?stored:null);
 if(!pi){
  if(stored||!target)return '';
  return `<section class="card spaced pi-panel" id="pi-panel"><div class="card-title"><h2>Pi-rating · takım güçleri</h2><span class="tag">YOK</span></div><p class="inline-note">Bu maç pi-rating eklenmeden önce toplandı. Puanları görmek için maçı yeniden analiz edin.</p></section>`;
 }
 const home=pi.ratings.home,away=pi.ratings.away,gd=pi.expectedGoalDifference,layer=result?.training?.pi;
 const status=!layer?'MODELDE DEĞERLENDİRİLMEDİ':layer.active?layer.experimental?'MODELDE DENEYSEL':'MODELDE ETKİN':'MODELDE KAPALI';
 const team=(name,r,venue)=>{const own=venue==='home'?r.home:r.away,other=venue==='home'?r.away:r.home;
  return `<div class="pi-team"><h3>${esc(name)}</h3><div class="pi-main"><b>${signed(own,number)}</b><span>${venue==='home'?'iç saha':'deplasman'} puanı · ortalama rakibe karşı ≈ ${signed(ratingToGoals(own),number)} gol</span></div>
   <div class="pi-sub"><span>${venue==='home'?'Deplasman':'İç saha'} puanı <b>${signed(other,number)}</b></span><span>Puanlanan maç <b>${number(r.matches,0)}</b></span></div></div>`;};
 const favourite=Math.abs(gd)<.1?'Pi puanlarına göre iki takım yaklaşık denk.':`Pi puanlarına göre ${esc(gd>0?target.home.name:target.away.name)} yaklaşık ${number(Math.abs(gd),2)} gol üstün.`;
 return `<section class="card spaced pi-panel" id="pi-panel"><div class="card-title"><h2>Pi-rating · takım güçleri</h2><span class="tag">${status}</span></div>
  <div class="pi-teams">${team(target.home.name,home,'home')}${team(target.away.name,away,'away')}</div>
  <div class="pi-gd"><span>Beklenen gol farkı (ev − deplasman)</span><b>${signed(gd,number)}</b><p>${favourite}</p></div>
  ${pi.coverage?.status!=='ready'?'<p class="inline-note">Takımlardan en az biri 3 maçtan az puanlandı; puanlar henüz güvenilir değil ve model bu katmanı kullanmaz.</p>':''}
  <p class="inline-note">Pi-rating (Constantinou ve Fenton, 2013): her takımın ayrı iç saha ve deplasman puanı vardır. 0 ortalama takım demektir; artı daha güçlü, eksi daha zayıf. Puanlar, geçmiş sezonlar dahil arşivdeki ${pi.archiveMatches?number(pi.archiveMatches,0)+' maçın ':''}yalnız ${esc(new Date(pi.cutoff??target.date).toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'}))} öncesinde bitenlerinden, her maçtaki gol farkı tahmin hatasına göre güncellenerek hesaplanır.${layer?' '+esc(layer.reason):''}</p></section>`;
}
