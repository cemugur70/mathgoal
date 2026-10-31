// Final results are optional for unplayed fixtures and incomplete provider responses.
export function renderResultComparison(bundle,prediction,{escapeHtml,formatPercent,formCount=10}) {
 const actual=bundle?.actual;
 if(bundle?.target?.finished!==true||!Number.isFinite(actual?.homeScore)||!Number.isFinite(actual?.awayScore))return `<div class="card spaced"><h2>Maç öncesi tahmin</h2><p class="small-text">Bu maç henüz tamamlanmadı veya doğrulanmış sonucu bulunmuyor. Gösterilen skorlar modelin tahminidir. Analiz anına kadar tamamlanmış son ${formCount===5?5:10} resmi maç ve rakip ağı kullanılır.</p></div>`;
 const probability=prediction?.heatmap?.find(c=>c&&c.home===actual.homeScore&&c.away===actual.awayScore)?.probability;
 return `<div class="card spaced"><h2>Sonucu sonradan kontrol et</h2><p class="small-text">Tamamlanmış maç için geçmişe dönük simülasyon. Gerçek sonuç tahmine verilmez.</p><details><summary>Gerçek sonucu aç · Tahmini etkilemez</summary><p>Gerçek skor: <strong>${escapeHtml(bundle.target.home.name)} ${actual.homeScore} – ${actual.awayScore} ${escapeHtml(bundle.target.away.name)}</strong></p><p class="inline-note">Bu skorun model olasılığı: ${formatPercent(probability)}</p></details></div>`;
}
