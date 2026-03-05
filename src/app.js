const path = require("node:path");
const express = require("express");
const cors = require("cors");
const pino = require("pino");
const pinoHttp = require("pino-http");

const config = require("./config");
const db = require("./db");
const { ALL_COLUMNS, mapRawToColumns } = require("./columns-map");

const app = express();
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

app.use(express.json({ limit: "10mb" }));
app.use(cors());
app.use(
  pinoHttp({
    logger,
    redact: ["req.headers.authorization"],
  }),
);

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

app.get("/api/health", async (req, res, next) => {
  try {
    await db.query("SELECT 1");
    res.json({
      status: "ok",
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/stats/overview", async (req, res, next) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

app.get("/api/matches", async (req, res, next) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, config.dashboardPageSize), 200);
    const offset = Math.max(toPositiveInt(req.query.offset, 0), 0);
    const country = (req.query.country || "").trim();
    const league = (req.query.league || "").trim();
    const season = (req.query.season || "").trim();
    const search = (req.query.search || "").trim();
    const dateFrom = (req.query.dateFrom || "").trim();
    const dateTo = (req.query.dateTo || "").trim();

    const filters = [];
    const values = [];

    if (country) {
      values.push(country);
      filters.push(`country = $${values.length}`);
    }
    if (league) {
      values.push(league);
      filters.push(`league = $${values.length}`);
    }
    if (season) {
      values.push(season);
      filters.push(`season = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      const token = `$${values.length}`;
      filters.push(`(home_team ILIKE ${token} OR away_team ILIKE ${token} OR match_id ILIKE ${token})`);
    }
    if (dateFrom) {
      values.push(dateFrom);
      filters.push(`match_date >= $${values.length}::date`);
    }
    if (dateTo) {
      values.push(dateTo);
      filters.push(`match_date <= $${values.length}::date`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int AS total FROM matches ${whereClause}`;
    const countResult = await db.query(countSql, values);
    const total = countResult.rows[0]?.total || 0;

    const dataValues = [...values, limit, offset];
    const dataSql = `
      SELECT
        match_id,
        country,
        league,
        season,
        round_no,
        match_date,
        match_time,
        home_team,
        away_team,
        home_score,
        away_score,
        full_time_result,
        scraped_at
      FROM matches
      ${whereClause}
      ORDER BY match_date DESC NULLS LAST, match_time DESC NULLS LAST, scraped_at DESC
      LIMIT $${dataValues.length - 1}
      OFFSET $${dataValues.length}
    `;
    const dataResult = await db.query(dataSql, dataValues);

    res.json({
      total,
      limit,
      offset,
      data: dataResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/matches/:matchId", async (req, res, next) => {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM matches
      WHERE match_id = $1
      LIMIT 1
      `,
      [req.params.matchId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Kayit bulunamadi." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/matches/:matchId/all-columns", async (req, res, next) => {
  try {
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const result = await db.query(
      `
      SELECT *
      FROM match_all_columns
      WHERE match_id = $1
        AND bookmaker = $2
      LIMIT 1
      `,
      [req.params.matchId, bookmaker],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "All-columns kaydi bulunamadi." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Turkish column-mapped odds endpoint
app.get("/api/matches/:matchId/odds", async (req, res, next) => {
  try {
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const result = await db.query(
      `SELECT raw_data FROM match_all_columns WHERE match_id = $1 AND bookmaker = $2 LIMIT 1`,
      [req.params.matchId, bookmaker],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Oran verisi bulunamadi." });
    }

    let rd = result.rows[0].raw_data;
    if (typeof rd === "string") rd = JSON.parse(rd);

    const mapped = mapRawToColumns(rd, bookmaker);
    res.json({ match_id: req.params.matchId, bookmaker, columns: mapped, all_columns_count: ALL_COLUMNS.length });
  } catch (error) {
    next(error);
  }
});

// all_columns.txt list endpoint
app.get("/api/columns", (req, res) => {
  res.json({ columns: ALL_COLUMNS, total: ALL_COLUMNS.length });
});

// ─── Ingestion API (Python scraper -> DB via HTTPS) ────────────────────────
function requireIngestKey(req, res, next) {
  if (!config.ingestApiKey) {
    return res.status(503).json({ message: "INGEST_API_KEY yapilandirilmamis." });
  }
  const provided =
    (req.headers["x-api-key"] || "").trim() ||
    (req.query.apikey || "").trim();
  if (provided !== config.ingestApiKey) {
    return res.status(401).json({ message: "Gecersiz API anahtari." });
  }
  next();
}

// POST /api/ingest/batch — match_all_columns tablosuna batch upsert
app.post("/api/ingest/batch", requireIngestKey, async (req, res, next) => {
  try {
    const { rows, bookmaker } = req.body;
    if (!Array.isArray(rows) || !rows.length || !bookmaker) {
      return res.status(400).json({ message: "rows (array) ve bookmaker (string) gerekli." });
    }

    let upserted = 0;
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of rows) {
        const matchId = row.ide || row.match_id;
        if (!matchId) continue;
        await client.query(
          `INSERT INTO match_all_columns (match_id, bookmaker, raw_data, scraped_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (match_id, bookmaker)
           DO UPDATE SET raw_data = $3, scraped_at = NOW()`,
          [matchId, bookmaker, JSON.stringify(row)],
        );
        upserted++;
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({ ok: true, upserted, bookmaker });
  } catch (error) {
    next(error);
  }
});

// POST /api/ingest/sync-matches — match_all_columns -> matches senkronizasyonu
app.post("/api/ingest/sync-matches", requireIngestKey, async (req, res, next) => {
  try {
    // source_url NOT NULL kisitini kaldir (varsa)
    await db.query(`ALTER TABLE matches ALTER COLUMN source_url DROP NOT NULL`).catch(() => { });
    await db.query(`ALTER TABLE matches ALTER COLUMN source_url SET DEFAULT ''`).catch(() => { });

    const result = await db.query(`
      INSERT INTO matches (
        match_id, country, league, season, match_date, match_time,
        home_team, away_team, home_score, away_score,
        full_time_result, source_url, scraped_at
      )
      SELECT DISTINCT ON (match_id)
        match_id,
        raw_data->>'ÜLKE',
        raw_data->>'LİG',
        raw_data->>'SEZON',
        CASE WHEN raw_data->>'TARİH' ~ '^\\d'
             THEN TO_DATE(raw_data->>'TARİH', 'DD.MM.YYYY')
             ELSE NULL END,
        CASE WHEN raw_data->>'SAAT' ~ '^\\d{1,2}:\\d{2}'
             THEN (raw_data->>'SAAT')::time
             ELSE NULL END,
        raw_data->>'EV SAHİBİ',
        raw_data->>'DEPLASMAN',
        CASE WHEN raw_data->>'MS' ~ '^\\d'
             THEN SPLIT_PART(raw_data->>'MS', '-', 1)::int
             ELSE NULL END,
        CASE WHEN raw_data->>'MS' ~ '\\d$'
             THEN SPLIT_PART(raw_data->>'MS', '-', 2)::int
             ELSE NULL END,
        raw_data->>'MS SONUCU',
        'https://www.flashscore.com/match/' || match_id || '/',
        scraped_at
      FROM match_all_columns
      WHERE raw_data->>'EV SAHİBİ' IS NOT NULL
        AND raw_data->>'EV SAHİBİ' != ''
      ORDER BY match_id, scraped_at DESC
      ON CONFLICT (match_id) DO UPDATE SET
        country = EXCLUDED.country,
        league = EXCLUDED.league,
        season = EXCLUDED.season,
        home_team = EXCLUDED.home_team,
        away_team = EXCLUDED.away_team,
        match_date = EXCLUDED.match_date,
        match_time = EXCLUDED.match_time,
        home_score = EXCLUDED.home_score,
        away_score = EXCLUDED.away_score,
        full_time_result = EXCLUDED.full_time_result,
        source_url = EXCLUDED.source_url
    `);

    const countResult = await db.query("SELECT COUNT(*)::int AS total FROM matches");
    res.json({
      ok: true,
      synced: result.rowCount || 0,
      totalMatches: countResult.rows[0]?.total || 0,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/ingest/status — DB durumunu kontrol et
app.get("/api/ingest/status", requireIngestKey, async (req, res, next) => {
  try {
    const macResult = await db.query("SELECT COUNT(*)::int AS c FROM match_all_columns");
    const matchResult = await db.query("SELECT COUNT(*)::int AS c FROM matches");
    res.json({
      match_all_columns: macResult.rows[0]?.c || 0,
      matches: matchResult.rows[0]?.c || 0,
    });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(config.staticDir));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API endpoint bulunamadi." });
  }

  return res.sendFile(path.join(config.staticDir, "index.html"));
});

app.use((error, req, res, next) => {
  req.log?.error({ err: error }, "Beklenmeyen hata");
  res.status(500).json({
    message: "Sunucuda beklenmeyen bir hata olustu.",
  });
});

module.exports = {
  app,
  logger,
};
