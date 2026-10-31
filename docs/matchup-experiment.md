# Deney: oyuncu–oyuncu eşleşme katmanı ve %80 güven kademesi

Tarih: 31 Ekim 2026. Durum: ölçüldü, uygulamaya bağlanmadı.

## Ne denendi

`dist/matchup-features.mjs`, iki takımın maç öncesi ilk 11 vektörlerinden taraf başına 14 eşleşme girdisi üretir. Oyuncular aynı roldeki rakipleriyle güç sırasına göre birebir eşlenir. Eşleşmeler ve diğer girdiler:

- forvet hücumu ↔ rakip defans savunması,
- orta saha üretimi ↔ rakip orta saha savunması,
- orta saha mücadelesi ↔ rakip orta saha mücadelesi,
- defans savunması ↔ rakip forvet hücumu,
- kaleci ↔ rakip forvet hücumu,
- en iyi hücumcu farkı, saha içi toplam güç farkı, kapsam ve eksiklik.

Girdiler, ilk 11 katmanının kullandığı ve maçtan kesin olarak önce bilinen oyuncu kanallarından türetilir. `gbdtRow(..., {matchupLayer:true})` ile 269 → 283 girdi olur.

Güven kademesi için, 1X2 seçiminin olasılığı en az %80 isabetli bir kademe aranır. Eşik yalnız ayar doğrulamasında seçilir ve en az 20 maç gerekir. Ayrı test yalnız raporlanır.

## Sonuç

Brentford–Nottingham Forest, Premier League (5795497), canlı şema-6 eğitim verisi, uygulamayla aynı zaman sıralı bölme:

| Pencere | Model | Test 1X2 | Test log kaybı | Eşleşme önem payı |
|---|---|---:|---:|---:|
| 5 | Obsidian + sezon (269) | %49,1 | 1,0206 | — |
| 5 | + eşleşme (283) | %48,4 | 1,0220 | %0,6 |
| 10 | Obsidian + sezon (269) | %47,4 | 1,0247 | — |
| 10 | + eşleşme (283) | %47,4 | 1,0247 | %1,2 |

Ayrı test, 5 maçlık pencere, mevcut model:

| Güven | Test maçı | Test isabeti |
|---|---:|---:|
| ≥ %50 | 170 | %60,6 |
| ≥ %55 | 101 | %64,4 |
| ≥ %60 | 52 | %71,2 |
| ≥ %65 | 25 | %68,0 |
| ≥ %70 | 12 | %50,0 |
| ≥ %75 | 4 | 3/4 |

- Eşleşme katmanı isabeti artırmadı. Bu girdiler, modelin zaten gördüğü 101 ilk 11 girdisinin fonksiyonları; ağaçlar bu ilişkiyi büyük ölçüde zaten öğrenebiliyor.
- Hiçbir kademe doğrulamada en az 20 maçla %80'e ulaşmadı. ≥ %70 ve üstü kademeler 2–14 maçlık; bu kadar az maçla isabet güvenilir biçimde ölçülemez.
- Ölçülebilir en yüksek kademe ≥ %60: test maçlarının yaklaşık %13'ü, isabet yaklaşık %71.

Katman, ölçülen bir kazanç sağlamadığı için tarayıcıdaki eğitime ve üretime bağlanmadı. Bağlansaydı her analizde beşinci bir GBDT eğitimi eklenirdi. Kod deney için duruyor.

## Sonraki adaylar

1. Pi-rating girdileri. 2017 Soccer Prediction Challenge'da CatBoost + pi-rating aynı 206 maçta %55,8 isabet aldı; bahis oranları %51,9'da kaldı.
2. Ölçülmüş güven kademesini arayüzde göstermek. Örnek: "bu güvende geçmiş test isabeti %71, 52 maç".

## Deney 2: pi-rating girdileri

