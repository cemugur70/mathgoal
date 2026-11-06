# At yarışı: rakip ağı rating'i ve Obsidian modeli

Veri 2021-01-01 – 2026-11-05: rating'ler tüm yurt içi hipodromlardaki 37316 sonuçlanmış koşudan öğrenilir (10757'i yalnızca ağ için: Kocaeli, Elazığ, Antalya, Şanlıurfa, Diyarbakır); değerlendirme ve ağırlıklar yalnızca İstanbul, Ankara, İzmir, Bursa ve Adana koşularında.
İngiliz + Arap. İlk 60 gün (2021-03-02 öncesi) yalnızca rating ısınması için kullanıldı.
Keşif: 2021-03-02 – 2026-01-01 öncesi (22174 koşu) · doğrulama: 2026-01-01 ve sonrası (3767 koşu).

## Yöntem

1. **Kim kimi geçti**: her geçmiş koşuda ödeme metninden bilinen ilk dereceler ve sonraki programlardan bilinen dereceler; derecesi bilinmeyen atlar bilinen ilk derecelerin arkasında sayılır.
2. **Rakip ağı rating'i** (Plackett–Luce, çevrimiçi): her koşu sonrası her at, rakiplerinin o anki gücüne göre beklenen ile gerçekleşen arasındaki fark kadar hareket eder. Güçlü atı geçmek daha çok kazandırır; güç ortak rakipler üzerinden yayılır.
3. **Pist / mesafe tercihi**: ağ içinde rakip gücüne göre düzeltilmiş pist (çim/kum/sentetik) ve mesafe (kısa ≤1300, mil ≤1600, orta ≤2000, uzun) sapmaları; ayrıca atın tüm hipodromlardaki kariyer kaydından aynı koşulda ortalama derece puanı (1/derece) eksi genel ortalaması, 3 sanal koşuyla büzülmüş.
4. **Hız puanı**: atın kendi bitiş derecesi, ırk + hipodrom + pist + mesafe için 2026-01-01 öncesi koşulardan alınan medyan dereceyle (par) karşılaştırılır ve o günün pist farkıyla (aynı gün, hipodrom ve pistteki tüm atların medyan sapması) düzeltilir; birim 1000 m başına saniye, pozitif = par'dan hızlı. 350711 koşuya puan verildi. Modele son 3 koşunun ortalaması ve son bir yıldaki son 4 koşunun en iyisi girer.
5. **Obsidian**: koşu içi softmax (koşullu logit) ile ağ rating'i, tercihler, kilo, handikap, puan, son 3 koşu formu, dinlenme, hız puanı, apranti, jokey ve antrenör formu (atlı sayısına göre beklenen galibiyete oranı, bir yıllık yarı ömür), jokeyin bindiği atın AGF payının üstünde kazanması (genel ve ırka göre), son koşuya göre mesafe değişimi, koşulan pistteki ayrıntılı kayıt (kazanma ve ilk 3 oranı, o pistteki koşu sayısı, en iyi diğer pistle fark, son koşudan bu yana pist değişimi), babanın yavrularının bu pist tercihi, galop (antrenman) dereceleri ve yarış öncesi AGF birleştirilir. Galop puanı, son 45 gündeki galopların aynı tür galopların 2026 öncesi ortancasından yüzde kaç hızlı olduğudur; galop sayısı ve son galoptan bu yana geçen gün de ayrı özelliktir. Sürprize açık koşularda (handikap veya 11+ atlı) AGF ve ağ rating'i ayrı bir ağırlık daha alır. Ağırlıklar yalnız keşif döneminde öğrenilir; L2 cezası her özelliğin standart sapmasına göre uygulanır, böylece dar ölçekli özellikler (form, pist tercihi) orantısız bastırılmaz.
6. **Piyasa sentezi**: Obsidian olasılığı ile AGF payı ikinci aşamada p^α · AGF^θ biçiminde birleştirilip koşu içinde 1'e tamamlanır. Doğrulama için ağırlıklar 2025-01-01 öncesinde, üsler 2025-01-01 – 2026-01-01 arasında öğrenildi (α 0.4819, θ 0.5192); canlı koşular için üsler doğrulama döneminden öğrenildi (α 0.3676, θ 0.5992). AGF'si olmayan koşularda uygulanmaz; onlarda piyasasız olasılık kullanılır. Sürpriz riski ve adayları sentez öncesi olasılığı kullanır. Sitede kullanılan son aşama raporun sonundaki ağaç katmanıdır.
7. Ağ politikası keşif döneminde küçük bir ızgaradan seçildi: öğrenme hızı 0.6, yarı ömür 540 gün. Kilo katsayıları (log-güç / kg): TB 0.018, AR -0.027.

