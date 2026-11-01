# At yarışı: rakip ağı rating'i ve Obsidian modeli

Veri 2024-01-01 – 2026-10-31: rating'ler tüm yurt içi hipodromlardaki 18328 sonuçlanmış koşudan öğrenilir (5541'i yalnızca ağ için: Kocaeli, Elazığ, Antalya, Şanlıurfa, Diyarbakır); değerlendirme ve ağırlıklar yalnızca İstanbul, Ankara, İzmir, Bursa ve Adana koşularında.
İngiliz + Arap. İlk 60 gün (2024-03-01 öncesi) yalnızca rating ısınması için kullanıldı.
Keşif: 2024-03-01 – 2026-01-01 öncesi (8492 koşu) · doğrulama: 2026-01-01 ve sonrası (3705 koşu).

## Yöntem

1. **Kim kimi geçti**: her geçmiş koşuda ödeme metninden bilinen ilk dereceler ve sonraki programlardan bilinen dereceler; derecesi bilinmeyen atlar bilinen ilk derecelerin arkasında sayılır.
2. **Rakip ağı rating'i** (Plackett–Luce, çevrimiçi): her koşu sonrası her at, rakiplerinin o anki gücüne göre beklenen ile gerçekleşen arasındaki fark kadar hareket eder. Güçlü atı geçmek daha çok kazandırır; güç ortak rakipler üzerinden yayılır.
3. **Pist / mesafe tercihi**: ağ içinde rakip gücüne göre düzeltilmiş pist (çim/kum/sentetik) ve mesafe (kısa ≤1300, mil ≤1600, orta ≤2000, uzun) sapmaları; ayrıca atın tüm hipodromlardaki kariyer kaydından aynı koşulda ortalama derece puanı (1/derece) eksi genel ortalaması, 3 sanal koşuyla büzülmüş.
4. **Obsidian**: koşu içi softmax (koşullu logit) ile ağ rating'i, tercihler, kilo, handikap, puan, son 3 koşu formu, dinlenme, apranti ve yarış öncesi AGF birleştirilir. Ağırlıklar yalnız keşif döneminde öğrenilir.
5. Ağ politikası keşif döneminde küçük bir ızgaradan seçildi: öğrenme hızı 0.35, yarı ömür 540 gün. Kilo katsayıları (log-güç / kg): TB 0.083, AR 0.024.

**Değer bahsi**: model olasılığı × kapanış ganyanı ≥ 1,20 olan her ata 1 TL. Kapanış ganyanı yarıştan önce kesin bilinmediği için bu ROI gösterge niteliğindedir.

## Doğrulama dönemi (modelin hiç görmediği koşular)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 3705 | 16.6% | 43.5% | 2.225 | -33.8% | 16203 | -50.3% |
| Yalnız handikap | 3705 | 21.2% | 51.1% | 2.105 | -35.1% | 13503 | -47.7% |
| Rakip ağı rating'i | 3705 | 26.3% | 60.0% | 2.005 | -25.7% | 12156 | -46.3% |
| Ağ + pist/mesafe tercihi + kilo | 3705 | 26.6% | 59.6% | 2.005 | -25.7% | 11922 | -47.5% |
| Obsidian, piyasasız (AGF hariç) | 3705 | 30.5% | 65.2% | 1.894 | -31.0% | 6140 | -44.0% |
| Yalnız AGF | 3705 | 28.5% | 61.1% | 1.907 | -36.2% | 5438 | -51.2% |
| Obsidian, kuralsız (AGF dahil) | 3705 | 33.5% | 67.9% | 1.843 | -27.8% | 4338 | -42.9% |
| Obsidian + backtest'ten geçen kurallar | 3705 | 33.5% | 67.9% | 1.843 | -27.7% | 4341 | -43.0% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 3705 | 36.0% | 69.4% | 1.789 | -29.5% | 0 | – |

### Irka göre (doğrulama)

| Model | İngiliz: 1. tahmin | İngiliz: log-kayıp | Arap: 1. tahmin | Arap: log-kayıp |
|---|---:|---:|---:|---:|
| Rakip ağı rating'i | 27.4% | 1.935 | 24.8% | 2.098 |
| Obsidian, piyasasız (AGF hariç) | 31.7% | 1.826 | 28.9% | 1.984 |
| Obsidian, kuralsız (AGF dahil) | 35.5% | 1.771 | 31.0% | 1.937 |
| Obsidian + backtest'ten geçen kurallar | 35.5% | 1.771 | 30.9% | 1.937 |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 38.3% | 1.709 | 33.0% | 1.893 |

## Keşif dönemi (ağırlıkların öğrenildiği dönem)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 8492 | 15.4% | 43.3% | 2.170 | -34.5% | 36277 | -41.3% |
| Yalnız handikap | 8492 | 22.3% | 53.4% | 2.041 | -29.2% | 31516 | -40.0% |
| Rakip ağı rating'i | 8492 | 25.8% | 57.9% | 1.990 | -22.4% | 28828 | -38.2% |
| Ağ + pist/mesafe tercihi + kilo | 8492 | 25.8% | 58.4% | 1.985 | -23.0% | 28493 | -38.0% |
| Obsidian, piyasasız (AGF hariç) | 8492 | 30.2% | 64.4% | 1.876 | -22.3% | 20680 | -33.4% |
| Yalnız AGF | 8492 | 29.0% | 61.8% | 1.882 | -28.2% | 13724 | -37.8% |
| Obsidian, kuralsız (AGF dahil) | 8492 | 33.2% | 68.0% | 1.816 | -23.3% | 14105 | -29.6% |
| Obsidian + backtest'ten geçen kurallar | 8492 | 33.2% | 68.0% | 1.816 | -23.4% | 14125 | -30.0% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 8492 | 35.5% | 70.4% | 1.755 | -27.9% | 0 | – |

