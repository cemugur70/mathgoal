# Mathgoal MVP Platform

Bu proje, Dokploy uzerinde calisacak tam akisli bir MVP saglar:

1. Python veri kaziyici (scraper) ile mac verisini cekme
2. PostgreSQL veritabanina yukleme (upsert)
3. Node.js (Express) REST API ile sunma
4. Web dashboard ile gorsellestirme

## Klasor Yapisi

```text
.
|-- public/
|   |-- app.js
|   `-- index.html
|-- scripts/
|   |-- collect_match_ids_from_league.py
|   |-- migrate.js
|   `-- scrape_to_postgres.py
|-- sql/
|   `-- 001_init.sql
|-- src/
|   |-- app.js
|   |-- config.js
|   `-- db.js
|-- .env.example
|-- package.json
|-- requirements-ingest.txt
`-- server.js
```

## Mimari

- Python (Veri Kaziyici): `scripts/scrape_to_postgres.py`
  - Match ID listesini okur
  - fast_scraper ile tum oran/market verisini ceker
  - `all_columns.txt` kolon setini doldurarak PostgreSQL'e yazar
- PostgreSQL: `sql/001_init.sql`
  - `matches` tablosu
  - `match_all_columns` tablosu (all_columns.txt'teki tum kolonlar)
  - 20GB analitik veri icin temel indeksler
- Node.js API: `server.js`, `src/*`
  - `/api/health`
  - `/api/stats/overview`
  - `/api/matches`
  - `/api/matches/:matchId`
  - `/api/matches/:matchId/all-columns?bookmaker=bet365`
- Frontend: `public/index.html`, `public/app.js`
  - Ozet kartlari
  - Filtreli mac listesi
  - Sayfalama

## Gereksinimler

- Node.js 20+
- Python 3.10+
- PostgreSQL (Dokploy servisi: `mathgoal-db`)

## Ortam Degiskenleri (.env)

1. `.env.example` dosyasini kopyala:

```powershell
Copy-Item .env.example .env
```

2. `.env` icine en az su alanlari gir:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://mathgoal:YOUR_PASSWORD@mathgoal-db:5432/mathgoal
DB_SSL=false
```

> Not: `DATABASE_URL` degerini Dokploy uzerindeki PostgreSQL servis baglanti bilgisinden al.

## Kurulum ve Calistirma (Lokal)

### 1) Node bagimliliklari

```powershell
npm install
```

### 2) Veritabani migration

```powershell
npm run migrate
```

### 3) Python bagimliliklari (ingest pipeline)

```powershell
python -m pip install -r requirements-ingest.txt
python -m playwright install chromium
```

### 4) Lig + sezon bazli Match ID toplama

```powershell
python scripts/collect_match_ids_from_league.py `
  --country England `
  --league "Premier League" `
  --league-url "https://www.flashscore.co.uk/football/england/premier-league/" `
  --season-start 2025 `
  --season-end 2025 `
  --output collected_match_ids_england_premier_2025_2026.json
```

### 5) Veri cekme + DB'ye yazma

```powershell
python scripts/scrape_to_postgres.py --ids-file collected_match_ids_england_premier_2025_2026.json --workers 8 --bookmakers all
```

### 6) API + Dashboard baslatma

```powershell
npm start
```

Ardindan:
- `http://localhost:3000` -> Dashboard
- `http://localhost:3000/api/health` -> Saglik kontrolu

## Dokploy Dagitim Notlari

Bu repo Dokploy + Nixpacks ile uyumludur:

- `package.json` mevcut
- `start` script: `node server.js`
- Uygulama `PORT` (yoksa 3000) dinler

Dokploy tarafinda:
1. `mathgoal-app` -> **Environment Variables**:
   - `DATABASE_URL`
   - `PORT=3000`
   - `NODE_ENV=production`
2. Deploy butonuna bas
3. Domain sekmesinde `mathgoal.site` icin `Validate DNS`
4. Auto SSL (Let's Encrypt) acik kalir

## Test Senaryolari

### Senaryo 1 - Migration kontrol
```powershell
npm run migrate
```
Beklenen: SQL dosyasi basariyla uygulanir, hata vermez.

### Senaryo 2 - API health
```powershell
curl http://localhost:3000/api/health
```
Beklenen: `status: ok`

### Senaryo 3 - Veri ingest
```powershell
python scripts/scrape_to_postgres.py --ids-file collected_match_ids.json --workers 4
```
Beklenen: Basarili/hatali id sayisi loglarda gorunur, DB'ye satir yazilir.
Ek not: Bu komut hem `matches` hem `match_all_columns` tablosunu upsert eder.

### Senaryo 3.1 - Premier League 2025/2026 testi
```powershell
python scripts/collect_match_ids_from_league.py `
  --country England `
  --league "Premier League" `
  --league-url "https://www.flashscore.co.uk/football/england/premier-league/" `
  --season-start 2025 `
  --season-end 2025 `
  --max-matches 50 `
  --output collected_match_ids_england_premier_2025_2026_test.json

python scripts/scrape_to_postgres.py --ids-file collected_match_ids_england_premier_2025_2026_test.json --workers 4
```
Beklenen: `England`/`Premier League` maclari DB'ye yazilir ve all_columns tablosu dolar.

### Senaryo 3.2 - Son 10 sezon cekimi
```powershell
python scripts/collect_match_ids_from_league.py `
  --country England `
  --league "Premier League" `
  --league-url "https://www.flashscore.co.uk/football/england/premier-league/" `
  --last-n-seasons 10 `
  --output collected_match_ids_england_premier_last10.json

python scripts/scrape_to_postgres.py --ids-file collected_match_ids_england_premier_last10.json --workers 8
```
Beklenen: Son 10 sezonun mac ID'leri toplanir ve DB'ye upsert edilir.

### Senaryo 4 - Liste endpoint
```powershell
curl "http://localhost:3000/api/matches?limit=20&offset=0"
```
Beklenen: `total`, `limit`, `offset`, `data` alanlarini dondurur.

### Senaryo 5 - Dashboard
- Tarayicidan `http://localhost:3000`
- Filtrelerle arama yap
- Sayfalama ile veriler cekilebilmeli

## Performans Notlari (MVP sonrasi)

- API tarafinda:
  - Sorgu onbellegi (Redis) eklenebilir
  - Sik filtreler icin ilave kompozit indeksler eklenebilir
- Python ingest tarafinda:
  - Is parcacigi sayisi (`--workers`) ortama gore ayarlanabilir
  - Hatali id'ler yeniden deneme kuyruguna alinabilir
- PostgreSQL tarafinda:
  - Buyuk veri setinde tarih bazli partition dusunulebilir

## Poisson Model API

Proje, Excel tabanlı Poisson futbol tahmin modelinin birebir kopyasını sunan bir API içerir. 
İş mantığı `src/lib/poisson.js` ve `src/services/poisson.service.js` içinde yer alır.

### POST /api/predict (Tekli Tahmin)

Verilen futbol odds (oran) değerlerini alıp model tahminlerini döner.

```powershell
curl -X POST http://localhost:3000/api/predict `
-H "Content-Type: application/json" `
-d '{
  "homeTeam": "Gent",
  "awayTeam": "KV Mechelen",
  "ftOver25": 1.67,
  "ftUnder25": 2.15,
  "bttsYes": 1.57,
  "bttsNo": 2.25,
  "homeOdd": 1.95,
  "drawOdd": 3.50,
  "awayOdd": 3.60
}'
```

Örnek Çıktı:
```json
{
  "ok": true,
  "data": {
    "homeTeam": "Gent",
    "awayTeam": "KV Mechelen",
    "inputOdds": {
      "ftOver25": 1.67,
      "ftUnder25": 2.15,
      "bttsYes": 1.57,
      "bttsNo": 2.25,
      "homeOdd": 1.95,
      "drawOdd": 3.5,
      "awayOdd": 3.6
    },
    "normalized": { ... },
    "totalLambda": 2.93,
    "favoriteShareAlpha": 0.53355,
    "favoriteSide": "EV",
    "homeLambda": 1.5633,
    "awayLambda": 1.3666,
    "modelBTTS": 0.589,
    "modelOver25": 0.5609,
    "coverage05": 0.9917,
    "roundedScore": "2-1",
    "scoreMatrix": [ ... ]
  }
}
```

### POST /api/predict/bulk (Toplu Tahmin)

Aynı anda birden çok maç (max 1000) için hesaplama yapar.

```powershell
curl -X POST http://localhost:3000/api/predict/bulk `
-H "Content-Type: application/json" `
-d '{
  "matches": [
    {
      "homeTeam": "Tirol",
      "awayTeam": "Grazer AK",
      "ftOver25": 2.30,
      "ftUnder25": 1.60,
      "bttsYes": 1.95,
      "bttsNo": 1.80,
      "homeOdd": 2.30,
      "drawOdd": 3.10,
      "awayOdd": 2.85
    }
  ]
}'
```

### POST /api/backtest (Geliştirici Backtest)

Modelin beklenen benchmark verileri ile kendi sonucunu test etmesini sağlar. `tests/fixtures/poisson-benchmark.json` formatındaki array'leri okur. Tolerans varsayılan olarak `0.005`'tir.

```powershell
curl -X POST http://localhost:3000/api/backtest `
-H "Content-Type: application/json" `
-d '{
  "tolerance": 0.005,
  "benchmarkRows": [
    {
      "id": "test-1",
      "input": { ... },
      "expected": { "totalLambda": 2.93, "modelBTTS": 0.589 }
    }
  ]
}'
```

**Testler:** API'ın bağımsız birim testlerini çalıştırmak için model math mantığında:
```powershell
npm test
```
Bu komut, Excel benchmark verileri ile milisaniyelik Node tabanlı tam doğrulama yapar.