**Değer bahsi**: model olasılığı × kapanış ganyanı ≥ 1,20 olan her ata 1 TL. Kapanış ganyanı yarıştan önce kesin bilinmediği için bu ROI gösterge niteliğindedir.

## Doğrulama dönemi (modelin hiç görmediği koşular)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 3767 | 16.6% | 43.5% | 2.226 | -33.7% | 16487 | -50.3% |
| Yalnız handikap | 3767 | 21.2% | 51.0% | 2.107 | -35.4% | 13961 | -46.9% |
| Rakip ağı rating'i | 3767 | 27.8% | 59.6% | 1.999 | -22.5% | 11589 | -43.8% |
| Ağ + pist/mesafe tercihi + kilo | 3767 | 27.0% | 60.0% | 1.994 | -25.7% | 11441 | -44.2% |
| Yalnız hız puanı | 3767 | 24.5% | 55.8% | 2.045 | -22.4% | 12249 | -41.9% |
| Obsidian, piyasasız, hız puanı olmadan | 3767 | 32.2% | 66.2% | 1.859 | -26.0% | 5528 | -27.8% |
| Obsidian, kuralsız, hız puanı olmadan | 3767 | 33.9% | 68.5% | 1.820 | -26.2% | 4214 | -36.6% |
| Obsidian, piyasasız (AGF hariç) | 3767 | 33.1% | 67.3% | 1.838 | -23.1% | 5111 | -19.1% |
| Yalnız AGF | 3767 | 28.6% | 61.1% | 1.906 | -36.1% | 5530 | -49.8% |
| Obsidian, kuralsız (AGF dahil) | 3767 | 34.6% | 69.2% | 1.805 | -23.0% | 3997 | -30.0% |
| Obsidian, kuralsız, ilk özellik seti (jokey/antrenör, galop ve pist kaydı olmadan) | 3767 | 34.3% | 69.2% | 1.827 | -23.7% | 4272 | -35.1% |
| Obsidian + kurallar, ayrıntılı pist kaydı ve baba pist tercihi olmadan | 3767 | 34.5% | 69.1% | 1.808 | -23.2% | 4021 | -28.6% |
| Obsidian + kurallar, jokey AGF üstü başarısı olmadan | 3767 | 34.3% | 69.3% | 1.807 | -24.2% | 3911 | -27.2% |
| Obsidian + kurallar, galop olmadan | 3767 | 34.5% | 69.3% | 1.813 | -22.5% | 4025 | -29.6% |
| Obsidian + backtest'ten geçen kurallar | 3767 | 34.6% | 69.2% | 1.805 | -23.0% | 3993 | -29.7% |
| Obsidian + AGF sentezi; AGF yoksa piyasasız | 3767 | 34.5% | 69.0% | 1.780 | -26.9% | 1958 | -21.4% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 3767 | 36.1% | 69.5% | 1.789 | -29.3% | 0 | – |

### Irka göre (doğrulama)

| Model | İngiliz: 1. tahmin | İngiliz: log-kayıp | Arap: 1. tahmin | Arap: log-kayıp |
|---|---:|---:|---:|---:|
| Rakip ağı rating'i | 28.4% | 1.928 | 26.9% | 2.092 |
| Obsidian, piyasasız (AGF hariç) | 34.9% | 1.760 | 30.6% | 1.941 |
| Obsidian, kuralsız (AGF dahil) | 36.9% | 1.728 | 31.7% | 1.907 |
| Obsidian + backtest'ten geçen kurallar | 36.9% | 1.728 | 31.7% | 1.907 |
| Obsidian + AGF sentezi; AGF yoksa piyasasız | 36.2% | 1.704 | 32.4% | 1.880 |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 38.4% | 1.707 | 33.0% | 1.896 |

