# Kural seti backtest'i (İngiliz ve Arap atları)

Kaynak: liderform.com.tr herkese açık program sayfaları, 2021-01-01 – 2026-11-01; İstanbul, Ankara, İzmir, Bursa ve Adana'da 14696 İngiliz, 11818 Arap koşusu. Üretim: 2026-11-02T22:21:08.682Z.

## Yorum varsayımları

- **Favori**: en düşük kapanış TJK ganyanı (yoksa AGF). **Plase**: 2.–3. favori. **İlk N at**: ilk N favori.
- **N. handikap**: koşudaki N. en yüksek handikap puanı. **Puan / TGP / Türkiye puanı**: liderform "puan" alanı (varsayım).
- **N numaralı**: program numarası; **N startlı**: kulvar. **Hafif kg**: koşunun en hafif üçte biri. "Fotomaç / posta puanı" ve "kazanç" verisi yok, o kurallar test edilmedi.
- Çim/kum kuralları kendi pistinde ölçüldü; kum kuralları ayrıca sentetikte (AWT) denendi. İngiliz ve Arap koşuları ayrı ölçülür, hiç karıştırılmaz.

## Nasıl okunur

- **İsabet**: kazanan, kuralın seçtiği atlar arasında mı. **Aynı sayıda favori**: kural kaç at seçtiyse o kadar favori seçilseydi isabet. Bir kuralın değeri bu sütunu geçip geçmemesidir.
- **Karar** (ayrıntı tablolarında, tüm dönem): %95 Wilson aralığına göre. 30 koşudan azsa karar verilmez.

## Geriye dönük doğrulama

Kurallar önce **keşif** döneminde (2026-01-01 öncesi) test edilir, sonra hiç görmedikleri **doğrulama** döneminde (2026-01-01 ve sonrası) tekrar etmeleri beklenir.
- **Fark**: her koşuda kural isabeti (1/0) eksi karşılaştırma ölçütü, ortalaması yüzde puan olarak. Ölçüt: aynı sayıda favori; "plase favoriden şanslı" iddiası için favorinin kazanması; "favori gelmez" iddiaları için rastgele pay (beklenen yön negatif). p eşleştirilmiş z testinden.
- **q (BH)**: iki ırktaki tüm keşif testleri tek aile sayılarak Benjamini–Hochberg düzeltmesi. 140 testte birkaçının şansla anlamlı çıkması beklenir; q bunu düzeltir.
- **doğrulandı**: keşifte q < 0,10 ve doğrulamada aynı yönde p < 0,05. **tersi doğrulandı**: iki dönemde de kuralın aleyhine anlamlı. **tekrar etmedi**: keşifte anlamlı ama doğrulamada değil. **kanıt yok**: ölçütten farkı anlamlı değil.
- **favori seçimi**: kural tam olarak aynı sayıda favoriyi seçiyor, test edilecek ayrı üstünlük yok. Oran iddiası varsa (ör. "%70 favori") iki dönemin %95 aralığıyla karşılaştırılır: **iddia doğrulandı / çürütüldü**.
- **ROI**: seçilen her ata 1 TL ganyan; resmi kapanış ganyanı ile (ödenen ganyan ikramiyesiyle 37150/37154 koşuda birebir aynı). Hipodrom kesintisi yüzünden rastgele oynamanın beklenen ROI'si negatiftir.

### İngiliz: doğrulama özeti

Keşif < 2026-01-01: 12582 koşu · doğrulama ≥ 2026-01-01: 2114 koşu. tersi doğrulandı: 13 · tekrar etmedi: 4 · kanıt yok: 1 · belirsiz: 1 · favori seçimi: 16 · yetersiz örnek: 35.