`dist/pi-ratings.mjs`, Constantinou ve Fenton (2013) pi-rating algoritmasını uygular. Her takımın ayrı bir ev ve deplasman puanı vardır. Puanlar, gol farkı tahmin hatasının logaritmasıyla güncellenir (b=10, c=3). Her eğitim satırı için yalnız o maçın başlama saatinden önce tamamlanmış sonuçlar oynatılır. Hedef maç, gelecek maçlar, geç tamamlanan, hazırlık, iptal ve hükmen maçlar dışlanır. Taraf başına 10 girdi eklenir; `gbdtRow(..., {piLayer:true})` ile 269 → 279 girdi olur. Testler `tests/pi-ratings.test.mjs` dosyasında.

Üretim arşivi kullanıldı: 6.016 maç ve canlı 5.488 eğitim satırı; bölme aynı. Öğrenme hızı λ yalnız ayar doğrulamasına bakılarak karşılaştırıldı.

| Pencere | Model | Doğrulama RPS | Test 1X2 | Test RPS | Pi önem payı |
|---|---|---:|---:|---:|---:|
| 5 | Mevcut (269) | 0,2159 | %49,1 | 0,2133 | — |
| 5 | Pi λ=0,035 | 0,2143 | %49,1 | 0,2139 | %14,2 |
| 5 | Pi λ=0,1 | 0,2161 | %48,2 | 0,2146 | %17,0 |
| 5 | Pi λ=0,2 | 0,2157 | %48,2 | 0,2153 | %7,5 |
| 5 | Pi λ=0,4 | 0,2155 | %49,4 | 0,2133 | %1,8 |
| 10 | Mevcut (269) | 0,2155 | %47,4 | 0,2146 | — |
| 10 | Pi λ=0,035 | 0,2153 | %47,4 | 0,2145 | %14,1 |
| 10 | Pi λ=0,1 | 0,2170 | %48,9 | 0,2155 | %13,6 |
| 10 | Pi λ=0,2 | 0,2145 | %47,9 | 0,2157 | %5,6 |
| 10 | Pi λ=0,4 | 0,2158 | %48,4 | 0,2139 | %2,0 |

- Doğrulamada en iyi pi ayarı test RPS'sini iyileştirmedi. Pencere 5'te λ=0,035 ile 0,2133 → 0,2139; pencere 10'da λ=0,2 ile 0,2146 → 0,2157.
- 411 test maçında bir isabet yüzdesinin standart hatası yaklaşık ±2,5 puan. Tüm farklar bu aralıkta kaldı.
- Ölçülebilir hiçbir kademede %80'e ulaşılmadı.
- Katman uygulamaya bağlanmadı.

## Ortak sonuç

Üç farklı yöntem aynı tavana takıldı: sezon katmanı, birebir oyuncu eşleşmesi ve pi-rating. Sınır algoritmadan çok veriden kaynaklanıyor.

- Arşivin büyük kısmı Ağustos–Ekim 2026. Takım başına medyan 4 maç var; eğitimdeki takımlar için bile yalnız birkaç ay.
- Pi-rating ve benzeri güç puanları, literatürdeki %52–56 sonuçlarını aynı ligde çok sezonluk geçmişle elde etti.
- Test setindeki ev sahibi oranı %42,8 (176/411). Model bunun yaklaşık 6 puan üstünde.

En olası kazanç: hedef liglerin geçmiş sezonlarını FotMob lig-sezon kaynağından toplamak. LaLiga için 2024/25 ve 2025/26 böyle toplanmıştı. Ardından aynı katmanlar yeniden ölçülmeli. Bu, eğitim süresini de artırır: `build-training-data.mjs` maç sayısıyla yaklaşık karesel büyüyor.

## Deney 3: geçmiş sezonlarla genişletilmiş arşiv

`scripts/collect-training-history.mjs` artık `--leagues`, `--seasons`, `--source` ve `--out` alır. Alt lig kimliği taşıyan maçlar (örneğin Championship için `leagueId` 893033, `parentLeagueId` 48) üst lig kimliğiyle eşleşir. Yalnız tamamlanmış, iptal ve hükmen olmayan maçlar eklenir. Arşivde zaten olan maçlar değiştirilmez; skoru çelişen maç hata olarak kaydedilir.

