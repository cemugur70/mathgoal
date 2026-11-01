# Kural seti backtest'i (İngiliz ve Arap atları)

Kaynak: liderform.com.tr herkese açık program sayfaları, 2025-10-29 – 2026-10-31; İstanbul, Ankara, İzmir, Bursa ve Adana'da 2522 İngiliz, 1955 Arap koşusu. Üretim: 2026-11-01T14:33:00.791Z.

## Yorum varsayımları

- **Favori**: en düşük kapanış TJK ganyanı (yoksa AGF). **Plase**: 2.–3. favori. **İlk N at**: ilk N favori.
- **N. handikap**: koşudaki N. en yüksek handikap puanı. **Puan / TGP / Türkiye puanı**: liderform "puan" alanı (varsayım).
- **N numaralı**: program numarası; **N startlı**: kulvar. **Hafif kg**: koşunun en hafif üçte biri. "Fotomaç / posta puanı" ve "kazanç" verisi yok, o kurallar test edilmedi.
- Çim/kum kuralları kendi pistinde ölçüldü; kum kuralları ayrıca sentetikte (AWT) denendi. İngiliz ve Arap koşuları ayrı ölçülür, hiç karıştırılmaz.

## Nasıl okunur

- **İsabet**: kazanan, kuralın seçtiği atlar arasında mı. **Aynı sayıda favori**: kural kaç at seçtiyse o kadar favori seçilseydi isabet. Bir kuralın değeri bu sütunu geçip geçmemesidir.
- **Karar** (ayrıntı tablolarında, tüm dönem): %95 Wilson aralığına göre. 30 koşudan azsa karar verilmez.

## Geriye dönük doğrulama

Kurallar önce **keşif** döneminde (2026-06-16 öncesi) test edilir, sonra hiç görmedikleri **doğrulama** döneminde (2026-06-16 ve sonrası) tekrar etmeleri beklenir. **Ara bölme**: 2026 öncesi veri henüz yetersiz; bölme noktası koşuların %60'ına kondu. Tam veriyle 2026-01-01 kullanılacak.
- **Fark**: her koşuda kural isabeti (1/0) eksi karşılaştırma ölçütü, ortalaması yüzde puan olarak. Ölçüt: aynı sayıda favori; "plase favoriden şanslı" iddiası için favorinin kazanması; "favori gelmez" iddiaları için rastgele pay (beklenen yön negatif). p eşleştirilmiş z testinden.
- **q (BH)**: iki ırktaki tüm keşif testleri tek aile sayılarak Benjamini–Hochberg düzeltmesi. 140 testte birkaçının şansla anlamlı çıkması beklenir; q bunu düzeltir.
- **doğrulandı**: keşifte q < 0,10 ve doğrulamada aynı yönde p < 0,05. **tersi doğrulandı**: iki dönemde de kuralın aleyhine anlamlı. **tekrar etmedi**: keşifte anlamlı ama doğrulamada değil. **kanıt yok**: ölçütten farkı anlamlı değil.
- **favori seçimi**: kural tam olarak aynı sayıda favoriyi seçiyor, test edilecek ayrı üstünlük yok. Oran iddiası varsa (ör. "%70 favori") iki dönemin %95 aralığıyla karşılaştırılır: **iddia doğrulandı / çürütüldü**.
- **ROI**: seçilen her ata 1 TL ganyan; resmi kapanış ganyanı ile (ödenen ganyan ikramiyesiyle ${oddsMatch} koşuda birebir aynı). Hipodrom kesintisi yüzünden rastgele oynamanın beklenen ROI'si negatiftir.

### İngiliz: doğrulama özeti

Keşif < 2026-06-16: 1512 koşu · doğrulama ≥ 2026-06-16: 1010 koşu. tersi doğrulandı: 2 · tekrar etmedi: 3 · kanıt yok: 2 · favori seçimi: 6 · yetersiz örnek: 57.

