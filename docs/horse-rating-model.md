# At yarışı: rakip ağı rating'i ve Obsidian modeli

Veri 2021-01-01 – 2026-11-01: rating'ler tüm yurt içi hipodromlardaki 37247 sonuçlanmış koşudan öğrenilir (10733'i yalnızca ağ için: Kocaeli, Elazığ, Antalya, Şanlıurfa, Diyarbakır); değerlendirme ve ağırlıklar yalnızca İstanbul, Ankara, İzmir, Bursa ve Adana koşularında.
İngiliz + Arap. İlk 60 gün (2021-03-02 öncesi) yalnızca rating ısınması için kullanıldı.
Keşif: 2021-03-02 – 2026-01-01 öncesi (22174 koşu) · doğrulama: 2026-01-01 ve sonrası (3722 koşu).

## Yöntem

1. **Kim kimi geçti**: her geçmiş koşuda ödeme metninden bilinen ilk dereceler ve sonraki programlardan bilinen dereceler; derecesi bilinmeyen atlar bilinen ilk derecelerin arkasında sayılır.
2. **Rakip ağı rating'i** (Plackett–Luce, çevrimiçi): her koşu sonrası her at, rakiplerinin o anki gücüne göre beklenen ile gerçekleşen arasındaki fark kadar hareket eder. Güçlü atı geçmek daha çok kazandırır; güç ortak rakipler üzerinden yayılır.
3. **Pist / mesafe tercihi**: ağ içinde rakip gücüne göre düzeltilmiş pist (çim/kum/sentetik) ve mesafe (kısa ≤1300, mil ≤1600, orta ≤2000, uzun) sapmaları; ayrıca atın tüm hipodromlardaki kariyer kaydından aynı koşulda ortalama derece puanı (1/derece) eksi genel ortalaması, 3 sanal koşuyla büzülmüş.
4. **Hız puanı**: atın kendi bitiş derecesi, ırk + hipodrom + pist + mesafe için 2026-01-01 öncesi koşulardan alınan medyan dereceyle (par) karşılaştırılır ve o günün pist farkıyla (aynı gün, hipodrom ve pistteki tüm atların medyan sapması) düzeltilir; birim 1000 m başına saniye, pozitif = par'dan hızlı. 350057 koşuya puan verildi. Modele son 3 koşunun ortalaması ve son bir yıldaki son 4 koşunun en iyisi girer.
5. **Obsidian**: koşu içi softmax (koşullu logit) ile ağ rating'i, tercihler, kilo, handikap, puan, son 3 koşu formu, dinlenme, hız puanı, apranti ve yarış öncesi AGF birleştirilir. Ağırlıklar yalnız keşif döneminde öğrenilir.
6. Ağ politikası keşif döneminde küçük bir ızgaradan seçildi: öğrenme hızı 0.6, yarı ömür 540 gün. Kilo katsayıları (log-güç / kg): TB 0.082, AR 0.012.

**Değer bahsi**: model olasılığı × kapanış ganyanı ≥ 1,20 olan her ata 1 TL. Kapanış ganyanı yarıştan önce kesin bilinmediği için bu ROI gösterge niteliğindedir.

## Doğrulama dönemi (modelin hiç görmediği koşular)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 3722 | 16.6% | 43.5% | 2.225 | -33.5% | 16290 | -50.6% |
| Yalnız handikap | 3722 | 21.2% | 51.0% | 2.105 | -35.2% | 13781 | -47.7% |
| Rakip ağı rating'i | 3722 | 27.4% | 60.0% | 1.998 | -23.4% | 11548 | -44.7% |
| Ağ + pist/mesafe tercihi + kilo | 3722 | 27.2% | 60.0% | 1.998 | -25.0% | 11453 | -45.7% |
| Yalnız hız puanı | 3722 | 24.3% | 56.0% | 2.044 | -22.9% | 12093 | -42.2% |
| Obsidian, piyasasız, hız puanı olmadan | 3722 | 30.8% | 65.9% | 1.890 | -29.6% | 6344 | -43.5% |
| Obsidian, kuralsız, hız puanı olmadan | 3722 | 33.6% | 68.1% | 1.840 | -27.5% | 4420 | -43.2% |
| Obsidian, piyasasız (AGF hariç) | 3722 | 31.5% | 66.6% | 1.874 | -27.7% | 5946 | -33.3% |
| Yalnız AGF | 3722 | 28.6% | 61.1% | 1.906 | -36.1% | 5454 | -51.1% |
| Obsidian, kuralsız (AGF dahil) | 3722 | 34.0% | 68.6% | 1.828 | -25.5% | 4242 | -37.3% |
| Obsidian + backtest'ten geçen kurallar | 3722 | 34.0% | 68.6% | 1.828 | -25.6% | 4245 | -37.7% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 3722 | 36.0% | 69.5% | 1.788 | -29.4% | 0 | – |