| Kural | Karar | Keşif n | Keşif isabet / favori | Fark (puan) | p | q (BH) | Doğrulama n | Doğrulama isabet / favori | Fark (puan) | p | ROI kural / aynı sayıda favori (tüm dönem) |
|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | **tersi doğrulandı** | 591 | 53.8% / 88.3% | -34.5 | <0.001 | <0.001 | 133 | 51.9% / 85.7% | -33.8 | <0.001 | -40.1% / -30.5% |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | **tersi doğrulandı** | 345 | 28.4% / 75.7% | -47.2 | <0.001 | <0.001 | 43 | 39.5% / 83.7% | -44.2 | <0.001 | -51.6% / -32.1% |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | **tersi doğrulandı** | 410 | 36.3% / 71.7% | -35.4 | <0.001 | <0.001 | 63 | 41.3% / 69.8% | -28.6 | 0.001 | -24.8% / -30.2% |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | **tersi doğrulandı** | 537 | 46.0% / 70.4% | -24.4 | <0.001 | <0.001 | 109 | 41.3% / 65.1% | -23.9 | <0.001 | -34.2% / -30.8% |
| HAN-15 (özet): 3. handikaplı at tek | **tersi doğrulandı** | 1010 | 15.2% / 38.8% | -23.6 | <0.001 | <0.001 | 175 | 12.0% / 32.6% | -20.6 | <0.001 | -37.8% / -23.9% |
| HAN-16 çim: %30 7,8,9 numaralar | **tersi doğrulandı** | 358 | 22.1% / 53.6% | -31.6 | <0.001 | <0.001 | 48 | 16.7% / 56.3% | -39.6 | <0.001 | -42.5% / -34.7% |
| HAN-16 kum: 1,2,3. handikaplar %80 | **tersi doğrulandı** | 446 | 43.3% / 70.0% | -26.7 | <0.001 | <0.001 | 85 | 38.8% / 71.8% | -32.9 | <0.001 | -37.9% / -28.7% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | **tersi doğrulandı** | 495 | 30.7% / 51.3% | -20.6 | <0.001 | <0.001 | 76 | 39.5% / 59.2% | -19.7 | 0.002 | -36.0% / -31.1% |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | **tersi doğrulandı** | 367 | 31.9% / 55.0% | -23.2 | <0.001 | <0.001 | 63 | 30.2% / 60.3% | -30.2 | <0.001 | -32.5% / -24.6% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | **tersi doğrulandı** | 348 | 29.3% / 54.0% | -24.7 | <0.001 | <0.001 | 61 | 19.7% / 55.7% | -36.1 | <0.001 | -7.4% / -23.9% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | **tersi doğrulandı** | 225 | 26.2% / 49.3% | -23.1 | <0.001 | <0.001 | 31 | 22.6% / 48.4% | -25.8 | 0.023 | -34.3% / -25.8% |
| HAN-16 (özet): hafif kilo favori | **tersi doğrulandı** | 607 | 26.7% / 37.7% | -11.0 | <0.001 | <0.001 | 110 | 33.6% / 46.4% | -12.7 | 0.021 | -22.2% / -24.4% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | **tersi doğrulandı** | 195 | 39.5% / 49.7% | -10.3 | 0.017 | 0.023 | 32 | 40.6% / 62.5% | -21.9 | 0.025 | -29.3% / -29.0% |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | **tekrar etmedi** | 325 | 45.2% / 81.2% | -36.0 | <0.001 | <0.001 | 66 | 68.2% / 69.7% | -1.5 | 0.859 | -23.8% / -25.0% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | **tekrar etmedi** | 336 | 20.8% / 47.6% | -26.8 | <0.001 | <0.001 | 77 | 23.4% / 37.7% | -14.3 | 0.059 | -23.7% / -21.1% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | **tekrar etmedi** | 312 | 62.8% / 71.2% | -8.3 | <0.001 | 0.001 | 96 | 64.6% / 70.8% | -6.3 | 0.080 | -33.1% / -31.6% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | **tekrar etmedi** | 278 | 74.8% / 82.7% | -7.9 | 0.006 | 0.008 | 52 | 67.3% / 73.1% | -5.8 | 0.407 | -29.4% / -30.0% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | **kanıt yok** | 155 | 78.7% / 81.3% | -2.6 | 0.433 | 0.449 | 50 | 68.0% / 72.0% | -4.0 | 0.416 | -28.2% / -31.4% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | **belirsiz** | 424 | 67.9% / 67.9% | 0.0 | – | – | 75 | 76.0% / 76.0% | 0.0 | – | -27.3% / -27.3% |
| Şartlı 1 çim: ilk 4 at arasında biter | **favori seçimi** | 294 | 83.0% / 83.0% | 0.0 | – | – | 47 | 66.0% / 66.0% | 0.0 | – | -34.1% / -34.1% |
| Şartlı 1 kum: favori-plaseler arasında biter | **favori seçimi** | 184 | 70.1% / 70.1% | 0.0 | – | – | 31 | 87.1% / 87.1% | 0.0 | – | -30.1% / -30.1% |
| Şartlı 3 kum: favori şanslı | **favori seçimi** | 486 | 42.8% / 42.8% | 0.0 | – | – | 83 | 47.0% / 47.0% | 0.0 | – | -27.6% / -27.6% |
| Şartlı 4: favori gelir | **favori seçimi** | 1337 | 42.0% / 42.0% | 0.0 | – | – | 234 | 40.6% / 40.6% | 0.0 | – | -28.6% / -28.6% |
| Şartlı 5 çim: favori çok şanslı | **favori seçimi** | 345 | 38.0% / 38.0% | 0.0 | – | – | 43 | 55.8% / 55.8% | 0.0 | – | -31.3% / -31.3% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | **favori seçimi** | 989 | 88.1% / 88.1% | 0.0 | – | – | 156 | 88.5% / 88.5% | 0.0 | – | -32.9% / -32.9% |
| KV-6 çim: 1-2. atların dışına çıkmaz | **favori seçimi** | 204 | 55.9% / 55.9% | 0.0 | – | – | 36 | 52.8% / 52.8% | 0.0 | – | -33.9% / -33.9% |
| KV-6 kum: 1-2. atlar şanslı | **favori seçimi** | 278 | 64.0% / 64.0% | 0.0 | – | – | 52 | 61.5% / 61.5% | 0.0 | – | -31.6% / -31.6% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | **favori seçimi** | 171 | 82.5% / 82.5% | 0.0 | – | – | 32 | 81.3% / 81.3% | 0.0 | – | -29.3% / -29.3% |
| HAN-14 (özet): 1-2. at kazanır | **favori seçimi** | 706 | 49.6% / 49.6% | 0.0 | – | – | 110 | 60.0% / 60.0% | 0.0 | – | -32.4% / -32.4% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | **favori seçimi** | 1158 | 67.4% / 67.4% | 0.0 | – | – | 206 | 61.7% / 61.7% | 0.0 | – | -31.0% / -31.0% |
| HAN-16 çim: favori-plaseler arasında biter | **favori seçimi** | 404 | 62.4% / 62.4% | 0.0 | – | – | 51 | 62.7% / 62.7% | 0.0 | – | -35.3% / -35.3% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | **favori seçimi** | 352 | 51.4% / 51.4% | 0.0 | – | – | 50 | 54.0% / 54.0% | 0.0 | – | -31.1% / -31.1% |
| Maiden kum: genelde favori kazanır | **favori seçimi** | 896 | 39.1% / 39.1% | 0.0 | – | – | 179 | 43.0% / 43.0% | 0.0 | – | -29.7% / -29.7% |
| Maiden (özet): ilk iki at arasında | **favori seçimi** | 2119 | 59.2% / 59.2% | 0.0 | – | – | 373 | 57.4% / 57.4% | 0.0 | – | -32.5% / -32.5% |
| Açık/Grup çim: favori-plase dışına çıkmaz | **favori seçimi** | 320 | 70.3% / 70.3% | 0.0 | – | – | 55 | 61.8% / 61.8% | 0.0 | – | -40.2% / -40.2% |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | **yetersiz örnek** | 143 | 27.3% / 77.6% | -50.3 | <0.001 | <0.001 | 3 | 66.7% / 66.7% | 0.0 | 1.000 | -28.9% / -30.8% |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | **yetersiz örnek** | 209 | 17.2% / 59.8% | -42.6 | <0.001 | <0.001 | 22 | 22.7% / 36.4% | -13.6 | 0.409 | -41.9% / -25.5% |
| KV-8 kum: favorinin şansı az (favori gelmez) | **yetersiz örnek** | 182 | 45.1% / 16.6% | +28.5 | <0.001 | <0.001 | 29 | 65.5% / 16.8% | +48.8 | <0.001 | -27.1% / -27.1% |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | **yetersiz örnek** | 125 | 28.8% / 68.0% | -39.2 | <0.001 | <0.001 | 17 | 23.5% / 88.2% | -64.7 | <0.001 | -52.6% / -15.5% |
| KV-8 kum: 57 kg altındaki atlar kazanır | **yetersiz örnek** | 54 | 14.8% / 61.1% | -46.3 | <0.001 | <0.001 | 7 | 14.3% / 71.4% | -57.1 | 0.005 | +5.5% / -22.7% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | **yetersiz örnek** | 56 | 28.6% / 69.6% | -41.1 | <0.001 | <0.001 | 9 | 33.3% / 77.8% | -44.4 | 0.011 | -45.3% / -12.8% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | **yetersiz örnek** | 76 | 17.1% / 51.3% | -34.2 | <0.001 | <0.001 | 11 | 0.0% / 54.5% | -54.5 | <0.001 | -63.9% / -41.2% |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | **yetersiz örnek** | 221 | 30.8% / 50.2% | -19.5 | <0.001 | <0.001 | 24 | 12.5% / 33.3% | -20.8 | 0.045 | -39.3% / -32.4% |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | **yetersiz örnek** | 60 | 5.0% / 36.7% | -31.7 | <0.001 | <0.001 | 10 | 0.0% / 40.0% | -40.0 | 0.014 | -55.0% / -39.4% |
| HAN-17 kum: plase atlar şanslı %70 | **yetersiz örnek** | 161 | 32.9% / 50.3% | -17.4 | 0.001 | 0.002 | 22 | 40.9% / 50.0% | -9.1 | 0.533 | -30.8% / -31.0% |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | **yetersiz örnek** | 147 | 70.1% / 77.6% | -7.5 | 0.053 | 0.064 | 3 | 33.3% / 66.7% | -33.3 | 0.617 | -32.4% / -37.8% |
| HAN-17 kum: puana göre 1-4. atlar | **yetersiz örnek** | 94 | 72.3% / 80.9% | -8.5 | 0.085 | 0.101 | 22 | 81.8% / 90.9% | -9.1 | 0.317 | -27.0% / -22.8% |
| Şartlı 2: 1-2. handikap dışına çıkmaz | **yetersiz örnek** | 147 | 53.1% / 61.2% | -8.2 | 0.094 | 0.109 | 3 | 0.0% / 33.3% | -33.3 | 0.317 | -25.0% / -30.4% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | **yetersiz örnek** | 59 | 23.7% / 30.5% | -6.8 | 0.395 | 0.421 | 8 | 12.5% / 62.5% | -50.0 | 0.061 | +9.8% / -57.6% |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | **yetersiz örnek** | 354 | 42.4% / 38.7% | +3.7 | 0.442 | 0.449 | 28 | 57.1% / 32.1% | +25.0 | 0.154 | -18.2% / -17.2% |
| KV-7 dişi kum: 1-2. handikaplı atlar | **yetersiz örnek** | 62 | 54.8% / 59.7% | -4.8 | 0.440 | 0.449 | 14 | 78.6% / 92.9% | -14.3 | 0.141 | -32.8% / -29.5% |
| Şartlı 2: favori varsa kazanır | **yetersiz örnek** | 147 | 37.4% / 37.4% | 0.0 | – | – | 3 | 33.3% / 33.3% | 0.0 | – | -36.3% / -36.3% |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | **yetersiz örnek** | 135 | 57.8% / 57.8% | 0.0 | – | – | 16 | 75.0% / 75.0% | 0.0 | – | -32.6% / -32.6% |
| KV-7 erkek kum: %20 favori | **yetersiz örnek** | 146 | 36.3% / 36.3% | 0.0 | – | – | 25 | 36.0% / 36.0% | 0.0 | – | -41.2% / -41.2% |
| KV-7 dişi çim: favori, yoksa plaseler | **yetersiz örnek** | 79 | 67.1% / 67.1% | 0.0 | – | – | 6 | 33.3% / 33.3% | 0.0 | – | -39.8% / -39.8% |
| KV-21 çim: %60 3,4,5 numaralı atlar | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-21 kum: %60 3,4,5 numaralı atlar | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-21: favori gelmez | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-22 çim: %60 1,2,3. handikaplar | **yetersiz örnek** | 27 | 55.6% / 66.7% | -11.1 | 0.367 | – | 8 | 62.5% / 75.0% | -12.5 | 0.581 | -26.7% / -33.6% |
| KV-22 kum: %50 1,2,3 numaralı | **yetersiz örnek** | 18 | 27.8% / 88.9% | -61.1 | <0.001 | – | 10 | 60.0% / 90.0% | -30.0 | 0.050 | -72.3% / -19.6% |
| KV-23 çim: %70 favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-23 kum: %60 favori | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-24 çim: handikap puanı 100+ atlar %80 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-24 kum: 90–120 puanlılar %80 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-25 çim: 2,3,4,5 numaralı %75 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-25 kum: 3,4,5 numaralı %60 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| HAN-13 çim: ilk 3 at çok şanslı | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | **yetersiz örnek** | 24 | 75.0% / 87.5% | -12.5 | 0.254 | – | 3 | 100.0% / 100.0% | 0.0 | – | -24.9% / -20.2% |
| Açık/Grup kum: %70 favori | **yetersiz örnek** | 137 | 39.4% / 39.4% | 0.0 | – | – | 19 | 47.4% / 47.4% | 0.0 | – | -43.0% / -43.0% |

### Arap: doğrulama özeti

Keşif < 2026-01-01: 10210 koşu · doğrulama ≥ 2026-01-01: 1608 koşu. tersi doğrulandı: 12 · iddia çürütüldü: 1 · tekrar etmedi: 2 · kanıt yok: 2 · favori seçimi: 12 · yetersiz örnek: 41.