| Kural | Karar | Keşif n | Keşif isabet / favori | Fark (puan) | p | q (BH) | Doğrulama n | Doğrulama isabet / favori | Fark (puan) | p | ROI kural / aynı sayıda favori (tüm dönem) |
|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | **tersi doğrulandı** | 113 | 54.9% / 86.7% | -31.9 | <0.001 | <0.001 | 51 | 43.1% / 84.3% | -41.2 | <0.001 | -33.0% / -31.0% |
| HAN-16 kum: 1,2,3. handikaplar %80 | **tersi doğrulandı** | 80 | 48.8% / 78.8% | -30.0 | <0.001 | <0.001 | 33 | 33.3% / 60.6% | -27.3 | 0.012 | -46.6% / -35.1% |
| HAN-15 (özet): 3. handikaplı at tek | **tekrar etmedi** | 131 | 10.7% / 45.0% | -34.4 | <0.001 | <0.001 | 77 | 16.9% / 28.6% | -11.7 | 0.056 | -54.3% / -21.9% |
| HAN-16 (özet): hafif kilo favori | **tekrar etmedi** | 70 | 34.3% / 51.4% | -17.1 | 0.015 | 0.032 | 62 | 29.0% / 37.1% | -8.1 | 0.274 | -20.3% / -18.7% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | **tekrar etmedi** | 59 | 61.0% / 72.9% | -11.9 | 0.030 | 0.051 | 56 | 67.9% / 66.1% | +1.8 | 0.657 | -32.6% / -35.1% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | **kanıt yok** | 53 | 43.4% / 50.9% | -7.5 | 0.346 | 0.429 | 38 | 39.5% / 65.8% | -26.3 | 0.001 | -30.9% / -27.2% |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | **kanıt yok** | 34 | 64.7% / 70.6% | -5.9 | 0.659 | 0.685 | 37 | 67.6% / 67.6% | 0.0 | 1.000 | +13.8% / -34.1% |
| Şartlı 4: favori gelir | **favori seçimi** | 166 | 40.4% / 40.4% | 0.0 | – | – | 107 | 37.4% / 37.4% | 0.0 | – | -38.1% / -38.1% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | **favori seçimi** | 125 | 85.6% / 85.6% | 0.0 | – | – | 75 | 85.3% / 85.3% | 0.0 | – | -37.7% / -37.7% |
| HAN-14 (özet): 1-2. at kazanır | **favori seçimi** | 86 | 65.1% / 65.1% | 0.0 | – | – | 45 | 51.1% / 51.1% | 0.0 | – | -25.3% / -25.3% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | **favori seçimi** | 156 | 64.1% / 64.1% | 0.0 | – | – | 87 | 65.5% / 65.5% | 0.0 | – | -32.9% / -32.9% |
| Maiden kum: genelde favori kazanır | **favori seçimi** | 187 | 42.2% / 42.2% | 0.0 | – | – | 46 | 41.3% / 41.3% | 0.0 | – | -26.3% / -26.3% |
| Maiden (özet): ilk iki at arasında | **favori seçimi** | 293 | 58.7% / 58.7% | 0.0 | – | – | 153 | 56.2% / 56.2% | 0.0 | – | -33.1% / -33.1% |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | **yetersiz örnek** | 109 | 42.2% / 68.8% | -26.6 | <0.001 | <0.001 | 29 | 41.4% / 75.9% | -34.5 | <0.001 | -51.9% / -31.7% |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | **yetersiz örnek** | 59 | 27.1% / 59.3% | -32.2 | <0.001 | <0.001 | 17 | 47.1% / 70.6% | -23.5 | 0.144 | -38.3% / -26.1% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | **yetersiz örnek** | 55 | 25.5% / 58.2% | -32.7 | <0.001 | <0.001 | 27 | 14.8% / 44.4% | -29.6 | 0.004 | -63.7% / -30.1% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | **yetersiz örnek** | 76 | 23.7% / 50.0% | -26.3 | <0.001 | <0.001 | 22 | 27.3% / 27.3% | 0.0 | 1.000 | -11.0% / -30.9% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | **yetersiz örnek** | 47 | 70.2% / 74.5% | -4.3 | 0.416 | 0.471 | 17 | 64.7% / 70.6% | -5.9 | 0.317 | -43.1% / -41.9% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | **yetersiz örnek** | 49 | 69.4% / 73.5% | -4.1 | 0.566 | 0.614 | 17 | 47.1% / 76.5% | -29.4 | 0.010 | -37.3% / -39.7% |
| Şartlı 1 çim: ilk 4 at arasında biter | **yetersiz örnek** | 21 | 76.2% / 76.2% | 0.0 | – | – | 29 | 62.1% / 62.1% | 0.0 | – | -48.2% / -48.2% |
| Şartlı 1 kum: favori-plaseler arasında biter | **yetersiz örnek** | 28 | 75.0% / 75.0% | 0.0 | – | – | 17 | 82.4% / 82.4% | 0.0 | – | -28.2% / -28.2% |
| Şartlı 2: favori varsa kazanır | **yetersiz örnek** | 5 | 0.0% / 0.0% | 0.0 | – | – | 1 | 100.0% / 100.0% | 0.0 | – | -66.7% / -66.7% |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | **yetersiz örnek** | 5 | 60.0% / 80.0% | -20.0 | 0.593 | – | 1 | 0.0% / 100.0% | -100.0 | – | -1.5% / -11.0% |
| Şartlı 2: 1-2. handikap dışına çıkmaz | **yetersiz örnek** | 5 | 20.0% / 20.0% | 0.0 | 1.000 | – | 1 | 0.0% / 100.0% | -100.0 | – | -57.9% / -53.3% |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | **yetersiz örnek** | 5 | 60.0% / 40.0% | +20.0 | 0.593 | – | 1 | 0.0% / 100.0% | -100.0 | – | +12.5% / -35.6% |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | **yetersiz örnek** | 11 | 45.5% / 45.5% | 0.0 | 1.000 | – | 19 | 57.9% / 31.6% | +26.3 | 0.219 | +14.2% / +14.8% |
| Şartlı 3 kum: favori şanslı | **yetersiz örnek** | 77 | 40.3% / 40.3% | 0.0 | – | – | 23 | 60.9% / 60.9% | 0.0 | – | -28.6% / -28.6% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | **yetersiz örnek** | 25 | 24.0% / 36.0% | -12.0 | 0.368 | – | 11 | 18.2% / 72.7% | -54.5 | <0.001 | -42.2% / -32.6% |
| Şartlı 5 çim: favori çok şanslı | **yetersiz örnek** | 29 | 37.9% / 37.9% | 0.0 | – | – | 26 | 65.4% / 65.4% | 0.0 | – | -13.4% / -13.4% |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | **yetersiz örnek** | 29 | 41.4% / 79.3% | -37.9 | 0.001 | – | 26 | 30.8% / 80.8% | -50.0 | <0.001 | -46.8% / -39.8% |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | **yetersiz örnek** | 9 | 0.0% / 44.4% | -44.4 | 0.011 | – | 5 | 0.0% / 20.0% | -20.0 | 0.317 | -100.0% / -45.6% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | **yetersiz örnek** | 7 | 28.6% / 42.9% | -14.3 | 0.674 | – | 4 | 0.0% / 75.0% | -75.0 | 0.003 | -39.6% / -35.4% |
| KV-6 çim: 1-2. atların dışına çıkmaz | **yetersiz örnek** | 16 | 56.3% / 56.3% | 0.0 | – | – | 23 | 47.8% / 47.8% | 0.0 | – | -37.4% / -37.4% |
| KV-6 kum: 1-2. atlar şanslı | **yetersiz örnek** | 49 | 57.1% / 57.1% | 0.0 | – | – | 17 | 70.6% / 70.6% | 0.0 | – | -38.7% / -38.7% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | **yetersiz örnek** | 11 | 36.4% / 72.7% | -36.4 | 0.017 | – | 1 | 0.0% / 100.0% | -100.0 | – | -59.0% / -10.5% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | **yetersiz örnek** | 9 | 55.6% / 55.6% | 0.0 | – | – | 11 | 81.8% / 81.8% | 0.0 | – | -17.6% / -17.6% |
| KV-7 erkek kum: %20 favori | **yetersiz örnek** | 19 | 42.1% / 42.1% | 0.0 | – | – | 14 | 21.4% / 21.4% | 0.0 | – | -50.0% / -50.0% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | **yetersiz örnek** | 7 | 0.0% / 71.4% | -71.4 | <0.001 | – | 4 | 0.0% / 25.0% | -25.0 | 0.317 | -100.0% / -45.0% |
| KV-7 dişi çim: favori, yoksa plaseler | **yetersiz örnek** | 3 | 33.3% / 33.3% | 0.0 | – | – | 5 | 40.0% / 40.0% | 0.0 | – | -69.8% / -69.8% |
| KV-7 dişi kum: 1-2. handikaplı atlar | **yetersiz örnek** | 11 | 81.8% / 90.9% | -9.1 | 0.317 | – | 4 | 75.0% / 100.0% | -25.0 | 0.317 | -31.5% / -19.4% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | **yetersiz örnek** | 15 | 40.0% / 40.0% | 0.0 | 1.000 | – | 20 | 50.0% / 70.0% | -20.0 | 0.087 | -25.2% / -22.9% |
| KV-8 kum: favorinin şansı az (favori gelmez) | **yetersiz örnek** | 25 | 56.0% / 17.2% | +38.8 | <0.001 | – | 12 | 66.7% / 15.5% | +51.2 | <0.001 | -14.3% / -14.3% |
| KV-8 kum: 57 kg altındaki atlar kazanır | **yetersiz örnek** | 3 | 33.3% / 100.0% | -66.7 | 0.046 | – | 5 | 20.0% / 60.0% | -40.0 | 0.102 | -63.6% / -20.7% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | **yetersiz örnek** | 28 | 92.9% / 92.9% | 0.0 | – | – | 12 | 58.3% / 58.3% | 0.0 | – | -31.6% / -31.6% |
| KV-21 çim: %60 3,4,5 numaralı atlar | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-21 kum: %60 3,4,5 numaralı atlar | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-21: favori gelmez | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-22 çim: %60 1,2,3. handikaplar | **yetersiz örnek** | 6 | 16.7% / 83.3% | -66.7 | 0.002 | – | 5 | 80.0% / 80.0% | 0.0 | 1.000 | -65.4% / -30.4% |
| KV-22 kum: %50 1,2,3 numaralı | **yetersiz örnek** | 11 | 54.5% / 81.8% | -27.3 | 0.053 | – | 3 | 33.3% / 100.0% | -66.7 | 0.046 | -67.3% / -29.6% |
| KV-23 çim: %70 favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-23 kum: %60 favori | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-24 çim: handikap puanı 100+ atlar %80 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-24 kum: 90–120 puanlılar %80 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-25 çim: 2,3,4,5 numaralı %75 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-25 kum: 3,4,5 numaralı %60 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| HAN-13 çim: ilk 3 at çok şanslı | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | **yetersiz örnek** | 4 | 100.0% / 100.0% | 0.0 | – | – | 0 | – / – | – | – | -28.3% / -28.3% |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | **yetersiz örnek** | 8 | 0.0% / 25.0% | -25.0 | 0.127 | – | 19 | 15.8% / 31.6% | -15.8 | 0.170 | -82.0% / -66.5% |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | **yetersiz örnek** | 7 | 0.0% / 57.1% | -57.1 | 0.005 | – | 17 | 29.4% / 29.4% | 0.0 | 1.000 | +31.7% / -53.6% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | **yetersiz örnek** | 72 | 76.4% / 76.4% | 0.0 | – | – | 21 | 81.0% / 81.0% | 0.0 | – | -24.9% / -24.9% |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | **yetersiz örnek** | 25 | 40.0% / 64.0% | -24.0 | 0.070 | – | 43 | 39.5% / 72.1% | -32.6 | 0.003 | -39.6% / -34.4% |
| HAN-16 çim: favori-plaseler arasında biter | **yetersiz örnek** | 17 | 64.7% / 64.7% | 0.0 | – | – | 40 | 60.0% / 60.0% | 0.0 | – | -38.6% / -38.6% |
| HAN-16 çim: %30 7,8,9 numaralar | **yetersiz örnek** | 17 | 23.5% / 64.7% | -41.2 | 0.006 | – | 37 | 13.5% / 51.4% | -37.8 | <0.001 | -53.4% / -35.3% |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | **yetersiz örnek** | 10 | 20.0% / 70.0% | -50.0 | 0.063 | – | 11 | 27.3% / 90.9% | -63.6 | <0.001 | -54.6% / +0.8% |
| HAN-17 kum: plase atlar şanslı %70 | **yetersiz örnek** | 22 | 45.5% / 45.5% | 0.0 | 1.000 | – | 9 | 22.2% / 44.4% | -22.2 | 0.317 | -23.3% / -35.2% |
| HAN-17 kum: puana göre 1-4. atlar | **yetersiz örnek** | 22 | 90.9% / 86.4% | +4.5 | 0.570 | – | 9 | 66.7% / 88.9% | -22.2 | 0.317 | -10.8% / -4.6% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | **yetersiz örnek** | 36 | 44.4% / 44.4% | 0.0 | – | – | 28 | 57.1% / 57.1% | 0.0 | – | -29.4% / -29.4% |
| Açık/Grup çim: favori-plase dışına çıkmaz | **yetersiz örnek** | 22 | 59.1% / 59.1% | 0.0 | – | – | 39 | 64.1% / 64.1% | 0.0 | – | -44.4% / -44.4% |
| Açık/Grup kum: %70 favori | **yetersiz örnek** | 12 | 50.0% / 50.0% | 0.0 | – | – | 9 | 55.6% / 55.6% | 0.0 | – | -22.0% / -22.0% |

### Arap: doğrulama özeti

Keşif < 2026-06-16: 1171 koşu · doğrulama ≥ 2026-06-16: 784 koşu. tersi doğrulandı: 3 · tekrar etmedi: 1 · kanıt yok: 1 · favori seçimi: 6 · yetersiz örnek: 59.