### Irka göre (doğrulama)

| Model | İngiliz: 1. tahmin | İngiliz: log-kayıp | Arap: 1. tahmin | Arap: log-kayıp |
|---|---:|---:|---:|---:|
| Rakip ağı rating'i | 28.0% | 1.929 | 26.6% | 2.089 |
| Obsidian, piyasasız (AGF hariç) | 33.1% | 1.805 | 29.3% | 1.964 |
| Obsidian, kuralsız (AGF dahil) | 35.4% | 1.757 | 32.2% | 1.921 |
| Obsidian + backtest'ten geçen kurallar | 35.5% | 1.757 | 32.0% | 1.921 |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 38.3% | 1.709 | 33.1% | 1.892 |

## Keşif dönemi (ağırlıkların öğrenildiği dönem)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 22174 | 15.0% | 42.8% | 2.181 | -38.8% | 90209 | -47.1% |
| Yalnız handikap | 22174 | 22.3% | 53.4% | 2.051 | -33.8% | 76511 | -45.8% |
| Rakip ağı rating'i | 22174 | 26.6% | 59.0% | 1.983 | -24.5% | 67118 | -41.0% |
| Ağ + pist/mesafe tercihi + kilo | 22174 | 26.6% | 59.2% | 1.981 | -24.6% | 66503 | -40.7% |
| Yalnız hız puanı | 22174 | 24.3% | 57.7% | 2.006 | -21.4% | 69541 | -38.3% |
| Obsidian, piyasasız, hız puanı olmadan | 22174 | 30.1% | 64.7% | 1.887 | -26.2% | 48219 | -38.4% |
| Obsidian, kuralsız, hız puanı olmadan | 22174 | 33.0% | 68.0% | 1.823 | -26.6% | 31011 | -37.0% |
| Obsidian, piyasasız (AGF hariç) | 22174 | 31.0% | 65.6% | 1.865 | -22.9% | 44549 | -32.0% |
| Yalnız AGF | 22174 | 28.9% | 61.9% | 1.885 | -31.8% | 31821 | -44.7% |
| Obsidian, kuralsız (AGF dahil) | 22174 | 33.4% | 68.2% | 1.809 | -24.5% | 30015 | -29.2% |
| Obsidian + backtest'ten geçen kurallar | 22174 | 33.4% | 68.2% | 1.809 | -24.5% | 30023 | -29.0% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 22174 | 35.4% | 70.4% | 1.762 | -30.1% | 0 | – |

## Kural katmanı (backtest ile uygulanan kurallar)

Kullanıcı kural setindeki her kural, yarış öncesi bilgiyle (favori = AGF sırası; kapanış ganyanı yarıştan önce bilinmez) aynı sayıda AGF favorisine karşı test edilir. Kuralın modeldeki ağırlığı bu farktır (kazanma olasılığı puanı; negatif = kuralın seçtiği atlar piyasanın sandığından kötü).
- **Walk-forward'da uygulanan**: keşif döneminde Benjamini–Hochberg q < 0,10 olan kurallar (50 kural). Doğrulama dönemi bu seçimi hiç etkilemez.
- **Canlı tahminde uygulanan**: ayrıca doğrulama döneminde aynı yönde p < 0,05 tekrar eden kurallar (17 kural).
- Etki: doğrulama döneminde kurallı Obsidian log-kayıp 1.828, kuralsız 1.828; 1. tahmin 34.0% / 34.0%. Obsidian'daki kural katsayısı: -0.0504.

