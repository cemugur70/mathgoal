# Kural seti backtest'i (İngiliz ve Arap atları)

Kaynak: liderform.com.tr herkese açık program sayfaları, 2024-01-01 – 2026-10-31; İstanbul, Ankara, İzmir, Bursa ve Adana'da 7123 İngiliz, 5664 Arap koşusu. Üretim: 2026-11-01T17:21:57.584Z.

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
- **ROI**: seçilen her ata 1 TL ganyan; resmi kapanış ganyanı ile (ödenen ganyan ikramiyesiyle 18288/18290 koşuda birebir aynı). Hipodrom kesintisi yüzünden rastgele oynamanın beklenen ROI'si negatiftir.

### İngiliz: doğrulama özeti

Keşif < 2026-01-01: 5019 koşu · doğrulama ≥ 2026-01-01: 2104 koşu. iddia doğrulandı: 1 · tersi doğrulandı: 12 · tekrar etmedi: 4 · kanıt yok: 2 · favori seçimi: 16 · yetersiz örnek: 35.

| Kural | Karar | Keşif n | Keşif isabet / favori | Fark (puan) | p | q (BH) | Doğrulama n | Doğrulama isabet / favori | Fark (puan) | p | ROI kural / aynı sayıda favori (tüm dönem) |
|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|
| HAN-14 kum: %75 1-2-3. atlara güvenin | **iddia doğrulandı** | 167 | 71.3% / 71.3% | 0.0 | – | – | 75 | 76.0% / 76.0% | 0.0 | – | -23.9% / -23.9% |
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | **tersi doğrulandı** | 244 | 54.1% / 89.3% | -35.2 | <0.001 | <0.001 | 133 | 51.9% / 85.7% | -33.8 | <0.001 | -39.4% / -30.2% |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | **tersi doğrulandı** | 135 | 25.9% / 74.1% | -48.1 | <0.001 | <0.001 | 43 | 39.5% / 83.7% | -44.2 | <0.001 | -45.7% / -28.3% |
| HAN-15 (özet): 3. handikaplı at tek | **tersi doğrulandı** | 387 | 15.8% / 39.8% | -24.0 | <0.001 | <0.001 | 174 | 12.1% / 32.8% | -20.7 | <0.001 | -41.7% / -25.5% |
| HAN-16 çim: %30 7,8,9 numaralar | **tersi doğrulandı** | 134 | 17.9% / 59.0% | -41.0 | <0.001 | <0.001 | 48 | 16.7% / 56.3% | -39.6 | <0.001 | -55.8% / -25.6% |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | **tersi doğrulandı** | 222 | 49.5% / 73.9% | -24.3 | <0.001 | <0.001 | 108 | 41.7% / 64.8% | -23.1 | <0.001 | -39.3% / -29.1% |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | **tersi doğrulandı** | 142 | 25.4% / 54.9% | -29.6 | <0.001 | <0.001 | 63 | 30.2% / 60.3% | -30.2 | <0.001 | -45.5% / -24.8% |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | **tersi doğrulandı** | 149 | 36.2% / 70.5% | -34.2 | <0.001 | <0.001 | 63 | 41.3% / 69.8% | -28.6 | 0.001 | -5.6% / -25.7% |
| HAN-16 kum: 1,2,3. handikaplar %80 | **tersi doğrulandı** | 179 | 44.7% / 69.3% | -24.6 | <0.001 | <0.001 | 85 | 38.8% / 71.8% | -32.9 | <0.001 | -38.6% / -28.2% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | **tersi doğrulandı** | 208 | 29.8% / 50.0% | -20.2 | <0.001 | <0.001 | 76 | 39.5% / 59.2% | -19.7 | 0.002 | -37.1% / -30.5% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | **tersi doğrulandı** | 92 | 27.2% / 51.1% | -23.9 | <0.001 | <0.001 | 31 | 22.6% / 48.4% | -25.8 | 0.023 | -33.1% / -26.7% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | **tersi doğrulandı** | 128 | 28.1% / 47.7% | -19.5 | 0.002 | 0.003 | 61 | 19.7% / 55.7% | -36.1 | <0.001 | -1.5% / -26.6% |
| HAN-16 (özet): hafif kilo favori | **tersi doğrulandı** | 253 | 29.6% / 39.5% | -9.9 | 0.005 | 0.008 | 109 | 33.9% / 46.8% | -12.8 | 0.021 | -17.1% / -18.8% |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | **tekrar etmedi** | 118 | 43.2% / 78.8% | -35.6 | <0.001 | <0.001 | 66 | 68.2% / 69.7% | -1.5 | 0.859 | -10.1% / -25.3% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | **tekrar etmedi** | 134 | 20.1% / 52.2% | -32.1 | <0.001 | <0.001 | 77 | 23.4% / 37.7% | -14.3 | 0.059 | -21.6% / -21.0% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | **tekrar etmedi** | 115 | 72.2% / 82.6% | -10.4 | 0.021 | 0.029 | 52 | 67.3% / 73.1% | -5.8 | 0.407 | -30.0% / -29.4% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | **tekrar etmedi** | 121 | 56.2% / 64.5% | -8.3 | 0.074 | 0.094 | 96 | 64.6% / 70.8% | -6.3 | 0.080 | -30.2% / -31.8% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | **kanıt yok** | 62 | 80.6% / 83.9% | -3.2 | 0.566 | 0.588 | 50 | 68.0% / 72.0% | -4.0 | 0.416 | -29.1% / -31.1% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | **kanıt yok** | 68 | 41.2% / 42.6% | -1.5 | 0.828 | 0.828 | 32 | 40.6% / 62.5% | -21.9 | 0.025 | -21.9% / -25.8% |
| Şartlı 1 çim: ilk 4 at arasında biter | **favori seçimi** | 119 | 81.5% / 81.5% | 0.0 | – | – | 47 | 66.0% / 66.0% | 0.0 | – | -28.8% / -28.8% |
| Şartlı 1 kum: favori-plaseler arasında biter | **favori seçimi** | 74 | 64.9% / 64.9% | 0.0 | – | – | 31 | 87.1% / 87.1% | 0.0 | – | -33.5% / -33.5% |
| Şartlı 3 kum: favori şanslı | **favori seçimi** | 190 | 41.6% / 41.6% | 0.0 | – | – | 83 | 47.0% / 47.0% | 0.0 | – | -28.1% / -28.1% |
| Şartlı 4: favori gelir | **favori seçimi** | 541 | 42.9% / 42.9% | 0.0 | – | – | 234 | 40.6% / 40.6% | 0.0 | – | -28.3% / -28.3% |
| Şartlı 5 çim: favori çok şanslı | **favori seçimi** | 135 | 35.6% / 35.6% | 0.0 | – | – | 43 | 55.8% / 55.8% | 0.0 | – | -28.1% / -28.1% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | **favori seçimi** | 394 | 86.5% / 86.5% | 0.0 | – | – | 154 | 88.3% / 88.3% | 0.0 | – | -29.9% / -29.9% |
| KV-6 çim: 1-2. atların dışına çıkmaz | **favori seçimi** | 80 | 57.5% / 57.5% | 0.0 | – | – | 36 | 52.8% / 52.8% | 0.0 | – | -28.0% / -28.0% |
| KV-6 kum: 1-2. atlar şanslı | **favori seçimi** | 115 | 61.7% / 61.7% | 0.0 | – | – | 52 | 61.5% / 61.5% | 0.0 | – | -33.3% / -33.3% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | **favori seçimi** | 80 | 85.0% / 85.0% | 0.0 | – | – | 32 | 81.3% / 81.3% | 0.0 | – | -24.4% / -24.4% |
| HAN-14 (özet): 1-2. at kazanır | **favori seçimi** | 273 | 50.2% / 50.2% | 0.0 | – | – | 110 | 60.0% / 60.0% | 0.0 | – | -30.2% / -30.2% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | **favori seçimi** | 455 | 67.9% / 67.9% | 0.0 | – | – | 205 | 61.5% / 61.5% | 0.0 | – | -30.2% / -30.2% |
| HAN-16 çim: favori-plaseler arasında biter | **favori seçimi** | 156 | 64.7% / 64.7% | 0.0 | – | – | 51 | 62.7% / 62.7% | 0.0 | – | -30.3% / -30.3% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | **favori seçimi** | 135 | 55.6% / 55.6% | 0.0 | – | – | 50 | 54.0% / 54.0% | 0.0 | – | -28.3% / -28.3% |
| Maiden kum: genelde favori kazanır | **favori seçimi** | 370 | 38.9% / 38.9% | 0.0 | – | – | 179 | 43.0% / 43.0% | 0.0 | – | -28.2% / -28.2% |
| Maiden (özet): ilk iki at arasında | **favori seçimi** | 842 | 57.1% / 57.1% | 0.0 | – | – | 371 | 57.4% / 57.4% | 0.0 | – | -31.6% / -31.6% |
| Açık/Grup çim: favori-plase dışına çıkmaz | **favori seçimi** | 112 | 68.8% / 68.8% | 0.0 | – | – | 55 | 61.8% / 61.8% | 0.0 | – | -39.8% / -39.8% |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | **yetersiz örnek** | 50 | 18.0% / 76.0% | -58.0 | <0.001 | <0.001 | 3 | 66.7% / 66.7% | 0.0 | 1.000 | -57.8% / -27.4% |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | **yetersiz örnek** | 46 | 21.7% / 73.9% | -52.2 | <0.001 | <0.001 | 17 | 23.5% / 88.2% | -64.7 | <0.001 | -68.3% / -3.2% |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | **yetersiz örnek** | 75 | 12.0% / 53.3% | -41.3 | <0.001 | <0.001 | 22 | 22.7% / 36.4% | -13.6 | 0.409 | -42.8% / -29.6% |
| KV-8 kum: favorinin şansı az (favori gelmez) | **yetersiz örnek** | 82 | 47.6% / 16.5% | +31.1 | <0.001 | <0.001 | 29 | 65.5% / 16.8% | +48.8 | <0.001 | -21.1% / -21.1% |
| HAN-17 kum: plase atlar şanslı %70 | **yetersiz örnek** | 64 | 29.7% / 54.7% | -25.0 | 0.002 | 0.003 | 22 | 40.9% / 50.0% | -9.1 | 0.533 | -36.1% / -29.4% |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | **yetersiz örnek** | 51 | 72.5% / 84.3% | -11.8 | 0.103 | 0.124 | 3 | 33.3% / 66.7% | -33.3 | 0.617 | -26.6% / -27.3% |
| Şartlı 2: 1-2. handikap dışına çıkmaz | **yetersiz örnek** | 51 | 52.9% / 62.7% | -9.8 | 0.250 | 0.281 | 3 | 0.0% / 33.3% | -33.3 | 0.317 | -22.1% / -25.8% |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | **yetersiz örnek** | 138 | 44.9% / 37.0% | +8.0 | 0.301 | 0.331 | 28 | 57.1% / 32.1% | +25.0 | 0.154 | -4.1% / -8.8% |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | **yetersiz örnek** | 82 | 40.2% / 45.1% | -4.9 | 0.466 | 0.494 | 24 | 12.5% / 33.3% | -20.8 | 0.045 | -23.7% / -41.0% |
| HAN-17 kum: puana göre 1-4. atlar | **yetersiz örnek** | 34 | 85.3% / 88.2% | -2.9 | 0.709 | 0.722 | 22 | 81.8% / 90.9% | -9.1 | 0.317 | -17.6% / -15.7% |
| Şartlı 2: favori varsa kazanır | **yetersiz örnek** | 51 | 43.1% / 43.1% | 0.0 | – | – | 3 | 33.3% / 33.3% | 0.0 | – | -21.7% / -21.7% |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | **yetersiz örnek** | 24 | 12.5% / 20.8% | -8.3 | 0.418 | – | 10 | 0.0% / 40.0% | -40.0 | 0.014 | -4.1% / -60.7% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | **yetersiz örnek** | 23 | 21.7% / 13.0% | +8.7 | 0.418 | – | 8 | 12.5% / 62.5% | -50.0 | 0.061 | -35.4% / -70.7% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | **yetersiz örnek** | 23 | 17.4% / 56.5% | -39.1 | <0.001 | – | 9 | 33.3% / 77.8% | -44.4 | 0.011 | -68.2% / -22.5% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | **yetersiz örnek** | 55 | 58.2% / 58.2% | 0.0 | – | – | 16 | 75.0% / 75.0% | 0.0 | – | -25.7% / -25.7% |
| KV-7 erkek kum: %20 favori | **yetersiz örnek** | 61 | 32.8% / 32.8% | 0.0 | – | – | 25 | 36.0% / 36.0% | 0.0 | – | -44.8% / -44.8% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | **yetersiz örnek** | 27 | 18.5% / 44.4% | -25.9 | 0.023 | – | 11 | 0.0% / 54.5% | -54.5 | <0.001 | -56.5% / -48.6% |
| KV-7 dişi çim: favori, yoksa plaseler | **yetersiz örnek** | 28 | 67.9% / 67.9% | 0.0 | – | – | 6 | 33.3% / 33.3% | 0.0 | – | -41.5% / -41.5% |
| KV-7 dişi kum: 1-2. handikaplı atlar | **yetersiz örnek** | 28 | 50.0% / 60.7% | -10.7 | 0.254 | – | 14 | 78.6% / 92.9% | -14.3 | 0.141 | -37.5% / -27.4% |
| KV-8 kum: 57 kg altındaki atlar kazanır | **yetersiz örnek** | 22 | 18.2% / 68.2% | -50.0 | 0.002 | – | 7 | 14.3% / 71.4% | -57.1 | 0.005 | +89.2% / -19.9% |
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
| HAN-13 kum: 1,2,3,4. handikaplar %70 | **yetersiz örnek** | 11 | 81.8% / 90.9% | -9.1 | 0.576 | – | 3 | 100.0% / 100.0% | 0.0 | – | -31.2% / -29.0% |
| Açık/Grup kum: %70 favori | **yetersiz örnek** | 38 | 57.9% / 57.9% | 0.0 | – | – | 19 | 47.4% / 47.4% | 0.0 | – | -26.1% / -26.1% |