| Kural | Karar | Keşif n | Keşif isabet / favori | Fark (puan) | p | q (BH) | Doğrulama n | Doğrulama isabet / favori | Fark (puan) | p | ROI kural / aynı sayıda favori (tüm dönem) |
|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | **tersi doğrulandı** | 97 | 49.5% / 83.5% | -34.0 | <0.001 | <0.001 | 40 | 45.0% / 82.5% | -37.5 | <0.001 | -39.2% / -26.0% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | **tersi doğrulandı** | 57 | 36.8% / 56.1% | -19.3 | 0.029 | 0.051 | 35 | 28.6% / 51.4% | -22.9 | 0.013 | -43.8% / -28.3% |
| HAN-15 (özet): 3. handikaplı at tek | **tersi doğrulandı** | 105 | 22.9% / 33.3% | -10.5 | 0.060 | 0.092 | 59 | 10.2% / 40.7% | -30.5 | <0.001 | -26.0% / -20.7% |
| HAN-16 (özet): hafif kilo favori | **tekrar etmedi** | 61 | 19.7% / 37.7% | -18.0 | 0.012 | 0.029 | 51 | 33.3% / 41.2% | -7.8 | 0.317 | -23.1% / -6.0% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | **kanıt yok** | 36 | 47.2% / 58.3% | -11.1 | 0.151 | 0.207 | 31 | 54.8% / 71.0% | -16.1 | 0.016 | -45.0% / -31.7% |
| Şartlı 4: favori gelir | **favori seçimi** | 140 | 36.4% / 36.4% | 0.0 | – | – | 81 | 33.3% / 33.3% | 0.0 | – | -34.5% / -34.5% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | **favori seçimi** | 114 | 83.3% / 83.3% | 0.0 | – | – | 68 | 79.4% / 79.4% | 0.0 | – | -24.8% / -24.8% |
| HAN-14 (özet): 1-2. at kazanır | **favori seçimi** | 79 | 45.6% / 45.6% | 0.0 | – | – | 32 | 56.3% / 56.3% | 0.0 | – | -24.0% / -24.0% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | **favori seçimi** | 128 | 55.5% / 55.5% | 0.0 | – | – | 73 | 63.0% / 63.0% | 0.0 | – | -31.8% / -31.8% |
| Maiden kum: genelde favori kazanır | **favori seçimi** | 158 | 32.3% / 32.3% | 0.0 | – | – | 74 | 35.1% / 35.1% | 0.0 | – | -39.6% / -39.6% |
| Maiden (özet): ilk iki at arasında | **favori seçimi** | 245 | 52.2% / 52.2% | 0.0 | – | – | 185 | 52.4% / 52.4% | 0.0 | – | -36.0% / -36.0% |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | **yetersiz örnek** | 61 | 27.9% / 60.7% | -32.8 | <0.001 | <0.001 | 13 | 30.8% / 46.2% | -15.4 | 0.421 | -54.1% / -35.2% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | **yetersiz örnek** | 43 | 16.3% / 39.5% | -23.3 | 0.008 | 0.020 | 22 | 36.4% / 36.4% | 0.0 | 1.000 | +5.1% / -41.5% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | **yetersiz örnek** | 31 | 61.3% / 80.6% | -19.4 | 0.024 | 0.048 | 12 | 50.0% / 66.7% | -16.7 | 0.138 | -54.6% / -36.5% |
| HAN-16 kum: 1,2,3. handikaplar %80 | **yetersiz örnek** | 62 | 41.9% / 59.7% | -17.7 | 0.050 | 0.082 | 26 | 23.1% / 61.5% | -38.5 | <0.001 | -26.3% / -33.7% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | **yetersiz örnek** | 52 | 19.2% / 34.6% | -15.4 | 0.067 | 0.097 | 15 | 6.7% / 40.0% | -33.3 | 0.008 | -27.0% / -40.7% |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | **yetersiz örnek** | 30 | 60.0% / 76.7% | -16.7 | 0.221 | 0.288 | 25 | 32.0% / 60.0% | -28.0 | 0.039 | -6.1% / -30.6% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | **yetersiz örnek** | 31 | 74.2% / 80.6% | -6.5 | 0.417 | 0.471 | 12 | 58.3% / 66.7% | -8.3 | 0.317 | -38.6% / -33.6% |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | **yetersiz örnek** | 85 | 54.1% / 55.3% | -1.2 | 0.858 | 0.858 | 26 | 46.2% / 73.1% | -26.9 | 0.023 | -7.7% / -34.3% |
| Şartlı 1 çim: ilk 4 at arasında biter | **yetersiz örnek** | 16 | 56.3% / 56.3% | 0.0 | – | – | 15 | 73.3% / 73.3% | 0.0 | – | -45.2% / -45.2% |
| Şartlı 1 kum: favori-plaseler arasında biter | **yetersiz örnek** | 12 | 66.7% / 66.7% | 0.0 | – | – | 5 | 60.0% / 60.0% | 0.0 | – | -25.9% / -25.9% |
| Şartlı 2: favori varsa kazanır | **yetersiz örnek** | 3 | 33.3% / 33.3% | 0.0 | – | – | 2 | 0.0% / 0.0% | 0.0 | – | -81.7% / -81.7% |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | **yetersiz örnek** | 3 | 66.7% / 66.7% | 0.0 | 1.000 | – | 2 | 100.0% / 100.0% | 0.0 | – | +25.7% / -38.5% |
| Şartlı 2: 1-2. handikap dışına çıkmaz | **yetersiz örnek** | 3 | 33.3% / 66.7% | -33.3 | 0.317 | – | 2 | 50.0% / 0.0% | +50.0 | 0.317 | -72.7% / -43.6% |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | **yetersiz örnek** | 3 | 66.7% / 66.7% | 0.0 | 1.000 | – | 2 | 50.0% / 100.0% | -50.0 | 0.317 | +51.4% / -31.7% |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | **yetersiz örnek** | 13 | 23.1% / 53.8% | -30.8 | 0.194 | – | 17 | 29.4% / 17.6% | +11.8 | 0.486 | -46.5% / -41.5% |
| Şartlı 3 kum: favori şanslı | **yetersiz örnek** | 62 | 43.5% / 43.5% | 0.0 | – | – | 15 | 53.3% / 53.3% | 0.0 | – | -13.5% / -13.5% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | **yetersiz örnek** | 26 | 26.9% / 46.2% | -19.2 | 0.084 | – | 3 | 66.7% / 66.7% | 0.0 | 1.000 | +8.5% / -5.9% |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | **yetersiz örnek** | 20 | 40.0% / 70.0% | -30.0 | 0.041 | – | 30 | 40.0% / 60.0% | -20.0 | 0.099 | -31.9% / -30.5% |
| Şartlı 5 çim: favori çok şanslı | **yetersiz örnek** | 30 | 13.3% / 13.3% | 0.0 | – | – | 25 | 24.0% / 24.0% | 0.0 | – | -71.7% / -71.7% |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | **yetersiz örnek** | 8 | 0.0% / 37.5% | -37.5 | 0.040 | – | 7 | 0.0% / 42.9% | -42.9 | 0.034 | -100.0% / -30.6% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | **yetersiz örnek** | 5 | 0.0% / 40.0% | -40.0 | 0.102 | – | 8 | 37.5% / 50.0% | -12.5 | 0.581 | -34.5% / -42.1% |
| KV-6 çim: 1-2. atların dışına çıkmaz | **yetersiz örnek** | 16 | 56.3% / 56.3% | 0.0 | – | – | 16 | 43.8% / 43.8% | 0.0 | – | -40.9% / -40.9% |
| KV-6 kum: 1-2. atlar şanslı | **yetersiz örnek** | 31 | 61.3% / 61.3% | 0.0 | – | – | 12 | 58.3% / 58.3% | 0.0 | – | -37.6% / -37.6% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | **yetersiz örnek** | 3 | 0.0% / 33.3% | -33.3 | 0.317 | – | 2 | 0.0% / 0.0% | 0.0 | – | -100.0% / -88.3% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | **yetersiz örnek** | 0 | – / – | – | – | – | 12 | 50.0% / 50.0% | 0.0 | – | -46.5% / -46.5% |
| KV-7 erkek kum: %20 favori | **yetersiz örnek** | 14 | 35.7% / 35.7% | 0.0 | – | – | 8 | 25.0% / 25.0% | 0.0 | – | -38.7% / -38.7% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | **yetersiz örnek** | 5 | 20.0% / 60.0% | -40.0 | 0.102 | – | 2 | 0.0% / 100.0% | -100.0 | – | -69.6% / +3.3% |
| KV-7 dişi çim: favori, yoksa plaseler | **yetersiz örnek** | 3 | 100.0% / 100.0% | 0.0 | – | – | 3 | 66.7% / 66.7% | 0.0 | – | -23.1% / -23.1% |
| KV-7 dişi kum: 1-2. handikaplı atlar | **yetersiz örnek** | 3 | 66.7% / 66.7% | 0.0 | – | – | 2 | 0.0% / 50.0% | -50.0 | 0.317 | -52.0% / -17.0% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | **yetersiz örnek** | 6 | 50.0% / 50.0% | 0.0 | 1.000 | – | 5 | 60.0% / 40.0% | +20.0 | 0.317 | -12.1% / -40.3% |
| KV-8 kum: favorinin şansı az (favori gelmez) | **yetersiz örnek** | 19 | 52.6% / 16.9% | +35.7 | 0.003 | – | 10 | 40.0% / 12.6% | +27.4 | 0.082 | -29.4% / -29.4% |
| KV-8 kum: 57 kg altındaki atlar kazanır | **yetersiz örnek** | 4 | 0.0% / 75.0% | -75.0 | 0.003 | – | 3 | 0.0% / 33.3% | -33.3 | 0.317 | -100.0% / -8.6% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | **yetersiz örnek** | 13 | 92.3% / 92.3% | 0.0 | – | – | 4 | 100.0% / 100.0% | 0.0 | – | -26.5% / -26.5% |
| KV-21 çim: %60 3,4,5 numaralı atlar | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-21 kum: %60 3,4,5 numaralı atlar | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-21: favori gelmez | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-22 çim: %60 1,2,3. handikaplar | **yetersiz örnek** | 3 | 0.0% / 66.7% | -66.7 | 0.046 | – | 2 | 50.0% / 50.0% | 0.0 | – | -78.3% / -32.3% |
| KV-22 kum: %50 1,2,3 numaralı | **yetersiz örnek** | 7 | 28.6% / 71.4% | -42.9 | 0.034 | – | 4 | 0.0% / 25.0% | -25.0 | 0.317 | -81.5% / -27.9% |
| KV-23 çim: %70 favori kazanır | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-23 kum: %60 favori | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-24 çim: handikap puanı 100+ atlar %80 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-24 kum: 90–120 puanlılar %80 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-25 çim: 2,3,4,5 numaralı %75 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| KV-25 kum: 3,4,5 numaralı %60 | **yetersiz örnek** | 0 | – / – | – | – | – | 0 | – / – | – | – | – / – |
| HAN-13 çim: ilk 3 at çok şanslı | **yetersiz örnek** | 0 | – / – | – | – | – | 1 | 100.0% / 100.0% | 0.0 | – | +46.7% / +46.7% |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | **yetersiz örnek** | 3 | 66.7% / 100.0% | -33.3 | 0.317 | – | 1 | 100.0% / 100.0% | 0.0 | – | -56.4% / -38.9% |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | **yetersiz örnek** | 8 | 0.0% / 62.5% | -62.5 | <0.001 | – | 14 | 28.6% / 57.1% | -28.6 | 0.141 | -19.3% / -13.7% |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | **yetersiz örnek** | 7 | 28.6% / 57.1% | -28.6 | 0.121 | – | 12 | 8.3% / 66.7% | -58.3 | 0.003 | -63.5% / -33.7% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | **yetersiz örnek** | 63 | 63.5% / 63.5% | 0.0 | – | – | 14 | 57.1% / 57.1% | 0.0 | – | -26.9% / -26.9% |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | **yetersiz örnek** | 24 | 45.8% / 75.0% | -29.2 | 0.022 | – | 33 | 39.4% / 72.7% | -33.3 | 0.003 | -38.7% / -32.6% |
| HAN-16 çim: favori-plaseler arasında biter | **yetersiz örnek** | 13 | 69.2% / 69.2% | 0.0 | – | – | 34 | 58.8% / 58.8% | 0.0 | – | -37.9% / -37.9% |
| HAN-16 çim: %30 7,8,9 numaralar | **yetersiz örnek** | 13 | 15.4% / 61.5% | -46.2 | 0.001 | – | 34 | 17.6% / 58.8% | -41.2 | <0.001 | -43.2% / -35.9% |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | **yetersiz örnek** | 7 | 14.3% / 100.0% | -85.7 | <0.001 | – | 9 | 44.4% / 77.8% | -33.3 | 0.046 | -68.2% / +3.5% |
| HAN-17 kum: plase atlar şanslı %70 | **yetersiz örnek** | 17 | 11.8% / 58.8% | -47.1 | <0.001 | – | 10 | 50.0% / 30.0% | +20.0 | 0.317 | -48.1% / -40.3% |
| HAN-17 kum: puana göre 1-4. atlar | **yetersiz örnek** | 17 | 64.7% / 58.8% | +5.9 | 0.572 | – | 10 | 70.0% / 70.0% | 0.0 | 1.000 | -33.5% / -50.0% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | **yetersiz örnek** | 28 | 60.7% / 60.7% | 0.0 | – | – | 22 | 40.9% / 40.9% | 0.0 | – | -23.8% / -23.8% |
| Açık/Grup çim: favori-plase dışına çıkmaz | **yetersiz örnek** | 8 | 50.0% / 50.0% | 0.0 | – | – | 21 | 76.2% / 76.2% | 0.0 | – | -34.5% / -34.5% |
| Açık/Grup kum: %70 favori | **yetersiz örnek** | 9 | 44.4% / 44.4% | 0.0 | – | – | 6 | 16.7% / 16.7% | 0.0 | – | -40.7% / -40.7% |