| Kural | Karar | Keşif n | Keşif isabet / favori | Fark (puan) | p | q (BH) | Doğrulama n | Doğrulama isabet / favori | Fark (puan) | p | ROI kural / aynı sayıda favori (tüm dönem) |
|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | **tersi doğrulandı** | 566 | 47.9% / 81.4% | -33.6 | <0.001 | <0.001 | 105 | 52.4% / 81.9% | -29.5 | <0.001 | -43.1% / -31.2% |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | **tersi doğrulandı** | 337 | 35.3% / 74.2% | -38.9 | <0.001 | <0.001 | 42 | 42.9% / 71.4% | -28.6 | 0.006 | -35.3% / -36.1% |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | **tersi doğrulandı** | 360 | 36.1% / 71.9% | -35.8 | <0.001 | <0.001 | 48 | 43.8% / 75.0% | -31.3 | <0.001 | -35.0% / -32.7% |
| HAN-15 (özet): 3. handikaplı at tek | **tersi doğrulandı** | 895 | 15.4% / 35.0% | -19.6 | <0.001 | <0.001 | 135 | 17.8% / 36.3% | -18.5 | <0.001 | -25.7% / -24.1% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | **tersi doğrulandı** | 515 | 30.5% / 50.3% | -19.8 | <0.001 | <0.001 | 75 | 36.0% / 50.7% | -14.7 | 0.037 | -34.0% / -28.4% |
| HAN-16 çim: %30 7,8,9 numaralar | **tersi doğrulandı** | 327 | 26.6% / 53.2% | -26.6 | <0.001 | <0.001 | 46 | 17.4% / 58.7% | -41.3 | <0.001 | -19.2% / -34.7% |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | **tersi doğrulandı** | 249 | 43.8% / 72.3% | -28.5 | <0.001 | <0.001 | 46 | 37.0% / 63.0% | -26.1 | 0.006 | -35.2% / -33.4% |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | **tersi doğrulandı** | 340 | 29.7% / 51.8% | -22.1 | <0.001 | <0.001 | 58 | 27.6% / 56.9% | -29.3 | <0.001 | -41.8% / -33.0% |
| HAN-16 kum: 1,2,3. handikaplar %80 | **tersi doğrulandı** | 383 | 37.6% / 58.0% | -20.4 | <0.001 | <0.001 | 65 | 32.3% / 67.7% | -35.4 | <0.001 | -34.8% / -34.3% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | **tersi doğrulandı** | 327 | 17.7% / 37.9% | -20.2 | <0.001 | <0.001 | 52 | 15.4% / 32.7% | -17.3 | 0.023 | -34.5% / -35.3% |
| HAN-16 (özet): hafif kilo favori | **tersi doğrulandı** | 514 | 21.2% / 33.5% | -12.3 | <0.001 | <0.001 | 92 | 28.3% / 44.6% | -16.3 | 0.007 | -33.5% / -20.0% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | **tersi doğrulandı** | 187 | 52.9% / 60.4% | -7.5 | 0.033 | 0.042 | 67 | 50.7% / 64.2% | -13.4 | 0.009 | -34.1% / -30.2% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | **iddia çürütüldü** | 355 | 52.4% / 52.4% | 0.0 | – | – | 60 | 58.3% / 58.3% | 0.0 | – | -39.5% / -39.5% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | **tekrar etmedi** | 312 | 16.3% / 42.9% | -26.6 | <0.001 | <0.001 | 49 | 28.6% / 42.9% | -14.3 | 0.157 | -28.3% / -33.4% |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | **tekrar etmedi** | 473 | 41.6% / 59.4% | -17.8 | <0.001 | <0.001 | 87 | 48.3% / 58.6% | -10.3 | 0.114 | -26.1% / -36.2% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | **kanıt yok** | 186 | 67.2% / 71.5% | -4.3 | 0.216 | 0.243 | 34 | 61.8% / 73.5% | -11.8 | 0.151 | -24.9% / -37.9% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | **kanıt yok** | 111 | 62.2% / 66.7% | -4.5 | 0.251 | 0.277 | 34 | 76.5% / 73.5% | +2.9 | 0.659 | -37.9% / -40.8% |
| Şartlı 1 çim: ilk 4 at arasında biter | **favori seçimi** | 186 | 71.5% / 71.5% | 0.0 | – | – | 31 | 64.5% / 64.5% | 0.0 | – | -36.2% / -36.2% |
| Şartlı 3 kum: favori şanslı | **favori seçimi** | 360 | 39.2% / 39.2% | 0.0 | – | – | 60 | 43.3% / 43.3% | 0.0 | – | -25.4% / -25.4% |
| Şartlı 4: favori gelir | **favori seçimi** | 1197 | 38.8% / 38.8% | 0.0 | – | – | 183 | 33.3% / 33.3% | 0.0 | – | -34.2% / -34.2% |
| Şartlı 5 çim: favori çok şanslı | **favori seçimi** | 337 | 35.9% / 35.9% | 0.0 | – | – | 42 | 21.4% / 21.4% | 0.0 | – | -39.4% / -39.4% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | **favori seçimi** | 894 | 84.0% / 84.0% | 0.0 | – | – | 142 | 81.7% / 81.7% | 0.0 | – | -32.5% / -32.5% |
| KV-6 kum: 1-2. atlar şanslı | **favori seçimi** | 186 | 57.0% / 57.0% | 0.0 | – | – | 34 | 58.8% / 58.8% | 0.0 | – | -36.9% / -36.9% |
| HAN-14 (özet): 1-2. at kazanır | **favori seçimi** | 609 | 44.3% / 44.3% | 0.0 | – | – | 89 | 46.1% / 46.1% | 0.0 | – | -31.9% / -31.9% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | **favori seçimi** | 1020 | 58.8% / 58.8% | 0.0 | – | – | 167 | 58.7% / 58.7% | 0.0 | – | -34.0% / -34.0% |
| HAN-16 çim: favori-plaseler arasında biter | **favori seçimi** | 346 | 58.1% / 58.1% | 0.0 | – | – | 46 | 60.9% / 60.9% | 0.0 | – | -35.5% / -35.5% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | **favori seçimi** | 244 | 49.2% / 49.2% | 0.0 | – | – | 38 | 52.6% / 52.6% | 0.0 | – | -25.3% / -25.3% |
| Maiden kum: genelde favori kazanır | **favori seçimi** | 969 | 38.0% / 38.0% | 0.0 | – | – | 171 | 33.3% / 33.3% | 0.0 | – | -33.0% / -33.0% |
| Maiden (özet): ilk iki at arasında | **favori seçimi** | 2114 | 58.7% / 58.7% | 0.0 | – | – | 340 | 51.8% / 51.8% | 0.0 | – | -31.7% / -31.7% |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | **yetersiz örnek** | 61 | 0.0% / 52.5% | -52.5 | <0.001 | <0.001 | 14 | 0.0% / 42.9% | -42.9 | 0.002 | -100.0% / -13.7% |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | **yetersiz örnek** | 160 | 30.0% / 64.4% | -34.4 | <0.001 | <0.001 | 3 | 66.7% / 100.0% | -33.3 | 0.317 | -13.0% / -33.7% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | **yetersiz örnek** | 154 | 19.5% / 50.6% | -31.2 | <0.001 | <0.001 | 22 | 27.3% / 45.5% | -18.2 | 0.147 | -30.3% / -11.0% |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | **yetersiz örnek** | 174 | 22.4% / 54.0% | -31.6 | <0.001 | <0.001 | 14 | 7.1% / 57.1% | -50.0 | 0.004 | -31.1% / -34.8% |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | **yetersiz örnek** | 188 | 26.6% / 51.1% | -24.5 | <0.001 | <0.001 | 17 | 23.5% / 52.9% | -29.4 | 0.077 | -38.0% / -28.9% |
| KV-8 kum: favorinin şansı az (favori gelmez) | **yetersiz örnek** | 123 | 34.1% / 15.5% | +18.6 | <0.001 | <0.001 | 25 | 52.0% / 15.0% | +37.0 | <0.001 | -45.6% / -45.6% |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | **yetersiz örnek** | 102 | 35.3% / 65.7% | -30.4 | <0.001 | <0.001 | 13 | 38.5% / 84.6% | -46.2 | 0.001 | -35.0% / -29.5% |
| HAN-17 kum: plase atlar şanslı %70 | **yetersiz örnek** | 103 | 24.3% / 49.5% | -25.2 | <0.001 | <0.001 | 19 | 36.8% / 52.6% | -15.8 | 0.317 | -42.2% / -21.5% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | **yetersiz örnek** | 35 | 17.1% / 37.1% | -20.0 | 0.026 | 0.034 | 13 | 23.1% / 46.2% | -23.1 | 0.165 | -57.2% / -52.4% |
| HAN-17 kum: puana göre 1-4. atlar | **yetersiz örnek** | 66 | 57.6% / 69.7% | -12.1 | 0.041 | 0.051 | 19 | 73.7% / 73.7% | 0.0 | 1.000 | -37.8% / -35.1% |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | **yetersiz örnek** | 172 | 71.5% / 77.9% | -6.4 | 0.046 | 0.057 | 3 | 66.7% / 100.0% | -33.3 | 0.317 | -31.8% / -31.0% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | **yetersiz örnek** | 79 | 38.0% / 48.1% | -10.1 | 0.141 | 0.161 | 9 | 66.7% / 44.4% | +22.2 | 0.131 | -19.7% / -35.5% |
| Şartlı 2: 1-2. handikap dışına çıkmaz | **yetersiz örnek** | 172 | 50.6% / 54.7% | -4.1 | 0.274 | 0.297 | 3 | 33.3% / 33.3% | 0.0 | 1.000 | -32.8% / -37.1% |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | **yetersiz örnek** | 293 | 31.1% / 33.4% | -2.4 | 0.611 | 0.611 | 27 | 25.9% / 29.6% | -3.7 | 0.800 | -34.1% / -35.9% |
| Şartlı 1 kum: favori-plaseler arasında biter | **yetersiz örnek** | 82 | 56.1% / 56.1% | 0.0 | – | – | 17 | 64.7% / 64.7% | 0.0 | – | -39.6% / -39.6% |
| Şartlı 2: favori varsa kazanır | **yetersiz örnek** | 173 | 31.2% / 31.2% | 0.0 | – | – | 3 | 0.0% / 0.0% | 0.0 | – | -51.5% / -51.5% |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-6 çim: 1-2. atların dışına çıkmaz | **yetersiz örnek** | 188 | 57.4% / 57.4% | 0.0 | – | – | 26 | 46.2% / 46.2% | 0.0 | – | -34.1% / -34.1% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | **yetersiz örnek** | 23 | 17.4% / 43.5% | -26.1 | 0.069 | – | 5 | 0.0% / 20.0% | -20.0 | 0.317 | -72.9% / -64.4% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | **yetersiz örnek** | 97 | 61.9% / 61.9% | 0.0 | – | – | 12 | 50.0% / 50.0% | 0.0 | – | -24.1% / -24.1% |
| KV-7 erkek kum: %20 favori | **yetersiz örnek** | 99 | 29.3% / 29.3% | 0.0 | – | – | 19 | 36.8% / 36.8% | 0.0 | – | -41.4% / -41.4% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | **yetersiz örnek** | 29 | 17.2% / 37.9% | -20.7 | 0.072 | – | 7 | 14.3% / 71.4% | -57.1 | 0.005 | -57.5% / -34.1% |
| KV-7 dişi çim: favori, yoksa plaseler | **yetersiz örnek** | 26 | 69.2% / 69.2% | 0.0 | – | – | 4 | 75.0% / 75.0% | 0.0 | – | -24.2% / -24.2% |
| KV-7 dişi kum: 1-2. handikaplı atlar | **yetersiz örnek** | 20 | 65.0% / 75.0% | -10.0 | 0.317 | – | 5 | 40.0% / 60.0% | -20.0 | 0.317 | -36.3% / -26.5% |
| KV-8 kum: 57 kg altındaki atlar kazanır | **yetersiz örnek** | 20 | 5.0% / 50.0% | -45.0 | <0.001 | – | 6 | 0.0% / 66.7% | -66.7 | 0.002 | -91.1% / -27.7% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | **yetersiz örnek** | 60 | 80.0% / 80.0% | 0.0 | – | – | 13 | 92.3% / 92.3% | 0.0 | – | -35.6% / -35.6% |
| KV-21 çim: %60 3,4,5 numaralı atlar | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-21 kum: %60 3,4,5 numaralı atlar | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-21: favori gelmez | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-22 çim: %60 1,2,3. handikaplar | **yetersiz örnek** | 13 | 46.2% / 61.5% | -15.4 | 0.421 | – | 4 | 25.0% / 75.0% | -50.0 | 0.083 | -31.3% / -10.0% |
| KV-22 kum: %50 1,2,3 numaralı | **yetersiz örnek** | 19 | 47.4% / 52.6% | -5.3 | 0.745 | – | 6 | 16.7% / 50.0% | -33.3 | 0.114 | -32.1% / -31.7% |
| KV-23 çim: %70 favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-23 kum: %60 favori | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-24 çim: handikap puanı 100+ atlar %80 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-24 kum: 90–120 puanlılar %80 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-25 çim: 2,3,4,5 numaralı %75 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-25 kum: 3,4,5 numaralı %60 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| HAN-13 çim: ilk 3 at çok şanslı | **yetersiz örnek** | 5 | 80.0% / 80.0% | 0.0 | – | – | 1 | 100.0% / 100.0% | 0.0 | – | -10.6% / -10.6% |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | **yetersiz örnek** | 21 | 71.4% / 90.5% | -19.0 | 0.088 | – | 2 | 100.0% / 100.0% | 0.0 | – | -21.2% / -28.8% |
| Açık/Grup çim: favori-plase dışına çıkmaz | **yetersiz örnek** | 162 | 71.0% / 71.0% | 0.0 | – | – | 27 | 77.8% / 77.8% | 0.0 | – | -38.0% / -38.0% |
| Açık/Grup kum: %70 favori | **yetersiz örnek** | 107 | 46.7% / 46.7% | 0.0 | – | – | 12 | 33.3% / 33.3% | 0.0 | – | -28.3% / -28.3% |

