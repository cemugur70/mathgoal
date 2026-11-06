# At yarışı: rakip ağı rating'i ve Obsidian modeli

Veri 2021-01-01 – 2026-11-02: rating'ler tüm yurt içi hipodromlardaki 37256 sonuçlanmış koşudan öğrenilir (10733'i yalnızca ağ için: Kocaeli, Elazığ, Antalya, Şanlıurfa, Diyarbakır); değerlendirme ve ağırlıklar yalnızca İstanbul, Ankara, İzmir, Bursa ve Adana koşularında.
İngiliz + Arap. İlk 60 gün (2021-03-02 öncesi) yalnızca rating ısınması için kullanıldı.
Keşif: 2021-03-02 – 2026-01-01 öncesi (22174 koşu) · doğrulama: 2026-01-01 ve sonrası (3731 koşu).

## Yöntem

1. **Kim kimi geçti**: her geçmiş koşuda ödeme metninden bilinen ilk dereceler ve sonraki programlardan bilinen dereceler; derecesi bilinmeyen atlar bilinen ilk derecelerin arkasında sayılır.
2. **Rakip ağı rating'i** (Plackett–Luce, çevrimiçi): her koşu sonrası her at, rakiplerinin o anki gücüne göre beklenen ile gerçekleşen arasındaki fark kadar hareket eder. Güçlü atı geçmek daha çok kazandırır; güç ortak rakipler üzerinden yayılır.
3. **Pist / mesafe tercihi**: ağ içinde rakip gücüne göre düzeltilmiş pist (çim/kum/sentetik) ve mesafe (kısa ≤1300, mil ≤1600, orta ≤2000, uzun) sapmaları; ayrıca atın tüm hipodromlardaki kariyer kaydından aynı koşulda ortalama derece puanı (1/derece) eksi genel ortalaması, 3 sanal koşuyla büzülmüş.
4. **Hız puanı**: atın kendi bitiş derecesi, ırk + hipodrom + pist + mesafe için 2026-01-01 öncesi koşulardan alınan medyan dereceyle (par) karşılaştırılır ve o günün pist farkıyla (aynı gün, hipodrom ve pistteki tüm atların medyan sapması) düzeltilir; birim 1000 m başına saniye, pozitif = par'dan hızlı. 350150 koşuya puan verildi. Modele son 3 koşunun ortalaması ve son bir yıldaki son 4 koşunun en iyisi girer.
5. **Obsidian**: koşu içi softmax (koşullu logit) ile ağ rating'i, tercihler, kilo, handikap, puan, son 3 koşu formu, dinlenme, hız puanı, apranti, jokey ve antrenör formu (atlı sayısına göre beklenen galibiyete oranı, bir yıllık yarı ömür), jokeyin bindiği atın AGF payının üstünde kazanması (genel ve ırka göre), son koşuya göre mesafe değişimi, koşulan pistteki ayrıntılı kayıt (kazanma ve ilk 3 oranı, o pistteki koşu sayısı, en iyi diğer pistle fark, son koşudan bu yana pist değişimi), babanın yavrularının bu pist tercihi, galop (antrenman) dereceleri ve yarış öncesi AGF birleştirilir. Galop puanı, son 45 gündeki galopların aynı tür galopların 2026 öncesi ortancasından yüzde kaç hızlı olduğudur; galop sayısı ve son galoptan bu yana geçen gün de ayrı özelliktir. Sürprize açık koşularda (handikap veya 11+ atlı) AGF ve ağ rating'i ayrı bir ağırlık daha alır. Ağırlıklar yalnız keşif döneminde öğrenilir; L2 cezası her özelliğin standart sapmasına göre uygulanır, böylece dar ölçekli özellikler (form, pist tercihi) orantısız bastırılmaz.
6. **Piyasa sentezi**: Obsidian olasılığı ile AGF payı ikinci aşamada p^α · AGF^θ biçiminde birleştirilip koşu içinde 1'e tamamlanır. Doğrulama için ağırlıklar 2025-01-01 öncesinde, üsler 2025-01-01 – 2026-01-01 arasında öğrenildi (α 0.4819, θ 0.5192); canlı koşular için üsler doğrulama döneminden öğrenildi (α 0.3698, θ 0.5969). AGF'si olmayan koşularda uygulanmaz. Sürpriz riski ve adayları sentez öncesi olasılığı kullanır.
7. Ağ politikası keşif döneminde küçük bir ızgaradan seçildi: öğrenme hızı 0.6, yarı ömür 540 gün. Kilo katsayıları (log-güç / kg): TB 0.066, AR 0.007.