## İngiliz atları

2522 sonuçlanmış İngiliz koşusu.

### Kurallar (İngiliz)

| Kural | Koşu | İsabet (95% aralık) | Ort. seçim | Rastgele | Aynı sayıda favori | İddia | Karar | 3 yaş (n / isabet / favori) | Sentetik (n / isabet / favori) |
|---|---:|---|---:|---:|---:|---|---|---|---|
| Şartlı 1 çim: ilk 4 at arasında biter | 50 | 68.0% (54.2%–79.2%) | 4.0 | 49.1% | 68.0% | – | favori seçimi (oran bilgi amaçlı) | 3 / 100.0% / 100.0% | – |
| Şartlı 1 kum: favori-plaseler arasında biter | 45 | 77.8% (63.7%–87.5%) | 3.1 | 36.9% | 77.8% | – | favori seçimi (oran bilgi amaçlı) | 9 / 88.9% / 88.9% | 22 / 68.2% / 68.2% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | 115 | 64.3% (55.3%–72.5%) | 3.0 | 35.4% | 69.6% | – | favoriden farksız | 17 / 64.7% / 88.2% | – |
| Şartlı 2: favori varsa kazanır | 6 | 16.7% (3.0%–56.4%) | 1.0 | 13.1% | 16.7% | – | yetersiz örnek | 3 / 0.0% / 0.0% | – |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | 0 / – / – |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | 6 | 50.0% (18.8%–81.2%) | 4.0 | 51.9% | 83.3% | – | yetersiz örnek | 3 / 66.7% / 66.7% | – |
| Şartlı 2: 1-2. handikap dışına çıkmaz | 6 | 16.7% (3.0%–56.4%) | 2.0 | 26.3% | 33.3% | – | yetersiz örnek | 3 / 0.0% / 0.0% | – |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 6 | 50.0% (18.8%–81.2%) | 2.7 | 34.3% | 50.0% | – | yetersiz örnek | 3 / 66.7% / 33.3% | – |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 30 | 53.3% (36.1%–69.8%) | 2.0 | 24.6% | 76.7% | – | doğrulandı | 13 / 53.8% / 76.9% | – |
| Şartlı 3 kum: favori şanslı | 100 | 45.0% (35.6%–54.8%) | 1.0 | 14.3% | 45.0% | – | favori seçimi (oran bilgi amaçlı) | 41 / 29.3% / 29.3% | 20 / 20.0% / 20.0% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 36 | 22.2% (11.7%–38.1%) | 1.8 | 19.8% | 47.2% | – | favoriden kötü | 21 / 33.3% / 47.6% | 13 / 23.1% / 38.5% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 91 | 41.8% (32.2%–52.0%) | 1.8 | 21.5% | 57.1% | – | favoriden kötü | 36 / 19.4% / 33.3% | – |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 71 | 66.2% (54.6%–76.1%) | 3.0 | 39.4% | 69.0% | – | favoriden farksız | 25 / 88.0% / 72.0% | – |
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 164 | 51.2% (43.6%–58.8%) | 3.9 | 56.2% | 86.0% | – | favoriden kötü | 60 / 60.0% / 83.3% | 38 / 57.9% / 84.2% |
| Şartlı 4: favori gelir | 273 | 39.2% (33.6%–45.1%) | 1.0 | 14.8% | 39.2% | – | favori seçimi (oran bilgi amaçlı) | 95 / 31.6% / 31.6% | – |
| Şartlı 5 çim: favori çok şanslı | 55 | 50.9% (38.1%–63.6%) | 1.1 | 16.2% | 50.9% | – | favori seçimi (oran bilgi amaçlı) | 14 / 64.3% / 64.3% | – |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | 55 | 36.4% (24.9%–49.6%) | 3.7 | 47.6% | 80.0% | 40.0% · tutuyor | favoriden kötü | 14 / 21.4% / 78.6% | – |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 14 | 0.0% (0.0%–21.5%) | 1.1 | 17.8% | 35.7% | – | yetersiz örnek | 5 / 0.0% / 80.0% | 2 / 0.0% / 50.0% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | 11 | 18.2% (5.1%–47.7%) | 1.2 | 19.1% | 54.5% | – | yetersiz örnek | 2 / 0.0% / 100.0% | 5 / 20.0% / 60.0% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | 200 | 85.5% (80.0%–89.7%) | 4.0 | 60.7% | 85.5% | – | favori seçimi (oran bilgi amaçlı) | 60 / 90.0% / 90.0% | – |
| KV-6 çim: 1-2. atların dışına çıkmaz | 39 | 51.3% (36.2%–66.1%) | 2.0 | 28.1% | 51.3% | – | favori seçimi (oran bilgi amaçlı) | 14 / 42.9% / 42.9% | – |
| KV-6 kum: 1-2. atlar şanslı | 66 | 60.6% (48.5%–71.5%) | 2.0 | 32.2% | 60.6% | – | favori seçimi (oran bilgi amaçlı) | 25 / 56.0% / 56.0% | 14 / 42.9% / 42.9% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | 64 | 68.8% (56.6%–78.8%) | 3.0 | 48.3% | 73.4% | – | favoriden farksız | 24 / 70.8% / 66.7% | 14 / 85.7% / 85.7% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | 66 | 63.6% (51.6%–74.2%) | 3.1 | 50.4% | 74.2% | – | favoriden kötü | 25 / 72.0% / 64.0% | 14 / 78.6% / 85.7% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | 12 | 33.3% (13.8%–60.9%) | 1.7 | 24.5% | 75.0% | – | yetersiz örnek | 5 / 20.0% / 80.0% | 5 / 60.0% / 40.0% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | 20 | 70.0% (48.1%–85.5%) | 2.0 | 30.5% | 70.0% | – | yetersiz örnek | 7 / 71.4% / 71.4% | – |
| KV-7 erkek kum: %20 favori | 33 | 33.3% (19.8%–50.4%) | 1.0 | 16.1% | 33.3% | 20.0% · tutuyor | iddia edilen oran tutuyor | 12 / 33.3% / 33.3% | 10 / 50.0% / 50.0% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | 11 | 0.0% (0.0%–25.9%) | 1.7 | 26.6% | 54.5% | – | yetersiz örnek | 4 / 0.0% / 50.0% | 5 / 20.0% / 80.0% |
| KV-7 dişi çim: favori, yoksa plaseler | 8 | 37.5% (13.7%–69.4%) | 3.0 | 39.4% | 37.5% | – | yetersiz örnek | 2 / 0.0% / 0.0% | – |
| KV-7 dişi kum: 1-2. handikaplı atlar | 15 | 80.0% (54.8%–93.0%) | 2.1 | 31.1% | 93.3% | – | yetersiz örnek | 8 / 87.5% / 100.0% | 6 / 16.7% / 66.7% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | 35 | 45.7% (30.5%–61.8%) | 1.6 | 26.0% | 57.1% | – | favoriden farksız | 14 / 28.6% / 64.3% | – |
| KV-8 kum: favorinin şansı az (favori gelmez) | 37 | 59.5% (43.5%–73.7%) | 1.0 | 16.7% | 59.5% | – | doğrulanmadı (favori yine en şanslı) | 14 / 57.1% / 57.1% | 23 / 43.5% / 43.5% |
| KV-8 kum: 57 kg altındaki atlar kazanır | 8 | 25.0% (7.1%–59.1%) | 1.8 | 24.8% | 75.0% | – | yetersiz örnek | 2 / 0.0% / 50.0% | 8 / 0.0% / 50.0% |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | 40 | 82.5% (68.0%–91.3%) | 3.1 | 47.3% | 82.5% | – | favori seçimi (oran bilgi amaçlı) | 16 / 87.5% / 87.5% | – |
| KV-21 çim: %60 3,4,5 numaralı atlar | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | – |
| KV-21 kum: %60 3,4,5 numaralı atlar | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-21: favori gelmez | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | – |
| KV-22 çim: %60 1,2,3. handikaplar | 11 | 45.5% (21.3%–72.0%) | 3.5 | 45.3% | 81.8% | 60.0% | yetersiz örnek | 0 / – / – | – |
| KV-22 kum: %50 1,2,3 numaralı | 14 | 50.0% (26.8%–73.2%) | 2.9 | 37.5% | 85.7% | 50.0% | yetersiz örnek | 0 / – / – | 13 / 46.2% / 76.9% |
| KV-23 çim: %70 favori kazanır | 0 | – (–––) | – | – | – | 70.0% | yetersiz örnek | 0 / – / – | – |
| KV-23 kum: %60 favori | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-24 çim: handikap puanı 100+ atlar %80 | 0 | – (–––) | – | – | – | 80.0% | yetersiz örnek | 0 / – / – | – |
| KV-24 kum: 90–120 puanlılar %80 | 0 | – (–––) | – | – | – | 80.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-25 çim: 2,3,4,5 numaralı %75 | 0 | – (–––) | – | – | – | 75.0% | yetersiz örnek | 0 / – / – | – |
| KV-25 kum: 3,4,5 numaralı %60 | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| HAN-13 çim: ilk 3 at çok şanslı | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | – |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | 4 | 100.0% (51.0%–100.0%) | 4.5 | 60.4% | 100.0% | 70.0% | yetersiz örnek | 3 / 100.0% / 100.0% | 0 / – / – |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | 27 | 11.1% (3.9%–28.1%) | 2.2 | 19.2% | 29.6% | 20.0% | yetersiz örnek | 15 / 13.3% / 33.3% | – |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 24 | 20.8% (9.2%–40.5%) | 2.8 | 22.6% | 37.5% | – | yetersiz örnek | 13 / 23.1% / 38.5% | – |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 76 | 31.6% (22.2%–42.7%) | 2.6 | 26.7% | 61.8% | – | favoriden kötü | 39 / 33.3% / 64.1% | 10 / 40.0% / 90.0% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | 93 | 77.4% (67.9%–84.7%) | 3.0 | 34.6% | 77.4% | 75.0% · tutuyor | iddia edilen oran tutuyor | 48 / 83.3% / 83.3% | 11 / 72.7% / 72.7% |
| HAN-14 (özet): 1-2. at kazanır | 131 | 60.3% (51.7%–68.3%) | 2.1 | 22.5% | 60.3% | – | favori seçimi (oran bilgi amaçlı) | 71 / 66.2% / 66.2% | – |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 68 | 39.7% (28.9%–51.6%) | 4.3 | 38.8% | 69.1% | – | favoriden kötü | 34 / 32.4% / 76.5% | – |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 138 | 42.0% (34.1%–50.4%) | 3.2 | 37.8% | 70.3% | – | favoriden kötü | 65 / 53.8% / 72.3% | 37 / 21.6% / 64.9% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 98 | 24.5% (17.0%–33.9%) | 1.7 | 17.8% | 44.9% | – | favoriden kötü | 42 / 23.8% / 42.9% | 24 / 25.0% / 45.8% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | 243 | 64.6% (58.4%–70.4%) | 3.0 | 33.0% | 64.6% | – | favori seçimi (oran bilgi amaçlı) | 116 / 68.1% / 68.1% | – |
| HAN-15 (özet): 3. handikaplı at tek | 208 | 13.0% (9.1%–18.2%) | 1.2 | 13.3% | 38.9% | – | favoriden kötü | 97 / 16.5% / 35.1% | – |
| HAN-16 çim: favori-plaseler arasında biter | 57 | 61.4% (48.4%–72.9%) | 3.0 | 34.3% | 61.4% | – | favori seçimi (oran bilgi amaçlı) | 23 / 69.6% / 69.6% | – |
| HAN-16 çim: %30 7,8,9 numaralar | 54 | 16.7% (9.0%–28.7%) | 2.5 | 26.4% | 55.6% | 30.0% · abartılı | favoriden kötü | 21 / 9.5% / 61.9% | – |
| HAN-16 kum: 1,2,3. handikaplar %80 | 113 | 44.2% (35.4%–53.4%) | 3.2 | 37.6% | 73.5% | 80.0% · abartılı | favoriden kötü | 35 / 51.4% / 68.6% | 27 / 40.7% / 70.4% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 82 | 22.0% (14.4%–32.1%) | 2.0 | 21.8% | 53.7% | – | favoriden kötü | 29 / 20.7% / 48.3% | 22 / 27.3% / 63.6% |
| HAN-16 (özet): hafif kilo favori | 132 | 31.8% (24.5%–40.2%) | 1.3 | 14.2% | 44.7% | – | favoriden kötü | 41 / 26.8% / 43.9% | – |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | 21 | 23.8% (10.6%–45.1%) | 3.1 | 35.9% | 81.0% | – | yetersiz örnek | 4 / 0.0% / 75.0% | – |
| HAN-17 kum: plase atlar şanslı %70 | 31 | 38.7% (23.7%–56.2%) | 2.0 | 22.7% | 45.2% | 70.0% · abartılı | favoriden farksız | 1 / 0.0% / 100.0% | 12 / 25.0% / 41.7% |
| HAN-17 kum: puana göre 1-4. atlar | 31 | 83.9% (67.4%–92.9%) | 4.0 | 45.5% | 87.1% | – | favoriden farksız | 1 / 100.0% / 100.0% | 11 / 63.6% / 72.7% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | 64 | 50.0% (38.1%–61.9%) | 2.1 | 24.3% | 50.0% | – | favori seçimi (oran bilgi amaçlı) | 6 / 83.3% / 83.3% | – |
| Maiden kum: genelde favori kazanır | 233 | 42.1% (35.9%–48.5%) | 1.0 | 11.1% | 42.1% | – | favori seçimi (oran bilgi amaçlı) | 125 / 41.6% / 41.6% | 63 / 28.6% / 28.6% |
| Maiden (özet): ilk iki at arasında | 446 | 57.8% (53.2%–62.3%) | 2.1 | 20.8% | 57.8% | – | favori seçimi (oran bilgi amaçlı) | 220 / 57.7% / 57.7% | – |
| Açık/Grup çim: favori-plase dışına çıkmaz | 61 | 62.3% (49.7%–73.4%) | 3.0 | 33.8% | 62.3% | – | favori seçimi (oran bilgi amaçlı) | 18 / 72.2% / 72.2% | – |
| Açık/Grup kum: %70 favori | 21 | 52.4% (32.4%–71.7%) | 1.1 | 14.1% | 52.4% | 70.0% | yetersiz örnek | 5 / 40.0% / 40.0% | 11 / 45.5% / 45.5% |