## İngiliz atları

14696 sonuçlanmış İngiliz koşusu.

### Kurallar (İngiliz)

| Kural | Koşu | İsabet (95% aralık) | Ort. seçim | Rastgele | Aynı sayıda favori | İddia | Karar | 3 yaş (n / isabet / favori) | Sentetik (n / isabet / favori) |
|---|---:|---|---:|---:|---:|---|---|---|---|
| Şartlı 1 çim: ilk 4 at arasında biter | 341 | 80.6% (76.1%–84.5%) | 4.0 | 51.4% | 80.6% | – | favori seçimi (oran bilgi amaçlı) | 15 / 86.7% / 86.7% | – |
| Şartlı 1 kum: favori-plaseler arasında biter | 215 | 72.6% (66.2%–78.1%) | 3.0 | 36.3% | 72.6% | – | favori seçimi (oran bilgi amaçlı) | 50 / 68.0% / 68.0% | 112 / 73.2% / 73.2% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | 408 | 63.2% (58.5%–67.8%) | 3.0 | 36.2% | 71.1% | – | favoriden kötü | 66 / 62.1% / 75.8% | – |
| Şartlı 2: favori varsa kazanır | 150 | 37.3% (30.0%–45.3%) | 1.1 | 13.5% | 37.3% | – | favori seçimi (oran bilgi amaçlı) | 53 / 37.7% / 37.7% | – |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | 0 / – / – |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | 150 | 69.3% (61.5%–76.2%) | 3.7 | 46.5% | 77.3% | – | favoriden kötü | 53 / 75.5% / 79.2% | – |
| Şartlı 2: 1-2. handikap dışına çıkmaz | 150 | 52.0% (44.1%–59.8%) | 2.1 | 26.9% | 60.7% | – | favoriden kötü | 53 / 50.9% / 56.6% | – |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 146 | 28.1% (21.4%–35.9%) | 3.6 | 39.3% | 77.4% | – | rastgeleden kötü | 51 / 37.3% / 78.4% | – |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 382 | 43.5% (38.6%–48.5%) | 2.0 | 26.1% | 68.1% | – | doğrulandı | 133 / 45.1% / 63.2% | – |
| Şartlı 3 kum: favori şanslı | 569 | 43.4% (39.4%–47.5%) | 1.1 | 14.3% | 43.4% | – | favori seçimi (oran bilgi amaçlı) | 222 / 41.4% / 41.4% | 139 / 40.3% / 40.3% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 256 | 25.8% (20.8%–31.5%) | 1.5 | 17.9% | 49.2% | – | favoriden kötü | 131 / 33.6% / 51.9% | 71 / 26.8% / 56.3% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 571 | 31.9% (28.2%–35.8%) | 1.7 | 21.1% | 52.4% | – | favoriden kötü | 170 / 21.2% / 40.6% | – |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 391 | 49.1% (44.2%–54.0%) | 3.0 | 39.9% | 79.3% | – | favoriden kötü | 141 / 53.9% / 78.0% | – |
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 724 | 53.5% (49.8%–57.1%) | 3.9 | 56.5% | 87.8% | – | favoriden kötü | 288 / 56.9% / 90.3% | 225 / 55.6% / 87.6% |
| Şartlı 4: favori gelir | 1571 | 41.8% (39.4%–44.3%) | 1.0 | 14.5% | 41.8% | – | favori seçimi (oran bilgi amaçlı) | 592 / 42.7% / 42.7% | – |
| Şartlı 5 çim: favori çok şanslı | 388 | 39.9% (35.2%–44.9%) | 1.1 | 15.5% | 39.9% | – | favori seçimi (oran bilgi amaçlı) | 120 / 40.0% / 40.0% | – |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | 388 | 29.6% (25.3%–34.4%) | 3.2 | 43.4% | 76.5% | 40.0% · abartılı | rastgeleden kötü | 120 / 26.7% / 78.3% | – |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 70 | 4.3% (1.5%–11.9%) | 1.2 | 16.6% | 37.1% | – | rastgeleden kötü | 33 / 3.0% / 45.5% | 17 / 0.0% / 23.5% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | 67 | 22.4% (14.1%–33.7%) | 1.2 | 19.2% | 34.3% | – | favoriden kötü | 20 / 15.0% / 45.0% | 23 / 34.8% / 47.8% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | 1145 | 88.1% (86.1%–89.9%) | 4.0 | 60.8% | 88.1% | – | favori seçimi (oran bilgi amaçlı) | 377 / 90.2% / 90.2% | – |
| KV-6 çim: 1-2. atların dışına çıkmaz | 240 | 55.4% (49.1%–61.6%) | 2.0 | 27.7% | 55.4% | – | favori seçimi (oran bilgi amaçlı) | 91 / 54.9% / 54.9% | – |
| KV-6 kum: 1-2. atlar şanslı | 330 | 63.6% (58.3%–68.6%) | 2.0 | 32.2% | 63.6% | – | favori seçimi (oran bilgi amaçlı) | 130 / 65.4% / 65.4% | 86 / 58.1% / 58.1% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | 205 | 76.1% (69.8%–81.4%) | 3.0 | 47.7% | 79.0% | – | favoriden farksız | 85 / 81.2% / 82.4% | 56 / 67.9% / 75.0% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | 330 | 73.6% (68.6%–78.1%) | 3.1 | 49.6% | 81.2% | – | favoriden kötü | 130 / 82.3% / 82.3% | 86 / 59.3% / 79.1% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | 65 | 29.2% (19.6%–41.2%) | 1.8 | 25.8% | 70.8% | – | favoriden kötü | 21 / 33.3% / 90.5% | 23 / 34.8% / 56.5% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | 151 | 59.6% (51.6%–67.1%) | 2.0 | 29.7% | 59.6% | – | favori seçimi (oran bilgi amaçlı) | 41 / 65.9% / 65.9% | – |
| KV-7 erkek kum: %20 favori | 171 | 36.3% (29.4%–43.7%) | 1.1 | 16.3% | 36.3% | 20.0% · temkinli | iddia temkinli (gerçek oran daha yüksek) | 64 / 46.9% / 46.9% | 67 / 41.8% / 41.8% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | 87 | 14.9% (8.9%–23.9%) | 1.8 | 28.6% | 51.7% | – | rastgeleden kötü | 37 / 16.2% / 59.5% | 39 / 41.0% / 74.4% |
| KV-7 dişi çim: favori, yoksa plaseler | 85 | 64.7% (54.1%–74.0%) | 3.0 | 38.3% | 64.7% | – | favori seçimi (oran bilgi amaçlı) | 33 / 66.7% / 66.7% | – |
| KV-7 dişi kum: 1-2. handikaplı atlar | 76 | 59.2% (48.0%–69.6%) | 2.0 | 31.8% | 65.8% | – | favoriden farksız | 39 / 51.3% / 59.0% | 33 / 42.4% / 63.6% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | 227 | 39.6% (33.5%–46.1%) | 1.5 | 24.6% | 51.5% | – | favoriden kötü | 82 / 29.3% / 48.8% | – |
| KV-8 kum: favorinin şansı az (favori gelmez) | 211 | 47.9% (41.2%–54.6%) | 1.0 | 16.6% | 47.9% | – | doğrulanmadı (favori yine en şanslı) | 82 / 48.8% / 48.8% | 121 / 43.0% / 43.0% |
| KV-8 kum: 57 kg altındaki atlar kazanır | 61 | 14.8% (8.0%–25.7%) | 1.4 | 20.8% | 62.3% | – | favoriden kötü | 26 / 3.8% / 61.5% | 31 / 16.1% / 45.2% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | 203 | 82.3% (76.4%–86.9%) | 3.0 | 46.9% | 82.3% | – | favori seçimi (oran bilgi amaçlı) | 91 / 78.0% / 78.0% | – |
| KV-21 çim: %60 3,4,5 numaralı atlar | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | – |
| KV-21 kum: %60 3,4,5 numaralı atlar | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-21: favori gelmez | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | – |
| KV-22 çim: %60 1,2,3. handikaplar | 35 | 57.1% (40.9%–72.0%) | 3.2 | 46.5% | 68.6% | 60.0% · tutuyor | favoriden farksız | 0 / – / – | – |
| KV-22 kum: %50 1,2,3 numaralı | 28 | 39.3% (23.6%–57.6%) | 2.9 | 39.4% | 89.3% | 50.0% | yetersiz örnek | 0 / – / – | 30 / 50.0% / 66.7% |
| KV-23 çim: %70 favori kazanır | 0 | – (–––) | – | – | – | 70.0% | yetersiz örnek | 0 / – / – | – |
| KV-23 kum: %60 favori | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-24 çim: handikap puanı 100+ atlar %80 | 0 | – (–––) | – | – | – | 80.0% | yetersiz örnek | 0 / – / – | – |
| KV-24 kum: 90–120 puanlılar %80 | 0 | – (–––) | – | – | – | 80.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-25 çim: 2,3,4,5 numaralı %75 | 0 | – (–––) | – | – | – | 75.0% | yetersiz örnek | 0 / – / – | – |
| KV-25 kum: 3,4,5 numaralı %60 | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| HAN-13 çim: ilk 3 at çok şanslı | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | – |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | 27 | 77.8% (59.2%–89.4%) | 4.3 | 64.8% | 88.9% | 70.0% | yetersiz örnek | 22 / 77.3% / 95.5% | 0 / – / – |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | 245 | 29.0% (23.7%–35.0%) | 2.3 | 21.6% | 48.6% | 20.0% · temkinli | favoriden kötü | 131 / 30.5% / 53.4% | – |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 231 | 17.7% (13.4%–23.2%) | 2.7 | 24.1% | 57.6% | – | rastgeleden kötü | 122 / 15.6% / 57.4% | – |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 430 | 31.6% (27.4%–36.2%) | 2.4 | 24.8% | 55.8% | – | favoriden kötü | 211 / 30.3% / 55.9% | 58 / 25.9% / 62.1% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | 499 | 69.1% (65.0%–73.0%) | 3.0 | 35.0% | 69.1% | 75.0% · abartılı | iddia abartılı | 250 / 74.8% / 74.8% | 72 / 69.4% / 69.4% |
| HAN-14 (özet): 1-2. at kazanır | 816 | 51.0% (47.6%–54.4%) | 2.0 | 22.8% | 51.0% | – | favori seçimi (oran bilgi amaçlı) | 443 / 55.5% / 55.5% | – |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 473 | 37.0% (32.8%–41.4%) | 4.1 | 39.8% | 71.5% | – | favoriden kötü | 261 / 33.0% / 71.6% | – |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 646 | 45.2% (41.4%–49.1%) | 3.2 | 38.4% | 69.5% | – | favoriden kötü | 305 / 51.1% / 72.5% | 244 / 39.3% / 71.3% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 413 | 21.3% (17.6%–25.5%) | 1.6 | 18.1% | 45.8% | – | favoriden kötü | 197 / 22.3% / 45.7% | 165 / 17.6% / 42.4% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | 1364 | 66.5% (63.9%–69.0%) | 3.0 | 34.6% | 66.5% | – | favori seçimi (oran bilgi amaçlı) | 675 / 68.3% / 68.3% | – |
| HAN-15 (özet): 3. handikaplı at tek | 1185 | 14.8% (12.9%–16.9%) | 1.2 | 13.8% | 37.9% | – | favoriden kötü | 592 / 16.6% / 36.5% | – |
| HAN-16 çim: favori-plaseler arasında biter | 455 | 62.4% (57.9%–66.7%) | 3.0 | 35.0% | 62.4% | – | favori seçimi (oran bilgi amaçlı) | 185 / 69.2% / 69.2% | – |
| HAN-16 çim: %30 7,8,9 numaralar | 406 | 21.4% (17.7%–25.7%) | 2.5 | 26.2% | 53.9% | 30.0% · abartılı | rastgeleden kötü | 153 / 18.3% / 55.6% | – |
| HAN-16 kum: 1,2,3. handikaplar %80 | 531 | 42.6% (38.4%–46.8%) | 3.1 | 37.5% | 70.2% | 80.0% · abartılı | favoriden kötü | 181 / 48.6% / 71.3% | 168 / 41.7% / 70.8% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 409 | 27.9% (23.7%–32.4%) | 2.0 | 22.3% | 54.3% | – | favoriden kötü | 143 / 30.8% / 55.9% | 133 / 24.1% / 59.4% |
| HAN-16 (özet): hafif kilo favori | 717 | 27.8% (24.6%–31.1%) | 1.2 | 14.3% | 39.1% | – | favoriden kötü | 226 / 28.3% / 40.7% | – |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | 142 | 28.2% (21.4%–36.1%) | 3.0 | 35.8% | 70.4% | – | favoriden kötü | 21 / 28.6% / 61.9% | – |
| HAN-17 kum: plase atlar şanslı %70 | 183 | 33.9% (27.4%–41.0%) | 2.0 | 23.0% | 50.3% | 70.0% · abartılı | favoriden kötü | 5 / 80.0% / 60.0% | 77 / 28.6% / 53.2% |
| HAN-17 kum: puana göre 1-4. atlar | 116 | 74.1% (65.5%–81.2%) | 4.0 | 45.4% | 82.8% | – | favoriden kötü | 3 / 66.7% / 100.0% | 47 / 68.1% / 70.2% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | 402 | 51.7% (46.9%–56.6%) | 2.0 | 24.9% | 51.7% | – | favori seçimi (oran bilgi amaçlı) | 40 / 67.5% / 67.5% | – |
| Maiden kum: genelde favori kazanır | 1075 | 39.7% (36.8%–42.7%) | 1.1 | 11.7% | 39.7% | – | favori seçimi (oran bilgi amaçlı) | 596 / 38.4% / 38.4% | 361 / 36.6% / 36.6% |
| Maiden (özet): ilk iki at arasında | 2492 | 58.9% (57.0%–60.8%) | 2.1 | 22.0% | 58.9% | – | favori seçimi (oran bilgi amaçlı) | 1237 / 56.2% / 56.2% | – |
| Açık/Grup çim: favori-plase dışına çıkmaz | 375 | 69.1% (64.2%–73.5%) | 3.1 | 36.1% | 69.1% | – | favori seçimi (oran bilgi amaçlı) | 110 / 69.1% / 69.1% | – |
| Açık/Grup kum: %70 favori | 156 | 40.4% (33.0%–48.2%) | 1.1 | 14.8% | 40.4% | 70.0% · abartılı | iddia abartılı | 37 / 37.8% / 37.8% | 87 / 41.4% / 41.4% |