### Arap: doğrulama özeti

Keşif < 2026-01-01: 4063 koşu · doğrulama ≥ 2026-01-01: 1601 koşu. tersi doğrulandı: 12 · iddia çürütüldü: 1 · tekrar etmedi: 2 · kanıt yok: 2 · favori seçimi: 12 · yetersiz örnek: 41.

| Kural | Karar | Keşif n | Keşif isabet / favori | Fark (puan) | p | q (BH) | Doğrulama n | Doğrulama isabet / favori | Fark (puan) | p | ROI kural / aynı sayıda favori (tüm dönem) |
|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | **tersi doğrulandı** | 233 | 45.9% / 81.1% | -35.2 | <0.001 | <0.001 | 104 | 52.9% / 81.7% | -28.8 | <0.001 | -42.4% / -28.0% |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | **tersi doğrulandı** | 138 | 31.9% / 66.7% | -34.8 | <0.001 | <0.001 | 48 | 43.8% / 75.0% | -31.3 | <0.001 | -30.8% / -34.4% |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | **tersi doğrulandı** | 128 | 38.3% / 73.4% | -35.2 | <0.001 | <0.001 | 42 | 42.9% / 71.4% | -28.6 | 0.006 | -30.8% / -31.3% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | **tersi doğrulandı** | 229 | 30.1% / 51.1% | -21.0 | <0.001 | <0.001 | 75 | 36.0% / 50.7% | -14.7 | 0.037 | -41.8% / -31.5% |
| HAN-15 (özet): 3. handikaplı at tek | **tersi doğrulandı** | 349 | 16.3% / 32.7% | -16.3 | <0.001 | <0.001 | 134 | 17.2% / 35.8% | -18.7 | <0.001 | -20.5% / -26.4% |
| HAN-16 kum: 1,2,3. handikaplar %80 | **tersi doğrulandı** | 156 | 34.6% / 59.6% | -25.0 | <0.001 | <0.001 | 65 | 32.3% / 67.7% | -35.4 | <0.001 | -40.1% / -30.9% |
| HAN-16 çim: %30 7,8,9 numaralar | **tersi doğrulandı** | 125 | 25.6% / 54.4% | -28.8 | <0.001 | <0.001 | 46 | 17.4% / 58.7% | -41.3 | <0.001 | -26.9% / -24.1% |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | **tersi doğrulandı** | 136 | 29.4% / 52.2% | -22.8 | <0.001 | <0.001 | 58 | 27.6% / 56.9% | -29.3 | <0.001 | -41.8% / -37.3% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | **tersi doğrulandı** | 127 | 18.1% / 37.8% | -19.7 | <0.001 | <0.001 | 52 | 15.4% / 32.7% | -17.3 | 0.023 | -24.7% / -37.5% |
| HAN-16 (özet): hafif kilo favori | **tersi doğrulandı** | 214 | 24.3% / 34.1% | -9.8 | 0.004 | 0.006 | 92 | 28.3% / 44.6% | -16.3 | 0.007 | -27.1% / -12.8% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | **tersi doğrulandı** | 69 | 46.4% / 58.0% | -11.6 | 0.041 | 0.055 | 67 | 50.7% / 64.2% | -13.4 | 0.009 | -41.7% / -30.4% |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | **tersi doğrulandı** | 87 | 51.7% / 66.7% | -14.9 | 0.044 | 0.058 | 46 | 37.0% / 63.0% | -26.1 | 0.006 | -21.0% / -33.3% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | **iddia çürütüldü** | 139 | 58.3% / 58.3% | 0.0 | – | – | 60 | 58.3% / 58.3% | 0.0 | – | -34.9% / -34.9% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | **tekrar etmedi** | 113 | 18.6% / 45.1% | -26.5 | <0.001 | <0.001 | 49 | 28.6% / 42.9% | -14.3 | 0.157 | -22.3% / -32.5% |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | **tekrar etmedi** | 187 | 42.8% / 59.9% | -17.1 | <0.001 | <0.001 | 87 | 48.3% / 58.6% | -10.3 | 0.114 | -21.5% / -34.0% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | **kanıt yok** | 40 | 65.0% / 75.0% | -10.0 | 0.152 | 0.178 | 33 | 75.8% / 75.8% | 0.0 | 1.000 | -37.8% / -37.0% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | **kanıt yok** | 74 | 70.3% / 77.0% | -6.8 | 0.224 | 0.257 | 33 | 60.6% / 75.8% | -15.2 | 0.049 | -25.7% / -34.9% |
| Şartlı 1 çim: ilk 4 at arasında biter | **favori seçimi** | 73 | 74.0% / 74.0% | 0.0 | – | – | 31 | 64.5% / 64.5% | 0.0 | – | -35.4% / -35.4% |
| Şartlı 3 kum: favori şanslı | **favori seçimi** | 142 | 46.5% / 46.5% | 0.0 | – | – | 60 | 43.3% / 43.3% | 0.0 | – | -14.1% / -14.1% |
| Şartlı 4: favori gelir | **favori seçimi** | 481 | 36.0% / 36.0% | 0.0 | – | – | 181 | 33.1% / 33.1% | 0.0 | – | -36.8% / -36.8% |
| Şartlı 5 çim: favori çok şanslı | **favori seçimi** | 128 | 35.9% / 35.9% | 0.0 | – | – | 42 | 21.4% / 21.4% | 0.0 | – | -37.7% / -37.7% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | **favori seçimi** | 360 | 83.6% / 83.6% | 0.0 | – | – | 142 | 81.7% / 81.7% | 0.0 | – | -29.7% / -29.7% |
| KV-6 kum: 1-2. atlar şanslı | **favori seçimi** | 74 | 56.8% / 56.8% | 0.0 | – | – | 33 | 60.6% / 60.6% | 0.0 | – | -40.3% / -40.3% |
| HAN-14 (özet): 1-2. at kazanır | **favori seçimi** | 235 | 48.9% / 48.9% | 0.0 | – | – | 88 | 45.5% / 45.5% | 0.0 | – | -25.9% / -25.9% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | **favori seçimi** | 399 | 57.9% / 57.9% | 0.0 | – | – | 166 | 58.4% / 58.4% | 0.0 | – | -32.8% / -32.8% |
| HAN-16 çim: favori-plaseler arasında biter | **favori seçimi** | 135 | 59.3% / 59.3% | 0.0 | – | – | 46 | 60.9% / 60.9% | 0.0 | – | -27.5% / -27.5% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | **favori seçimi** | 98 | 52.0% / 52.0% | 0.0 | – | – | 38 | 52.6% / 52.6% | 0.0 | – | -17.6% / -17.6% |
| Maiden kum: genelde favori kazanır | **favori seçimi** | 384 | 35.4% / 35.4% | 0.0 | – | – | 171 | 33.3% / 33.3% | 0.0 | – | -34.0% / -34.0% |
| Maiden (özet): ilk iki at arasında | **favori seçimi** | 833 | 56.7% / 56.7% | 0.0 | – | – | 340 | 51.8% / 51.8% | 0.0 | – | -30.5% / -30.5% |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | **yetersiz örnek** | 59 | 15.3% / 55.9% | -40.7 | <0.001 | <0.001 | 14 | 7.1% / 57.1% | -50.0 | 0.004 | -58.8% / -29.6% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | **yetersiz örnek** | 62 | 16.1% / 54.8% | -38.7 | <0.001 | <0.001 | 22 | 27.3% / 45.5% | -18.2 | 0.147 | -23.5% / -3.2% |
| KV-8 kum: favorinin şansı az (favori gelmez) | **yetersiz örnek** | 54 | 37.0% / 16.4% | +20.7 | 0.002 | 0.003 | 25 | 52.0% / 15.0% | +37.0 | <0.001 | -40.5% / -40.5% |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | **yetersiz örnek** | 67 | 32.8% / 59.7% | -26.9 | 0.002 | 0.003 | 17 | 23.5% / 52.9% | -29.4 | 0.077 | -13.9% / -13.1% |
| HAN-17 kum: plase atlar şanslı %70 | **yetersiz örnek** | 44 | 25.0% / 52.3% | -27.3 | 0.004 | 0.006 | 19 | 36.8% / 52.6% | -15.8 | 0.317 | -36.0% / -17.8% |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | **yetersiz örnek** | 55 | 34.5% / 56.4% | -21.8 | 0.014 | 0.020 | 3 | 66.7% / 100.0% | -33.3 | 0.317 | +22.3% / -21.4% |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | **yetersiz örnek** | 38 | 36.8% / 65.8% | -28.9 | 0.015 | 0.021 | 13 | 38.5% / 84.6% | -46.2 | 0.001 | -34.2% / -22.4% |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | **yetersiz örnek** | 122 | 39.3% / 25.4% | +13.9 | 0.053 | 0.068 | 27 | 25.9% / 29.6% | -3.7 | 0.800 | -15.9% / -29.8% |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | **yetersiz örnek** | 61 | 67.2% / 75.4% | -8.2 | 0.091 | 0.111 | 3 | 66.7% / 100.0% | -33.3 | 0.317 | -29.2% / -20.1% |
| Şartlı 2: 1-2. handikap dışına çıkmaz | **yetersiz örnek** | 61 | 41.0% / 47.5% | -6.6 | 0.317 | 0.343 | 3 | 33.3% / 33.3% | 0.0 | 1.000 | -38.9% / -35.7% |
| Şartlı 1 kum: favori-plaseler arasında biter | **yetersiz örnek** | 33 | 57.6% / 57.6% | 0.0 | – | – | 17 | 64.7% / 64.7% | 0.0 | – | -31.7% / -31.7% |
| Şartlı 2: favori varsa kazanır | **yetersiz örnek** | 61 | 23.0% / 23.0% | 0.0 | – | – | 3 | 0.0% / 0.0% | 0.0 | – | -62.3% / -62.3% |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | **yetersiz örnek** | 20 | 0.0% / 60.0% | -60.0 | <0.001 | – | 14 | 0.0% / 42.9% | -42.9 | 0.002 | -100.0% / -11.2% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | **yetersiz örnek** | 15 | 26.7% / 46.7% | -20.0 | 0.167 | – | 13 | 23.1% / 46.2% | -23.1 | 0.165 | -41.0% / -45.9% |
| KV-6 çim: 1-2. atların dışına çıkmaz | **yetersiz örnek** | 83 | 56.6% / 56.6% | 0.0 | – | – | 26 | 46.2% / 46.2% | 0.0 | – | -29.2% / -29.2% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | **yetersiz örnek** | 10 | 20.0% / 30.0% | -10.0 | 0.577 | – | 5 | 0.0% / 20.0% | -20.0 | 0.317 | -81.5% / -82.4% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | **yetersiz örnek** | 37 | 67.6% / 67.6% | 0.0 | – | – | 12 | 50.0% / 50.0% | 0.0 | – | -9.5% / -9.5% |
| KV-7 erkek kum: %20 favori | **yetersiz örnek** | 39 | 30.8% / 30.8% | 0.0 | – | – | 19 | 36.8% / 36.8% | 0.0 | – | -33.1% / -33.1% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | **yetersiz örnek** | 10 | 20.0% / 40.0% | -20.0 | 0.317 | – | 7 | 14.3% / 71.4% | -57.1 | 0.005 | -66.2% / -12.7% |
| KV-7 dişi çim: favori, yoksa plaseler | **yetersiz örnek** | 11 | 81.8% / 81.8% | 0.0 | – | – | 4 | 75.0% / 75.0% | 0.0 | – | -16.6% / -16.6% |
| KV-7 dişi kum: 1-2. handikaplı atlar | **yetersiz örnek** | 8 | 62.5% / 87.5% | -25.0 | 0.127 | – | 5 | 40.0% / 60.0% | -20.0 | 0.317 | -49.4% / -17.7% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | **yetersiz örnek** | 27 | 40.7% / 59.3% | -18.5 | 0.122 | – | 9 | 66.7% / 44.4% | +22.2 | 0.131 | -14.2% / -14.0% |
| KV-8 kum: 57 kg altındaki atlar kazanır | **yetersiz örnek** | 9 | 0.0% / 55.6% | -55.6 | 0.002 | – | 6 | 0.0% / 66.7% | -66.7 | 0.002 | -100.0% / -14.4% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | **yetersiz örnek** | 35 | 77.1% / 77.1% | 0.0 | – | – | 13 | 92.3% / 92.3% | 0.0 | – | -36.6% / -36.6% |
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
| HAN-13 çim: ilk 3 at çok şanslı | **yetersiz örnek** | 2 | 100.0% / 100.0% | 0.0 | – | – | 1 | 100.0% / 100.0% | 0.0 | – | +13.3% / +13.3% |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | **yetersiz örnek** | 12 | 66.7% / 91.7% | -25.0 | 0.056 | – | 2 | 100.0% / 100.0% | 0.0 | – | -48.7% / -31.3% |
| HAN-17 kum: puana göre 1-4. atlar | **yetersiz örnek** | 27 | 48.1% / 63.0% | -14.8 | 0.149 | – | 19 | 73.7% / 73.7% | 0.0 | 1.000 | -39.0% / -40.1% |
| Açık/Grup çim: favori-plase dışına çıkmaz | **yetersiz örnek** | 54 | 63.0% / 63.0% | 0.0 | – | – | 26 | 76.9% / 76.9% | 0.0 | – | -37.2% / -37.2% |
| Açık/Grup kum: %70 favori | **yetersiz örnek** | 28 | 53.6% / 53.6% | 0.0 | – | – | 12 | 33.3% / 33.3% | 0.0 | – | -11.7% / -11.7% |

