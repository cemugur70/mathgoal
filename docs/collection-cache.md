# Toplama süresi ölçümü ve biten maç önbelleği

Tarih: 31 Ekim 2026. Kapsam: "Maçı analiz et" ile tetiklenen `scripts/collect.mjs` akışı.

## Ne değişti

- **Biten maçlar için kalıcı önbellek** (`scripts/fotmob-source.mjs`). Süresi dolan bir `matchDetails` dosyası; maç bitmiş, iptal edilmemiş ve dosya başlama saatinden en az 48 saat sonra yazılmışsa yeniden indirilmez. Hedef maç her zaman yeniden indirilir. Takım ve lig verisinin 30 dakikalık, bitmemiş maçların 24 saatlik süresi değişmedi. `FOTMOB_SETTLED_CACHE=0` kuralı kapatır ve eski davranışa döner.
- **Bekleme yalnız ağ isteğinden sonra.** Toplama havuzu her kayıttan sonra 180 ms bekliyordu; önbellekten okunan kayıtlar da bekliyordu. Bekleme artık istemcide ve yalnız gerçek bir FotMob isteğinden sonra uygulanıyor. Ağ isteği başına bekleme eskisiyle aynı. Diğer betikler varsayılan sıfır beklemeyle eskisi gibi çalışır.
- **Süre ölçümü.** `collect.mjs` adım sürelerini ve kaynak özetini `data/collect-timing-<maç>.json` dosyasına yazar ve `TOPLAMA_SÜRESİ` satırı basar. `train.mjs` her eğitim adımı için `EĞİTİM_ADIMI` satırı basar. Kaynak kayıtlarına `ms`, `reuse` ve `refetch` alanları eklendi.

## 48 saat eşiği neden

Yerel önbellekten 25 "bitmiş" maç FotMob'dan taze çekildi ve modelin okuduğu normalize kayıtlarla karşılaştırıldı.

- Başlama saatinden 6,3–8,3 saat sonra kaydedilen maçlarda modele giren değerler sonradan düzeltilmişti: takım ve oyuncu xG'si, pas, isabetli şut, sarı kart, oyuncu reytingi.
- 8,8 saatten sonra kaydedilenlerde yalnız FotMob'un tüm arşive sonradan eklediği `line_breaking_passes` metriği ve bir maçta üç oyuncunun mevki etiketi farklıydı. Model bu metriği kullanmıyor.
- Örnek küçük olduğu için eşik geniş bir payla 48 saat seçildi. Maçtan kısa süre sonra indirilmiş bir dosya bir kez daha indirilir; 48 saatten sonra indirilen kopya kalıcı olur.

Bilinen sınırlar:

- FotMob ileride geçmiş maçlara yeni metrik eklerse, kalıcı önbellekteki maçlar bu metrik olmadan kalır.
- Nadir mevki etiketi düzeltmeleri de alınmaz.
- Gerekirse `FOTMOB_SETTLED_CACHE=0` ile bir tam yenileme yapılabilir.

## Ölçüm

Konyaspor–Galatasaray (5904790), yerel makine, aynı başlangıç durumu: her çalıştırmadan önce önbellek ve arşiv yedekten geri yüklendi. Önbellek dosyaları 25–26 Ekim tarihliydi, yani hepsinin 24 saatlik süresi dolmuştu. Bu durum, bir maçın bir gün sonra yeniden analiz edilmesine karşılık gelir.

| Adım | Önce (s) | Sonra (s) |
|---|---:|---:|
| Hedef maç | 0,5 | 0,4 |
| Takım ağı | 14,2 | 14,4 |
| Geçmiş maç detayları | 61,4 | 5,8 |
| Oyuncu geçmişleri | 2,3 | 2,0 |
| Diğer | 0,8 | 0,8 |
| **Eğitim hariç toplam** | **79,2** | **23,3** |
| Eğitim (`train.mjs`) | 269,4 | 283,8 |
| **Toplam** | **348,6** | **307,1** |

Maç detayı istekleri 464'ten 71'e indi: 393 kayıt kalıcı önbellekten geldi. Toplanan paket her iki çalıştırmada aynı kapsamda: 453 maç, 204 takım, 42 metrik, 0 hata, 39 tam ve 5 kısmi oyuncu geçmişi. Eğitim süresindeki fark aynı iş üzerinde makine gürültüsüdür.

## Asıl darboğaz: eğitim

Toplamanın %75–80'i, toplama yanıtından önce çalışan `train.mjs` adımında geçiyor:

| Eğitim adımı | Süre (s) |
|---|---:|
| `build-training-data.mjs` | 209–244 |
| `build-market-network-training.mjs` | 19–21 |
| `export-player-graph-source.mjs` | 17–25 |
| `build-starter-training.mjs` | 12–13 |
| Diğer üç adım | 10–11 |

`build-training-data.mjs`, arşivdeki her maç için ve her iki form penceresi için tam analizi baştan çalıştırıyor. Toplam 5.000'den fazla analiz yapılıyor. Bir satırın girdileri yalnız o maçtan önce tamamlanan maçlara bağlı, bu yüzden eski satırların çoğu yeni toplamayla değişmez. Önerilen sonraki adımlar, etki sırasıyla:

1. **Eğitimi yanıttan ayırmak.** Paket yazılınca yanıt dönsün, eğitim arka planda çalışsın. Kullanıcının beklemesi yaklaşık 5 dakikadan yaklaşık 25 saniyeye iner. Kısa bir süre yeni satırlar eğitimde olmaz; bu, "toplama yanıtı eğitim yayınlandıktan sonra döner" kuralını ve onu doğrulayan testi değiştirir.
2. **Artımlı temel eğitim verisi.** Satırları, girdi maçlarının kimlik kümesi ve model sürümüyle anahtarlayıp önceki artefakttan yeniden kullanmak. Yalnız yeni maçlardan sonraki satırlar yeniden hesaplanır.

Bu iki adım bu değişikliğe dahil değil.

## Doğrulama

`npm test`: 215/215. Yeni `tests/fotmob-source.test.mjs`:

- 48 saat kuralı.
- Yerleşmiş maçın istek yapılmadan kullanılması.
- Erken kaydedilmiş, bitmemiş, kapatılmış ve `refresh` durumlarında yeniden indirme.
- Mevcut süre kuralı ve `cacheOnly` davranışı.
- Beklemenin yalnız ağ isteğinden sonra uygulanması.

## Üretim yayını — 31 Ekim 2026

`mathgoal-collection-cache.tar.gz` ve `scripts/deploy-collection-cache.sh` ile yüklendi. İmaj yeniden kuruldu, konteyner sağlıklı, arayüz sürümü değişmeden 2026-10-30.2. Konteynerdeki `fotmob-source.mjs`, `collect.mjs` ve `train.mjs` hash'leri yerel dosyalarla aynı. Kural 48 saat eşiğiyle etkin. `tests/fotmob-source.test.mjs` konteyner içinde 4/4 geçti. Değiştirilen dosyaların önceki hâlleri sunucuda `/opt/mathgoal/app/data/pre-collection-cache-20261031/` altında. Yeni bir toplama henüz üretimde ölçülmedi; ilk gerçek analizden sonra `data/collect-timing-<maç>.json` süreleri gösterecek.