### Favori referansı (İngiliz, sınıf × pist)

| Sınıf | Pist | Koşu | Ort. at | Favori kazandı | İlk 3 favoriden biri |
|---|---|---:|---:|---:|---:|
| COND | Kum | 452 | 7.8 | 41.8% | 78.3% |
| HAND | Kum | 395 | 9.3 | 37.0% | 70.9% |
| MAIDEN | Kum | 233 | 10.0 | 42.1% | 77.7% |
| COND | Çim | 226 | 8.7 | 38.1% | 71.7% |
| KV | Kum | 188 | 6.7 | 50.5% | 80.3% |
| HAND | Çim | 184 | 10.3 | 31.5% | 58.7% |
| MAIDEN | Çim | 150 | 11.3 | 39.3% | 70.0% |
| KV | Çim | 128 | 7.6 | 35.9% | 68.8% |
| COND | Sentetik | 116 | 8.8 | 38.8% | 74.1% |
| HAND | Sentetik | 90 | 11.0 | 34.4% | 62.2% |
| KV | Sentetik | 70 | 7.5 | 38.6% | 81.4% |
| SAT | Kum | 68 | 9.3 | 38.2% | 66.2% |
| MAIDEN | Sentetik | 63 | 11.3 | 28.6% | 65.1% |
| GROUP | Çim | 61 | 9.9 | 32.8% | 62.3% |
| SAT | Çim | 34 | 9.4 | 29.4% | 58.8% |
| SAT | Sentetik | 23 | 10.5 | 30.4% | 56.5% |
| GROUP | Kum | 21 | 8.0 | 52.4% | 81.0% |