## İngiliz atları

7123 sonuçlanmış İngiliz koşusu.

### Kurallar (İngiliz)

| Kural | Koşu | İsabet (95% aralık) | Ort. seçim | Rastgele | Aynı sayıda favori | İddia | Karar | 3 yaş (n / isabet / favori) | Sentetik (n / isabet / favori) |
|---|---:|---|---:|---:|---:|---|---|---|---|
| Şartlı 1 çim: ilk 4 at arasında biter | 166 | 77.1% (70.1%–82.8%) | 4.0 | 49.8% | 77.1% | – | favori seçimi (oran bilgi amaçlı) | 6 / 66.7% / 66.7% | – |
| Şartlı 1 kum: favori-plaseler arasında biter | 105 | 71.4% (62.2%–79.2%) | 3.0 | 35.1% | 71.4% | – | favori seçimi (oran bilgi amaçlı) | 28 / 67.9% / 67.9% | 62 / 62.9% / 62.9% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | 217 | 59.9% (53.3%–66.2%) | 3.0 | 34.9% | 67.3% | – | favoriden kötü | 35 / 57.1% / 77.1% | – |
| Şartlı 2: favori varsa kazanır | 54 | 42.6% (30.3%–55.8%) | 1.0 | 13.4% | 42.6% | – | favori seçimi (oran bilgi amaçlı) | 21 / 33.3% / 33.3% | – |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | 0 / – / – |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | 54 | 70.4% (57.2%–80.9%) | 4.0 | 50.9% | 83.3% | – | favoriden kötü | 21 / 76.2% / 85.7% | – |
| Şartlı 2: 1-2. handikap dışına çıkmaz | 54 | 50.0% (37.1%–62.9%) | 2.1 | 27.4% | 61.1% | – | favoriden farksız | 21 / 38.1% / 57.1% | – |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 53 | 20.8% (12.0%–33.5%) | 3.2 | 37.1% | 75.5% | – | rastgeleden kötü | 21 / 42.9% / 71.4% | – |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 166 | 47.0% (39.5%–54.6%) | 2.0 | 26.3% | 69.3% | – | doğrulandı | 54 / 51.9% / 66.7% | – |
| Şartlı 3 kum: favori şanslı | 273 | 43.2% (37.5%–49.2%) | 1.1 | 14.7% | 43.2% | – | favori seçimi (oran bilgi amaçlı) | 111 / 37.8% / 37.8% | 69 / 31.9% / 31.9% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 123 | 26.0% (19.1%–34.4%) | 1.5 | 19.3% | 50.4% | – | favoriden kötü | 73 / 35.6% / 49.3% | 39 / 23.1% / 53.8% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 284 | 32.4% (27.2%–38.0%) | 1.8 | 22.2% | 52.5% | – | favoriden kötü | 84 / 20.2% / 33.3% | – |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 184 | 52.2% (45.0%–59.3%) | 3.0 | 40.1% | 75.5% | – | favoriden kötü | 69 / 55.1% / 73.9% | – |
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 377 | 53.3% (48.3%–58.3%) | 3.9 | 57.9% | 88.1% | – | favoriden kötü | 147 / 56.5% / 89.1% | 107 / 54.2% / 86.0% |
| Şartlı 4: favori gelir | 775 | 42.2% (38.8%–45.7%) | 1.0 | 14.9% | 42.2% | – | favori seçimi (oran bilgi amaçlı) | 287 / 40.4% / 40.4% | – |
| Şartlı 5 çim: favori çok şanslı | 178 | 40.4% (33.5%–47.8%) | 1.1 | 15.7% | 40.4% | – | favori seçimi (oran bilgi amaçlı) | 55 / 43.6% / 43.6% | – |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | 178 | 29.2% (23.0%–36.3%) | 3.3 | 43.3% | 76.4% | 40.0% · abartılı | rastgeleden kötü | 55 / 20.0% / 85.5% | – |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 34 | 8.8% (3.0%–23.0%) | 1.1 | 16.3% | 26.5% | – | favoriden kötü | 14 / 7.1% / 42.9% | 7 / 0.0% / 42.9% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | 31 | 19.4% (9.2%–36.3%) | 1.2 | 19.0% | 25.8% | – | favoriden farksız | 8 / 12.5% / 25.0% | 11 / 36.4% / 45.5% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | 548 | 87.0% (84.0%–89.6%) | 4.0 | 61.3% | 87.0% | – | favori seçimi (oran bilgi amaçlı) | 179 / 89.9% / 89.9% | – |
| KV-6 çim: 1-2. atların dışına çıkmaz | 116 | 56.0% (47.0%–64.7%) | 2.0 | 28.0% | 56.0% | – | favori seçimi (oran bilgi amaçlı) | 44 / 56.8% / 56.8% | – |
| KV-6 kum: 1-2. atlar şanslı | 167 | 61.7% (54.1%–68.7%) | 2.0 | 32.3% | 61.7% | – | favori seçimi (oran bilgi amaçlı) | 68 / 69.1% / 69.1% | 41 / 56.1% / 56.1% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | 112 | 75.0% (66.2%–82.1%) | 3.0 | 47.5% | 78.6% | – | favoriden farksız | 46 / 76.1% / 78.3% | 27 / 70.4% / 81.5% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | 167 | 70.7% (63.4%–77.0%) | 3.2 | 49.9% | 79.6% | – | favoriden kötü | 68 / 77.9% / 82.4% | 41 / 68.3% / 80.5% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | 32 | 21.9% (11.0%–38.8%) | 1.7 | 23.2% | 62.5% | – | favoriden kötü | 13 / 23.1% / 84.6% | 10 / 30.0% / 50.0% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | 71 | 62.0% (50.3%–72.4%) | 2.0 | 30.6% | 62.0% | – | favori seçimi (oran bilgi amaçlı) | 21 / 57.1% / 57.1% | – |
| KV-7 erkek kum: %20 favori | 86 | 33.7% (24.6%–44.2%) | 1.0 | 16.2% | 33.7% | 20.0% · temkinli | iddia temkinli (gerçek oran daha yüksek) | 31 / 41.9% / 41.9% | 31 / 48.4% / 48.4% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | 38 | 13.2% (5.8%–27.3%) | 1.8 | 29.2% | 47.4% | – | rastgeleden kötü | 15 / 20.0% / 53.3% | 18 / 33.3% / 77.8% |
| KV-7 dişi çim: favori, yoksa plaseler | 34 | 61.8% (45.0%–76.1%) | 3.0 | 37.8% | 61.8% | – | favori seçimi (oran bilgi amaçlı) | 13 / 61.5% / 61.5% | – |
| KV-7 dişi kum: 1-2. handikaplı atlar | 42 | 59.5% (44.5%–73.0%) | 2.1 | 31.7% | 71.4% | – | favoriden farksız | 23 / 47.8% / 69.6% | 16 / 25.0% / 43.8% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | 100 | 41.0% (31.9%–50.8%) | 1.5 | 23.9% | 49.0% | – | favoriden farksız | 41 / 31.7% / 51.2% | – |
| KV-8 kum: favorinin şansı az (favori gelmez) | 111 | 52.3% (43.0%–61.3%) | 1.0 | 16.5% | 52.3% | – | doğrulanmadı (favori yine en şanslı) | 45 / 46.7% / 46.7% | 68 / 44.1% / 44.1% |
| KV-8 kum: 57 kg altındaki atlar kazanır | 29 | 17.2% (7.6%–34.5%) | 1.5 | 22.1% | 69.0% | – | yetersiz örnek | 10 / 10.0% / 60.0% | 18 / 5.6% / 44.4% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | 112 | 83.9% (76.0%–89.6%) | 3.0 | 47.7% | 83.9% | – | favori seçimi (oran bilgi amaçlı) | 47 / 83.0% / 83.0% | – |
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
| HAN-13 kum: 1,2,3,4. handikaplar %70 | 14 | 85.7% (60.1%–96.0%) | 4.4 | 61.2% | 92.9% | 70.0% | yetersiz örnek | 12 / 83.3% / 100.0% | 0 / – / – |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | 106 | 34.0% (25.6%–43.4%) | 2.3 | 22.2% | 42.5% | 20.0% · temkinli | favoriden farksız | 57 / 35.1% / 49.1% | – |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 97 | 14.4% (8.8%–22.8%) | 2.6 | 23.3% | 49.5% | – | rastgeleden kötü | 51 / 9.8% / 51.0% | – |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 205 | 26.8% (21.2%–33.3%) | 2.4 | 25.4% | 56.6% | – | favoriden kötü | 103 / 24.3% / 56.3% | 30 / 23.3% / 76.7% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | 242 | 72.7% (66.8%–78.0%) | 3.0 | 35.8% | 72.7% | 75.0% · tutuyor | iddia edilen oran tutuyor | 123 / 78.9% / 78.9% | 35 / 68.6% / 68.6% |
| HAN-14 (özet): 1-2. at kazanır | 383 | 53.0% (48.0%–57.9%) | 2.0 | 23.2% | 53.0% | – | favori seçimi (oran bilgi amaçlı) | 211 / 58.8% / 58.8% | – |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 212 | 37.7% (31.5%–44.4%) | 4.0 | 39.1% | 70.3% | – | favoriden kötü | 119 / 32.8% / 72.3% | – |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 330 | 47.0% (41.7%–52.4%) | 3.2 | 39.7% | 70.9% | – | favoriden kötü | 157 / 52.9% / 75.2% | 118 / 32.2% / 69.5% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 211 | 21.3% (16.3%–27.3%) | 1.6 | 18.5% | 46.9% | – | favoriden kötü | 103 / 22.3% / 44.7% | 82 / 22.0% / 39.0% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | 660 | 65.9% (62.2%–69.4%) | 3.0 | 35.1% | 65.9% | – | favori seçimi (oran bilgi amaçlı) | 331 / 68.0% / 68.0% | – |
| HAN-15 (özet): 3. handikaplı at tek | 561 | 14.6% (11.9%–17.8%) | 1.2 | 14.4% | 37.6% | – | favoriden kötü | 288 / 17.0% / 35.1% | – |
| HAN-16 çim: favori-plaseler arasında biter | 207 | 64.3% (57.5%–70.5%) | 3.0 | 35.6% | 64.3% | – | favori seçimi (oran bilgi amaçlı) | 82 / 72.0% / 72.0% | – |
| HAN-16 çim: %30 7,8,9 numaralar | 182 | 17.6% (12.7%–23.8%) | 2.5 | 26.2% | 58.2% | 30.0% · abartılı | rastgeleden kötü | 67 / 14.9% / 62.7% | – |
| HAN-16 kum: 1,2,3. handikaplar %80 | 264 | 42.8% (37.0%–48.8%) | 3.2 | 38.2% | 70.1% | 80.0% · abartılı | favoriden kötü | 84 / 45.2% / 69.0% | 83 / 37.3% / 67.5% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 189 | 25.4% (19.7%–32.1%) | 1.9 | 21.1% | 50.3% | – | favoriden kötü | 65 / 32.3% / 53.8% | 63 / 22.2% / 57.1% |
| HAN-16 (özet): hafif kilo favori | 362 | 30.9% (26.4%–35.9%) | 1.3 | 15.1% | 41.7% | – | favoriden kötü | 114 / 28.1% / 43.9% | – |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | 63 | 22.2% (13.7%–33.9%) | 3.0 | 35.7% | 77.8% | – | rastgeleden kötü | 10 / 20.0% / 70.0% | – |
| HAN-17 kum: plase atlar şanslı %70 | 86 | 32.6% (23.6%–43.0%) | 2.0 | 24.0% | 53.5% | 70.0% · abartılı | favoriden kötü | 2 / 50.0% / 50.0% | 36 / 19.4% / 52.8% |
| HAN-17 kum: puana göre 1-4. atlar | 56 | 83.9% (72.2%–91.3%) | 4.0 | 45.7% | 89.3% | – | favoriden farksız | 1 / 100.0% / 100.0% | 22 / 68.2% / 63.6% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | 185 | 55.1% (47.9%–62.1%) | 2.0 | 25.3% | 55.1% | – | favori seçimi (oran bilgi amaçlı) | 16 / 75.0% / 75.0% | – |
| Maiden kum: genelde favori kazanır | 549 | 40.3% (36.2%–44.4%) | 1.1 | 11.4% | 40.3% | – | favori seçimi (oran bilgi amaçlı) | 316 / 38.0% / 38.0% | 181 / 30.9% / 30.9% |
| Maiden (özet): ilk iki at arasında | 1213 | 57.2% (54.4%–60.0%) | 2.1 | 21.4% | 57.2% | – | favori seçimi (oran bilgi amaçlı) | 620 / 54.5% / 54.5% | – |
| Açık/Grup çim: favori-plase dışına çıkmaz | 167 | 66.5% (59.0%–73.2%) | 3.1 | 34.3% | 66.5% | – | favori seçimi (oran bilgi amaçlı) | 53 / 67.9% / 67.9% | – |
| Açık/Grup kum: %70 favori | 57 | 54.4% (41.6%–66.6%) | 1.1 | 14.5% | 54.4% | 70.0% · abartılı | iddia abartılı | 13 / 38.5% / 38.5% | 33 / 39.4% / 39.4% |