**Değer bahsi**: model olasılığı × kapanış ganyanı ≥ 1,20 olan her ata 1 TL. Kapanış ganyanı yarıştan önce kesin bilinmediği için bu ROI gösterge niteliğindedir.

## Doğrulama dönemi (modelin hiç görmediği koşular)

| Model | Koşu | 1. tahmin kazandı | İlk 3 tahminde | Log-kayıp (düşük iyi) | ROI: her koşu 1. tahmin | Değer bahsi sayısı | ROI: değer bahsi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tekdüze olasılık (1. tahmin = 1 numaralı at) | 3731 | 16.6% | 43.5% | 2.226 | -33.6% | 16335 | -50.6% |
| Yalnız handikap | 3731 | 21.2% | 51.0% | 2.106 | -35.2% | 13825 | -47.4% |
| Rakip ağı rating'i | 3731 | 27.7% | 59.7% | 1.999 | -22.8% | 11504 | -44.8% |
| Ağ + pist/mesafe tercihi + kilo | 3731 | 26.9% | 60.1% | 1.995 | -26.1% | 11354 | -44.9% |
| Yalnız hız puanı | 3731 | 24.3% | 55.7% | 2.045 | -23.0% | 12144 | -41.8% |
| Obsidian, piyasasız, hız puanı olmadan | 3731 | 32.3% | 66.1% | 1.858 | -25.8% | 5487 | -27.0% |
| Obsidian, kuralsız, hız puanı olmadan | 3731 | 34.0% | 68.6% | 1.820 | -25.7% | 4160 | -38.9% |
| Obsidian, piyasasız (AGF hariç) | 3731 | 33.1% | 67.1% | 1.837 | -23.2% | 5074 | -19.6% |
| Yalnız AGF | 3731 | 28.6% | 61.1% | 1.906 | -36.1% | 5470 | -51.2% |
| Obsidian, kuralsız (AGF dahil) | 3731 | 34.6% | 69.2% | 1.805 | -23.0% | 3956 | -30.6% |
| Obsidian, kuralsız, ilk özellik seti (jokey/antrenör, galop ve pist kaydı olmadan) | 3731 | 34.3% | 69.2% | 1.827 | -24.1% | 4232 | -35.9% |
| Obsidian + kurallar, ayrıntılı pist kaydı ve baba pist tercihi olmadan | 3731 | 34.5% | 69.1% | 1.807 | -23.5% | 3988 | -29.2% |
| Obsidian + kurallar, jokey AGF üstü başarısı olmadan | 3731 | 34.4% | 69.2% | 1.806 | -24.0% | 3880 | -27.1% |
| Obsidian + kurallar, galop olmadan | 3731 | 34.5% | 69.2% | 1.812 | -22.6% | 3991 | -28.2% |
| Obsidian + backtest'ten geçen kurallar | 3731 | 34.6% | 69.3% | 1.804 | -23.0% | 3951 | -30.6% |
| Obsidian + AGF sentezi (canlıda kullanılan) | 3731 | 34.6% | 69.2% | 1.791 | -25.5% | 3258 | -33.4% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 3731 | 36.1% | 69.5% | 1.788 | -29.3% | 0 | – |

### Irka göre (doğrulama)

| Model | İngiliz: 1. tahmin | İngiliz: log-kayıp | Arap: 1. tahmin | Arap: log-kayıp |
|---|---:|---:|---:|---:|
| Rakip ağı rating'i | 28.4% | 1.928 | 26.9% | 2.091 |
| Obsidian, piyasasız (AGF hariç) | 35.0% | 1.761 | 30.6% | 1.938 |
| Obsidian, kuralsız (AGF dahil) | 36.8% | 1.728 | 31.8% | 1.905 |
| Obsidian + backtest'ten geçen kurallar | 36.8% | 1.728 | 31.8% | 1.905 |
| Obsidian + AGF sentezi (canlıda kullanılan) | 36.2% | 1.717 | 32.4% | 1.888 |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 38.4% | 1.708 | 33.1% | 1.893 |

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
| Obsidian, piyasasız (AGF hariç) | 22174 | 31.9% | 67.6% | 1.826 | -23.1% | 36935 | -25.6% |
| Yalnız AGF | 22174 | 28.9% | 61.9% | 1.885 | -31.8% | 31752 | -44.7% |
| Obsidian, kuralsız (AGF dahil) | 22174 | 33.8% | 69.3% | 1.789 | -23.3% | 27493 | -22.6% |
| Obsidian, kuralsız, ilk özellik seti (jokey/antrenör, galop ve pist kaydı olmadan) | 22174 | 33.6% | 68.2% | 1.807 | -24.0% | 29723 | -29.0% |
| Obsidian + kurallar, ayrıntılı pist kaydı ve baba pist tercihi olmadan | 22174 | 33.8% | 69.1% | 1.790 | -23.3% | 27502 | -23.1% |
| Obsidian + kurallar, jokey AGF üstü başarısı olmadan | 22174 | 33.8% | 69.2% | 1.790 | -24.0% | 27246 | -23.2% |
| Obsidian + kurallar, galop olmadan | 22174 | 33.8% | 68.6% | 1.795 | -23.9% | 28038 | -24.9% |
| Obsidian + backtest'ten geçen kurallar | 22174 | 33.8% | 69.3% | 1.789 | -23.3% | 27484 | -22.3% |
| Obsidian + AGF sentezi (canlıda kullanılan) | 22174 | 34.2% | 69.7% | 1.777 | -24.8% | 22838 | -26.1% |
| Kapanış ganyanı (referans, yarış öncesi bilinmez) | 22174 | 35.4% | 70.4% | 1.762 | -30.1% | 0 | – |