Toplanan sezonlar: Premier League (47), Championship (48), Ligue 1 (53), Bundesliga (54), Serie A (55), Eredivisie (57), Primeira Liga (61) ve Süper Lig (71) için 2024/25 ve 2025/26. LaLiga (87) zaten vardı. 16 lig-sezonun hepsi eksiksiz alındı: 5.732 yeni maç. Arşiv 4.341 maçtan 10.073 maça çıktı; eğitim satırı 5.488'den 16.790'a çıktı.

**Yöntem.** İki arşivden aynı kodla, ayrı kopya klasörlerde şema-6 eğitim verisi üretildi. İki model de yalnız 1 Ekim 2026'dan önceki satırlarla eğitildi; model seçimi, uygulamadaki gibi o dönemin kendi doğrulama dilimiyle yapıldı. Ardından iki model, 1–30 Ekim 2026 arasındaki aynı 922 maçta değerlendirildi. Bunların 253'ü hedef liglerden. Farklar, aynı maçlar üzerinden eşleştirilmiş olarak hesaplandı.

| Pencere | Model | Arşiv | Eğitim satırı | 1X2 (922) | RPS (922) | 1X2 hedef (253) | RPS hedef (253) |
|---|---|---|---:|---:|---:|---:|---:|
| 5 | Mevcut (269) | Eski | 1.273 | %50,9 | 0,2194 | %52,2 | 0,2156 |
| 5 | Mevcut (269) | Geçmiş sezonlu | 5.216 | %52,9 | 0,2157 | %56,1 | 0,2055 |
| 5 | Pi (279) | Eski | 1.273 | %51,4 | 0,2181 | %51,8 | 0,2139 |
| 5 | Pi (279) | Geçmiş sezonlu | 5.216 | %52,8 | 0,2143 | %56,1 | 0,2027 |
| 10 | Mevcut (269) | Eski | 1.273 | %51,7 | 0,2181 | %56,1 | 0,2128 |
| 10 | Mevcut (269) | Geçmiş sezonlu | 5.216 | %51,8 | 0,2157 | %56,1 | 0,2051 |
| 10 | Pi (279) | Eski | 1.273 | %50,9 | 0,2185 | %54,9 | 0,2141 |
| 10 | Pi (279) | Geçmiş sezonlu | 5.216 | %52,0 | 0,2151 | %56,1 | 0,2028 |