### Favori referansı (İngiliz, sınıf × pist)

| Sınıf | Pist | Koşu | Ort. at | Favori kazandı | İlk 3 favoriden biri |
|---|---|---:|---:|---:|---:|
| COND | Kum | 1119 | 7.7 | 42.1% | 78.4% |
| HAND | Kum | 971 | 9.0 | 33.6% | 69.6% |
| COND | Çim | 867 | 8.4 | 38.3% | 75.0% |
| HAND | Çim | 616 | 9.7 | 31.7% | 62.5% |
| MAIDEN | Kum | 549 | 9.8 | 40.3% | 73.8% |
| KV | Kum | 495 | 6.7 | 45.3% | 81.4% |
| MAIDEN | Çim | 483 | 10.8 | 40.0% | 68.9% |
| KV | Çim | 407 | 7.7 | 33.9% | 73.5% |
| COND | Sentetik | 341 | 8.4 | 36.4% | 74.8% |
| HAND | Sentetik | 287 | 9.7 | 36.2% | 65.9% |
| KV | Sentetik | 204 | 7.2 | 40.7% | 80.4% |
| MAIDEN | Sentetik | 181 | 10.4 | 30.9% | 72.4% |
| GROUP | Çim | 167 | 10.0 | 37.1% | 66.5% |
| SAT | Kum | 166 | 9.1 | 43.4% | 71.7% |
| SAT | Çim | 103 | 9.0 | 36.9% | 70.9% |
| SAT | Sentetik | 64 | 9.8 | 32.8% | 65.6% |
| GROUP | Kum | 57 | 7.7 | 54.4% | 77.2% |
| GROUP | Sentetik | 33 | 9.4 | 39.4% | 69.7% |

