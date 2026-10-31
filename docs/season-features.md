# Sezon-içi (as-of) lig istatistikleri GBDT katmanı

Sürüm: model şeması 6, UI 2026-10-30.2. Plan: `docs/season-features-plan.md`.

## Ne eklendi

- `dist/season-features.mjs`: her hedef için aynı lig ve aynı sezondaki, kesim anından önce tamamlanmış arşiv maçlarından 14 takım özelliği üretir. FotMob sezon tablosu, oyuncu sezon toplamları, reytingler ve önbellekteki `content.table` **okunmaz**; hepsi anlık görüntü olduğu için geçmişe dönük eğitimde sızıntı yaratır.
- Özellikler (taraf başına 14, toplam 28): oynanan maç, puan/maç, atılan ve yenilen gol/maç, xG lehte/aleyhte, bitiricilik ve gol yeme artığı, aynı saha puanı, arşiv içi lig sırası, şut ve isabetli şut/maç, dinlenme günü, eksik kapsam. Oranlar lig ortalamasına 5 sanal maçla çekilir; tüm değerler [-1, 1] aralığındadır. Sezon başında vektör nötrdür ve eksik kapsam 1'dir.
- Sezon sınırı 1 Temmuz; takvim yılı ligleri (açık liste + Mayıs–Haziran maçları 50 gün içinde Temmuz–Ağustos'a devam eden arşivler) 1 Ocak. Aynı sezondaki kupa / Avrupa maçları sezon toplamlarına girmez, yalnız dinlenme gününü etkiler.
- `scripts/build-season-training.mjs` eğitim satırlarına `homeSeasonFeatures` / `awaySeasonFeatures` / `seasonFeatureMaxAvailableAt` / `seasonCoverage` ekler, hedef veya gelecek kanıt bulursa hata verir ve şemayı 6'ya yükseltir. `scripts/train.mjs` bu aşamayı pazar ağından sonra çalıştırır; başarısız aşama yayınlanmış artefaktı korur.
- `gbdt-training.mjs`: `seasonLayer` seçeneğiyle 255 → 269 girdi (`SEASON_GBDT_FEATURE_NAMES`). Zaman ve geçerlilik kapısı geçilmezse sezon bloğu nötre düşer. `outcome-training.mjs` özellik üst sınırı 256 → 512.
- `season-selection.mjs`: pazar ağı kapısının aynısı. Otomatik modda en az 0,003 doğrulama NLL kazancı, tam skor isabetinde düşüş olmaması, eğitimde ≥ 70 ve ≥ %60 kapsam ve hedefte her iki takım için ≥ 3 sezon maçı gerekir. "GBDT · Obsidian pazar ağı" seçiminde eşik aşılmasa da katman **deneysel** olarak etkinleşir. Test etiketleri seçimde kullanılmaz. `gbdt` / `graph` / `baseline` modlarında katman değerlendirilmez.
- Model seçicide yeni seçenek yok. GBDT kartında "Sezon katmanı: etkin / deneysel etkin / kapalı" satırı ve özellik önem tablosunda `Sezon-içi · …` etiketleri görünür. İlk 11 değişikliği ve simülasyon fazları sezon bloğunu korur (kuyruk `slice(END)` ile taşınır).

## Veri kapsamı ve ölçülen etki

Yerel arşivle (4.727 maç, 5.340 satır) sezon kapsamı hazır satır: 4.036. Yerel etiket kaynağı üretimdekinden küçük olduğu için 840 satırın hedef bilgisi satırın kendi takım alanlarından alındı (`rowDerivedTargets`). Üretimde `npm run train` tam kaynakla yeniden üretir.

Arşiv tek sezon (Ağustos 2026 →) ağırlıklı olduğu için sezon-içi değerler 10 maç penceresiyle büyük ölçüde örtüşür. Üç gerçek maçta sonuç (`scripts/check-season-prediction.mjs`, raporlar `data/season-prediction-<id>-<form>.json`):

| Maç / pencere | Doğrulama NLL ref → sezon | Doğrulama tam skor | Ayrı test NLL ref → sezon | Test tam skor | Kazanç | Otomatik |
|---|---:|---:|---:|---:|---:|---|
| Parma–Udinese 5749726 / 10 | 3,1153 → 3,1152 | %6,10 → %6,63 | 3,1102 → 3,1066 | %10,35 → %12,12 | +0,00009 | kapalı |
| Athletic–Getafe 5868102 / 5 | 2,8484 → 2,8529 | %15,00 → %15,83 | 3,0266 → 3,0401 | %14,88 → %14,05 | −0,00445 | kapalı |
| Konyaspor–Galatasaray 5904790 / 10 | 3,1107 → 3,1109 | %5,47 → %5,99 | 3,1082 → 3,1042 | %11,25 → %10,75 | −0,00028 | kapalı |

Hiçbir örnekte 0,003 doğrulama eşiği aşılmadı; otomatik mod referans modeli korur, Obsidian seçiminde katman deneyseldir. Test sütunları yalnız raporlanır, seçimde kullanılmaz. Bu sonuçlar genel bir iyileşme veya kesin skor iddiası değildir. Sezon ilerledikçe ve çok sezonlu arşiv büyüdükçe ölçüm tekrarlanmalıdır. Öğrenilen bölünme kazancı en çok `season.shotsPerGame`, `season.gaPerGame` ve `season.restDays` girdilerinde görüldü; bu tanımlayıcıdır, nedensel değildir.

Konyaspor–Galatasaray Obsidian modunda: projeksiyon modu 1–1 (%10,78), gol ortalaması 1,07–1,78; seed 12345 ile 10.000 simülasyonda mod 1–1 (%10,54). Hedef etiketi 29–28 olarak eklenince tahmin değişmedi.

## Doğrulama

`npm test`: 211/211. Yeni `tests/season-features.test.mjs`: sezon sınırı ve takvim ligi tespiti, as-of (hedef, gelecek, geç tamamlanan ve kesimde bitmemiş maçların dışlanması, başlama+3s kullanılabilirlik kuralı), sezon başı nötrlüğü, kupa / önceki sezon / çakışan kayıt, ayna yönelim, `gbdtRow` 269 uzunluk ve nötre düşme, seçim kapısı. Hat testleri şema 6 artefaktı ve atomik yayını doğrular.

## Üretim yayını — 30 Ekim 2026

Kod paketi `mathgoal-season-features.tar.gz`, sunucu betiği `scripts/deploy-season.sh`. UI 2026-10-30.2 yayında. Servis sağlıklı ve yayındaki modül hash'leri yerel dosyalarla aynı. Konteyner içinde `node scripts/train.mjs` tam kaynakla şema-6 artefaktını üretti: 5.378 satır, 4.388 sezon-hazır satır, 0 türetilmiş hedef, kimlik `6df953bb5a35…`. Önceki şema-5 artefaktın yedeği sunucuda `/opt/mathgoal/app/data/training-schema5-backup-20261030.json`, yerelde `data/training-schema5-backup.json`.

Üretim verisiyle gerçek maç denetimleri hepsi geçti: 269 girdi, 10.000 simülasyon, hedef etiketi tahmini değiştirmedi.

| Maç / pencere | Obsidian modunda kazanç | Obsidian kararı | Otomatik moddaki kazanç | Otomatik |
|---|---:|---|---:|---|
| Konyaspor–Galatasaray 5904790 / 10 | +0,00438 | doğrulandı, etkin | −0,01494 | kapalı |
| Parma–Udinese 5749726 / 10 | +0,00386 | deneysel, tam skor %6,37 → %5,84 düştü | −0,02154 | kapalı |
| Athletic–Getafe 5868102 / 5 | −0,00445 | deneysel | −0,00618 | kapalı |

İki mod farklı referansa karşı ölçülür. Obsidian modunda sezon katmanı, pazar ağı modeline eklenen kazanç olarak ölçülür. Otomatik modda ise o modun seçtiği modele karşı ölçülür. Bu yüzden Konyaspor–Galatasaray'da Obsidian'da doğrulanan katman otomatik modda devreye girmez. Denetimin ilk sürümü bu iki kararı eşit sanıyordu; otomatik karar artık kendi doğrulama sonucuna göre denetlenir.

Canlı tarayıcı QA, Konyaspor–Galatasaray, Obsidian: GBDT kartında "Sezon katmanı: etkin", 64 ağaç ve 269 girdi, 10.000 simülasyon tamamlandı, konsol hatası yok.