## Sürpriz modeli

Sürpriz = kazananın kapanış ganyanı ≥ 10 TL. Oranlar beş şehirdeki koşulardan; keşif 2021-03-02 – 2026-01-01 öncesi, doğrulama 2026-01-01 ve sonrası.

### Koşu ailesi

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| Handikap | 6160 | 16.9% | 1011 | 18.7% |
| Satış | 842 | 16.0% | 146 | 15.8% |
| Grup / kupa | 813 | 14.4% | 127 | 11.8% |
| Maiden | 4108 | 13.5% | 715 | 14.4% |
| Şartlı | 7398 | 11.4% | 1196 | 11.7% |
| KV | 2835 | 9.6% | 521 | 8.4% |

### Atlı sayısı

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| 14+ atlı | 1789 | 25.2% | 508 | 25.0% |
| 11–13 atlı | 5418 | 19.0% | 895 | 19.3% |
| 8–10 atlı | 8279 | 13.2% | 1304 | 12.1% |
| ≤7 atlı | 6684 | 5.9% | 1023 | 5.5% |

### Irk × koşu ailesi

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| Arap Handikap | 2842 | 20.3% | 453 | 21.4% |
| Arap Satış | 320 | 17.5% | 44 | 20.5% |
| İngiliz Satış | 522 | 15.1% | 102 | 13.7% |
| İngiliz Grup / kupa | 523 | 14.5% | 84 | 8.3% |
| Arap Grup / kupa | 290 | 14.1% | 43 | 18.6% |
| İngiliz Handikap | 3318 | 13.9% | 558 | 16.5% |
| Arap Maiden | 2057 | 13.7% | 343 | 16.3% |
| Arap Şartlı | 3356 | 13.6% | 529 | 14.7% |
| İngiliz Maiden | 2051 | 13.3% | 372 | 12.6% |
| Arap KV | 1064 | 11.2% | 195 | 10.3% |
| İngiliz Şartlı | 4042 | 9.7% | 667 | 9.3% |
| İngiliz KV | 1771 | 8.6% | 326 | 7.4% |

### Irk × atlı sayısı

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| Arap 14+ atlı | 1039 | 26.9% | 307 | 26.4% |
| İngiliz 14+ atlı | 750 | 22.9% | 201 | 22.9% |
| Arap 11–13 atlı | 3130 | 19.8% | 510 | 21.4% |
| İngiliz 11–13 atlı | 2288 | 17.9% | 385 | 16.6% |
| Arap 8–10 atlı | 3748 | 13.6% | 562 | 11.7% |
| İngiliz 8–10 atlı | 4531 | 12.8% | 742 | 12.4% |
| Arap ≤7 atlı | 2018 | 6.2% | 233 | 5.2% |
| İngiliz ≤7 atlı | 4666 | 5.8% | 790 | 5.6% |

### Pist

| | Keşif koşu | Sürpriz | 2026 koşu | Sürpriz |
|---|---:|---:|---:|---:|
| Çim | 9039 | 14.3% | 1205 | 16.8% |
| Kum | 9810 | 12.9% | 1892 | 11.6% |
| Sentetik | 3321 | 12.4% | 633 | 14.5% |

### Koşu başına sürpriz riski (doğrulama)

Yarış öncesi bilgiyle lojistik model: atlı sayısı, koşu ailesi, ırk, pist, AGF favorisinin payı, kazanma modelinin en yüksek olasılığı ve olasılıkların dağınıklığı. Ağırlıklar keşifte öğrenildi. Doğrulamada AUC 0.685 (0,5 = şans), Brier 0.113 (sabit oranla 0.119).

