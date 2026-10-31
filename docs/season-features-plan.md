# Plan: Sezon-içi (as-of) istatistiklerin GBDT girdisi olması

Durum: uygulandı, 30 Ekim 2026. Sonuçlar ve ölçümler: `docs/season-features.md`.

## Neden mevcut sezon verisi doğrudan kullanılamaz

- FotMob sezon/kariyer toplamları (`/api/player`, `content.table`, lig `stats`) **o anki** anlık görüntüdür. Geçmiş bir eğitim satırı için "maç günündeki" değeri yoktur; kullanılırsa gelecek bilgisi sızar.
- Önbellekteki `matchDetails-*.json` içindeki `content.table` da önbelleğe alındığı andaki tablodur, maç anındaki değil.
- Bu yüzden sezon istatistikleri **arşivdeki maç kayıtlarından yeniden üretilecek**: her hedef satır için aynı ligde, aynı sezonda, `cutoff` öncesinde tamamlanmış maçların toplamı. Mevcut 5/10 maç penceresiyle aynı sızıntı kuralları (start < cutoff ve available < cutoff) geçerli.

## Veri kapsamı (training-source.json, 3.272 maç)

| Durum | Sonuç |
|---|---|
| İki sezon kapsayan lig | Yalnızca LaLiga (87): 858 maç, Ağu 2024 → Eki 2026 |
| Tek sezon (Ağu 2026 →) | Diğer 21 lig; sezon başında 8–12 maç var |
| Takvim yılı ligleri | 59 ve 182: Mayıs 2026 başlangıç |
| Maç kaydında sezon alanı | Yok; `leagueId` + tarih var. `matchDetails.general.leagueRoundName` var, `parentLeagueSeason` yok |

Sonuç: sezon-içi özellikler çoğu ligde 10 maç penceresiyle güçlü korelasyon gösterecek. Gerçek kazanç LaLiga satırlarında ve sezon ilerledikçe ölçülecek. Bu, planın en büyük riskidir ve doğrulama kapısı bunu yakalayacak.

## Sezon sınırı tanımı

- Sezon anahtarı: `leagueId + sezon başlangıç yılı`. Varsayılan sınır 1 Temmuz. Lig için arşivdeki ilk maç Mayıs–Haziran ise takvim-yılı ligi kabul edilir ve sınır 1 Ocak olur.
- `dist/season-features.mjs` içinde `seasonKey(leagueId, date)` saf fonksiyon; testlerle sabitlenir.
- Aynı takımın aynı sezon farklı turnuva maçları (kupa, Avrupa) **dahil edilmez**: yalnızca hedef `leagueId`. Bu, mevcut "lig gücü hedef ligden" kuralıyla tutarlı.

## Özellik seti (taraf başına 14, iki taraf 28 girdi)

Takım sezon-içi, hedef ligden, cutoff öncesi:

| # | Ad | Tanım |
|---|---|---|
| 1 | `season.played` | oynanan maç / 38, 0–1 |
| 2 | `season.ppg` | puan/maç, küçültülmüş, [-1,1] ölçeği: (ppg−1.35)/1.65 |
| 3 | `season.gfPerGame` | atılan gol/maç, log ölçek |
| 4 | `season.gaPerGame` | yenilen gol/maç, log ölçek |
| 5 | `season.xgFor` | xG/maç |
| 6 | `season.xgAgainst` | rakip xG/maç |
| 7 | `season.finishing` | clip(log((gol+.5)/(xG+.5))) |
| 8 | `season.concession` | clip(log((yenilen+.5)/(rakip xG+.5))) |
| 9 | `season.venuePpg` | hedefteki aynı saha (ev/deplasman) ppg |
| 10 | `season.rank` | cutoff anında ligdeki ppg sırası, 0–1 normalize (arşivdeki takımlar arasında; "tablo" değil, kapsam notu ile) |
| 11 | `season.shotsPerGame` | şut/maç |
| 12 | `season.sotPerGame` | isabetli şut/maç |
| 13 | `season.restDays` | son lig maçından bu yana gün, clip 0–14 / 14 |
| 14 | `season.missingFraction` | eksik metrik oranı (xG yoksa vb.) |

Küçültme: her oran, lig ortalamasına 5 sanal maçla çekilir (`n/(n+5)`), mevcut H2H ve oyuncu katmanı ile aynı yaklaşım. Sezon başı (0 maç) → tüm değerler nötr, `missingFraction = 1`.

Oyuncu tarafı bu fazda **eklenmez**. Gerekçe: 101 ilk-11 girdisi zaten oyuncu maç istatistiklerini taşıyor; sezon-içi oyuncu per-90 eklemek girdi sayısını ikiye katlar ve aynı veriyi tekrar eder. İkinci faz olarak ayrı değerlendirilir.

