const path = require("node:path");
const express = require("express");
const cors = require("cors");

const pino = require("pino");
const pinoHttp = require("pino-http");
const config = require("./config");
const db = require("./db");
const { predictMatch } = require("./cpr");
const { ALL_COLUMNS, mapRawToColumns } = require("./columns-map");

// Initialize DB specific functions and indexes
db.query(`
CREATE INDEX IF NOT EXISTS idx_matches_home_date ON matches (home_team, match_date DESC);
CREATE INDEX IF NOT EXISTS idx_matches_away_date ON matches (away_team, match_date DESC);

CREATE OR REPLACE FUNCTION get_team_elo(p_team text, p_date date, p_limit int)
RETURNS numeric AS $$
DECLARE
  v_elo numeric;
BEGIN
  SELECT ROUND(SUM(
      10 * (
        (CASE WHEN m2.home_team = p_team AND m2.full_time_result = 'MS 1' THEN 1
              WHEN m2.away_team = p_team AND m2.full_time_result = 'MS 2' THEN 1
              WHEN m2.full_time_result = 'MS 0' THEN 0.5 ELSE 0 END)
        -
        (CASE WHEN m2.home_team = p_team THEN 
                COALESCE(1 / NULLIF((mac2.raw_data->>'bet365_home')::numeric, 0), 0.5)
              ELSE 
                COALESCE(1 / NULLIF((mac2.raw_data->>'bet365_away')::numeric, 0), 0.5) 
         END)
      )
    ), 1) INTO v_elo
  FROM (
      SELECT m3.match_id, m3.home_team, m3.away_team, m3.full_time_result
      FROM matches m3 
      WHERE (m3.home_team = p_team OR m3.away_team = p_team) AND m3.match_date < p_date
      ORDER BY m3.match_date DESC
      LIMIT p_limit
  ) m2
  LEFT JOIN match_all_columns mac2 ON m2.match_id = mac2.match_id AND mac2.bookmaker = 'bet365';
  
  RETURN COALESCE(v_elo, 0);
END;
$$ LANGUAGE plpgsql STABLE;
`).catch(e => console.error("Error creating get_team_elo function:", e.message));

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

// ─── Shared: Odds range filter builder ─────────────────────────────
const ODDS_KEY_MAP = {
  odds_1:          { closing: "home" },
  odds_x:          { closing: "draw" },
  odds_2:          { closing: "away" },
  odds_ou25_over:  { closing: "2_5_over" },
  odds_ou25_under: { closing: "2_5_under" },
  odds_btts_yes:   { closing: "yes" },
  odds_btts_no:    { closing: "no" },
  odds_dc_1x:      { closing: "home_draw_odds" },
  odds_dc_x2:      { closing: "away_draw_odds" },
  odds_dc_12:      { closing: "home_away_odds" },
  odds_iy_1:       { closing: "first_half_home" },
  odds_iy_x:       { closing: "first_half_draw" },
  odds_iy_2:       { closing: "first_half_away" },
  odds_ou15_over:  { closing: "1_5_over" },
  odds_ou35_over:  { closing: "3_5_over" },
};

/**
 * Parse odds range filters from query and append to values array.
 * Returns { oddsFilters: string[], needsJoin: boolean }
 */
function buildOddsFilters(query, bookmaker, values) {
  const oddsFilters = [];
  let needsJoin = false;
  for (const [paramKey, keyMap] of Object.entries(ODDS_KEY_MAP)) {
    const exactVal = parseFloat(query[paramKey]);
    if (!isNaN(exactVal)) {
      needsJoin = true;
      const jsonKey = `${bookmaker}_${keyMap.closing}`;
      values.push(exactVal);
      oddsFilters.push(`(mac.raw_data->>'${jsonKey}')::numeric = $${values.length}`);
    }
  }
  return { oddsFilters, needsJoin };
}

/**
 * Parse common filters from query and append to values array.
 * Returns filters array of SQL conditions.
 */