| Irk | Kural | Koşu (tüm) | Keşif: fark / q | Doğrulama: fark / p | Walk-forward | Canlı |
|---|---|---:|---|---|---|---|
| İngiliz | Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 289 | -39.0% / 0.000 | +4.2% / 0.672 | ✔ | – |
| İngiliz | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 518 | -35.4% / 0.000 | -35.2% / 0.000 | ✔ | ✔ |
| İngiliz | Şartlı 5 çim: %40 hafif kg'lar kazanır | 258 | -42.6% / 0.000 | -53.6% / 0.000 | ✔ | – |
| İngiliz | HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 336 | -38.8% / 0.000 | -31.1% / 0.001 | ✔ | ✔ |
| İngiliz | HAN-15 (özet): 3. handikaplı at tek | 891 | -21.6% / 0.000 | -19.1% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 490 | -36.9% / 0.000 | -31.0% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 5 çim: %40 hafif kg'lar kazanır | 244 | -44.9% / 0.000 | -21.4% / 0.173 | ✔ | – |
| İngiliz | HAN-16 çim: %30 7,8,9 numaralar | 313 | -33.8% / 0.000 | -36.6% / 0.000 | ✔ | ✔ |
| Arap | HAN-15 (özet): 3. handikaplı at tek | 726 | -17.4% / 0.000 | -13.1% / 0.037 | ✔ | ✔ |
| İngiliz | Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 100 | -51.0% / 0.000 | +50.0% / 0.317 | ✔ | – |
| Arap | HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 286 | -33.6% / 0.000 | -30.0% / 0.019 | ✔ | ✔ |
| İngiliz | HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 159 | -40.3% / 0.000 | -6.7% / 0.747 | ✔ | – |
| İngiliz | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 506 | -22.1% / 0.000 | -22.2% / 0.000 | ✔ | ✔ |
| Arap | HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 254 | -27.5% / 0.000 | -15.6% / 0.192 | ✔ | – |
| Arap | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 402 | -21.3% / 0.000 | -7.3% / 0.372 | ✔ | – |
| Arap | Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 55 | -50.0% / 0.000 | -38.5% / 0.006 | ✔ | – |
| İngiliz | HAN-16 kum: 1,2,3. handikaplar %80 | 420 | -21.0% / 0.000 | -36.1% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 324 | -21.7% / 0.000 | -36.2% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 425 | -19.5% / 0.000 | -16.4% / 0.044 | ✔ | ✔ |
| İngiliz | Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 281 | -25.8% / 0.000 | -14.3% / 0.317 | ✔ | – |
| Arap | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 273 | -23.2% / 0.000 | -27.5% / 0.004 | ✔ | ✔ |
| İngiliz | Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 398 | -19.6% / 0.000 | -16.1% / 0.044 | ✔ | ✔ |
| Arap | HAN-16 çim: %30 7,8,9 numaralar | 265 | -26.6% / 0.000 | -43.8% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 325 | -20.9% / 0.000 | -11.3% / 0.191 | ✔ | – |
| Arap | Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 121 | -31.4% / 0.000 | -25.0% / 0.083 | ✔ | – |

Tablo keşif q değerine göre ilk 25 test edilebilir kuralı gösterir; tamamı `data/horse/horse-model.json` içinde.

## Obsidian ağırlıkları (keşif)

Özellikler koşu içinde ortalamadan sapma olarak girer; pozitif ağırlık kazanma şansını artırır.

| Özellik | Ağırlık |
|---|---:|
| net | 0.2631 |
| rated | -0.3454 |
| kg | -0.0617 |
| handicap | 0.2282 |
| handicapMissing | -0.0171 |
| point | 0.1701 |
| surfaceAffinity | 0.1655 |
| distanceAffinity | 0.0457 |
| form | 0.0188 |
| daysOff | -0.0564 |
| speedAvg | 0.0612 |
| speedBest | 0.2139 |
| speedMissing | -0.2495 |
| agf | 0.6346 |
| apprentice | -0.3015 |
| rules | -0.0504 |

## Ağ politikası ızgarası (keşif, yalnız rating)

| Öğrenme hızı | Yarı ömür (gün) | Log-kayıp | 1. tahmin |
|---:|---:|---:|---:|
| 0.6 | 540 | 2.0003 | 26.0% |
| 0.35 | 540 | 2.0006 | 25.3% |
| 0.6 | 270 | 2.0045 | 25.7% |
| 0.35 | 270 | 2.011 | 24.8% |
| 0.2 | 540 | 2.0395 | 23.9% |
| 0.2 | 270 | 2.0488 | 23.3% |