## Keşif dönemi (ağırlıkların öğrenildiği dönem)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 22174 | 15.0% | 42.8% | 2.181 | -38.8% | 90209 | -47.1% |
| Yalnız handikap | 22174 | 22.3% | 53.4% | 2.051 | -33.8% | 76569 | -45.7% |
| Rakip ağı rating'i | 22174 | 26.6% | 59.1% | 1.983 | -24.6% | 66823 | -41.0% |
| Ağ + pist/mesafe tercihi + kilo | 22174 | 26.7% | 59.2% | 1.978 | -25.3% | 65795 | -40.5% |
| Yalnız hız puanı | 22174 | 24.3% | 57.7% | 2.006 | -21.4% | 69691 | -38.1% |
| Obsidian, piyasasız, hız puanı olmadan | 22174 | 31.1% | 66.6% | 1.851 | -25.5% | 40828 | -34.2% |
| Obsidian, kuralsız, hız puanı olmadan | 22174 | 33.4% | 68.7% | 1.805 | -25.4% | 29055 | -30.3% |
| Obsidian, piyasasız (AGF hariç) | 22174 | 31.9% | 67.6% | 1.826 | -23.1% | 36936 | -25.6% |
| Yalnız AGF | 22174 | 28.9% | 61.9% | 1.885 | -31.8% | 31752 | -44.7% |
| Obsidian, kuralsız (AGF dahil) | 22174 | 33.8% | 69.3% | 1.789 | -23.3% | 27493 | -22.6% |
| Obsidian, kuralsız, ilk özellik seti (jokey/antrenör, galop ve pist kaydı olmadan) | 22174 | 33.6% | 68.2% | 1.807 | -24.0% | 29722 | -29.0% |
| Obsidian + kurallar, ayrıntılı pist kaydı ve baba pist tercihi olmadan | 22174 | 33.8% | 69.1% | 1.790 | -23.3% | 27502 | -23.1% |
| Obsidian + kurallar, jokey AGF üstü başarısı olmadan | 22174 | 33.8% | 69.2% | 1.790 | -24.0% | 27245 | -23.2% |
| Obsidian + kurallar, galop olmadan | 22174 | 33.8% | 68.6% | 1.795 | -23.9% | 28038 | -24.9% |
| Obsidian + backtest'ten geçen kurallar | 22174 | 33.8% | 69.3% | 1.789 | -23.3% | 27483 | -22.3% |
| Obsidian + AGF sentezi; AGF yoksa piyasasız | 22174 | 34.3% | 69.7% | 1.767 | -25.3% | 15885 | -17.9% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 22174 | 35.4% | 70.4% | 1.762 | -30.1% | 0 | – |

## Sürpriz modeli

Sürpriz = kazananın kapanış ganyanı ≥ 10 TL. Oranlar beş şehirdeki koşulardan; keşif 2021-03-02 – 2026-01-01 öncesi, doğrulama 2026-01-01 ve sonrası.

### Koşu ailesi

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| Handikap | 6160 | 16.9% | 1021 | 18.7% |
| Satış | 842 | 16.0% | 149 | 15.4% |
| Grup / kupa | 813 | 14.4% | 127 | 11.8% |
| Maiden | 4108 | 13.5% | 725 | 14.8% |
| Şartlı | 7398 | 11.4% | 1206 | 11.6% |
| KV | 2835 | 9.6% | 524 | 8.4% |

### Atlı sayısı

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| 14+ atlı | 1789 | 25.2% | 511 | 25.0% |
| 11–13 atlı | 5418 | 19.0% | 904 | 19.5% |
| 8–10 atlı | 8279 | 13.2% | 1321 | 12.1% |
| ≤7 atlı | 6684 | 5.9% | 1030 | 5.4% |

### Irk × koşu ailesi

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| Arap Handikap | 2842 | 20.3% | 458 | 21.6% |
| Arap Satış | 320 | 17.5% | 45 | 20.0% |
| İngiliz Satış | 522 | 15.1% | 104 | 13.5% |
| İngiliz Grup / kupa | 523 | 14.5% | 84 | 8.3% |
| Arap Grup / kupa | 290 | 14.1% | 43 | 18.6% |
| İngiliz Handikap | 3318 | 13.9% | 563 | 16.3% |
| Arap Maiden | 2057 | 13.7% | 349 | 16.9% |
| Arap Şartlı | 3356 | 13.6% | 532 | 14.7% |
| İngiliz Maiden | 2051 | 13.3% | 376 | 12.8% |
| Arap KV | 1064 | 11.2% | 197 | 10.2% |
| İngiliz Şartlı | 4042 | 9.7% | 674 | 9.2% |
| İngiliz KV | 1771 | 8.6% | 327 | 7.3% |