| Risk | Koşu | Gerçek sürpriz | Tahmin edilen |
|---|---:|---:|---:|
| yüksek | 535 | 29.0% | 28.0% |
| orta | 1446 | 16.3% | 16.1% |
| düşük | 1749 | 7.1% | 7.9% |

### Sürpriz adayları

AGF'de ilk 3'te olmayan, kazanma olasılığı ≥ %8 ve AGF payının ≥ 1.5 katı olan atlar. Eşik keşif döneminde seçildi (en az 500 bahis, en yüksek ROI). ROI kapanış ganyanıyla, at başına 1 TL.

| Küme | Bahis | Kazandı | Kazanma | ROI |
|---|---:|---:|---:|---:|
| Keşif: adaylar | 3122 | 316 | 10.1% | -8.3% |
| Doğrulama: adaylar | 443 | 40 | 9.0% | -21.4% |
| Doğrulama: adaylar, orta/yüksek riskli koşular | 281 | 24 | 8.5% | -19.3% |
| Doğrulama: AGF ilk 3 dışındaki tüm atlar | 17055 | 794 | 4.7% | -44.4% |

## Kural katmanı (backtest ile uygulanan kurallar)

Kullanıcı kural setindeki her kural, yarış öncesi bilgiyle (favori = AGF sırası; kapanış ganyanı yarıştan önce bilinmez) aynı sayıda AGF favorisine karşı test edilir. Kuralın modeldeki ağırlığı bu farktır (kazanma olasılığı puanı; negatif = kuralın seçtiği atlar piyasanın sandığından kötü).
- **Walk-forward'da uygulanan**: keşif döneminde Benjamini–Hochberg q < 0,10 olan kurallar (50 kural). Doğrulama dönemi bu seçimi hiç etkilemez.
- **Canlı tahminde uygulanan**: ayrıca doğrulama döneminde aynı yönde p < 0,05 tekrar eden kurallar (17 kural).
- Etki: doğrulama döneminde kurallı Obsidian log-kayıp 1.804, kuralsız 1.805; 1. tahmin 34.6% / 34.6%. Obsidian'daki kural katsayısı: -0.1137.

| Irk | Kural | Koşu (tüm) | Keşif: fark / q | Doğrulama: fark / p | Walk-forward | Canlı |
|---|---|---:|---|---|---|---|
| İngiliz | Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 289 | -39.0% / 0.000 | +4.2% / 0.672 | ✔ | – |
| İngiliz | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 518 | -35.4% / 0.000 | -35.2% / 0.000 | ✔ | ✔ |
| İngiliz | Şartlı 5 çim: %40 hafif kg'lar kazanır | 258 | -42.6% / 0.000 | -53.6% / 0.000 | ✔ | – |
| İngiliz | HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 336 | -38.8% / 0.000 | -31.1% / 0.001 | ✔ | ✔ |
| İngiliz | HAN-15 (özet): 3. handikaplı at tek | 892 | -21.6% / 0.000 | -18.2% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 490 | -36.9% / 0.000 | -31.0% / 0.000 | ✔ | ✔ |
| Arap | Şartlı 5 çim: %40 hafif kg'lar kazanır | 244 | -44.9% / 0.000 | -21.4% / 0.173 | ✔ | – |
| İngiliz | HAN-16 çim: %30 7,8,9 numaralar | 313 | -33.8% / 0.000 | -36.6% / 0.000 | ✔ | ✔ |
| Arap | HAN-15 (özet): 3. handikaplı at tek | 726 | -17.4% / 0.000 | -13.1% / 0.037 | ✔ | ✔ |
| İngiliz | Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 100 | -51.0% / 0.000 | +50.0% / 0.317 | ✔ | – |
| Arap | HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 286 | -33.6% / 0.000 | -30.0% / 0.019 | ✔ | ✔ |
| İngiliz | HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 159 | -40.3% / 0.000 | -6.7% / 0.747 | ✔ | – |
| İngiliz | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 507 | -22.1% / 0.000 | -22.0% / 0.000 | ✔ | ✔ |
| Arap | HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 254 | -27.5% / 0.000 | -15.6% / 0.192 | ✔ | – |
| Arap | HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 402 | -21.3% / 0.000 | -7.3% / 0.372 | ✔ | – |
| Arap | Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 55 | -50.0% / 0.000 | -38.5% / 0.006 | ✔ | – |
| İngiliz | HAN-16 kum: 1,2,3. handikaplar %80 | 420 | -21.0% / 0.000 | -36.1% / 0.000 | ✔ | ✔ |
| İngiliz | HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 324 | -21.7% / 0.000 | -36.2% / 0.000 | ✔ | ✔ |
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
| switchAffinity | 0.2577 |
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
