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