### Irk × atlı sayısı

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| Arap 14+ atlı | 1039 | 26.9% | 309 | 26.5% |
| İngiliz 14+ atlı | 750 | 22.9% | 202 | 22.8% |
| Arap 11–13 atlı | 3130 | 19.8% | 518 | 21.6% |
| İngiliz 11–13 atlı | 2288 | 17.9% | 386 | 16.6% |
| Arap 8–10 atlı | 3748 | 13.6% | 568 | 11.8% |
| İngiliz 8–10 atlı | 4531 | 12.8% | 753 | 12.4% |
| Arap ≤7 atlı | 2018 | 6.2% | 234 | 5.1% |
| İngiliz ≤7 atlı | 4666 | 5.8% | 796 | 5.5% |

### Pist

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| Çim | 9039 | 14.3% | 1206 | 16.9% |
| Kum | 9810 | 12.9% | 1915 | 11.6% |
| Sentetik | 3321 | 12.4% | 645 | 14.6% |

### Koşu başına sürpriz riski (doğrulama)

Yarış öncesi bilgiyle lojistik model: atlı sayısı, koşu ailesi, ırk, pist, AGF favorisinin payı, kazanma modelinin en yüksek olasılığı ve olasılıkların dağınıklığı. Ağırlıklar keşifte öğrenildi. Doğrulamada AUC 0.686 (0,5 = şans), Brier 0.113 (sabit oranla 0.119).

| Risk | Koşu | Gerçek sürpriz | Tahmin edilen |
|---|---:|---:|---:|
| yüksek | 539 | 28.8% | 28.0% |
| orta | 1462 | 16.5% | 16.1% |
| düşük | 1765 | 7.0% | 7.9% |

### Sürpriz adayları

AGF'de ilk 3'te olmayan, kazanma olasılığı ≥ %8 ve AGF payının ≥ 1.5 katı olan atlar. Eşik keşif döneminde seçildi (en az 500 bahis, en yüksek ROI). ROI kapanış ganyanıyla, at başına 1 TL.

| Küme | Bahis | Kazandı | Kazanma | ROI |
|---|---:|---:|---:|---:|
| Keşif: adaylar | 3122 | 316 | 10.1% | -8.3% |
| Doğrulama: adaylar | 452 | 42 | 9.3% | -20.5% |
| Doğrulama: adaylar, orta/yüksek riskli koşular | 286 | 25 | 8.7% | -18.3% |
| Doğrulama: AGF ilk 3 dışındaki tüm atlar | 17208 | 801 | 4.7% | -44.5% |

## Kural katmanı (backtest ile uygulanan kurallar)

Kullanıcı kural setindeki her kural, yarış öncesi bilgiyle (favori = AGF sırası; kapanış ganyanı yarıştan önce bilinmez) aynı sayıda AGF favorisine karşı test edilir. Kuralın modeldeki ağırlığı bu farktır (kazanma olasılığı puanı; negatif = kuralın seçtiği atlar piyasanın sandığından kötü).
- **Walk-forward'da uygulanan**: keşif döneminde Benjamini–Hochberg q < 0,10 olan kurallar (50 kural). Doğrulama dönemi bu seçimi hiç etkilemez.
- **Canlı tahminde uygulanan**: ayrıca doğrulama döneminde aynı yönde p < 0,05 tekrar eden kurallar (17 kural).
- Etki: doğrulama döneminde kurallı Obsidian log-kayıp 1.805, kuralsız 1.805; 1. tahmin 34.6% / 34.6%. Obsidian'daki kural katsayısı: -0.1137.

