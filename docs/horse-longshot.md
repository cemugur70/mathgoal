# Uzun atış skoru (ileriye dönük testte, sitede kullanılmıyor)

Yarış öncesi ganyanı en az 10 olan atlar arasında, kapanış fiyatının bilmediğini arayan bir skor. Sığ ağaçlar kapanış fiyatının üstüne eğitilir; okuduğu 65 sinyal yarıştan önce bilinir. Skoru eğitim dönemindeki en iyi %10'a giren at adaydır. Ödemeler kapanış fiyatıyla hesaplanır; kendi bahsinin fiyatı düşürmesi hesaba katılmaz. **Kâr iddiası yoktur.**

## Geçmiş sonuçlar

"Kat", kapanış fiyatının beklediğine göre kazanan sayısıdır; aralıklar %95 bootstrap. 2026 bu çalışma sırasında birkaç kez görüldüğü için tamamen bağımsız sayılmaz.

| Küme | Bahis | Kazanan | Kat | ROI |
|---|---:|---:|---|---|
| 2025, son okuma, adaylar | 1780 | 144 | 1,43 (1,21–1,62) | -13,8% (-30,4% / 1,8%) |
| 2025, son okuma, tüm uzun atışlar | 17709 | 676 | 1,06 (0,99–1,13) | -45,0% (-50,3% / -39,7%) |
| 2025, 15 dk, adaylar | 2179 | 197 | 1,44 (1,27–1,63) | -5,8% (-23,1% / 15,4%) |
| 2026, son okuma, adaylar | 1332 | 105 | 1,44 (1,19–1,68) | -3,1% (-23,3% / 17,2%) |
| 2026, son okuma, tüm uzun atışlar | 15066 | 512 | 0,94 (0,87–1,00) | -50,3% (-54,6% / -45,9%) |
| 2026, 15 dk, adaylar | 1667 | 147 | 1,45 (1,25–1,65) | 0,0% (-19,1% / 19,1%) |

## İleriye dönük test

Model `scripts/horse-longshot-model.json` içinde dondurulmuştur ve 2026-11-06 ve sonrasını sınar. Fiyat, sunucunun `data/horse/odds-snapshots` kayıtlarında yarıştan önce görülen son fiyattır. Kural testten önce yazıldı:

1. En az 500 aday birikmeden karar verilmez.
2. Kat aralığının alt sınırı 1'in üstünde olmalıdır.
3. ROI, aynı koşulardaki eski sürpriz adaylarından yüksek olmalıdır.

Ölçüm: sunucudan kayıtları ve veritabanını yerele alıp `npm run horse:longshotforward`. Geçerse skor sitedeki sürpriz adaylarının yerine önerilir; bunun için sinyalleri canlı yayında üretmek ve 512 MB sınırını sınamak gerekir.