### Start (kulvar) etkisi (İngiliz), alan büyüklüğüne göre düzeltilmiş

A/E = gerçek birincilik / beklenen birincilik (Σ 1/at sayısı). 1,00 nötr; 1,20 = %20 fazla.

**Kum 1400 m** (1013 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 980 | 133 | 1.06 |
| 2 | 981 | 125 | 0.99 |
| 3 | 978 | 120 | 0.95 |
| 4 | 973 | 118 | 0.95 |
| 5 | 969 | 127 | 1.04 |
| 6 | 883 | 114 | 1.09 |
| 7 | 762 | 76 | 0.90 |
| 8 | 648 | 66 | 0.98 |
| 9 | 481 | 45 | 0.98 |
| 10 | 372 | 33 | 0.99 |
| 11 | 257 | 24 | 1.13 |
| 12 | 161 | 10 | 0.81 |
| 13 | 106 | 8 | 1.05 |
| 14 | 66 | 4 | 0.91 |
| 15 | 41 | 3 | 1.18 |
| 16 | 31 | 5 | 2.67 |
| 17 | 20 | 0 | 0.00 |

**Kum 1200 m** (469 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 456 | 65 | 1.13 |
| 2 | 450 | 66 | 1.16 |
| 3 | 460 | 51 | 0.88 |
| 4 | 451 | 59 | 1.03 |
| 5 | 448 | 49 | 0.88 |
| 6 | 400 | 53 | 1.14 |
| 7 | 357 | 37 | 0.94 |
| 8 | 307 | 22 | 0.68 |
| 9 | 253 | 24 | 0.96 |
| 10 | 195 | 16 | 0.88 |
| 11 | 131 | 15 | 1.32 |
| 12 | 72 | 9 | 1.55 |
| 13 | 40 | 1 | 0.33 |
| 14 | 23 | 1 | 0.60 |

**Kum 1900 m** (447 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 430 | 62 | 1.06 |
| 2 | 438 | 66 | 1.10 |
| 3 | 435 | 53 | 0.90 |
| 4 | 434 | 64 | 1.09 |
| 5 | 432 | 46 | 0.79 |
| 6 | 365 | 42 | 0.93 |
| 7 | 315 | 38 | 1.04 |
| 8 | 244 | 32 | 1.23 |
| 9 | 181 | 17 | 0.95 |
| 10 | 121 | 10 | 0.91 |
| 11 | 83 | 9 | 1.26 |
| 12 | 56 | 6 | 1.30 |
| 13 | 28 | 1 | 0.48 |
| 14 | 18 | 0 | 0.00 |

**Çim 1200 m** (441 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 422 | 61 | 1.15 |
| 2 | 423 | 49 | 0.92 |
| 3 | 425 | 49 | 0.91 |
| 4 | 425 | 60 | 1.12 |
| 5 | 422 | 56 | 1.07 |
| 6 | 375 | 46 | 1.06 |
| 7 | 330 | 31 | 0.86 |
| 8 | 291 | 26 | 0.86 |
| 9 | 237 | 30 | 1.31 |
| 10 | 183 | 13 | 0.78 |
| 11 | 130 | 6 | 0.54 |
| 12 | 94 | 9 | 1.20 |
| 13 | 37 | 2 | 0.75 |
| 14 | 32 | 2 | 0.89 |

**Kum 2000 m** (386 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 380 | 53 | 1.02 |
| 2 | 377 | 59 | 1.15 |
| 3 | 376 | 47 | 0.92 |
| 4 | 377 | 47 | 0.91 |
| 5 | 369 | 58 | 1.17 |
| 6 | 324 | 45 | 1.12 |
| 7 | 270 | 33 | 1.05 |
| 8 | 211 | 19 | 0.84 |
| 9 | 143 | 15 | 1.07 |
| 10 | 92 | 5 | 0.60 |
| 11 | 68 | 2 | 0.35 |
| 12 | 47 | 2 | 0.54 |
| 13 | 25 | 0 | 0.00 |
| 14 | 15 | 0 | 0.00 |

**Çim 1300 m** (374 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 360 | 47 | 1.15 |
| 2 | 362 | 38 | 0.92 |
| 3 | 360 | 53 | 1.30 |
| 4 | 363 | 49 | 1.20 |
| 5 | 353 | 35 | 0.88 |
| 6 | 346 | 34 | 0.90 |
| 7 | 317 | 25 | 0.76 |
| 8 | 293 | 25 | 0.86 |
| 9 | 228 | 18 | 0.87 |
| 10 | 196 | 19 | 1.13 |
| 11 | 157 | 14 | 1.10 |
| 12 | 124 | 7 | 0.73 |
| 13 | 76 | 4 | 0.72 |
| 14 | 56 | 5 | 1.27 |

### HAN-16 profili (İngiliz)

554 koşu; katılan atların handikap puanı 6–75 (P10–P90: 40–68); yaş şartları: 4U, 3O, 3U. Resmi katılım şartı metni bu kaynakta yok; bu aralık katılanlardan gözlemdir.

| Tarih | Şehir | Pist | Mesafe | Yaş | Kazanan | Handikap | Kg | Ganyan | At |
|---|---|---|---:|---|---|---:|---:|---:|---:|
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
| 2026-10-06 | adana | Sentetik | 1400 | 3O | WOLF BROTHERS | 47 | 52 | 1.65 | 15 |

## Arap atları

5664 sonuçlanmış Arap koşusu. Kurallar İngiliz atları için yazıldı; bu bölüm Araplara aktarılıp aktarılamayacağını gösterir.

### Kurallar (Arap)

| Kural | Koşu | İsabet (95% aralık) | Ort. seçim | Rastgele | Aynı sayıda favori | İddia | Karar | 3 yaş (n / isabet / favori) | Sentetik (n / isabet / favori) |
|---|---:|---|---:|---:|---:|---|---|---|---|
| Şartlı 1 çim: ilk 4 at arasında biter | 104 | 71.2% (61.8%–79.0%) | 4.0 | 38.4% | 71.2% | – | favori seçimi (oran bilgi amaçlı) | 104 / 71.2% / 71.2% | – |
| Şartlı 1 kum: favori-plaseler arasında biter | 50 | 60.0% (46.2%–72.4%) | 3.0 | 32.2% | 60.0% | – | favori seçimi (oran bilgi amaçlı) | 50 / 60.0% / 60.0% | 45 / 64.4% / 64.4% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | 136 | 48.5% (40.3%–56.9%) | 3.0 | 28.3% | 61.0% | – | favoriden kötü | 136 / 48.5% / 61.0% | – |
| Şartlı 2: favori varsa kazanır | 64 | 21.9% (13.5%–33.4%) | 1.1 | 12.7% | 21.9% | – | favori seçimi (oran bilgi amaçlı) | 17 / 17.6% / 17.6% | – |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | 0 / – / – |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | 64 | 67.2% (55.0%–77.4%) | 4.1 | 47.3% | 76.6% | – | favoriden farksız | 17 / 76.5% / 82.4% | – |
| Şartlı 2: 1-2. handikap dışına çıkmaz | 64 | 40.6% (29.5%–52.9%) | 2.1 | 24.7% | 46.9% | – | favoriden farksız | 17 / 41.2% / 47.1% | – |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 58 | 36.2% (25.1%–49.1%) | 3.4 | 37.7% | 58.6% | – | favoriden kötü | 17 / 47.1% / 70.6% | – |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 149 | 36.9% (29.6%–44.9%) | 2.0 | 22.2% | 48.3% | – | doğrulandı | 53 / 30.2% / 49.1% | – |
| Şartlı 3 kum: favori şanslı | 202 | 45.5% (38.8%–52.4%) | 1.1 | 12.5% | 45.5% | – | favori seçimi (oran bilgi amaçlı) | 41 / 43.9% / 43.9% | 62 / 35.5% / 35.5% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 84 | 19.0% (12.1%–28.7%) | 1.4 | 14.4% | 52.4% | – | favoriden kötü | 6 / 33.3% / 50.0% | 32 / 18.8% / 46.9% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 304 | 31.6% (26.6%–37.0%) | 2.0 | 22.7% | 51.0% | – | favoriden kötü | 88 / 38.6% / 46.6% | – |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 133 | 46.6% (38.4%–55.1%) | 3.0 | 34.1% | 65.4% | – | favoriden kötü | 34 / 52.9% / 64.7% | – |
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 337 | 48.1% (42.8%–53.4%) | 3.9 | 50.4% | 81.3% | – | favoriden kötü | 63 / 50.8% / 74.6% | 110 / 38.2% / 82.7% |
| Şartlı 4: favori gelir | 662 | 35.2% (31.7%–38.9%) | 1.1 | 13.1% | 35.2% | – | favori seçimi (oran bilgi amaçlı) | 136 / 33.1% / 33.1% | – |
| Şartlı 5 çim: favori çok şanslı | 170 | 32.4% (25.8%–39.7%) | 1.1 | 12.4% | 32.4% | – | favori seçimi (oran bilgi amaçlı) | 40 / 37.5% / 37.5% | – |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | 170 | 39.4% (32.4%–46.9%) | 4.3 | 45.6% | 72.9% | 40.0% · tutuyor | favoriden kötü | 40 / 32.5% / 80.0% | – |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 34 | 0.0% (0.0%–10.2%) | 1.1 | 13.2% | 52.9% | – | rastgeleden kötü | 10 / 0.0% / 50.0% | 8 / 0.0% / 50.0% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | 28 | 25.0% (12.7%–43.4%) | 1.7 | 19.3% | 46.4% | – | yetersiz örnek | 11 / 18.2% / 45.5% | 4 / 50.0% / 75.0% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | 502 | 83.1% (79.5%–86.1%) | 4.0 | 51.0% | 83.1% | – | favori seçimi (oran bilgi amaçlı) | 93 / 74.2% / 74.2% | – |
| KV-6 çim: 1-2. atların dışına çıkmaz | 109 | 54.1% (44.8%–63.2%) | 2.0 | 25.6% | 54.1% | – | favori seçimi (oran bilgi amaçlı) | 28 / 46.4% / 46.4% | – |
| KV-6 kum: 1-2. atlar şanslı | 107 | 57.9% (48.5%–66.9%) | 2.1 | 27.0% | 57.9% | – | favori seçimi (oran bilgi amaçlı) | 18 / 44.4% / 44.4% | 34 / 67.6% / 67.6% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | 73 | 69.9% (58.6%–79.2%) | 3.0 | 39.0% | 75.3% | – | favoriden farksız | 11 / 54.5% / 72.7% | 24 / 70.8% / 79.2% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | 107 | 67.3% (57.9%–75.4%) | 3.2 | 41.5% | 76.6% | – | favoriden kötü | 18 / 50.0% / 61.1% | 34 / 70.6% / 79.4% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | 15 | 13.3% (3.7%–37.9%) | 1.8 | 21.0% | 26.7% | – | yetersiz örnek | 3 / 0.0% / 33.3% | 7 / 28.6% / 71.4% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | 49 | 63.3% (49.3%–75.3%) | 2.0 | 26.2% | 63.3% | – | favori seçimi (oran bilgi amaçlı) | 16 / 43.8% / 43.8% | – |
| KV-7 erkek kum: %20 favori | 58 | 32.8% (22.1%–45.6%) | 1.0 | 13.5% | 32.8% | 20.0% · temkinli | iddia temkinli (gerçek oran daha yüksek) | 6 / 50.0% / 50.0% | 13 / 84.6% / 84.6% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | 17 | 17.6% (6.2%–41.0%) | 1.5 | 23.5% | 52.9% | – | yetersiz örnek | 4 / 0.0% / 50.0% | 6 / 33.3% / 100.0% |
| KV-7 dişi çim: favori, yoksa plaseler | 15 | 80.0% (54.8%–93.0%) | 3.0 | 39.9% | 80.0% | – | yetersiz örnek | 5 / 60.0% / 60.0% | – |
| KV-7 dişi kum: 1-2. handikaplı atlar | 13 | 53.8% (29.1%–76.8%) | 2.0 | 26.2% | 76.9% | – | yetersiz örnek | 0 / – / – | 8 / 75.0% / 75.0% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | 36 | 47.2% (32.0%–63.0%) | 1.5 | 19.7% | 55.6% | – | favoriden farksız | 10 / 50.0% / 70.0% | – |
| KV-8 kum: favorinin şansı az (favori gelmez) | 79 | 41.8% (31.5%–52.8%) | 1.1 | 15.9% | 41.8% | – | doğrulanmadı (favori yine en şanslı) | 10 / 60.0% / 60.0% | 27 / 40.7% / 40.7% |
| KV-8 kum: 57 kg altındaki atlar kazanır | 15 | 0.0% (0.0%–20.4%) | 1.2 | 18.6% | 60.0% | – | yetersiz örnek | 5 / 0.0% / 40.0% | 2 / 50.0% / 50.0% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | 48 | 81.3% (68.1%–89.8%) | 3.0 | 44.6% | 81.3% | – | favori seçimi (oran bilgi amaçlı) | 9 / 100.0% / 100.0% | – |
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
| HAN-13 çim: ilk 3 at çok şanslı | 3 | 100.0% (43.8%–100.0%) | 3.0 | 46.8% | 100.0% | – | yetersiz örnek | 3 / 100.0% / 100.0% | – |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | 14 | 71.4% (45.4%–88.3%) | 5.1 | 48.1% | 92.9% | 70.0% | yetersiz örnek | 6 / 50.0% / 100.0% | 0 / – / – |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | 84 | 31.0% (22.1%–41.5%) | 2.3 | 21.2% | 58.3% | 20.0% · temkinli | favoriden kötü | 21 / 33.3% / 66.7% | – |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 73 | 13.7% (7.6%–23.4%) | 2.8 | 22.8% | 56.2% | – | favoriden kötü | 15 / 13.3% / 66.7% | – |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 194 | 28.9% (22.9%–35.6%) | 3.1 | 26.2% | 53.6% | – | favoriden kötü | 26 / 30.8% / 57.7% | 35 / 34.3% / 51.4% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | 199 | 58.3% (51.3%–64.9%) | 3.0 | 27.3% | 58.3% | 75.0% · abartılı | iddia abartılı | 27 / 63.0% / 63.0% | 40 / 47.5% / 47.5% |
| HAN-14 (özet): 1-2. at kazanır | 323 | 48.0% (42.6%–53.4%) | 2.1 | 18.4% | 48.0% | – | favori seçimi (oran bilgi amaçlı) | 55 / 54.5% / 54.5% | – |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 186 | 34.9% (28.5%–42.0%) | 4.4 | 38.5% | 68.8% | – | favoriden kötü | 24 / 16.7% / 87.5% | – |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 274 | 44.5% (38.8%–50.4%) | 3.2 | 31.5% | 59.5% | – | favoriden kötü | 25 / 60.0% / 76.0% | 105 / 31.4% / 58.1% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 179 | 17.3% (12.5%–23.5%) | 1.7 | 15.7% | 36.3% | – | favoriden kötü | 22 / 22.7% / 59.1% | 76 / 18.4% / 39.5% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | 565 | 58.1% (53.9%–62.1%) | 3.1 | 29.2% | 58.1% | – | favori seçimi (oran bilgi amaçlı) | 59 / 76.3% / 76.3% | – |
| HAN-15 (özet): 3. handikaplı at tek | 483 | 16.6% (13.5%–20.1%) | 1.2 | 11.5% | 33.5% | – | favoriden kötü | 52 / 17.3% / 42.3% | – |
| HAN-16 çim: favori-plaseler arasında biter | 181 | 59.7% (52.4%–66.5%) | 3.1 | 30.3% | 59.7% | – | favori seçimi (oran bilgi amaçlı) | 0 / – / – | – |
| HAN-16 çim: %30 7,8,9 numaralar | 171 | 23.4% (17.7%–30.3%) | 2.7 | 24.8% | 55.6% | 30.0% · tutuyor | favoriden kötü | 0 / – / – | – |
| HAN-16 kum: 1,2,3. handikaplar %80 | 221 | 33.9% (28.0%–40.4%) | 3.2 | 31.5% | 62.0% | 80.0% · abartılı | favoriden kötü | 0 / – / – | 72 / 31.9% / 66.7% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 162 | 21.6% (16.0%–28.6%) | 2.1 | 18.7% | 44.4% | – | favoriden kötü | 0 / – / – | 57 / 24.6% / 47.4% |
| HAN-16 (özet): hafif kilo favori | 306 | 25.5% (20.9%–30.7%) | 1.3 | 12.4% | 37.3% | – | favoriden kötü | 0 / – / – | – |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | 51 | 37.3% (25.3%–51.0%) | 3.8 | 36.1% | 70.6% | – | favoriden kötü | 0 / – / – | – |
| HAN-17 kum: plase atlar şanslı %70 | 63 | 28.6% (18.9%–40.7%) | 2.0 | 19.1% | 52.4% | 70.0% · abartılı | favoriden kötü | 0 / – / – | 22 / 18.2% / 45.5% |
| HAN-17 kum: puana göre 1-4. atlar | 46 | 58.7% (44.3%–71.7%) | 4.0 | 37.1% | 67.4% | – | favoriden farksız | 0 / – / – | 14 / 64.3% / 71.4% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | 136 | 52.2% (43.9%–60.4%) | 2.1 | 20.1% | 52.2% | – | favori seçimi (oran bilgi amaçlı) | 0 / – / – | – |
| Maiden kum: genelde favori kazanır | 555 | 34.8% (30.9%–38.8%) | 1.1 | 11.1% | 34.8% | – | favori seçimi (oran bilgi amaçlı) | 343 / 36.4% / 36.4% | 174 / 43.7% / 43.7% |
| Maiden (özet): ilk iki at arasında | 1173 | 55.2% (52.4%–58.1%) | 2.1 | 19.9% | 55.2% | – | favori seçimi (oran bilgi amaçlı) | 881 / 54.5% / 54.5% | – |
| Açık/Grup çim: favori-plase dışına çıkmaz | 80 | 67.5% (56.6%–76.8%) | 3.0 | 27.2% | 67.5% | – | favori seçimi (oran bilgi amaçlı) | 26 / 53.8% / 53.8% | – |
| Açık/Grup kum: %70 favori | 40 | 47.5% (32.9%–62.5%) | 1.1 | 11.8% | 47.5% | 70.0% · abartılı | iddia abartılı | 6 / 33.3% / 33.3% | 12 / 75.0% / 75.0% |

### Favori referansı (Arap, sınıf × pist)

| Sınıf | Pist | Koşu | Ort. at | Favori kazandı | İlk 3 favoriden biri |
|---|---|---:|---:|---:|---:|
| COND | Kum | 924 | 8.8 | 39.0% | 74.1% |
| HAND | Kum | 788 | 11.1 | 30.7% | 60.0% |
| COND | Çim | 675 | 9.9 | 31.4% | 64.6% |
| MAIDEN | Kum | 555 | 10.1 | 34.8% | 70.8% |
| HAND | Çim | 544 | 11.2 | 30.3% | 60.3% |
| MAIDEN | Çim | 444 | 11.6 | 32.7% | 66.2% |
| KV | Kum | 310 | 7.9 | 39.4% | 74.8% |
| COND | Sentetik | 308 | 9.3 | 38.6% | 73.1% |
| HAND | Sentetik | 252 | 11.7 | 28.6% | 54.8% |
| KV | Çim | 252 | 8.5 | 34.5% | 72.6% |
| MAIDEN | Sentetik | 174 | 10.8 | 43.7% | 77.6% |
| KV | Sentetik | 112 | 8.0 | 50.0% | 80.4% |
| SAT | Kum | 91 | 10.1 | 28.6% | 59.3% |
| GROUP | Çim | 80 | 12.0 | 45.0% | 67.5% |
| SAT | Çim | 64 | 10.7 | 31.3% | 71.9% |
| GROUP | Kum | 40 | 10.3 | 47.5% | 67.5% |
| SAT | Sentetik | 31 | 11.0 | 41.9% | 64.5% |

### Start (kulvar) etkisi (Arap), alan büyüklüğüne göre düzeltilmiş

A/E = gerçek birincilik / beklenen birincilik (Σ 1/at sayısı). 1,00 nötr; 1,20 = %20 fazla.

**Kum 1400 m** (796 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 780 | 92 | 1.09 |
| 2 | 780 | 93 | 1.10 |
| 3 | 776 | 87 | 1.03 |
| 4 | 784 | 76 | 0.90 |
| 5 | 764 | 78 | 0.95 |
| 6 | 745 | 84 | 1.08 |
| 7 | 704 | 58 | 0.82 |
| 8 | 639 | 72 | 1.18 |
| 9 | 556 | 44 | 0.88 |
| 10 | 467 | 44 | 1.09 |
| 11 | 353 | 23 | 0.80 |
| 12 | 248 | 19 | 1.01 |
| 13 | 163 | 11 | 0.96 |
| 14 | 112 | 8 | 1.07 |
| 15 | 78 | 4 | 0.81 |
| 16 | 43 | 5 | 1.93 |
| 17 | 27 | 1 | 0.64 |
| 18 | 15 | 1 | 1.17 |

**Çim 1200 m** (452 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 446 | 63 | 1.39 |
| 2 | 441 | 51 | 1.15 |
| 3 | 440 | 37 | 0.83 |
| 4 | 438 | 69 | 1.57 |
| 5 | 437 | 40 | 0.91 |
| 6 | 431 | 44 | 1.03 |
| 7 | 422 | 44 | 1.07 |
| 8 | 388 | 24 | 0.66 |
| 9 | 343 | 20 | 0.66 |
| 10 | 313 | 31 | 1.15 |
| 11 | 251 | 11 | 0.54 |
| 12 | 193 | 6 | 0.40 |
| 13 | 112 | 8 | 0.99 |
| 14 | 84 | 2 | 0.34 |
| 15 | 26 | 1 | 0.61 |

**Kum 1200 m** (417 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 408 | 59 | 1.33 |
| 2 | 409 | 52 | 1.17 |
| 3 | 405 | 35 | 0.79 |
| 4 | 404 | 48 | 1.09 |
| 5 | 407 | 50 | 1.14 |
| 6 | 384 | 38 | 0.95 |
| 7 | 366 | 27 | 0.73 |
| 8 | 338 | 34 | 1.05 |
| 9 | 285 | 22 | 0.84 |
| 10 | 244 | 24 | 1.12 |
| 11 | 187 | 8 | 0.52 |
| 12 | 132 | 8 | 0.79 |
| 13 | 86 | 7 | 1.13 |
| 14 | 60 | 5 | 1.21 |
| 15 | 40 | 1 | 0.38 |
| 16 | 17 | 2 | 1.89 |

**Kum 1900 m** (359 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 350 | 37 | 0.91 |
| 2 | 348 | 45 | 1.11 |
| 3 | 352 | 43 | 1.04 |
| 4 | 342 | 31 | 0.78 |
| 5 | 348 | 38 | 0.95 |
| 6 | 332 | 36 | 0.97 |
| 7 | 300 | 38 | 1.19 |
| 8 | 269 | 33 | 1.20 |
| 9 | 202 | 24 | 1.30 |
| 10 | 156 | 6 | 0.45 |
| 11 | 123 | 11 | 1.12 |
| 12 | 100 | 8 | 1.04 |
| 13 | 63 | 3 | 0.66 |
| 14 | 43 | 3 | 1.01 |
| 15 | 23 | 2 | 1.33 |
| 16 | 15 | 1 | 1.04 |

**Çim 1400 m** (329 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 316 | 33 | 0.98 |
| 2 | 323 | 29 | 0.84 |
| 3 | 327 | 41 | 1.17 |
| 4 | 319 | 38 | 1.12 |
| 5 | 324 | 30 | 0.88 |
| 6 | 318 | 49 | 1.48 |
| 7 | 300 | 26 | 0.86 |
| 8 | 266 | 17 | 0.67 |
| 9 | 223 | 20 | 1.01 |
| 10 | 185 | 20 | 1.29 |
| 11 | 144 | 15 | 1.32 |
| 12 | 111 | 2 | 0.24 |
| 13 | 79 | 4 | 0.72 |
| 14 | 49 | 5 | 1.56 |
| 15 | 33 | 1 | 0.50 |
| 16 | 19 | 0 | 0.00 |
| 17 | 15 | 0 | 0.00 |

**Çim 1300 m** (309 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 303 | 28 | 1.00 |
| 2 | 305 | 31 | 1.09 |
| 3 | 303 | 31 | 1.10 |
| 4 | 301 | 38 | 1.36 |
| 5 | 302 | 23 | 0.82 |
| 6 | 297 | 28 | 1.04 |
| 7 | 292 | 27 | 1.04 |
| 8 | 284 | 19 | 0.76 |
| 9 | 265 | 17 | 0.75 |
| 10 | 240 | 18 | 0.92 |
| 11 | 211 | 22 | 1.31 |
| 12 | 174 | 11 | 0.83 |
| 13 | 107 | 7 | 0.92 |
| 14 | 91 | 6 | 0.95 |
| 15 | 35 | 2 | 0.88 |

### HAN-16 profili (Arap)

474 koşu; katılan atların handikap puanı 8–75 (P10–P90: 39–70); yaş şartları: 4U, 4O. Resmi katılım şartı metni bu kaynakta yok; bu aralık katılanlardan gözlemdir.

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