| Irk | Kural | Koşu (tüm) | Keşif: fark / q | Doğrulama: fark / p | Walk-forward | Canlı |
|---|---|---:|---|---|---|---|
| İngiliz | Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 289 | -39.0% / 0.000 | +4.2% / 0.672 | ✔ | – |
| İngiliz | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 519 | -35.4% / 0.000 | -34.8% / 0.000 | ✔ | ✔ |
| İngiliz | Şartlı 5 çim: %40 hafif kg'lar kazanır | 258 | -42.6% / 0.000 | -53.6% / 0.000 | ✔ | – |
| İngiliz | HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 336 | -38.8% / 0.000 | -31.1% / 0.001 | ✔ | ✔ |
| İngiliz | HAN-15 (özet): 3. handikaplı at tek | 893 | -21.6% / 0.000 | -18.1% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 490 | -36.9% / 0.000 | -31.0% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 5 çim: %40 hafif kg'lar kazanır | 244 | -44.9% / 0.000 | -21.4% / 0.173 | ✔ | – |
| İngiliz | HAN-16 çim: %30 7,8,9 numaralar | 313 | -33.8% / 0.000 | -36.6% / 0.000 | ✔ | ✔ |
| Arap | HAN-15 (özet): 3. handikaplı at tek | 726 | -17.4% / 0.000 | -13.1% / 0.037 | ✔ | ✔ |
| İngiliz | Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 100 | -51.0% / 0.000 | +50.0% / 0.317 | ✔ | – |
| Arap | HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 286 | -33.6% / 0.000 | -30.0% / 0.019 | ✔ | ✔ |
| İngiliz | HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 159 | -40.3% / 0.000 | -6.7% / 0.747 | ✔ | – |
| İngiliz | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 507 | -22.1% / 0.000 | -22.0% / 0.000 | ✔ | ✔ |
| Arap | HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 255 | -27.5% / 0.000 | -18.2% / 0.126 | ✔ | – |
| Arap | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 402 | -21.3% / 0.000 | -7.3% / 0.372 | ✔ | – |
| Arap | Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 55 | -50.0% / 0.000 | -38.5% / 0.006 | ✔ | – |
| İngiliz | HAN-16 kum: 1,2,3. handikaplar %80 | 420 | -21.0% / 0.000 | -36.1% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 326 | -21.7% / 0.000 | -34.7% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 425 | -19.5% / 0.000 | -16.4% / 0.044 | ✔ | ✔ |
| İngiliz | Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 281 | -25.8% / 0.000 | -14.3% / 0.317 | ✔ | – |
| Arap | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 274 | -23.2% / 0.000 | -24.4% / 0.012 | ✔ | ✔ |
| İngiliz | Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 398 | -19.6% / 0.000 | -16.1% / 0.044 | ✔ | ✔ |
| Arap | HAN-16 çim: %30 7,8,9 numaralar | 265 | -26.6% / 0.000 | -43.8% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 325 | -20.9% / 0.000 | -11.3% / 0.191 | ✔ | – |
| Arap | Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 121 | -31.4% / 0.000 | -25.0% / 0.083 | ✔ | – |

Tablo keşif q değerine göre ilk 25 test edilebilir kuralı gösterir; tamamı `data/horse/horse-model.json` içinde.

## Obsidian ağırlıkları (keşif)

Özellikler koşu içinde ortalamadan sapma olarak girer; pozitif ağırlık kazanma şansını artırır.

| Özellik | Ağırlık |
|---|---:|
| net | 0.2472 |
| rated | -0.4052 |
| kg | -0.0693 |
| handicap | 0.2535 |
| handicapMissing | -0.0483 |
| point | 0.1298 |
| surfaceAffinity | 1.0699 |
| distanceAffinity | 0.2144 |
| form | -0.0314 |
| daysOff | -0.1177 |
| speedAvg | 0.0646 |
| speedBest | 0.2376 |
| speedMissing | -0.9108 |
| agf | 0.5148 |
| apprentice | -0.2097 |
| jockey | 0.1775 |
| trainer | 0.2581 |
| distanceChange | -0.4239 |
| agfOpen | 0.0725 |
| netOpen | -0.0118 |
| rules | -0.1137 |
| gallopBest | 0.1125 |
| gallopAvg | 0.1191 |
| gallopCount | 0.1263 |
| gallopDays | -0.0026 |
| gallopMissing | -0.0096 |
| jockeyEdge | 0.4874 |
| jockeyBreed | 0.2525 |
| surfaceWin | 0.0037 |
| surfaceTop3 | 0.0814 |
| surfaceStarts | -0.0706 |
| surfaceGap | -0.054 |
| surfaceSwitch | -0.104 |
| switchAffinity | 0.2578 |
| sireSurface | 1.9384 |

## Ağ politikası ızgarası (keşif, yalnız rating)

| Öğrenme hızı | Yarı ömür (gün) | Log-kayıp | 1. tahmin |
|---:|---:|---:|---:|
| 0.6 | 540 | 2.0003 | 26.0% |
| 0.35 | 540 | 2.0006 | 25.3% |
| 0.6 | 270 | 2.0045 | 25.7% |
| 0.35 | 270 | 2.011 | 24.8% |
| 0.2 | 540 | 2.0395 | 23.9% |
| 0.2 | 270 | 2.0488 | 23.3% |

<!-- agac-katmani -->
## Ağaç katmanı (sitede kullanılan)

Koşu içinde gruplanmış gradient boosting (derinlik 4, öğrenme hızı 0.03). Amaç fonksiyonu Plackett–Luce: bilinen ilk 4 derece, derecesi bilinmeyen atlar yalnız kalan aşamalarda rakip sayılır. Ağaç sayısı 2025-01-01 – 2026-01-01 arasında seçildi.

