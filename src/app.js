const path = require("node:path");
const express = require("express");
const cors = require("cors");
const pino = require("pino");
const pinoHttp = require("pino-http");

const config = require("./config");
const db = require("./db");

const app = express();
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

app.use(express.json({ limit: "1mb" }));
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