### Start (kulvar) etkisi (İngiliz), alan büyüklüğüne göre düzeltilmiş

A/E = gerçek birincilik / beklenen birincilik (Σ 1/at sayısı). 1,00 nötr; 1,20 = %20 fazla.

**Kum 1400 m** (405 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 394 | 55 | 1.12 |
| 2 | 388 | 43 | 0.89 |
| 3 | 386 | 46 | 0.95 |
| 4 | 391 | 53 | 1.09 |
| 5 | 392 | 50 | 1.03 |
| 6 | 358 | 41 | 0.98 |
| 7 | 312 | 35 | 1.03 |
| 8 | 267 | 21 | 0.77 |
| 9 | 205 | 19 | 0.98 |
| 10 | 167 | 13 | 0.87 |
| 11 | 123 | 12 | 1.17 |
| 12 | 77 | 6 | 1.00 |
| 13 | 52 | 5 | 1.32 |
| 14 | 32 | 3 | 1.38 |
| 15 | 17 | 2 | 1.89 |

**Kum 1200 m** (209 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 206 | 32 | 1.28 |
| 2 | 202 | 31 | 1.25 |
| 3 | 206 | 21 | 0.84 |
| 4 | 197 | 27 | 1.13 |
| 5 | 203 | 20 | 0.82 |
| 6 | 182 | 24 | 1.15 |
| 7 | 169 | 19 | 1.04 |
| 8 | 142 | 10 | 0.68 |
| 9 | 125 | 7 | 0.57 |
| 10 | 92 | 6 | 0.71 |
| 11 | 64 | 9 | 1.62 |
| 12 | 31 | 2 | 0.83 |
| 13 | 22 | 0 | 0.00 |

**Kum 1900 m** (166 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 162 | 20 | 0.92 |
| 2 | 161 | 20 | 0.91 |
| 3 | 162 | 25 | 1.15 |
| 4 | 161 | 25 | 1.15 |
| 5 | 159 | 21 | 0.98 |
| 6 | 133 | 13 | 0.81 |
| 7 | 117 | 11 | 0.82 |
| 8 | 94 | 13 | 1.30 |
| 9 | 68 | 7 | 1.06 |
| 10 | 49 | 5 | 1.12 |
| 11 | 37 | 5 | 1.54 |
| 12 | 20 | 1 | 0.60 |

**Kum 2000 m** (154 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 153 | 23 | 1.15 |
| 2 | 152 | 26 | 1.31 |
| 3 | 147 | 13 | 0.68 |
| 4 | 150 | 21 | 1.07 |
| 5 | 149 | 15 | 0.78 |
| 6 | 136 | 20 | 1.21 |
| 7 | 112 | 16 | 1.28 |
| 8 | 93 | 7 | 0.72 |
| 9 | 67 | 8 | 1.21 |
| 10 | 45 | 3 | 0.74 |
| 11 | 32 | 0 | 0.00 |
| 12 | 21 | 1 | 0.62 |
| 13 | 15 | 0 | 0.00 |

**Çim 1400 m** (131 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 126 | 11 | 0.76 |
| 2 | 127 | 15 | 1.02 |
| 3 | 126 | 10 | 0.69 |
| 4 | 127 | 13 | 0.89 |
| 5 | 124 | 18 | 1.26 |
| 6 | 120 | 17 | 1.26 |
| 7 | 109 | 9 | 0.78 |
| 8 | 96 | 16 | 1.67 |
| 9 | 76 | 3 | 0.44 |
| 10 | 64 | 8 | 1.44 |
| 11 | 49 | 2 | 0.50 |
| 12 | 34 | 2 | 0.79 |
| 13 | 25 | 5 | 2.89 |
| 14 | 18 | 0 | 0.00 |

**Çim 1200 m** (117 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 114 | 20 | 1.46 |
| 2 | 112 | 10 | 0.76 |
| 3 | 113 | 12 | 0.89 |
| 4 | 116 | 13 | 0.94 |
| 5 | 110 | 13 | 1.01 |
| 6 | 103 | 12 | 1.06 |
| 7 | 89 | 7 | 0.77 |
| 8 | 84 | 7 | 0.83 |
| 9 | 69 | 12 | 1.89 |
| 10 | 57 | 5 | 0.99 |
| 11 | 46 | 2 | 0.52 |
| 12 | 36 | 1 | 0.35 |
| 13 | 15 | 2 | 1.89 |

### HAN-16 profili (İngiliz)

197 koşu; katılan atların handikap puanı 6–75 (P10–P90: 39–69); yaş şartları: 3O, 3U, 4U. Resmi katılım şartı metni bu kaynakta yok; bu aralık katılanlardan gözlemdir.

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

1955 sonuçlanmış Arap koşusu. Kurallar İngiliz atları için yazıldı; bu bölüm Araplara aktarılıp aktarılamayacağını gösterir.

### Kurallar (Arap)

| Kural | Koşu | İsabet (95% aralık) | Ort. seçim | Rastgele | Aynı sayıda favori | İddia | Karar | 3 yaş (n / isabet / favori) | Sentetik (n / isabet / favori) |
|---|---:|---|---:|---:|---:|---|---|---|---|
| Şartlı 1 çim: ilk 4 at arasında biter | 31 | 64.5% (46.9%–78.9%) | 4.0 | 36.6% | 64.5% | – | favori seçimi (oran bilgi amaçlı) | 31 / 64.5% / 64.5% | – |
| Şartlı 1 kum: favori-plaseler arasında biter | 17 | 64.7% (41.3%–82.7%) | 3.1 | 29.7% | 64.7% | – | yetersiz örnek | 17 / 64.7% / 64.7% | 19 / 68.4% / 68.4% |
| Şartlı 1: genel puanı yüksek ilk 3 attan biri gelir | 67 | 50.7% (39.1%–62.3%) | 3.0 | 27.8% | 64.2% | – | favoriden kötü | 67 / 50.7% / 64.2% | – |
| Şartlı 2: favori varsa kazanır | 5 | 20.0% (3.6%–62.4%) | 1.2 | 16.6% | 20.0% | – | yetersiz örnek | 4 / 0.0% / 0.0% | – |
| Şartlı 2 kum: puanı 190 üstü favori kazanır | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | 0 / – / – |
| Şartlı 2: 1,2,3,5. handikaplar arasında geçer | 5 | 80.0% (37.6%–96.4%) | 4.0 | 54.7% | 80.0% | – | yetersiz örnek | 4 / 75.0% / 75.0% | – |
| Şartlı 2: 1-2. handikap dışına çıkmaz | 5 | 40.0% (11.8%–76.9%) | 2.2 | 30.4% | 40.0% | – | yetersiz örnek | 4 / 25.0% / 25.0% | – |
| Şartlı 2: favori yoksa 55 kg civarı sürpriz (54–56 kg, favori dışı) | 5 | 60.0% (23.1%–88.2%) | 3.6 | 47.2% | 80.0% | – | yetersiz örnek | 4 / 75.0% / 75.0% | – |
| Şartlı 3 çim: plaseler (2–3. favori) favoriden şanslı | 30 | 26.7% (14.2%–44.4%) | 2.0 | 22.8% | 46.7% | – | doğrulanmadı (favori daha sık kazanıyor) | 15 / 33.3% / 53.3% | – |
| Şartlı 3 kum: favori şanslı | 77 | 45.5% (34.8%–56.5%) | 1.0 | 11.7% | 45.5% | – | favori seçimi (oran bilgi amaçlı) | 15 / 53.3% / 53.3% | 14 / 28.6% / 28.6% |
| Şartlı 3 kum: 47–51 handikap puanlılar arasında geçer | 29 | 31.0% (17.3%–49.2%) | 1.3 | 12.7% | 48.3% | – | yetersiz örnek | 2 / 100.0% / 100.0% | 5 / 0.0% / 40.0% |
| Şartlı 3: favori yoksa 60 kg civarı at (59–61 kg) | 92 | 33.7% (24.9%–43.8%) | 2.2 | 24.3% | 54.3% | – | favoriden kötü | 30 / 50.0% / 53.3% | – |
| Şartlı 4 çim: 2-3-4. TGP (puan) atlar kazanır | 50 | 40.0% (27.6%–53.8%) | 3.0 | 31.4% | 64.0% | – | favoriden kötü | 13 / 53.8% / 38.5% | – |
| Şartlı 4 kum: 1,2,3,4 startlı atlar kazanır | 137 | 48.2% (40.0%–56.5%) | 3.9 | 47.6% | 83.2% | – | favoriden kötü | 29 / 44.8% / 79.3% | 34 / 32.4% / 82.4% |
| Şartlı 4: favori gelir | 221 | 35.3% (29.3%–41.8%) | 1.0 | 12.1% | 35.3% | – | favori seçimi (oran bilgi amaçlı) | 52 / 32.7% / 32.7% | – |
| Şartlı 5 çim: favori çok şanslı | 55 | 18.2% (10.2%–30.3%) | 1.1 | 11.0% | 18.2% | – | favori seçimi (oran bilgi amaçlı) | 14 / 21.4% / 21.4% | – |
| Şartlı 5 çim: %40 hafif kg'lar kazanır | 55 | 47.3% (34.7%–60.2%) | 5.0 | 48.3% | 69.1% | 40.0% · tutuyor | favoriden kötü | 14 / 35.7% / 78.6% | – |
| Şartlı 5 kum: sürpriz 49–51 kg'lardan gelir | 15 | 0.0% (0.0%–20.4%) | 1.1 | 13.8% | 40.0% | – | yetersiz örnek | 4 / 0.0% / 50.0% | 2 / 0.0% / 0.0% |
| Şartlı 5 1200 kum: 1, 8, 13 startlılar kazanır | 13 | 23.1% (8.2%–50.3%) | 1.6 | 19.8% | 46.2% | – | yetersiz örnek | 5 / 20.0% / 60.0% | 2 / 0.0% / 50.0% |
| Şartlı 5: öne çıkan favori, yoksa 2,3,4. atlar (ilk 4 favori) | 182 | 81.9% (75.6%–86.8%) | 4.0 | 48.0% | 81.9% | – | favori seçimi (oran bilgi amaçlı) | 37 / 75.7% / 75.7% | – |
| KV-6 çim: 1-2. atların dışına çıkmaz | 32 | 50.0% (33.6%–66.4%) | 2.0 | 25.0% | 50.0% | – | favori seçimi (oran bilgi amaçlı) | 9 / 44.4% / 44.4% | – |
| KV-6 kum: 1-2. atlar şanslı | 43 | 60.5% (45.6%–73.6%) | 2.1 | 27.1% | 60.5% | – | favori seçimi (oran bilgi amaçlı) | 7 / 28.6% / 28.6% | 13 / 69.2% / 69.2% |
| KV-6 kum: puana göre 1,2,3. atlar kazanır | 43 | 69.8% (54.9%–81.4%) | 3.0 | 38.5% | 76.7% | – | favoriden farksız | 7 / 28.6% / 57.1% | 13 / 76.9% / 76.9% |
| KV-6 kum: 1,2,3. handikaplar arasında geçer | 43 | 58.1% (43.3%–71.6%) | 3.1 | 40.2% | 76.7% | – | favoriden kötü | 7 / 42.9% / 57.1% | 13 / 61.5% / 76.9% |
| KV-6 dişi kum: 6 numaralı ya da 6 startlı at | 5 | 0.0% (0.0%–43.4%) | 1.8 | 21.7% | 20.0% | – | yetersiz örnek | 1 / 0.0% / 0.0% | 3 / 33.3% / 33.3% |
| KV-7 erkek çim: ilk 2 atın dışına çıkmaz | 12 | 50.0% (25.4%–74.6%) | 2.0 | 24.6% | 50.0% | – | yetersiz örnek | 4 / 0.0% / 0.0% | – |
| KV-7 erkek kum: %20 favori | 22 | 31.8% (16.4%–52.7%) | 1.0 | 13.8% | 31.8% | 20.0% | yetersiz örnek | 2 / 100.0% / 100.0% | 4 / 100.0% / 100.0% |
| KV-7 erkek kum: 54 kg şansı yüksek (53.5–54.5) | 7 | 14.3% (2.6%–51.3%) | 1.7 | 25.5% | 71.4% | – | yetersiz örnek | 2 / 0.0% / 100.0% | 2 / 0.0% / 100.0% |
| KV-7 dişi çim: favori, yoksa plaseler | 6 | 83.3% (43.6%–97.0%) | 3.0 | 35.1% | 83.3% | – | yetersiz örnek | 2 / 50.0% / 50.0% | – |
| KV-7 dişi kum: 1-2. handikaplı atlar | 5 | 40.0% (11.8%–76.9%) | 2.0 | 24.2% | 60.0% | – | yetersiz örnek | 0 / – / – | 2 / 50.0% / 50.0% |
| KV-8 çim: 1-2-4 startlı favori/plase atlar | 11 | 54.5% (28.0%–78.7%) | 1.7 | 22.6% | 45.5% | – | yetersiz örnek | 4 / 50.0% / 75.0% | – |
| KV-8 kum: favorinin şansı az (favori gelmez) | 29 | 48.3% (31.4%–65.6%) | 1.1 | 15.4% | 48.3% | – | yetersiz örnek | 5 / 40.0% / 40.0% | 9 / 44.4% / 44.4% |
| KV-8 kum: 57 kg altındaki atlar kazanır | 7 | 0.0% (0.0%–35.4%) | 1.0 | 14.6% | 57.1% | – | yetersiz örnek | 3 / 0.0% / 33.3% | 0 / – / – |
| KV-9: kesin favori, yoksa plaseler dışına çıkmaz | 17 | 94.1% (73.0%–99.0%) | 3.0 | 42.1% | 94.1% | – | yetersiz örnek | 4 / 100.0% / 100.0% | – |
| KV-21 çim: %60 3,4,5 numaralı atlar | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | – |
| KV-21 kum: %60 3,4,5 numaralı atlar | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-21: favori gelmez | 0 | – (–––) | – | – | – | – | yetersiz örnek | 0 / – / – | – |
| KV-22 çim: %60 1,2,3. handikaplar | 5 | 20.0% (3.6%–62.4%) | 3.0 | 29.5% | 60.0% | 60.0% | yetersiz örnek | 0 / – / – | – |
| KV-22 kum: %50 1,2,3 numaralı | 11 | 18.2% (5.1%–47.7%) | 3.0 | 30.5% | 54.5% | 50.0% | yetersiz örnek | 0 / – / – | 8 / 62.5% / 62.5% |
| KV-23 çim: %70 favori kazanır | 0 | – (–––) | – | – | – | 70.0% | yetersiz örnek | 0 / – / – | – |
| KV-23 kum: %60 favori | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-24 çim: handikap puanı 100+ atlar %80 | 0 | – (–––) | – | – | – | 80.0% | yetersiz örnek | 0 / – / – | – |
| KV-24 kum: 90–120 puanlılar %80 | 0 | – (–––) | – | – | – | 80.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| KV-25 çim: 2,3,4,5 numaralı %75 | 0 | – (–––) | – | – | – | 75.0% | yetersiz örnek | 0 / – / – | – |
| KV-25 kum: 3,4,5 numaralı %60 | 0 | – (–––) | – | – | – | 60.0% | yetersiz örnek | 0 / – / – | 0 / – / – |
| HAN-13 çim: ilk 3 at çok şanslı | 1 | 100.0% (20.7%–100.0%) | 3.0 | 37.5% | 100.0% | – | yetersiz örnek | 1 / 100.0% / 100.0% | – |
| HAN-13 kum: 1,2,3,4. handikaplar %70 | 4 | 75.0% (30.1%–95.4%) | 4.5 | 41.2% | 100.0% | 70.0% | yetersiz örnek | 3 / 66.7% / 100.0% | 0 / – / – |
| HAN-14 çim: en üstteki 2 handikabın şansı %20 | 22 | 18.2% (7.3%–38.5%) | 2.2 | 18.4% | 59.1% | 20.0% | yetersiz örnek | 6 / 16.7% / 66.7% | – |
| HAN-14 çim: 7,8,9. handikap sırasındaki atlar | 19 | 15.8% (5.5%–37.6%) | 2.7 | 21.6% | 63.2% | – | yetersiz örnek | 5 / 20.0% / 80.0% | – |
| HAN-14 kum: 37,43,47,48,49,51,52 handikaplar fazla kazanıyor | 74 | 28.4% (19.4%–39.5%) | 3.4 | 27.3% | 58.1% | – | favoriden kötü | 11 / 27.3% / 63.6% | 11 / 27.3% / 54.5% |
| HAN-14 kum: %75 1-2-3. atlara güvenin | 77 | 62.3% (51.2%–72.3%) | 3.0 | 26.3% | 62.3% | 75.0% · abartılı | iddia abartılı | 12 / 66.7% / 66.7% | 12 / 50.0% / 50.0% |
| HAN-14 (özet): 1-2. at kazanır | 111 | 48.6% (39.6%–57.8%) | 2.1 | 17.6% | 48.6% | – | favori seçimi (oran bilgi amaçlı) | 20 / 60.0% / 60.0% | – |
| HAN-15 çim: 5,6,8,9,10 numaralı atlar çok şanslı | 57 | 42.1% (30.2%–55.0%) | 4.7 | 37.0% | 73.7% | – | favoriden kötü | 10 / 10.0% / 80.0% | – |
| HAN-15 kum: 1,2,3. handikaplar fazla kazanır | 111 | 52.3% (43.0%–61.3%) | 3.2 | 30.6% | 59.5% | – | favoriden farksız | 12 / 83.3% / 91.7% | 33 / 21.2% / 60.6% |
| HAN-15 kum: 54 kg'lılar fazla kazanıyor (53.5–54.5) | 67 | 16.4% (9.4%–27.1%) | 1.8 | 14.7% | 35.8% | – | favoriden kötü | 10 / 20.0% / 70.0% | 26 / 19.2% / 38.5% |
| HAN-15 (özet): 1,2,3. at dışına çıkmaz | 201 | 58.2% (51.3%–64.8%) | 3.0 | 27.0% | 58.2% | – | favori seçimi (oran bilgi amaçlı) | 24 / 83.3% / 83.3% | – |
| HAN-15 (özet): 3. handikaplı at tek | 164 | 18.3% (13.1%–24.9%) | 1.3 | 11.3% | 36.0% | – | favoriden kötü | 20 / 20.0% / 50.0% | – |
| HAN-16 çim: favori-plaseler arasında biter | 47 | 61.7% (47.4%–74.2%) | 3.1 | 26.3% | 61.7% | – | favori seçimi (oran bilgi amaçlı) | 0 / – / – | – |
| HAN-16 çim: %30 7,8,9 numaralar | 47 | 17.0% (8.9%–30.1%) | 2.9 | 23.7% | 59.6% | 30.0% · tutuyor | favoriden kötü | 0 / – / – | – |
| HAN-16 kum: 1,2,3. handikaplar %80 | 88 | 36.4% (27.1%–46.8%) | 3.3 | 29.7% | 60.2% | 80.0% · abartılı | favoriden kötü | 0 / – / – | 23 / 30.4% / 56.5% |
| HAN-16 kum: 40,48,49,50,52,53,54 handikaplardan sürpriz | 65 | 23.1% (14.5%–34.6%) | 2.0 | 16.4% | 38.5% | – | favoriden kötü | 0 / – / – | 17 / 17.6% / 41.2% |
| HAN-16 (özet): hafif kilo favori | 112 | 25.9% (18.7%–34.7%) | 1.2 | 10.7% | 39.3% | – | favoriden kötü | 0 / – / – | – |
| HAN-17 çim: hafif kg'lı atlar çok şanslı | 16 | 31.3% (14.2%–55.6%) | 3.9 | 33.7% | 87.5% | – | yetersiz örnek | 0 / – / – | – |
| HAN-17 kum: plase atlar şanslı %70 | 27 | 25.9% (13.2%–44.7%) | 2.0 | 19.1% | 48.1% | 70.0% | yetersiz örnek | 0 / – / – | 7 / 28.6% / 42.9% |
| HAN-17 kum: puana göre 1-4. atlar | 27 | 66.7% (47.8%–81.4%) | 4.0 | 37.8% | 63.0% | – | yetersiz örnek | 0 / – / – | 7 / 57.1% / 71.4% |
| HAN-17: normal şartlarda 1-2. at dışına çıkmaz | 50 | 52.0% (38.5%–65.2%) | 2.1 | 18.7% | 52.0% | – | favori seçimi (oran bilgi amaçlı) | 0 / – / – | – |
| Maiden kum: genelde favori kazanır | 232 | 33.2% (27.4%–39.5%) | 1.1 | 11.1% | 33.2% | – | favori seçimi (oran bilgi amaçlı) | 157 / 33.1% / 33.1% | 62 / 37.1% / 37.1% |
| Maiden (özet): ilk iki at arasında | 430 | 52.3% (47.6%–57.0%) | 2.1 | 19.8% | 52.3% | – | favori seçimi (oran bilgi amaçlı) | 335 / 52.2% / 52.2% | – |
| Açık/Grup çim: favori-plase dışına çıkmaz | 29 | 69.0% (50.8%–82.7%) | 3.0 | 27.4% | 69.0% | – | yetersiz örnek | 9 / 66.7% / 66.7% | – |
| Açık/Grup kum: %70 favori | 15 | 33.3% (15.2%–58.3%) | 1.0 | 11.2% | 33.3% | 70.0% | yetersiz örnek | 2 / 50.0% / 50.0% | 4 / 25.0% / 25.0% |

### Favori referansı (Arap, sınıf × pist)

| Sınıf | Pist | Koşu | Ort. at | Favori kazandı | İlk 3 favoriden biri |
|---|---|---:|---:|---:|---:|
| COND | Kum | 357 | 9.1 | 38.4% | 75.1% |
| HAND | Kum | 314 | 11.6 | 29.6% | 60.2% |
| MAIDEN | Kum | 232 | 10.2 | 33.2% | 69.4% |
| COND | Çim | 173 | 10.5 | 28.9% | 60.7% |
| HAND | Çim | 157 | 12.7 | 31.2% | 60.5% |
| MAIDEN | Çim | 136 | 11.6 | 33.8% | 66.9% |
| KV | Kum | 121 | 8.1 | 40.5% | 78.5% |
| COND | Sentetik | 99 | 10.4 | 37.4% | 70.7% |
| HAND | Sentetik | 79 | 13.3 | 21.5% | 49.4% |
| KV | Çim | 73 | 9.0 | 42.5% | 69.9% |
| MAIDEN | Sentetik | 62 | 11.7 | 37.1% | 71.0% |
| KV | Sentetik | 39 | 8.6 | 48.7% | 76.9% |
| SAT | Kum | 36 | 10.7 | 33.3% | 66.7% |
| GROUP | Çim | 29 | 11.8 | 41.4% | 69.0% |

### Start (kulvar) etkisi (Arap), alan büyüklüğüne göre düzeltilmiş

A/E = gerçek birincilik / beklenen birincilik (Σ 1/at sayısı). 1,00 nötr; 1,20 = %20 fazla.

**Kum 1400 m** (317 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 306 | 38 | 1.20 |
| 2 | 309 | 39 | 1.22 |
| 3 | 314 | 30 | 0.92 |
| 4 | 311 | 29 | 0.90 |
| 5 | 302 | 33 | 1.06 |
| 6 | 300 | 34 | 1.13 |
| 7 | 284 | 18 | 0.66 |
| 8 | 259 | 28 | 1.17 |
| 9 | 239 | 16 | 0.75 |
| 10 | 203 | 16 | 0.93 |
| 11 | 158 | 10 | 0.80 |
| 12 | 118 | 13 | 1.49 |
| 13 | 84 | 5 | 0.85 |
| 14 | 59 | 4 | 1.02 |
| 15 | 42 | 3 | 1.14 |
| 16 | 26 | 3 | 1.93 |
| 17 | 18 | 1 | 0.96 |

**Kum 1200 m** (175 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 172 | 27 | 1.47 |
| 2 | 169 | 15 | 0.83 |
| 3 | 167 | 12 | 0.67 |
| 4 | 163 | 22 | 1.28 |
| 5 | 171 | 22 | 1.20 |
| 6 | 166 | 19 | 1.10 |
| 7 | 153 | 8 | 0.52 |
| 8 | 143 | 13 | 0.94 |
| 9 | 122 | 10 | 0.89 |
| 10 | 107 | 12 | 1.26 |
| 11 | 91 | 4 | 0.52 |
| 12 | 58 | 4 | 0.89 |
| 13 | 35 | 4 | 1.57 |
| 14 | 22 | 3 | 2.01 |
| 15 | 16 | 1 | 0.95 |

**Kum 1900 m** (136 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 131 | 16 | 1.10 |
| 2 | 133 | 16 | 1.08 |
| 3 | 135 | 18 | 1.18 |
| 4 | 129 | 11 | 0.77 |
| 5 | 134 | 12 | 0.80 |
| 6 | 127 | 12 | 0.86 |
| 7 | 117 | 20 | 1.65 |
| 8 | 107 | 9 | 0.84 |
| 9 | 78 | 7 | 1.04 |
| 10 | 64 | 2 | 0.37 |
| 11 | 54 | 4 | 0.94 |
| 12 | 48 | 4 | 1.09 |
| 13 | 28 | 2 | 1.01 |
| 14 | 23 | 1 | 0.63 |

**Çim 1400 m** (113 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 106 | 13 | 1.29 |
| 2 | 111 | 7 | 0.66 |
| 3 | 112 | 13 | 1.20 |
| 4 | 106 | 11 | 1.10 |
| 5 | 112 | 12 | 1.12 |
| 6 | 112 | 18 | 1.67 |
| 7 | 110 | 8 | 0.77 |
| 8 | 99 | 6 | 0.68 |
| 9 | 89 | 6 | 0.80 |
| 10 | 79 | 7 | 1.10 |
| 11 | 68 | 6 | 1.13 |
| 12 | 59 | 1 | 0.23 |
| 13 | 42 | 2 | 0.69 |
| 14 | 22 | 3 | 2.15 |
| 15 | 16 | 1 | 1.06 |

**Çim 1200 m** (113 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 109 | 18 | 1.61 |
| 2 | 108 | 10 | 0.93 |
| 3 | 111 | 10 | 0.88 |
| 4 | 112 | 17 | 1.49 |
| 5 | 109 | 8 | 0.73 |
| 6 | 107 | 9 | 0.85 |
| 7 | 103 | 11 | 1.09 |
| 8 | 97 | 2 | 0.22 |
| 9 | 86 | 7 | 0.93 |
| 10 | 80 | 12 | 1.73 |
| 11 | 60 | 3 | 0.63 |
| 12 | 38 | 1 | 0.36 |
| 13 | 32 | 5 | 2.26 |
| 14 | 24 | 0 | 0.00 |
| 15 | 17 | 0 | 0.00 |

**Kum 2000 m** (109 koşu)

| Start | Koşan | Birincilik | A/E |
|---:|---:|---:|---:|
| 1 | 106 | 15 | 1.21 |
| 2 | 106 | 16 | 1.30 |
| 3 | 104 | 6 | 0.49 |
| 4 | 109 | 13 | 1.02 |
| 5 | 107 | 6 | 0.49 |
| 6 | 100 | 15 | 1.34 |
| 7 | 95 | 6 | 0.59 |
| 8 | 85 | 10 | 1.14 |
| 9 | 62 | 8 | 1.36 |
| 10 | 51 | 4 | 0.87 |
| 11 | 32 | 2 | 0.75 |
| 12 | 23 | 4 | 2.20 |

### HAN-16 profili (Arap)

158 koşu; katılan atların handikap puanı 8–75 (P10–P90: 39–70); yaş şartları: 4O, 4U. Resmi katılım şartı metni bu kaynakta yok; bu aralık katılanlardan gözlemdir.

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