- **AGF'li koşular**: tüm özelliklerle 1400 ağaç × AGF (doğrulama üsleri 0.677 / 0.5013, canlı 0.7473 / 0.4151).
- **AGF'siz koşular ve AGF açıklanmadan önce**: piyasasız özelliklerle 900 ağaç × piyasasız logit (doğrulama üsleri 0.6939 / 0.4351, canlı 1.1806 / 0.1451).
- Sürpriz riski ve adayları ağaç ve sentez öncesi logit olasılığını kullanır.

Doğrulama (2026-01-01 ve sonrası), ağaçlardan önce sitede gösterilen olasılığa karşı; aralık %95 bootstrap:

| Koşular | Koşu | Önce | Sonra | Fark (aralık) | 1. tahmin | İlk 3 |
|---|---:|---:|---:|---|---|---|
| Tümü | 3766 | 1.7752 | 1.7640 | -0.0112 (-0.0154 / -0.0070) | 34.5% → 34.3% | 69.0% → 69.5% |
| AGF'li | 2664 | 1.7357 | 1.7272 | -0.0085 (-0.0133 / -0.0035) | 35.7% → 35.3% | 70.4% → 71.1% |
| AGF'siz | 1102 | 1.8706 | 1.8529 | -0.0177 (-0.0256 / -0.0099) | 31.7% → 31.9% | 65.6% → 65.9% |

<!-- /agac-katmani -->

<!-- oran-katmani -->
## Canlı ganyan katmanı (sitede kullanılan)

AGF'si olmayan koşularda ağaç katmanının olasılığı son yayındaki ganyan payıyla birleşir; üsler yarışa kalan süreye göre ayrıdır. Fiyatı eksik koşu, 300 dakikadan erken fiyat ve AGF'li koşu bu katmanı kullanmaz. Geçmiş günlerin kartları bu katman olmadan gösterilir.

Üsler 2025-01-01 – 2026-01-01 arasında öğrenildi, 2026-01-01 ve sonrasında sınandı; aralık %95 bootstrap. Kabul kuralı çalıştırmadan önce yazıldı: kazanç en az 0,005 ve aralığın üst sınırı sıfırın altında.

| Yarışa kalan | Koşu | Önce | Sonra | Fark (aralık) | 1. tahmin | İlk 3 |
|---|---:|---:|---:|---|---|---|
| Son yayın (:21, :51), tüm AGF'siz | 1102 | 1.8529 | 1.8280 | -0.0249 (-0.0372 / -0.0138) | 31.9% → 32.9% | 65.9% → 68.0% |
| Son yayın, fiyatı olan | 841 | 1.7884 | 1.7557 | -0.0326 (-0.0469 / -0.0171) | 34.4% → 35.8% | 66.8% → 69.6% |
| 240 dk | 708 | 1.7309 | 1.7203 | -0.0107 (-0.0178 / -0.0030) | 35.0% → 36.6% | 68.6% → 69.1% |
| 120 dk | 732 | 1.7195 | 1.7032 | -0.0163 (-0.0279 / -0.0048) | 35.5% → 36.2% | 69.4% → 70.4% |
| 60 dk | 744 | 1.7229 | 1.6958 | -0.0271 (-0.0421 / -0.0134) | 35.3% → 36.8% | 69.2% → 71.5% |
| 30 dk | 740 | 1.7269 | 1.7012 | -0.0257 (-0.0441 / -0.0084) | 35.4% → 38.1% | 69.3% → 73.1% |
| 15 dk | 1040 | 1.8630 | 1.8359 | -0.0271 (-0.0410 / -0.0120) | 31.7% → 33.4% | 65.1% → 68.1% |
| 5 dk | 743 | 1.7167 | 1.6869 | -0.0298 (-0.0510 / -0.0101) | 35.9% → 39.3% | 69.4% → 71.9% |
| 1 dk | 734 | 1.7180 | 1.6865 | -0.0315 (-0.0522 / -0.0104) | 35.4% → 38.3% | 69.3% → 72.5% |

AGF'li koşular, AGF görünmeden aynı katmanla: 240 dk -0.0021 (-0.0070 / 0.0024), 120 dk -0.0049 (-0.0116 / 0.0017), 60 dk -0.0110 (-0.0186 / -0.0031).

<!-- /oran-katmani -->