## Hat değişiklikleri

1. **`dist/season-features.mjs`** (yeni): `SEASON_FEATURE_NAMES`, `seasonKey`, `createSeasonFeatureIndex(matches)` → `.features(target,{cutoff})` → `{home, away, evidence:{maxAvailableAt, matchIds, seasonKey}}`. `market-model.mjs` ile aynı giriş filtresi (finished, cancelled, awarded, lig 489/114 hariç, çakışan id'ler).
2. **`scripts/build-season-training.mjs`** (yeni): her satıra `homeSeasonFeatures`, `awaySeasonFeatures`, `seasonFeatureMaxAvailableAt` ekler; `maxAvailableAt >= row.date` ise hata fırlatır; `schemaVersion = 6`, `seasonFeatureNames`, `seasonPolicy = 'archive-league-season-to-date-v1'`.
3. **`scripts/train.mjs`**: görev listesine `build-season-training.mjs` eklenir; şema kontrolü `hasGraph ? 6 : 1`.
4. **`dist/gbdt-training.mjs`**: `gbdtRow` içine `seasonLayer` bloğu; zaman kapısı + geçerlilik + nötr vektör; `featureMaxAvailableAt` güncellemesi. Girdi sayısı 255 → 283.
5. **`dist/model.mjs`**: schema 6 doğrulaması (`seasonFeatureNames` eşleşmesi); hedef maç için tarayıcıda aynı index ile özellik çıkarımı.
6. **Seçim kapısı**: `market-network-selection.mjs` deseni kopyalanır. Sezon katmanlı aday, aynı doğrulama kohortunda ≥ 0,003 NLL kazancı ve tam skor isabetinde düşüş yoksa otomatik etkin; aksi halde kullanıcı seçiminde "deneysel". Test etiketleri seçimde kullanılmaz.
7. **UI**: model seçicide yeni seçenek **yok**; sezon katmanı GBDT/Obsidian adaylarının içine girer. Model raporunda `seasonLayer: {active, validated, gain, coveredTrain}` ve özellik önem tablosunda `season.*` satırları görünür. Açıklama metni: "Sezon istatistikleri arşivden maç anına göre yeniden hesaplanır; FotMob sezon tablosu kullanılmaz."

## Testler (`tests/season-features.test.mjs`)

- Sezon sınırı: 30 Haziran / 1 Temmuz ve takvim-yılı ligi.
- As-of: cutoff'tan sonra biten hiçbir maç toplama girmez; `completedAt` yoksa kickoff+3s kuralı.
- Hedef maçın kendisi ve kupa maçları hariç.
- Sezon başı nötr vektör ve `missingFraction = 1`.
- Ayna skor yönelimi (ev/deplasman değişince gf/ga yer değiştirir).
- `gbdtRow`: geçersiz/gelecek sezon özelliği nötre düşer; 283 uzunluk.
- Hat: başarısız sezon aşaması önceki `dist/data/training.json`'u korur.
- Gerçek maç kontrolü: `scripts/check-season-prediction.mjs 5749726 10`, `5868102 5`, `5904790 10`; 10.000 simülasyon tamamlanır, hedef etiketi eklenince tahmin değişmez.

## Değerlendirme ve yayın kriteri

- Aynı kronolojik 70/15/15 bölme, aynı arındırma. Rapor: 255 girdili referans vs 283 girdili aday, doğrulama ve ayrı test NLL + tam skor.
- LaLiga alt kümesi ayrıca raporlanır (iki sezon kapsayan tek lig).
- Kazanç yoksa katman kodda kalır, otomatik mod referansı korur; doküman "ölçülen fark" tablosuyla güncellenir. Garanti iddiası yazılmaz.
- Yayın: `npm test` tam geçiş, `npm run train` ile schema-6 artefakt, üretim hash doğrulaması, tarayıcı QA (seed 12345, model geçişinde tohum korunur).

## Yapılmayacaklar

- FotMob sezon/kariyer toplamları, reytingler, transfer değeri, yaş, ülke: girdi olmaz.
- Önbellek tablosu (`content.table`) kullanılmaz.
- Önceki sezon devri (ör. 2025/26'dan sönümlü taşınan güç): ikinci faz; şu an yalnızca LaLiga'da ölçülebilir.

## Tahmini iş

| Adım | Süre |
|---|---|
| season-features.mjs + testler | 0,5 gün |
| build/train hattı + gbdtRow + model.mjs | 0,5 gün |
| seçim kapısı + rapor/UI | 0,5 gün |
| yeniden eğitim, gerçek maç kontrolleri, QA, doküman | 0,5 gün |