Eşleştirilmiş farklar (geçmiş sezonlu − eski; RPS'de eksi daha iyi):

| Pencere | Model | ΔRPS tümü | ΔRPS hedef ligler | Δ1X2 hedef ligler |
|---|---|---:|---:|---:|
| 5 | Mevcut | −0,0037 ± 0,0015 (z −2,4) | −0,0100 ± 0,0030 (z −3,3) | +4,0 ± 1,8 puan |
| 5 | Pi | −0,0038 ± 0,0015 (z −2,5) | −0,0112 ± 0,0032 (z −3,5) | +4,3 ± 2,0 puan |
| 10 | Mevcut | −0,0025 ± 0,0013 (z −1,9) | −0,0077 ± 0,0026 (z −3,0) | 0,0 ± 1,6 puan |
| 10 | Pi | −0,0033 ± 0,0014 (z −2,4) | −0,0114 ± 0,0027 (z −4,1) | +1,2 ± 1,6 puan |

Genişletilmiş arşivde pi katmanı, mevcut modele göre ek kazanç verdi: hedef liglerde ΔRPS −0,0028 ± 0,0012 (pencere 5) ve −0,0024 ± 0,0008 (pencere 10). Eski arşivde bu kazanç yoktu.

- Geçmiş sezonlar, toplanan liglerde olasılık kalitesini belirgin biçimde iyileştirdi. RPS düşüşü yaklaşık 0,008–0,011; z değerleri 3–4. Bu, öncekilerin aksine gürültü değil.
- 1X2 isabeti hedef liglerde en fazla yaklaşık 4 puan arttı; %52 → %56. Literatürdeki %52–56 bandına ulaşıldı.
- Pi-rating, ancak uzun geçmişle işe yarıyor. Bu, literatürle uyumlu.
- %80'e yine ulaşılmadı. ≥ %60 güven kademesi 922 maçın 156–172'sini kapsıyor; isabet %61–67.
- Bedel: 10.073 maçlık arşivle `build-training-data.mjs` yerelde 442 sn yerine 2.094 sn sürdü. Toplam eğitim yaklaşık 7 dakikadan yaklaşık 38 dakikaya çıkıyor. `collect.mjs` eğitimi bekleyerek yanıt verdiği için, üretime almadan önce eğitimin toplama yanıtından ayrılması ya da artımlı yapılması gerekiyor.

Genişletilmiş arşiv ve pi katmanı henüz üretime alınmadı.

## Üretim: arka plan eğitimi, geçmiş sezonlar ve pi katmanı (31 Ekim 2026)

- **Arka plan eğitimi.** `collect.mjs` artık eğitimi beklemiyor. `data/training.pending` dosyasını yazıyor ve `scripts/train-queue.mjs` betiğini bağımsız bir süreç olarak başlatıyor. Kuyrukta aynı anda tek bir çalışan olur; bunu `data/training.lock` sağlar. Çalışan, bekleyen istekler bitene kadar `train.mjs` betiğini çalıştırır. Yarıda kalmış bir çalışanın kilidi devralınır. Yeni dosya yayınlanana kadar analizler bir önceki `dist/data/training.json` dosyasını kullanır. Durum `/api/health` yanıtının `training` alanında ve `data/training-status.json` dosyasında görünür. Testlerde ayrık başlatma `MATHGOAL_TRAINING_DETACH=0` ile kapatılır.
- **Geçmiş sezonlar.** Sunucu arşivi `scripts/merge-training-archive.mjs` ile 4.341 maçtan 10.073 maça çıktı. Ekleme yalnız yeni maçları alır; çelişen bir sonuç görürse işlemi durdurur.
- **Pi katmanı.** `build-pi-training.mjs`, şema-6 satırlarına pi girdilerini ekler. Toplama anında hedef maçın pi puanları tüm arşivden hesaplanır ve `bundle.piRatings` olarak pakete yazılır. Puanlar yalnız aynı kesim anı ve aynı politika sürümüyle kullanılır. `dist/pi-selection.mjs`, sezon katmanıyla aynı doğrulama kapısını uygular. Pi katmanı yalnız sezon katmanı etkinken karşılaştırılır. `piRatings` alanı olmayan eski maç paketlerinde katman kapalı kalır; bu maçlar yeniden analiz edilince açılır.
- **Boyut ve bellek.** Yayınlanan dosyada ondalıklar 6 anlamlı basamağa yuvarlanır ve yalnız derlemede kullanılan `graphCoverage` alanı çıkarılır. Dosya 152 MB yerine 85 MB, sıkıştırılmış aktarım 13,9 MB oldu. Aynı Ekim değerlendirmesinde sonuçlar değişmedi. `dist/data/` dosyaları artık ETag ve `no-cache` ile sunuluyor; değişmeyen dosya için tarayıcı 304 alır. Eğitim yaklaşık 1,2 GB yığın belleği gerektirdiği için kapsayıcı sınırı 1 GB'tan 3 GB'a, Node yığın sınırı `--max-old-space-size=2048` değerine çıkarıldı. Eski compose dosyası `/opt/mathgoal/backup-history-pi-20261031141504` klasöründe.
- **Ölçülen süreler.** Sunucudaki tam eğitim 34,5 dakika sürdü; bunun 28,2 dakikası `build-training-data`. Yayınlanan dosyada 16.790 satır var. Galatasaray–Fenerbahçe toplaması 36 saniyede yanıt verdi; eğitim ardından kuyrukta çalıştı. Canlı raporda model 279 girdi ve 24 ağaçla çalıştı; pazar ağı modunda pi katmanı deneysel olarak etkindi.
