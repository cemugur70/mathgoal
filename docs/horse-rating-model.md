# At yarışı: rakip ağı rating'i ve Obsidian modeli

Veri 2025-10-29 – 2026-10-31: rating'ler tüm yurt içi hipodromlardaki 6305 sonuçlanmış koşudan öğrenilir (1828'i yalnızca ağ için: Kocaeli, Elazığ, Antalya, Şanlıurfa, Diyarbakır); değerlendirme ve ağırlıklar yalnızca İstanbul, Ankara, İzmir, Bursa ve Adana koşularında.
İngiliz + Arap. İlk 60 gün (2025-12-28 öncesi) yalnızca rating ısınması için kullanıldı.
Keşif: 2025-12-28 – 2026-07-10 öncesi (2243 koşu) · doğrulama: 2026-07-10 ve sonrası (1504 koşu). **Ara bölme**: 2026 öncesi veri henüz yetersiz olduğundan bölme noktası değerlendirilebilir koşuların %60'ına kondu; tam veriyle 2026-01-01 kullanılacak.

## Yöntem

1. **Kim kimi geçti**: her geçmiş koşuda ödeme metninden bilinen ilk dereceler ve sonraki programlardan bilinen dereceler; derecesi bilinmeyen atlar bilinen ilk derecelerin arkasında sayılır.
2. **Rakip ağı rating'i** (Plackett–Luce, çevrimiçi): her koşu sonrası her at, rakiplerinin o anki gücüne göre beklenen ile gerçekleşen arasındaki fark kadar hareket eder. Güçlü atı geçmek daha çok kazandırır; güç ortak rakipler üzerinden yayılır.
3. **Pist / mesafe tercihi**: ağ içinde rakip gücüne göre düzeltilmiş pist (çim/kum/sentetik) ve mesafe (kısa ≤1300, mil ≤1600, orta ≤2000, uzun) sapmaları; ayrıca atın tüm hipodromlardaki kariyer kaydından aynı koşulda ortalama derece puanı (1/derece) eksi genel ortalaması, 3 sanal koşuyla büzülmüş.
4. **Obsidian**: koşu içi softmax (koşullu logit) ile ağ rating'i, tercihler, kilo, handikap, puan, son 3 koşu formu, dinlenme, apranti ve yarış öncesi AGF birleştirilir. Ağırlıklar yalnız keşif döneminde öğrenilir.
5. Ağ politikası keşif döneminde küçük bir ızgaradan seçildi: öğrenme hızı 0.35, yarı ömür 270 gün. Kilo katsayıları (log-güç / kg): TB 0.100, AR 0.039.

**Değer bahsi**: model olasılığı × kapanış ganyanı ≥ 1,20 olan her ata 1 TL. Kapanış ganyanı yarıştan önce kesin bilinmediği için bu ROI gösterge niteliğindedir.

## Doğrulama dönemi (modelin hiç görmediği koşular)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 1504 | 15.2% | 41.5% | 2.233 | -28.0% | 6845 | -45.8% |
| Yalnız handikap | 1504 | 18.8% | 48.7% | 2.145 | -37.6% | 5809 | -40.7% |
| Rakip ağı rating'i | 1504 | 24.0% | 55.9% | 2.044 | -29.2% | 5506 | -40.8% |
| Ağ + pist/mesafe tercihi + kilo | 1504 | 23.7% | 56.2% | 2.043 | -33.0% | 5336 | -39.5% |
| Obsidian, piyasasız (AGF hariç) | 1504 | 29.1% | 63.2% | 1.934 | -32.7% | 3078 | -42.6% |
| Yalnız AGF | 1504 | 26.1% | 58.6% | 1.932 | -39.4% | 2439 | -39.2% |
| Obsidian, kuralsız (AGF dahil) | 1504 | 31.5% | 65.2% | 1.875 | -30.1% | 2155 | -33.5% |
| Obsidian + backtest'ten geçen kurallar | 1504 | 31.6% | 65.2% | 1.875 | -29.9% | 2154 | -33.4% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 1504 | 35.1% | 67.0% | 1.820 | -28.6% | 0 | – |

### Irka göre (doğrulama)

| Model | İngiliz: 1. tahmin | İngiliz: log-kayıp | Arap: 1. tahmin | Arap: log-kayıp |
|---|---:|---:|---:|---:|
| Rakip ağı rating'i | 25.1% | 1.969 | 22.6% | 2.141 |
| Obsidian, piyasasız (AGF hariç) | 29.4% | 1.866 | 28.6% | 2.022 |
| Obsidian, kuralsız (AGF dahil) | 32.5% | 1.803 | 30.3% | 1.970 |
| Obsidian + backtest'ten geçen kurallar | 32.6% | 1.803 | 30.3% | 1.970 |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 36.8% | 1.730 | 32.9% | 1.936 |

## Keşif dönemi (ağırlıkların öğrenildiği dönem)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 2243 | 17.4% | 44.7% | 2.219 | -37.3% | 9526 | -54.1% |
| Yalnız handikap | 2243 | 22.6% | 52.9% | 2.080 | -34.3% | 7642 | -52.7% |
| Rakip ağı rating'i | 2243 | 25.5% | 57.0% | 2.062 | -25.9% | 7426 | -54.1% |
| Ağ + pist/mesafe tercihi + kilo | 2243 | 25.4% | 57.8% | 2.049 | -28.2% | 7159 | -56.2% |
| Obsidian, piyasasız (AGF hariç) | 2243 | 31.1% | 66.4% | 1.884 | -31.8% | 3661 | -50.6% |
| Yalnız AGF | 2243 | 30.5% | 62.9% | 1.886 | -33.3% | 3081 | -62.2% |
| Obsidian, kuralsız (AGF dahil) | 2243 | 33.8% | 69.1% | 1.829 | -29.4% | 2534 | -58.2% |
| Obsidian + backtest'ten geçen kurallar | 2243 | 33.8% | 69.1% | 1.829 | -29.4% | 2533 | -58.2% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 2243 | 36.6% | 71.2% | 1.764 | -30.1% | 0 | – |