### Favori referansı (İngiliz, sınıf × pist)

| Sınıf | Pist | Koşu | Ort. at | Favori kazandı | İlk 3 favoriden biri |
|---|---|---:|---:|---:|---:|
| COND | Kum | 2245 | 7.9 | 41.4% | 79.0% |
| HAND | Kum | 1963 | 9.2 | 34.4% | 68.7% |
| COND | Çim | 1878 | 8.4 | 39.1% | 77.0% |
| HAND | Çim | 1401 | 9.7 | 31.8% | 63.9% |
| MAIDEN | Kum | 1075 | 9.6 | 39.7% | 73.9% |
| MAIDEN | Çim | 1056 | 10.6 | 40.5% | 70.3% |
| KV | Kum | 924 | 6.7 | 42.7% | 81.8% |
| KV | Çim | 838 | 7.7 | 36.0% | 72.8% |
| COND | Sentetik | 689 | 8.4 | 38.2% | 75.9% |
| HAND | Sentetik | 616 | 9.4 | 36.7% | 67.4% |
| GROUP | Çim | 375 | 9.5 | 37.9% | 69.1% |
| KV | Sentetik | 373 | 7.2 | 41.3% | 79.6% |
| MAIDEN | Sentetik | 361 | 10.2 | 36.6% | 76.2% |
| SAT | Kum | 324 | 9.4 | 41.4% | 71.3% |
| SAT | Çim | 193 | 9.3 | 29.5% | 65.8% |
| GROUP | Kum | 156 | 7.8 | 40.4% | 77.6% |
| SAT | Sentetik | 124 | 10.1 | 34.7% | 67.7% |
| GROUP | Sentetik | 87 | 8.8 | 41.4% | 65.5% |

### Start (kulvar) etkisi (İngiliz), alan büyüklüğüne göre düzeltilmiş

A/E = gerçek birincilik / beklenen birincilik (Σ 1/at sayısı). 1,00 nötr; 1,20 = %20 fazla.