function buildBaseFilters(query, values) {
  const filters = [];
  const country = (query.country || "").trim();
  const league = (query.league || "").trim();
  const season = (query.season || "").trim();
  const search = (query.search || "").trim();
  const dateFrom = (query.dateFrom || "").trim();
  const dateTo = (query.dateTo || "").trim();
  const ftResult = (query.result || "").trim();

  if (country) { values.push(`%${country}%`); filters.push(`m.country ILIKE $${values.length}`); }
  if (league) { values.push(`%${league}%`); filters.push(`m.league ILIKE $${values.length}`); }
  if (season) { values.push(`%${season}%`); filters.push(`m.season ILIKE $${values.length}`); }
  if (search) {
    values.push(`%${search}%`);
    const t = `$${values.length}`;
    filters.push(`(m.home_team ILIKE ${t} OR m.away_team ILIKE ${t})`);
  }
  if (dateFrom) { values.push(dateFrom); filters.push(`m.match_date >= $${values.length}::date`); }
  if (dateTo) { values.push(dateTo); filters.push(`m.match_date <= $${values.length}::date`); }
  if (ftResult) { values.push(ftResult); filters.push(`m.full_time_result = $${values.length}`); }

  const ELO_KEYS = [
    { param: "elo_home_5", args: "m.home_team, m.match_date, 5" },
    { param: "elo_home_10", args: "m.home_team, m.match_date, 10" },
    { param: "elo_home_20", args: "m.home_team, m.match_date, 20" },
    { param: "elo_away_5", args: "m.away_team, m.match_date, 5" },
    { param: "elo_away_10", args: "m.away_team, m.match_date, 10" },
    { param: "elo_away_20", args: "m.away_team, m.match_date, 20" }
  ];

  for (const f of ELO_KEYS) {
    const val = parseFloat(query[f.param]);
    if (!isNaN(val)) {
      values.push(val);
      filters.push(`get_team_elo(${f.args}) = $${values.length}`);
    }
  }

  return filters;
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
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const values = [];
    const filters = buildBaseFilters(req.query, values);
    const { oddsFilters, needsJoin } = buildOddsFilters(req.query, bookmaker, values);

    // Always JOIN with match_all_columns (bookmaker is always set)
    values.push(bookmaker);
    const bmIdx = values.length;
    const allFilters = [...filters, `mac.bookmaker = $${bmIdx}`, ...oddsFilters];
    const whereClause = allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : "";

    const sql = `
      SELECT
        COUNT(DISTINCT m.match_id)::int AS total_matches,
        COUNT(DISTINCT m.league)::int AS total_leagues,
        COUNT(DISTINCT m.country)::int AS total_countries,
        MIN(m.match_date) AS first_match_date,
        MAX(m.match_date) AS last_match_date,
        COUNT(mac.match_id)::int AS total_odds
      FROM matches m
      INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
      ${whereClause}
    `;
    const r = await db.query(sql, values);
    res.json(r.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/analysis", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(toPositiveInt(req.query.limit, 50), 1), 1000);
    const offset = Math.max(toPositiveInt(req.query.offset, 0), 0);
    const bookmaker = (req.query.bookmaker || "bet365").trim();

    const values = [];
    const filters = buildBaseFilters(req.query, values);
    const { oddsFilters, needsJoin } = buildOddsFilters(req.query, bookmaker, values);

    // For analysis we ALWAYS join match_all_columns to get current odds
    values.push(bookmaker);
    const bmIdx = values.length;
    const allFilters = [...filters, `mac.bookmaker = $${bmIdx}`, ...oddsFilters];
    const whereClause = allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : "";

    const selectQuery = `
      SELECT
        m.match_id,
        m.match_date,
        m.match_time,
        m.league,
        m.country,
        m.home_team,
        m.away_team,
        m.home_score,
        m.away_score,
        m.full_time_result,
        m.half_time_result,
        (mac.raw_data->>'${bookmaker}_home')::numeric AS odds_1,
        (mac.raw_data->>'${bookmaker}_draw')::numeric AS odds_x,
        (mac.raw_data->>'${bookmaker}_away')::numeric AS odds_2,
        get_team_elo(m.home_team, m.match_date, 5) AS home_5m,
        get_team_elo(m.home_team, m.match_date, 10) AS home_10m,
        get_team_elo(m.home_team, m.match_date, 20) AS home_20m,
        get_team_elo(m.away_team, m.match_date, 5) AS away_5m,
        get_team_elo(m.away_team, m.match_date, 10) AS away_10m,
        get_team_elo(m.away_team, m.match_date, 20) AS away_20m,
        get_team_elo(m.home_team, m.match_date, 1000) AS home_general,
        get_team_elo(m.away_team, m.match_date, 1000) AS away_general
      FROM matches m
      INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
      ${whereClause}
      ORDER BY m.match_date DESC, m.match_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT m.match_id)::int AS total
      FROM matches m
      INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
      ${whereClause}
    `;

    const [rowsResult, countResult] = await Promise.all([
      db.query(selectQuery, values),
      db.query(countQuery, values)
    ]);

    const processedRows = rowsResult.rows.map(r => {
      const cprData = predictMatch({
        oddsHome: r.odds_1, oddsDraw: r.odds_x, oddsAway: r.odds_2,
        homeEloGeneral: r.home_general, awayEloGeneral: r.away_general,
        homeForm5: r.home_5m, awayForm5: r.away_5m,
        homeForm10: r.home_10m, awayForm10: r.away_10m,
        homeForm20: r.home_20m, awayForm20: r.away_20m,
        leagueAvgElo: 0
      });
      return { ...r, cpr: cprData };
    });

    res.json({
      data: processedRows,
      total: countResult.rows[0].total,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/matches", async (req, res, next) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, config.dashboardPageSize), 200);
    const offset = Math.max(toPositiveInt(req.query.offset, 0), 0);
    const bookmaker = (req.query.bookmaker || "bet365").trim();

    const values = [];
    const filters = buildBaseFilters(req.query, values);
    const { oddsFilters, needsJoin } = buildOddsFilters(req.query, bookmaker, values);

    // Build query with optional JOIN
    if (needsJoin) {
      values.push(bookmaker);
      const bmIdx = values.length;
      const allFilters = [...filters, `mac.bookmaker = $${bmIdx}`, ...oddsFilters];
      const whereClause = allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : "";

      const countSql = `
        SELECT COUNT(DISTINCT m.match_id)::int AS total
        FROM matches m
        INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
        ${whereClause}
      `;
      const countResult = await db.query(countSql, values);
      const total = countResult.rows[0]?.total || 0;

      const dataValues = [...values, limit, offset];
      const dataSql = `
        SELECT DISTINCT ON (m.match_date, m.match_time, m.scraped_at, m.match_id)
          m.match_id, m.country, m.league, m.season, m.round_no,
          m.match_date, m.match_time, m.home_team, m.away_team,
          m.home_score, m.away_score, m.full_time_result, m.scraped_at
        FROM matches m
        INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
        ${whereClause}
        ORDER BY m.match_date DESC NULLS LAST, m.match_time DESC NULLS LAST, m.scraped_at DESC, m.match_id
        LIMIT $${dataValues.length - 1}
        OFFSET $${dataValues.length}
      `;
      const dataResult = await db.query(dataSql, dataValues);

      return res.json({ total, limit, offset, data: dataResult.rows });
    }

    // No odds filters — simple query (no JOIN for performance)
    if (bookmaker) {
      values.push(bookmaker);
      filters.push(`EXISTS (SELECT 1 FROM match_all_columns WHERE match_all_columns.match_id = m.match_id AND match_all_columns.bookmaker = $${values.length})`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int AS total FROM matches m ${whereClause}`;
    const countResult = await db.query(countSql, values);
    const total = countResult.rows[0]?.total || 0;

    const dataValues = [...values, limit, offset];
    const dataSql = `
      SELECT
        m.match_id, m.country, m.league, m.season, m.round_no,
        m.match_date, m.match_time, m.home_team, m.away_team,
        m.home_score, m.away_score, m.full_time_result, m.scraped_at
      FROM matches m
      ${whereClause}
      ORDER BY m.match_date DESC NULLS LAST, m.match_time DESC NULLS LAST, m.scraped_at DESC
      LIMIT $${dataValues.length - 1}
      OFFSET $${dataValues.length}
    `;
    const dataResult = await db.query(dataSql, dataValues);

    res.json({ total, limit, offset, data: dataResult.rows });
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

// Distinct filter options for dropdowns
app.get("/api/filters/options", async (req, res, next) => {
  try {
    const [countries, leagues, seasons] = await Promise.all([
      db.query("SELECT DISTINCT country FROM matches WHERE country IS NOT NULL ORDER BY country"),
      db.query("SELECT DISTINCT league FROM matches WHERE league IS NOT NULL ORDER BY league"),
      db.query("SELECT DISTINCT season FROM matches WHERE season IS NOT NULL ORDER BY season DESC"),
    ]);
    res.json({
      countries: countries.rows.map(r => r.country),
      leagues: leagues.rows.map(r => r.league),
      seasons: seasons.rows.map(r => r.season),
    });
  } catch (error) {
    next(error);
  }
});

// Market statistics endpoint
app.get("/api/stats/markets", async (req, res, next) => {
  try {
    const bookmaker = (req.query.bookmaker || "bet365").trim();

    const values = [];
    const filters = buildBaseFilters(req.query, values);
    const { oddsFilters } = buildOddsFilters(req.query, bookmaker, values);

    values.push(bookmaker);
    const bmIdx = values.length;
    const allFilters = [...filters, `mac.bookmaker = $${bmIdx}`, ...oddsFilters];

    const whereClause = allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : "";

    const sql = `
      SELECT
        COUNT(*)::int AS total_matches,

        -- Maç Sonucu (Full Time Result)
        COUNT(*) FILTER (WHERE m.full_time_result = 'MS 1')::int AS ft_home_wins,
        COUNT(*) FILTER (WHERE m.full_time_result = 'MS 0')::int AS ft_draws,
        COUNT(*) FILTER (WHERE m.full_time_result = 'MS 2')::int AS ft_away_wins,

        -- Skor tabanlı istatistikler
        ROUND(AVG(m.home_score)::numeric, 2) AS avg_home_goals,
        ROUND(AVG(m.away_score)::numeric, 2) AS avg_away_goals,
        ROUND(AVG(COALESCE(m.home_score,0) + COALESCE(m.away_score,0))::numeric, 2) AS avg_total_goals,

        -- KG VAR/YOK (BTTS)
        COUNT(*) FILTER (WHERE m.home_score > 0 AND m.away_score > 0)::int AS btts_yes,
        COUNT(*) FILTER (WHERE m.home_score = 0 OR m.away_score = 0)::int AS btts_no,

        -- Alt/Üst 2.5
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) > 2)::int AS over_2_5,
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) <= 2)::int AS under_2_5,

        -- Alt/Üst 1.5
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) > 1)::int AS over_1_5,
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) <= 1)::int AS under_1_5,

        -- Alt/Üst 3.5
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) > 3)::int AS over_3_5,
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) <= 3)::int AS under_3_5,

        -- Alt/Üst 0.5
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) > 0)::int AS over_0_5,
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) = 0)::int AS under_0_5,

        -- Ev sahibi golleri
        COUNT(*) FILTER (WHERE m.home_score > 0)::int AS home_scored,
        COUNT(*) FILTER (WHERE m.home_score = 0)::int AS home_clean_sheet,
        COUNT(*) FILTER (WHERE m.home_score >= 2)::int AS home_scored_2plus,
        COUNT(*) FILTER (WHERE m.home_score >= 3)::int AS home_scored_3plus,

        -- Deplasman golleri
        COUNT(*) FILTER (WHERE m.away_score > 0)::int AS away_scored,
        COUNT(*) FILTER (WHERE m.away_score = 0)::int AS away_clean_sheet,
        COUNT(*) FILTER (WHERE m.away_score >= 2)::int AS away_scored_2plus,
        COUNT(*) FILTER (WHERE m.away_score >= 3)::int AS away_scored_3plus,

        -- Tek/Çift
        COUNT(*) FILTER (WHERE (COALESCE(m.home_score,0) + COALESCE(m.away_score,0)) % 2 = 1)::int AS total_odd,
        COUNT(*) FILTER (WHERE (COALESCE(m.home_score,0) + COALESCE(m.away_score,0)) % 2 = 0)::int AS total_even,

        -- Çifte Şans
        COUNT(*) FILTER (WHERE m.full_time_result IN ('MS 1', 'MS 0'))::int AS dc_1x,
        COUNT(*) FILTER (WHERE m.full_time_result IN ('MS 0', 'MS 2'))::int AS dc_x2,
        COUNT(*) FILTER (WHERE m.full_time_result IN ('MS 1', 'MS 2'))::int AS dc_12,

        -- İlk yarı gol
        COUNT(*) FILTER (WHERE m.home_score IS NOT NULL)::int AS has_score

      FROM matches m
      INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
      ${whereClause}
    `;

    const queryResult = await db.query(sql, values);
    const row = queryResult.rows[0] || {};
    const total = row.total_matches || 0;

    function pct(val) {
      if (!total || val == null) return 0;
      return Math.round((val / total) * 10000) / 100;
    }

    res.json({
      total_matches: total,
      bookmaker,
      markets: {
        "Maç Sonucu": {
          "Ev Kazanır (1)": { count: row.ft_home_wins, pct: pct(row.ft_home_wins) },
          "Beraberlik (X)": { count: row.ft_draws, pct: pct(row.ft_draws) },
          "Dep. Kazanır (2)": { count: row.ft_away_wins, pct: pct(row.ft_away_wins) },
        },
        "Çifte Şans": {
          "1X (Ev veya Ber.)": { count: row.dc_1x, pct: pct(row.dc_1x) },
          "X2 (Ber. veya Dep.)": { count: row.dc_x2, pct: pct(row.dc_x2) },
          "12 (Ev veya Dep.)": { count: row.dc_12, pct: pct(row.dc_12) },
        },
        "KG VAR/YOK (BTTS)": {
          "KG VAR": { count: row.btts_yes, pct: pct(row.btts_yes) },
          "KG YOK": { count: row.btts_no, pct: pct(row.btts_no) },
        },
        "Alt/Üst 2.5": {
          "2.5 Üst": { count: row.over_2_5, pct: pct(row.over_2_5) },
          "2.5 Alt": { count: row.under_2_5, pct: pct(row.under_2_5) },
        },
        "Alt/Üst 1.5": {
          "1.5 Üst": { count: row.over_1_5, pct: pct(row.over_1_5) },
          "1.5 Alt": { count: row.under_1_5, pct: pct(row.under_1_5) },
        },
        "Alt/Üst 3.5": {
          "3.5 Üst": { count: row.over_3_5, pct: pct(row.over_3_5) },
          "3.5 Alt": { count: row.under_3_5, pct: pct(row.under_3_5) },
        },
        "Alt/Üst 0.5": {
          "0.5 Üst": { count: row.over_0_5, pct: pct(row.over_0_5) },
          "0.5 Alt (Gol Yok)": { count: row.under_0_5, pct: pct(row.under_0_5) },
        },
        "Tek/Çift": {
          "Tek": { count: row.total_odd, pct: pct(row.total_odd) },
          "Çift": { count: row.total_even, pct: pct(row.total_even) },
        },
        "Gol Ortalamaları": {
          "Ev Sahibi Ort. Gol": { value: row.avg_home_goals },
          "Deplasman Ort. Gol": { value: row.avg_away_goals },
          "Toplam Ort. Gol": { value: row.avg_total_goals },
        },
        "Ev Sahibi Gol": {
          "Gol Atar": { count: row.home_scored, pct: pct(row.home_scored) },
          "Gol Yemez": { count: row.home_clean_sheet, pct: pct(row.home_clean_sheet) },
          "2+ Gol Atar": { count: row.home_scored_2plus, pct: pct(row.home_scored_2plus) },
          "3+ Gol Atar": { count: row.home_scored_3plus, pct: pct(row.home_scored_3plus) },
        },
        "Deplasman Gol": {
          "Gol Atar": { count: row.away_scored, pct: pct(row.away_scored) },
          "Gol Yemez": { count: row.away_clean_sheet, pct: pct(row.away_clean_sheet) },
          "2+ Gol Atar": { count: row.away_scored_2plus, pct: pct(row.away_scored_2plus) },
          "3+ Gol Atar": { count: row.away_scored_3plus, pct: pct(row.away_scored_3plus) },
        },
      },
    });
  } catch (error) {
    next(error);
  }
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
