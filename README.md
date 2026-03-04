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
  - Flashscore sayfasindan temel mac verisini ceker
  - Retry + eszamanli isleme ile PostgreSQL'e yazar
- PostgreSQL: `sql/001_init.sql`
  - `matches` tablosu
  - 20GB analitik veri icin temel indeksler
- Node.js API: `server.js`, `src/*`
  - `/api/health`
  - `/api/stats/overview`
  - `/api/matches`
  - `/api/matches/:matchId`
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
```

### 4) Veri cekme + DB'ye yazma

```powershell
python scripts/scrape_to_postgres.py --ids-file collected_match_ids.json --workers 8
```

### 5) API + Dashboard baslatma

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