**Kum 1400 m** (2016 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 1963 | 270 | 1.08 |
| 2 | 1959 | 245 | 0.98 |
| 3 | 1951 | 235 | 0.95 |
| 4 | 1947 | 233 | 0.94 |
| 5 | 1927 | 245 | 1.02 |
| 6 | 1767 | 215 | 1.04 |
| 7 | 1537 | 155 | 0.92 |
| 8 | 1302 | 122 | 0.91 |
| 9 | 976 | 99 | 1.07 |
| 10 | 730 | 71 | 1.10 |
| 11 | 545 | 56 | 1.25 |
| 12 | 367 | 23 | 0.82 |
| 13 | 221 | 22 | 1.40 |
| 14 | 144 | 9 | 0.94 |
| 15 | 95 | 3 | 0.51 |
| 16 | 67 | 7 | 1.75 |
| 17 | 42 | 0 | 0.00 |
| 18 | 28 | 5 | 3.32 |

**Çim 1200 m** (973 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 935 | 137 | 1.13 |
| 2 | 936 | 121 | 1.00 |
| 3 | 936 | 127 | 1.05 |
| 4 | 938 | 119 | 0.98 |
| 5 | 914 | 121 | 1.04 |
| 6 | 831 | 97 | 0.98 |
| 7 | 731 | 75 | 0.91 |
| 8 | 610 | 57 | 0.88 |
| 9 | 473 | 48 | 1.05 |
| 10 | 350 | 26 | 0.82 |
| 11 | 247 | 19 | 0.92 |
| 12 | 181 | 16 | 1.12 |
| 13 | 71 | 2 | 0.40 |
| 14 | 57 | 3 | 0.78 |
| 15 | 30 | 3 | 1.63 |
| 16 | 18 | 2 | 1.96 |
| 17 | 16 | 2 | 2.22 |

**Kum 1900 m** (914 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 879 | 124 | 1.06 |
| 2 | 894 | 126 | 1.05 |
| 3 | 887 | 104 | 0.88 |
| 4 | 884 | 119 | 1.01 |
| 5 | 876 | 110 | 0.95 |
| 6 | 770 | 105 | 1.11 |
| 7 | 663 | 71 | 0.93 |
| 8 | 516 | 59 | 1.08 |
| 9 | 389 | 37 | 0.98 |
| 10 | 268 | 21 | 0.88 |
| 11 | 190 | 15 | 0.94 |
| 12 | 132 | 13 | 1.23 |
| 13 | 71 | 2 | 0.39 |
| 14 | 49 | 3 | 0.91 |
| 15 | 35 | 2 | 0.89 |
| 16 | 24 | 2 | 1.35 |

**Çim 1300 m** (885 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 862 | 108 | 1.07 |
| 2 | 856 | 104 | 1.04 |
| 3 | 852 | 132 | 1.34 |
| 4 | 856 | 109 | 1.10 |
| 5 | 842 | 87 | 0.90 |
| 6 | 804 | 81 | 0.91 |
| 7 | 751 | 72 | 0.90 |
| 8 | 685 | 67 | 0.96 |
| 9 | 519 | 36 | 0.75 |
| 10 | 428 | 41 | 1.10 |
| 11 | 339 | 24 | 0.85 |
| 12 | 257 | 14 | 0.68 |
| 13 | 103 | 4 | 0.54 |
| 14 | 83 | 5 | 0.85 |
| 15 | 24 | 2 | 1.30 |

**Kum 1200 m** (874 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 847 | 114 | 1.05 |
| 2 | 841 | 122 | 1.13 |
| 3 | 849 | 96 | 0.88 |
| 4 | 846 | 102 | 0.94 |
| 5 | 826 | 110 | 1.06 |
| 6 | 741 | 99 | 1.14 |
| 7 | 656 | 62 | 0.85 |
| 8 | 578 | 50 | 0.81 |
| 9 | 442 | 38 | 0.88 |
| 10 | 337 | 33 | 1.06 |
| 11 | 227 | 23 | 1.18 |
| 12 | 125 | 16 | 1.62 |
| 13 | 78 | 5 | 0.86 |
| 14 | 45 | 1 | 0.31 |
| 15 | 22 | 2 | 1.37 |

**Çim 1400 m** (764 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 741 | 69 | 0.77 |
| 2 | 747 | 95 | 1.05 |
| 3 | 743 | 81 | 0.90 |
| 4 | 743 | 87 | 0.97 |
| 5 | 734 | 98 | 1.11 |
| 6 | 700 | 97 | 1.20 |
| 7 | 615 | 58 | 0.87 |
| 8 | 519 | 61 | 1.16 |
| 9 | 379 | 38 | 1.10 |
| 10 | 289 | 29 | 1.20 |
| 11 | 217 | 16 | 0.95 |
| 12 | 166 | 13 | 1.09 |
| 13 | 126 | 10 | 1.18 |
| 14 | 106 | 5 | 0.72 |
| 15 | 74 | 4 | 0.87 |
| 16 | 52 | 3 | 0.97 |
| 17 | 34 | 2 | 1.04 |
| 18 | 23 | 1 | 0.80 |

### HAN-16 profili (İngiliz)

1154 koşu; katılan atların handikap puanı 6–75 (P10–P90: 38–68); yaş şartları: 4U, 3O, 3U. Resmi katılım şartı metni bu kaynakta yok; bu aralık katılanlardan gözlemdir.

| Tarih | Şehir | Pist | Mesafe | Yaş | Kazanan | Handikap | Kg | Ganyan | At |
|---|---|---|---:|---|---|---:|---:|---:|---:|
| 2026-11-01 | istanbul | Sentetik | 1400 | 3O | SÜPER HAN | 65 | 59.5 | 2.5 | 8 |
| 2026-10-31 | ankara | Kum | 1400 | 3O | DEJAME | 69 | 58 | 7.6 | 9 |
| 2026-10-30 | bursa | Kum | 2000 | 3O | RISING PEARL | 30 | 52 | 25.75 | 12 |
| 2026-10-25 | istanbul | Çim | 2200 | 3U | KING OF THE WIN | 62 | 61 | 10.55 | 7 |
| 2026-10-24 | izmir | Kum | 1200 | 3U | BATTLECAT | 56 | 54 | 7.35 | 13 |
| 2026-10-23 | istanbul | Çim | 1600 | 3O | ANGEL OF TIME | 46 | 51 | 9.45 | 10 |
| 2026-10-23 | istanbul | Sentetik | 2100 | 3U | NINE TREES | 68 | 56 | 3.55 | 9 |
| 2026-10-21 | bursa | Çim | 2000 | 3U | DRAGON BORA | 52 | 58.5 | 5.25 | 5 |
| 2026-10-17 | izmir | Kum | 2000 | 3U | WAR STORM | 66 | 57.5 | 6.15 | 13 |
| 2026-10-16 | istanbul | Sentetik | 2000 | 3O | VENUS DOOM | 53 | 55 | 14.95 | 8 |
| 2026-10-15 | ankara | Çim | 2400 | 3O | BORN TO TRUST | 68 | 60 | 3.55 | 7 |
| 2026-10-14 | istanbul | Sentetik | 1500 | 3U | PRENS LAUTARO | 63 | 59.5 | 1.7 | 7 |
| 2026-10-12 | bursa | Çim | 1500 | 3O | BAY CAVALLO | 45 | 52 | 2.3 | 12 |
| 2026-10-08 | izmir | Kum | 1200 | 3O | MOMENT SAVER | 66 | 61.5 | 5.05 | 9 |
| 2026-10-08 | izmir | Kum | 1600 | 3U | FASTEST ÇINAR | 61 | 58.5 | 7.9 | 12 |

## Arap atları

11818 sonuçlanmış Arap koşusu. Kurallar İngiliz atları için yazıldı; bu bölüm Araplara aktarılıp aktarılamayacağını gösterir.

### Kurallar (Arap)

| Kural | Koşu | İsabet (95% aralık) | Ort. seçim | Rastgele | Aynı sayıda favori | İddia | Karar | 3 yaş (n / isabet / favori) | Sentetik (n / isabet / favori) |
|---|---:|---|---:|---:|---:|---|---|---|---|
| Şartlı 1 çim: ilk 4 at arasında biter | 217 | 70.5% (64.1%–76.2%) | 4.1 | 39.7% | 70.5% | – | favori seçimi (oran bilgi amaçlı) | 217 / 70.5% / 70.5% | – |
| Şartlı 1 kum: favori-plaseler arasında biter | 99 | 57.6% (47.7%–66.8%) | 3.1 | 32.1% | 57.6% | – | favori seçimi (oran bilgi amaçlı) | 99 / 57.6% / 57.6% | 77 / 68.8% / 68.8% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | 254 | 52.4% (46.2%–58.4%) | 3.0 | 29.2% | 61.4% | – | favoriden kötü | 254 / 52.4% / 61.4% | – |
| Şartlı 2: favori varsa kazanır | 176 | 30.7% (24.3%–37.8%) | 1.1 | 12.5% | 30.7% | – | favori seçimi (oran bilgi amaçlı) | 65 / 36.9% / 36.9% | – |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | 0 / – / – |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | 175 | 71.4% (64.3%–77.6%) | 4.0 | 46.6% | 78.3% | – | favoriden kötü | 64 / 78.1% / 84.4% | – |
| Şartlı 2: 1-2. handikap dışına çıkmaz | 175 | 50.3% (43.0%–57.6%) | 2.1 | 25.0% | 54.3% | – | favoriden farksız | 64 / 57.8% / 65.6% | – |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 163 | 30.7% (24.1%–38.1%) | 3.6 | 38.4% | 65.0% | – | rastgeleden kötü | 63 / 31.7% / 71.4% | – |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 320 | 30.6% (25.8%–35.9%) | 2.0 | 21.9% | 50.3% | – | doğrulanmadı (favori daha sık kazanıyor) | 104 / 32.7% / 48.1% | – |
| Şartlı 3 kum: favori şanslı | 420 | 39.8% (35.2%–44.5%) | 1.1 | 12.3% | 39.8% | – | favori seçimi (oran bilgi amaçlı) | 96 / 40.6% / 40.6% | 134 / 34.3% / 34.3% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 176 | 20.5% (15.2%–27.0%) | 1.3 | 14.5% | 50.0% | – | favoriden kötü | 25 / 52.0% / 64.0% | 69 / 23.2% / 44.9% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 590 | 31.2% (27.6%–35.0%) | 1.9 | 21.1% | 50.3% | – | favoriden kötü | 161 / 37.9% / 48.4% | – |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 295 | 42.7% (37.2%–48.4%) | 3.0 | 33.4% | 70.8% | – | favoriden kötü | 64 / 42.2% / 65.6% | – |
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 671 | 48.6% (44.8%–52.4%) | 3.9 | 48.9% | 81.5% | – | favoriden kötü | 120 / 50.8% / 80.8% | 229 / 43.7% / 83.4% |
| Şartlı 4: favori gelir | 1380 | 38.1% (35.6%–40.7%) | 1.1 | 13.0% | 38.1% | – | favori seçimi (oran bilgi amaçlı) | 269 / 38.3% / 38.3% | – |
| Şartlı 5 çim: favori çok şanslı | 379 | 34.3% (29.7%–39.2%) | 1.1 | 12.7% | 34.3% | – | favori seçimi (oran bilgi amaçlı) | 85 / 36.5% / 36.5% | – |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | 379 | 36.1% (31.5%–41.1%) | 4.1 | 44.8% | 73.9% | 40.0% · tutuyor | rastgeleden kötü | 85 / 30.6% / 78.8% | – |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 75 | 0.0% (0.0%–4.9%) | 1.1 | 13.1% | 50.7% | – | rastgeleden kötü | 18 / 0.0% / 55.6% | 14 / 7.1% / 42.9% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | 48 | 18.8% (10.2%–31.9%) | 1.7 | 19.1% | 39.6% | – | favoriden kötü | 15 / 13.3% / 40.0% | 8 / 50.0% / 50.0% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | 1036 | 83.7% (81.3%–85.8%) | 4.0 | 50.9% | 83.7% | – | favori seçimi (oran bilgi amaçlı) | 187 / 78.6% / 78.6% | – |
| KV-6 çim: 1-2. atların dışına çıkmaz | 214 | 56.1% (49.4%–62.6%) | 2.0 | 25.6% | 56.1% | – | favori seçimi (oran bilgi amaçlı) | 54 / 48.1% / 48.1% | – |
| KV-6 kum: 1-2. atlar şanslı | 220 | 57.3% (50.7%–63.6%) | 2.1 | 27.2% | 57.3% | – | favori seçimi (oran bilgi amaçlı) | 45 / 44.4% / 44.4% | 72 / 65.3% / 65.3% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | 145 | 65.5% (57.5%–72.8%) | 3.0 | 38.8% | 68.3% | – | favoriden farksız | 30 / 56.7% / 60.0% | 47 / 63.8% / 70.2% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | 220 | 66.4% (59.9%–72.3%) | 3.2 | 41.1% | 71.8% | – | favoriden farksız | 45 / 55.6% / 53.3% | 72 / 66.7% / 76.4% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | 28 | 14.3% (5.7%–31.5%) | 1.9 | 22.5% | 39.3% | – | yetersiz örnek | 6 / 16.7% / 33.3% | 13 / 23.1% / 46.2% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | 109 | 60.6% (51.2%–69.2%) | 2.0 | 26.8% | 60.6% | – | favori seçimi (oran bilgi amaçlı) | 35 / 45.7% / 45.7% | – |
| KV-7 erkek kum: %20 favori | 118 | 30.5% (22.9%–39.3%) | 1.1 | 14.1% | 30.5% | 20.0% · temkinli | iddia temkinli (gerçek oran daha yüksek) | 13 / 30.8% / 30.8% | 29 / 69.0% / 69.0% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | 36 | 16.7% (7.9%–31.9%) | 1.7 | 23.2% | 44.4% | – | favoriden kötü | 8 / 0.0% / 50.0% | 13 / 15.4% / 76.9% |
| KV-7 dişi çim: favori, yoksa plaseler | 30 | 70.0% (52.1%–83.3%) | 3.1 | 36.5% | 70.0% | – | favori seçimi (oran bilgi amaçlı) | 11 / 72.7% / 72.7% | – |
| KV-7 dişi kum: 1-2. handikaplı atlar | 25 | 60.0% (40.7%–76.6%) | 2.0 | 24.7% | 72.0% | – | yetersiz örnek | 0 / – / – | 14 / 64.3% / 78.6% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | 88 | 40.9% (31.2%–51.4%) | 1.5 | 20.4% | 47.7% | – | favoriden farksız | 20 / 30.0% / 65.0% | – |
| KV-8 kum: favorinin şansı az (favori gelmez) | 148 | 37.2% (29.8%–45.2%) | 1.1 | 15.5% | 37.2% | – | doğrulanmadı (favori yine en şanslı) | 20 / 40.0% / 40.0% | 56 / 48.2% / 48.2% |
| KV-8 kum: 57 kg altındaki atlar kazanır | 26 | 3.8% (0.7%–18.9%) | 1.2 | 17.4% | 53.8% | – | yetersiz örnek | 8 / 0.0% / 37.5% | 10 / 30.0% / 60.0% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | 73 | 82.2% (71.9%–89.3%) | 3.0 | 45.4% | 82.2% | – | favori seçimi (oran bilgi amaçlı) | 18 / 88.9% / 88.9% | – |
| KV-21 çim: %60 3,4,5 numaralı atlar | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | – |
| KV-21 kum: %60 3,4,5 numaralı atlar | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-21: favori gelmez | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | – |
| KV-22 çim: %60 1,2,3. handikaplar | 17 | 41.2% (21.6%–64.0%) | 3.1 | 34.5% | 64.7% | 60.0% | yetersiz örnek | 0 / – / – | – |
| KV-22 kum: %50 1,2,3 numaralı | 25 | 40.0% (23.4%–59.3%) | 3.0 | 32.4% | 52.0% | 50.0% | yetersiz örnek | 0 / – / – | 21 / 61.9% / 76.2% |
| KV-23 çim: %70 favori kazanır | 0 | – (–––) | – | – | – | 70.0% | yetersiz örnek | 0 / – / – | – |
| KV-23 kum: %60 favori | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-24 çim: handikap puanı 100+ atlar %80 | 0 | – (–––) | – | – | – | 80.0% | yetersiz örnek | 0 / – / – | – |
| KV-24 kum: 90–120 puanlılar %80 | 0 | – (–––) | – | – | – | 80.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-25 çim: 2,3,4,5 numaralı %75 | 0 | – (–––) | – | – | – | 75.0% | yetersiz örnek | 0 / – / – | – |
| KV-25 kum: 3,4,5 numaralı %60 | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| HAN-13 çim: ilk 3 at çok şanslı | 6 | 83.3% (43.6%–97.0%) | 3.0 | 46.0% | 83.3% | – | yetersiz örnek | 6 / 83.3% / 83.3% | – |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | 23 | 73.9% (53.5%–87.5%) | 5.1 | 49.1% | 91.3% | 70.0% | yetersiz örnek | 12 / 58.3% / 100.0% | 0 / – / – |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | 205 | 26.3% (20.8%–32.8%) | 2.3 | 20.4% | 51.2% | 20.0% · temkinli | favoriden kötü | 51 / 33.3% / 52.9% | – |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 188 | 21.3% (16.0%–27.7%) | 2.8 | 23.3% | 54.3% | – | favoriden kötü | 43 / 25.6% / 48.8% | – |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 398 | 29.4% (25.1%–34.1%) | 3.1 | 25.7% | 52.5% | – | favoriden kötü | 57 / 31.6% / 56.1% | 71 / 31.0% / 56.3% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | 415 | 53.3% (48.4%–58.0%) | 3.1 | 27.2% | 53.3% | 75.0% · abartılı | iddia abartılı | 58 / 56.9% / 56.9% | 78 / 55.1% / 55.1% |
| HAN-14 (özet): 1-2. at kazanır | 698 | 44.6% (40.9%–48.3%) | 2.1 | 18.2% | 44.6% | – | favori seçimi (oran bilgi amaçlı) | 126 / 44.4% / 44.4% | – |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 408 | 37.0% (32.5%–41.8%) | 4.5 | 39.2% | 72.3% | – | favoriden kötü | 52 / 28.8% / 76.9% | – |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 560 | 42.7% (38.6%–46.8%) | 3.2 | 31.3% | 59.3% | – | favoriden kötü | 52 / 61.5% / 69.2% | 219 / 37.9% / 62.6% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 379 | 17.4% (13.9%–21.6%) | 1.8 | 15.9% | 37.2% | – | favoriden kötü | 42 / 16.7% / 45.2% | 153 / 18.3% / 41.2% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | 1187 | 58.8% (56.0%–61.6%) | 3.1 | 28.8% | 58.8% | – | favori seçimi (oran bilgi amaçlı) | 127 / 66.9% / 66.9% | – |
| HAN-15 (özet): 3. handikaplı at tek | 1030 | 15.7% (13.6%–18.1%) | 1.2 | 11.5% | 35.1% | – | favoriden kötü | 114 / 22.8% / 38.6% | – |
| HAN-16 çim: favori-plaseler arasında biter | 392 | 58.4% (53.5%–63.2%) | 3.1 | 30.3% | 58.4% | – | favori seçimi (oran bilgi amaçlı) | 0 / – / – | – |
| HAN-16 çim: %30 7,8,9 numaralar | 373 | 25.5% (21.3%–30.1%) | 2.7 | 25.3% | 53.9% | 30.0% · tutuyor | favoriden kötü | 0 / – / – | – |
| HAN-16 kum: 1,2,3. handikaplar %80 | 448 | 36.8% (32.5%–41.4%) | 3.2 | 31.0% | 59.4% | 80.0% · abartılı | favoriden kötü | 0 / – / – | 158 / 34.2% / 65.2% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 361 | 18.0% (14.4%–22.3%) | 2.1 | 18.9% | 42.9% | – | favoriden kötü | 0 / – / – | 129 / 24.0% / 48.8% |
| HAN-16 (özet): hafif kilo favori | 606 | 22.3% (19.1%–25.8%) | 1.2 | 12.1% | 35.1% | – | favoriden kötü | 0 / – / – | – |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | 115 | 35.7% (27.5%–44.7%) | 3.8 | 36.5% | 67.8% | – | favoriden kötü | 0 / – / – | – |
| HAN-17 kum: plase atlar şanslı %70 | 122 | 26.2% (19.2%–34.7%) | 2.0 | 18.4% | 50.0% | 70.0% · abartılı | favoriden kötü | 0 / – / – | 45 / 31.1% / 44.4% |
| HAN-17 kum: puana göre 1-4. atlar | 85 | 61.2% (50.5%–70.8%) | 4.0 | 36.8% | 70.6% | – | favoriden farksız | 0 / – / – | 28 / 60.7% / 78.6% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | 282 | 49.6% (43.9%–55.4%) | 2.1 | 20.0% | 49.6% | – | favori seçimi (oran bilgi amaçlı) | 0 / – / – | – |
| Maiden kum: genelde favori kazanır | 1140 | 37.3% (34.5%–40.1%) | 1.1 | 11.1% | 37.3% | – | favori seçimi (oran bilgi amaçlı) | 716 / 38.1% / 38.1% | 355 / 42.0% / 42.0% |
| Maiden (özet): ilk iki at arasında | 2454 | 57.7% (55.7%–59.6%) | 2.1 | 20.3% | 57.7% | – | favori seçimi (oran bilgi amaçlı) | 1870 / 57.5% / 57.5% | – |
| Açık/Grup çim: favori-plase dışına çıkmaz | 189 | 72.0% (65.2%–77.9%) | 3.1 | 28.7% | 72.0% | – | favori seçimi (oran bilgi amaçlı) | 62 / 69.4% / 69.4% | – |
| Açık/Grup kum: %70 favori | 119 | 45.4% (36.7%–54.3%) | 1.1 | 12.9% | 45.4% | 70.0% · abartılı | iddia abartılı | 18 / 44.4% / 44.4% | 35 / 45.7% / 45.7% |

### Favori referansı (Arap, sınıf × pist)

| Sınıf | Pist | Koşu | Ort. at | Favori kazandı | İlk 3 favoriden biri |
|---|---|---:|---:|---:|---:|
| COND | Kum | 1846 | 8.9 | 38.5% | 73.6% |
| HAND | Kum | 1616 | 11.3 | 29.5% | 57.4% |
| COND | Çim | 1497 | 9.9 | 34.3% | 66.6% |
| HAND | Çim | 1219 | 11.2 | 30.9% | 59.6% |
| MAIDEN | Kum | 1140 | 10.2 | 37.3% | 71.8% |
| MAIDEN | Çim | 959 | 11.3 | 36.5% | 68.6% |
| COND | Sentetik | 625 | 9.1 | 37.6% | 71.7% |
| KV | Kum | 579 | 7.9 | 36.3% | 72.7% |
| HAND | Sentetik | 544 | 11.4 | 30.0% | 59.0% |
| KV | Çim | 498 | 8.4 | 36.1% | 71.5% |
| MAIDEN | Sentetik | 355 | 10.6 | 42.0% | 76.9% |
| KV | Sentetik | 206 | 7.7 | 47.6% | 79.6% |
| GROUP | Çim | 189 | 11.5 | 42.3% | 72.0% |
| SAT | Kum | 184 | 10.5 | 28.3% | 60.3% |
| SAT | Çim | 131 | 11.2 | 29.8% | 67.9% |
| GROUP | Kum | 119 | 9.1 | 45.4% | 75.6% |
| SAT | Sentetik | 65 | 10.5 | 35.4% | 70.8% |
| GROUP | Sentetik | 35 | 10.1 | 45.7% | 74.3% |

### Start (kulvar) etkisi (Arap), alan büyüklüğüne göre düzeltilmiş

A/E = gerçek birincilik / beklenen birincilik (Σ 1/at sayısı). 1,00 nötr; 1,20 = %20 fazla.

**Kum 1400 m** (1593 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 1557 | 188 | 1.12 |
| 2 | 1563 | 170 | 1.01 |
| 3 | 1553 | 171 | 1.02 |
| 4 | 1558 | 143 | 0.85 |
| 5 | 1543 | 156 | 0.95 |
| 6 | 1505 | 165 | 1.05 |
| 7 | 1428 | 139 | 0.97 |
| 8 | 1305 | 135 | 1.07 |
| 9 | 1117 | 95 | 0.94 |
| 10 | 923 | 82 | 1.04 |
| 11 | 709 | 50 | 0.87 |
| 12 | 513 | 39 | 1.00 |
| 13 | 319 | 24 | 1.07 |
| 14 | 221 | 17 | 1.15 |
| 15 | 148 | 11 | 1.17 |
| 16 | 90 | 11 | 2.02 |
| 17 | 55 | 1 | 0.31 |
| 18 | 31 | 2 | 1.13 |

**Çim 1200 m** (965 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 949 | 128 | 1.33 |
| 2 | 943 | 113 | 1.18 |
| 3 | 942 | 95 | 1.00 |
| 4 | 942 | 130 | 1.37 |
| 5 | 945 | 99 | 1.04 |
| 6 | 923 | 97 | 1.05 |
| 7 | 900 | 79 | 0.90 |
| 8 | 836 | 54 | 0.69 |
| 9 | 740 | 51 | 0.77 |
| 10 | 658 | 50 | 0.88 |
| 11 | 545 | 33 | 0.74 |
| 12 | 435 | 24 | 0.69 |
| 13 | 171 | 12 | 0.98 |
| 14 | 127 | 3 | 0.34 |
| 15 | 49 | 2 | 0.64 |
| 16 | 22 | 1 | 0.77 |
| 17 | 15 | 0 | 0.00 |

**Kum 1200 m** (817 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 798 | 110 | 1.28 |
| 2 | 799 | 103 | 1.19 |
| 3 | 797 | 78 | 0.91 |
| 4 | 794 | 92 | 1.08 |
| 5 | 793 | 97 | 1.15 |
| 6 | 760 | 67 | 0.85 |
| 7 | 722 | 57 | 0.79 |
| 8 | 668 | 59 | 0.92 |
| 9 | 573 | 52 | 0.99 |
| 10 | 487 | 41 | 0.96 |
| 11 | 382 | 18 | 0.57 |
| 12 | 259 | 19 | 0.95 |
| 13 | 162 | 14 | 1.20 |
| 14 | 102 | 7 | 1.01 |
| 15 | 70 | 3 | 0.66 |
| 16 | 39 | 2 | 0.83 |

**Çim 1300 m** (729 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 715 | 73 | 1.09 |
| 2 | 717 | 79 | 1.18 |
| 3 | 719 | 75 | 1.11 |
| 4 | 715 | 75 | 1.12 |
| 5 | 712 | 65 | 0.97 |
| 6 | 706 | 61 | 0.94 |
| 7 | 698 | 66 | 1.04 |
| 8 | 675 | 49 | 0.81 |
| 9 | 629 | 50 | 0.92 |
| 10 | 570 | 47 | 0.98 |
| 11 | 497 | 39 | 0.96 |
| 12 | 414 | 25 | 0.76 |
| 13 | 165 | 14 | 1.20 |
| 14 | 133 | 9 | 0.99 |
| 15 | 65 | 2 | 0.48 |
| 16 | 23 | 2 | 1.52 |
| 17 | 15 | 1 | 1.24 |

**Kum 1900 m** (713 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 700 | 75 | 0.93 |
| 2 | 697 | 82 | 1.02 |
| 3 | 698 | 74 | 0.92 |
| 4 | 682 | 72 | 0.91 |
| 5 | 698 | 87 | 1.09 |
| 6 | 669 | 63 | 0.84 |
| 7 | 607 | 75 | 1.17 |
| 8 | 538 | 67 | 1.23 |
| 9 | 413 | 44 | 1.16 |
| 10 | 324 | 22 | 0.79 |
| 11 | 246 | 19 | 0.95 |
| 12 | 178 | 17 | 1.25 |
| 13 | 114 | 5 | 0.62 |
| 14 | 77 | 6 | 1.14 |
| 15 | 47 | 3 | 0.99 |
| 16 | 30 | 4 | 2.14 |

**Çim 1400 m** (680 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 664 | 70 | 0.99 |
| 2 | 674 | 64 | 0.89 |
| 3 | 673 | 86 | 1.20 |
| 4 | 666 | 80 | 1.13 |
| 5 | 669 | 65 | 0.92 |
| 6 | 661 | 81 | 1.17 |
| 7 | 613 | 48 | 0.78 |
| 8 | 550 | 55 | 1.05 |
| 9 | 463 | 46 | 1.12 |
| 10 | 383 | 38 | 1.18 |
| 11 | 296 | 22 | 0.94 |
| 12 | 228 | 5 | 0.30 |
| 13 | 159 | 10 | 0.90 |
| 14 | 99 | 7 | 1.09 |
| 15 | 64 | 3 | 0.77 |
| 16 | 40 | 1 | 0.44 |
| 17 | 28 | 1 | 0.66 |
| 18 | 22 | 0 | 0.00 |
| 19 | 20 | 1 | 0.98 |

### HAN-16 profili (Arap)

998 koşu; katılan atların handikap puanı 8–75 (P10–P90: 37–69); yaş şartları: 4U, 5U, 4O. Resmi katılım şartı metni bu kaynakta yok; bu aralık katılanlardan gözlemdir.

| Tarih | Şehir | Pist | Mesafe | Yaş | Kazanan | Handikap | Kg | Ganyan | At |
|---|---|---|---:|---|---|---:|---:|---:|---:|
| 2026-10-28 | istanbul | Sentetik | 1500 | 4O | KONAKLI | 48 | 52 | 7.45 | 14 |
| 2026-10-24 | izmir | Kum | 1600 | 4U | BALAŞİR | 55 | 55.5 | 3.7 | 16 |
| 2026-10-22 | izmir | Kum | 1200 | 4U | SERTTAYKUT | 53 | 54.5 | 9.05 | 12 |
| 2026-10-22 | bursa | Çim | 1800 | 4U | MAHÇİÇEK | 47 | 53 | 7.55 | 14 |
| 2026-10-18 | istanbul | Sentetik | 2400 | 4O | ALMUTANABİY | 60 | 54.5 | 8.7 | 11 |
| 2026-10-18 | adana | Kum | 2000 | 4O | CANMERT | 52 | 53.5 | 3.7 | 9 |
| 2026-10-13 | adana | Sentetik | 1900 | 4O | ÇEŞMEBAŞI | 44 | 52 | 10.3 | 16 |
| 2026-10-12 | bursa | Çim | 1500 | 4O | BİÇERGİLLER | 66 | 61.5 | 5.9 | 15 |
| 2026-10-11 | istanbul | Çim | 1600 | 4U | UMUDUNU KAYBETME | 71 | 61.5 | 3.7 | 13 |
| 2026-10-11 | adana | Sentetik | 2000 | 4U | ÖZGÜNALP | 63 | 58 | 15.65 | 11 |
| 2026-10-08 | ankara | Çim | 1400 | 4U | LOSTRA | 67 | 59 | 15.95 | 16 |
| 2026-10-07 | istanbul | Sentetik | 2000 | 4U | MANDAR ABBAS | 53 | 52 | 3.7 | 14 |
| 2026-10-05 | bursa | Çim | 1700 | 4U | ZİNAMIN | 55 | 56.5 | 12.3 | 12 |
| 2026-10-01 | izmir | Kum | 1400 | 4U | ERGEN | 52 | 55 | 10.45 | 15 |
| 2026-09-30 | istanbul | Sentetik | 1400 | 4U | YEŞİLKAYA | 72 | 59 | 12.45 | 17 |