## Kural katmanı (backtest ile uygulanan kurallar)

Kullanıcı kural setindeki her kural, yarış öncesi bilgiyle (favori = AGF sırası; kapanış ganyanı yarıştan önce bilinmez) aynı sayıda AGF favorisine karşı test edilir. Kuralın modeldeki ağırlığı bu farktır (kazanma olasılığı puanı; negatif = kuralın seçtiği atlar piyasanın sandığından kötü).
- **Walk-forward'da uygulanan**: keşif döneminde Benjamini–Hochberg q < 0,10 olan kurallar (34 kural). Doğrulama dönemi bu seçimi hiç etkilemez.
- **Canlı tahminde uygulanan**: ayrıca doğrulama döneminde aynı yönde p < 0,05 tekrar eden kurallar (16 kural).
- Etki: doğrulama döneminde kurallı Obsidian log-kayıp 1.843, kuralsız 1.843; 1. tahmin 33.5% / 33.5%. Obsidian'daki kural katsayısı: 0.0711.

| Irk | Kural | Koşu (tüm) | Keşif: fark / q | Doğrulama: fark / p | Walk-forward | Canlı |
|---|---|---:|---|---|---|---|
| İngiliz | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 271 | -37.2% / 0.000 | -35.2% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 251 | -44.0% / 0.000 | -30.1% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-15 (özet): 3. handikaplı at tek | 416 | -23.2% / 0.000 | -19.1% / 0.000 | ✔ | ✔ |
| İngiliz | Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 36 | -64.7% / 0.000 | +50.0% / 0.317 | ✔ | – |
| İngiliz | Şartlı 5 çim: %40 hafif kg'lar kazanır | 116 | -46.6% / 0.000 | -53.6% / 0.000 | ✔ | – |
| İngiliz | HAN-16 çim: %30 7,8,9 numaralar | 150 | -39.4% / 0.000 | -36.6% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-17 çim: hafif kg'lı atlar çok şanslı | 43 | -57.6% / 0.000 | -80.0% / 0.000 | ✔ | – |
| Arap | Şartlı 5 çim: %40 hafif kg'lar kazanır | 112 | -40.5% / 0.000 | -21.4% / 0.173 | ✔ | – |
| İngiliz | Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 134 | -39.5% / 0.000 | +4.2% / 0.672 | ✔ | – |
| Arap | HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 120 | -38.9% / 0.000 | -30.0% / 0.019 | ✔ | ✔ |
| Arap | HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 45 | -45.7% / 0.000 | -40.0% / 0.070 | ✔ | – |
| İngiliz | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 152 | -28.6% / 0.000 | -36.2% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 63 | -43.8% / 0.000 | -6.7% / 0.747 | ✔ | – |
| İngiliz | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 258 | -22.6% / 0.000 | -22.2% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 162 | -27.0% / 0.000 | -11.3% / 0.191 | ✔ | – |
| Arap | Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 215 | -20.6% / 0.000 | -16.4% / 0.044 | ✔ | ✔ |
| Arap | Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 56 | -42.5% / 0.000 | -25.0% / 0.083 | ✔ | – |
| İngiliz | HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 146 | -31.7% / 0.000 | -31.1% / 0.001 | ✔ | ✔ |
| Arap | HAN-16 çim: %30 7,8,9 numaralar | 117 | -28.2% / 0.000 | -43.8% / 0.000 | ✔ | ✔ |
| Arap | HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 110 | -28.2% / 0.000 | -15.6% / 0.192 | ✔ | – |
| Arap | HAN-15 (özet): 3. handikaplı at tek | 323 | -13.8% / 0.000 | -13.1% / 0.037 | ✔ | ✔ |
| Arap | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 135 | -24.2% / 0.000 | -27.5% / 0.004 | ✔ | ✔ |
| İngiliz | Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 127 | -22.6% / 0.001 | -14.3% / 0.317 | ✔ | – |
| İngiliz | Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 208 | -16.4% / 0.001 | -16.1% / 0.044 | ✔ | ✔ |
| Arap | HAN-16 kum: 1,2,3. handikaplar %80 | 150 | -22.2% / 0.002 | -47.6% / 0.000 | ✔ | ✔ |

Tablo keşif q değerine göre ilk 25 test edilebilir kuralı gösterir; tamamı `data/horse/horse-model.json` içinde.

## Obsidian ağırlıkları (keşif)

Özellikler koşu içinde ortalamadan sapma olarak girer; pozitif ağırlık kazanma şansını artırır.

| Özellik | Ağırlık |
|---|---:|
| net | 0.4537 |
| rated | -0.315 |
| kg | -0.0592 |
| handicap | 0.2966 |
| handicapMissing | -0.1673 |
| point | 0.222 |
| surfaceAffinity | 0.1289 |
| distanceAffinity | -0.0106 |
| form | 0.1089 |
| daysOff | -0.0405 |
| agf | 0.6436 |
| apprentice | -0.3301 |
| rules | 0.0711 |

## Ağ politikası ızgarası (keşif, yalnız rating)

| Öğrenme hızı | Yarı ömür (gün) | Log-kayıp | 1. tahmin |
|---:|---:|---:|---:|
| 0.35 | 540 | 2.0002 | 25.0% |
| 0.35 | 270 | 2.0056 | 24.9% |
| 0.6 | 270 | 2.0103 | 25.8% |
| 0.6 | 540 | 2.0143 | 25.8% |
| 0.2 | 540 | 2.0326 | 23.7% |
| 0.2 | 270 | 2.039 | 23.3% |