## Kural katmanı (backtest ile uygulanan kurallar)

Kullanıcı kural setindeki her kural, yarış öncesi bilgiyle (favori = AGF sırası; kapanış ganyanı yarıştan önce bilinmez) aynı sayıda AGF favorisine karşı test edilir. Kuralın modeldeki ağırlığı bu farktır (kazanma olasılığı puanı; negatif = kuralın seçtiği atlar piyasanın sandığından kötü).
- **Walk-forward'da uygulanan**: keşif döneminde Benjamini–Hochberg q < 0,10 olan kurallar (15 kural). Doğrulama dönemi bu seçimi hiç etkilemez.
- **Canlı tahminde uygulanan**: ayrıca doğrulama döneminde aynı yönde p < 0,05 tekrar eden kurallar (1 kural).
- Etki: doğrulama döneminde kurallı Obsidian log-kayıp 1.875, kuralsız 1.875; 1. tahmin 31.6% / 31.5%. Obsidian'daki kural katsayısı: -0.0142.

| Irk | Kural | Koşu (tüm) | Keşif: fark / q | Doğrulama: fark / p | Walk-forward | Canlı |
|---|---|---:|---|---|---|---|
| Arap | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 112 | -40.7% / 0.000 | -30.8% / 0.004 | ✔ | – |
| İngiliz | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 115 | -33.3% / 0.000 | -48.0% / 0.000 | ✔ | – |
| İngiliz | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 112 | -28.0% / 0.000 | -26.3% / 0.041 | ✔ | – |
| İngiliz | HAN-15 (özet): 3. handikaplı at tek | 160 | -24.1% / 0.000 | -20.8% / 0.004 | ✔ | ✔ |
| İngiliz | HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 70 | -37.3% / 0.000 | -31.6% / 0.018 | ✔ | – |
| İngiliz | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 54 | -38.6% / 0.001 | -20.0% / 0.423 | ✔ | – |
| İngiliz | HAN-16 kum: 1,2,3. handikaplar %80 | 95 | -27.4% / 0.001 | -36.4% / 0.010 | ✔ | – |
| Arap | HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 43 | -27.3% / 0.017 | +10.0% / 0.668 | ✔ | – |
| İngiliz | Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | 84 | -13.3% / 0.020 | +5.1% / 0.416 | ✔ | – |
| İngiliz | HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 78 | -20.6% / 0.020 | 0.0% / 1.000 | ✔ | – |
| Arap | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 52 | -22.7% / 0.025 | -25.0% / 0.317 | ✔ | – |
| İngiliz | HAN-16 (özet): hafif kilo favori | 105 | -14.7% / 0.039 | -5.4% / 0.597 | ✔ | – |
| Arap | HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 43 | -16.7% / 0.081 | -42.9% / 0.034 | ✔ | – |
| Arap | HAN-16 kum: 1,2,3. handikaplar %80 | 57 | -22.2% / 0.081 | -58.3% / 0.000 | ✔ | – |
| Arap | Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 68 | -16.7% / 0.098 | -25.0% / 0.042 | ✔ | – |
| İngiliz | KV-6 kum: 1,2,3. handikaplar arasında geçer | 45 | -17.6% / 0.102 | -36.4% / 0.017 | – | – |
| Arap | HAN-15 (özet): 3. handikaplı at tek | 104 | -8.2% / 0.283 | -22.6% / 0.042 | – | – |
| İngiliz | KV-6 kum: puana göre 1,2,3. atlar kazanır | 45 | -5.9% / 0.388 | -9.1% / 0.317 | – | – |
| Arap | HAN-16 (özet): hafif kilo favori | 63 | -9.5% / 0.401 | 0.0% / 1.000 | – | – |
| İngiliz | Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 52 | +6.5% / 0.706 | -4.8% / 0.711 | – | – |
| Arap | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 70 | -1.8% / 0.868 | -7.7% / 0.574 | – | – |
| İngiliz | Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 65 | 0.0% / 1.000 | -29.6% / 0.001 | – | – |

Tablo keşif q değerine göre ilk 25 test edilebilir kuralı gösterir; tamamı `data/horse/horse-model.json` içinde.

## Obsidian ağırlıkları (keşif)

Özellikler koşu içinde ortalamadan sapma olarak girer; pozitif ağırlık kazanma şansını artırır.

| Özellik | Ağırlık |
|---|---:|
| net | 0.3279 |
| rated | -0.1031 |
| kg | -0.0615 |
| handicap | 0.2806 |
| handicapMissing | 0.0011 |
| point | 0.2413 |
| surfaceAffinity | 0.1701 |
| distanceAffinity | -0.0385 |
| form | 0.148 |
| daysOff | -0.0039 |
| agf | 0.5946 |
| apprentice | -0.3347 |
| rules | -0.0142 |

## Ağ politikası ızgarası (keşif, yalnız rating)

| Öğrenme hızı | Yarı ömür (gün) | Log-kayıp | 1. tahmin |
|---:|---:|---:|---:|
| 0.35 | 270 | 2.0726 | 23.1% |
| 0.35 | 540 | 2.0756 | 23.0% |
| 0.2 | 540 | 2.0902 | 21.6% |
| 0.2 | 270 | 2.0913 | 21.9% |
| 0.6 | 270 | 2.1141 | 24.3% |
| 0.6 | 540 | 2.1299 | 24.3% |
