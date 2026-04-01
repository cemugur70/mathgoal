const path = require("node:path");
const express = require("express");
const cors = require("cors");

const pino = require("pino");
const pinoHttp = require("pino-http");
const config = require("./config");
const db = require("./db");
const { ALL_COLUMNS, mapRawToColumns } = require("./columns-map");
const { MODEL_WEIGHTS, createPrediction, backtestSummary } = require("./match-model");

const app = express();
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: ["http://localhost:3000", "https://mathgoal.site"] }));
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

function normalizeCursorDate(value, orderDir) {
  const trimmed = String(value || "").trim();
  if (trimmed) {
    return trimmed;
  }
  return orderDir === "ASC" ? "9999-12-31" : "0001-01-01";
}

function normalizeCursorTime(value, orderDir) {
  const trimmed = String(value || "").trim();
  if (trimmed) {
    return trimmed;
  }
  return orderDir === "ASC" ? "23:59:59.999999" : "00:00:00";
}

// ─── Shared: Odds range filter builder ─────────────────────────────
const ODDS_KEY_MAP = {
  // MS 1X2
  odds_1: { closing: "home" },
  odds_x: { closing: "draw" },
  odds_2: { closing: "away" },
  // IY 1X2
  odds_iy_1: { closing: "first_half_home" },
  odds_iy_x: { closing: "first_half_draw" },
  odds_iy_2: { closing: "first_half_away" },
  // 2Y 1X2
  odds_2y_1: { closing: "second_half_home" },
  odds_2y_x: { closing: "second_half_draw" },
  odds_2y_2: { closing: "second_half_away" },

  // Cifte Sans
  odds_dc_1x: { closing: "home_draw_odds" },
  odds_dc_12: { closing: "home_away_odds" },
  odds_dc_x2: { closing: "away_draw_odds" },
  // IY Cifte Sans
  odds_iy_dc_1x: { closing: "first_half_home_draw_odds" },
  odds_iy_dc_12: { closing: "first_half_home_away_odds" },
  odds_iy_dc_x2: { closing: "first_half_away_draw_odds" },

  // DNB
  odds_dnb_1: { closing: "draw_no_bet_home" },
  odds_dnb_2: { closing: "draw_no_bet_away" },

  // BTTS
  odds_btts_yes: { closing: "yes" },
  odds_btts_no: { closing: "no" },
  odds_iy_btts_yes: { closing: "first_half_yes" },
  odds_iy_btts_no: { closing: "first_half_no" },

  // Odd/Even
  odds_odd: { closing: "odd" },
  odds_even: { closing: "even" },
  odds_iy_odd: { closing: "first_half_odd" },
  odds_iy_even: { closing: "first_half_even" },

  // O/U
  odds_ou05_over: { closing: "0_5_over" },
  odds_ou05_under: { closing: "0_5_under" },
  odds_ou15_over: { closing: "1_5_over" },
  odds_ou15_under: { closing: "1_5_under" },
  odds_ou25_over: { closing: "2_5_over" },
  odds_ou25_under: { closing: "2_5_under" },
  odds_ou35_over: { closing: "3_5_over" },
  odds_ou35_under: { closing: "3_5_under" },
  odds_ou45_over: { closing: "4_5_over" },
  odds_ou45_under: { closing: "4_5_under" },

  // AH (Asian Handicap)
  odds_ah_minus_15_1: { closing: "ah_minus_1_5_home" },
  odds_ah_minus_15_2: { closing: "ah_minus_1_5_away" },
  odds_ah_minus_10_1: { closing: "ah_minus_1_0_home" },
  odds_ah_minus_10_2: { closing: "ah_minus_1_0_away" },
  odds_ah_minus_05_1: { closing: "ah_minus_0_5_home" },
  odds_ah_minus_05_2: { closing: "ah_minus_0_5_away" },
  odds_ah_00_1: { closing: "ah_0_0_home" },
  odds_ah_00_2: { closing: "ah_0_0_away" },
  odds_ah_plus_05_1: { closing: "ah_0_5_home" },
  odds_ah_plus_05_2: { closing: "ah_0_5_away" },
  odds_ah_plus_10_1: { closing: "ah_1_0_home" },
  odds_ah_plus_10_2: { closing: "ah_1_0_away" },
  odds_ah_plus_15_1: { closing: "ah_1_5_home" },
  odds_ah_plus_15_2: { closing: "ah_1_5_away" },

  // EH (European Handicap)
  odds_eh_minus_1_1: { closing: "eh_minus1_home" },
  odds_eh_minus_1_x: { closing: "eh_minus1_draw" },
  odds_eh_minus_1_2: { closing: "eh_minus1_away" },
  odds_eh_plus_1_1: { closing: "eh_plus1_home" },
  odds_eh_plus_1_x: { closing: "eh_plus1_draw" },
  odds_eh_plus_1_2: { closing: "eh_plus1_away" },

  // IY O/U
  odds_iy_ou05_over: { closing: "first_half_0_5_over" },
  odds_iy_ou05_under: { closing: "first_half_0_5_under" },
  odds_iy_ou15_over: { closing: "first_half_1_5_over" },
  odds_iy_ou15_under: { closing: "first_half_1_5_under" },
  odds_iy_ou25_over: { closing: "first_half_2_5_over" },
  odds_iy_ou25_under: { closing: "first_half_2_5_under" },
};

/**
 * Parse odds range filters from query and append to values array.
 * Returns { oddsFilters: string[], needsJoin: boolean }
 */
function buildOddsFilters(query, bookmaker, values) {
  const oddsFilters = [];
  let needsJoin = false;
  for (const [paramKey, keyMap] of Object.entries(ODDS_KEY_MAP)) {
    const minVal = parseFloat(query[`${paramKey}_min`]);
    const maxVal = parseFloat(query[`${paramKey}_max`]);
    const exactVal = parseFloat(query[paramKey]);
    const jsonKey = `${bookmaker}_${keyMap.closing}`;

    if (!isNaN(minVal)) {
      needsJoin = true;
      values.push(minVal);
      oddsFilters.push(`(mac.raw_data->>'${jsonKey}')::numeric >= $${values.length}`);
    }
    if (!isNaN(maxVal)) {
      needsJoin = true;
      values.push(maxVal);
      oddsFilters.push(`(mac.raw_data->>'${jsonKey}')::numeric <= $${values.length}`);
    }
    if (!isNaN(exactVal) && isNaN(minVal) && isNaN(maxVal)) {
      needsJoin = true;
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

  if (country) { values.push(country); filters.push(`m.country = $${values.length}`); }
  if (league) { values.push(league); filters.push(`m.league = $${values.length}`); }
  if (season) { values.push(season); filters.push(`m.season = $${values.length}`); }
  if (search) {
    values.push(search);
    const exact = `$${values.length}`;
    values.push(`%${search}%`);
    const like = `$${values.length}`;
    filters.push(`(m.match_id = ${exact} OR m.home_team ILIKE ${like} OR m.away_team ILIKE ${like})`);
  }
  if (dateFrom) { values.push(dateFrom); filters.push(`m.match_date >= $${values.length}::date`); }
  if (dateTo) { values.push(dateTo); filters.push(`m.match_date <= $${values.length}::date`); }
  if (ftResult) { values.push(ftResult); filters.push(`m.full_time_result = $${values.length}`); }
  if (query.upcomingOnly === 'true') { filters.push(`m.home_score IS NULL`); }

  return filters;
}

function priorMatchCondition(matchAlias, targetAlias) {
  return `(
    COALESCE(${matchAlias}.match_date, DATE '0001-01-01'),
    COALESCE(${matchAlias}.match_time, TIME '00:00:00'),
    ${matchAlias}.match_id
  ) < (
    COALESCE(${targetAlias}.match_date, DATE '0001-01-01'),
    COALESCE(${targetAlias}.match_time, TIME '00:00:00'),
    ${targetAlias}.match_id
  )`;
}

function recencyWeightSql(rankExpr) {
  return `CASE ${rankExpr}
    WHEN 1 THEN 1.00
    WHEN 2 THEN 0.85
    WHEN 3 THEN 0.72
    WHEN 4 THEN 0.61
    WHEN 5 THEN 0.52
    WHEN 6 THEN 0.44
    ELSE 0.38
  END`;
}

function buildPredictionFeatureQuery(rawQuery, bookmaker, limit, completedOnly = false) {
  const values = [];
  const query = { ...rawQuery };
  const sortValue = String(query.sort || "").trim().toLowerCase();
  const orderDir = sortValue === "asc" || (!sortValue && query.upcomingOnly === "true" && !completedOnly) ? "ASC" : "DESC";
  if (completedOnly) {
    delete query.upcomingOnly;
  }

  const filters = buildBaseFilters(query, values);
  const { oddsFilters } = buildOddsFilters(query, bookmaker, values);
  if (completedOnly) {
    filters.push("m.home_score IS NOT NULL");
    filters.push("m.away_score IS NOT NULL");
  }

  values.push(bookmaker);
  const bmIdx = values.length;
  const oddsKeyHome = `${bookmaker}_home`;
  const oddsKeyDraw = `${bookmaker}_draw`;
  const oddsKeyAway = `${bookmaker}_away`;
  const allFilters = [
    ...filters,
    ...oddsFilters,
    `mac.bookmaker = $${bmIdx}`,
    `NULLIF(mac.raw_data->>'${oddsKeyHome}', '') IS NOT NULL`,
    `NULLIF(mac.raw_data->>'${oddsKeyDraw}', '') IS NOT NULL`,
    `NULLIF(mac.raw_data->>'${oddsKeyAway}', '') IS NOT NULL`,
  ];
  const whereClause = allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : "";
  const limitParam = values.length + 1;
  const priorTarget = priorMatchCondition("m2", "tm");
  const weightHome = recencyWeightSql("recent.rn");
  const weightAway = recencyWeightSql("recent.rn");
  const weightH2h = recencyWeightSql("recent.rn");

  return {
    values: [...values, limit],
    sql: `
      WITH target_matches AS (
        SELECT
          m.match_id,
          m.country,
          m.league,
          m.season,
          m.match_date,
          m.match_time,
          m.home_team,
          m.away_team,
          m.home_score,
          m.away_score,
          m.full_time_result,
          (mac.raw_data->>'${oddsKeyHome}')::numeric AS odds_home,
          (mac.raw_data->>'${oddsKeyDraw}')::numeric AS odds_draw,
          (mac.raw_data->>'${oddsKeyAway}')::numeric AS odds_away
        FROM matches m
        INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
        ${whereClause}
        ORDER BY m.match_date ${orderDir} NULLS LAST, m.match_time ${orderDir} NULLS LAST, m.match_id ${orderDir}
        LIMIT $${limitParam}
      )
      SELECT
        tm.*,
        COALESCE(home_recent.ppg, 1.4) AS home_ppg,
        COALESCE(home_recent.goals_for, 1.35) AS home_goals_for,
        COALESCE(home_recent.goals_against, 1.1) AS home_goals_against,
        COALESCE(home_recent.match_count, 0) AS home_form_matches,
        COALESCE(away_recent.ppg, 1.2) AS away_ppg,
        COALESCE(away_recent.goals_for, 1.1) AS away_goals_for,
        COALESCE(away_recent.goals_against, 1.35) AS away_goals_against,
        COALESCE(away_recent.match_count, 0) AS away_form_matches,
        COALESCE(h2h.home_ppg, 1.5) AS h2h_home_ppg,
        COALESCE(h2h.home_goal_diff, 0) AS h2h_home_goal_diff,
        COALESCE(h2h.match_count, 0) AS h2h_matches,
        COALESCE(league_recent.avg_home_goals, 1.35) AS league_home_goals,
        COALESCE(league_recent.avg_away_goals, 1.1) AS league_away_goals,
        COALESCE(league_recent.avg_total_goals, 2.45) AS league_total_goals,
        COALESCE(league_recent.match_count, 0) AS league_match_count,
        0::numeric AS availability_home,
        0::numeric AS availability_away
      FROM target_matches tm
      LEFT JOIN LATERAL (
        SELECT
          SUM(weight * points)::numeric / NULLIF(SUM(weight), 0) AS ppg,
          SUM(weight * goals_for)::numeric / NULLIF(SUM(weight), 0) AS goals_for,
          SUM(weight * goals_against)::numeric / NULLIF(SUM(weight), 0) AS goals_against,
          COUNT(*)::int AS match_count
        FROM (
          SELECT
            ${weightHome} AS weight,
            CASE
              WHEN recent.home_team = tm.home_team AND recent.home_score > recent.away_score THEN 3
              WHEN recent.away_team = tm.home_team AND recent.away_score > recent.home_score THEN 3
              WHEN recent.home_score = recent.away_score THEN 1
              ELSE 0
            END AS points,
            CASE
              WHEN recent.home_team = tm.home_team THEN recent.home_score
              ELSE recent.away_score
            END AS goals_for,
            CASE
              WHEN recent.home_team = tm.home_team THEN recent.away_score
              ELSE recent.home_score
            END AS goals_against
          FROM (
            SELECT
              m2.match_id,
              m2.home_team,
              m2.away_team,
              m2.home_score,
              m2.away_score,
              ROW_NUMBER() OVER (
                ORDER BY COALESCE(m2.match_date, DATE '0001-01-01') DESC,
                         COALESCE(m2.match_time, TIME '00:00:00') DESC,
                         m2.match_id DESC
              ) AS rn
            FROM matches m2
            WHERE (m2.home_team = tm.home_team OR m2.away_team = tm.home_team)
              AND m2.home_score IS NOT NULL
              AND m2.away_score IS NOT NULL
              AND ${priorTarget}
            ORDER BY COALESCE(m2.match_date, DATE '0001-01-01') DESC,
                     COALESCE(m2.match_time, TIME '00:00:00') DESC,
                     m2.match_id DESC
            LIMIT 6
          ) recent
        ) weighted
      ) home_recent ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM(weight * points)::numeric / NULLIF(SUM(weight), 0) AS ppg,
          SUM(weight * goals_for)::numeric / NULLIF(SUM(weight), 0) AS goals_for,
          SUM(weight * goals_against)::numeric / NULLIF(SUM(weight), 0) AS goals_against,
          COUNT(*)::int AS match_count
        FROM (
          SELECT
            ${weightAway} AS weight,
            CASE
              WHEN recent.home_team = tm.away_team AND recent.home_score > recent.away_score THEN 3
              WHEN recent.away_team = tm.away_team AND recent.away_score > recent.home_score THEN 3
              WHEN recent.home_score = recent.away_score THEN 1
              ELSE 0
            END AS points,
            CASE
              WHEN recent.home_team = tm.away_team THEN recent.home_score
              ELSE recent.away_score
            END AS goals_for,
            CASE
              WHEN recent.home_team = tm.away_team THEN recent.away_score
              ELSE recent.home_score
            END AS goals_against
          FROM (
            SELECT
              m2.match_id,
              m2.home_team,
              m2.away_team,
              m2.home_score,
              m2.away_score,
              ROW_NUMBER() OVER (
                ORDER BY COALESCE(m2.match_date, DATE '0001-01-01') DESC,
                         COALESCE(m2.match_time, TIME '00:00:00') DESC,
                         m2.match_id DESC
              ) AS rn
            FROM matches m2
            WHERE (m2.home_team = tm.away_team OR m2.away_team = tm.away_team)
              AND m2.home_score IS NOT NULL
              AND m2.away_score IS NOT NULL
              AND ${priorTarget}
            ORDER BY COALESCE(m2.match_date, DATE '0001-01-01') DESC,
                     COALESCE(m2.match_time, TIME '00:00:00') DESC,
                     m2.match_id DESC
            LIMIT 6
          ) recent
        ) weighted
      ) away_recent ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM(weight * home_points)::numeric / NULLIF(SUM(weight), 0) AS home_ppg,
          SUM(weight * home_goal_diff)::numeric / NULLIF(SUM(weight), 0) AS home_goal_diff,
          COUNT(*)::int AS match_count
        FROM (
          SELECT
            ${weightH2h} AS weight,
            CASE
              WHEN recent.home_team = tm.home_team AND recent.home_score > recent.away_score THEN 3
              WHEN recent.away_team = tm.home_team AND recent.away_score > recent.home_score THEN 3
              WHEN recent.home_score = recent.away_score THEN 1
              ELSE 0
            END AS home_points,
            CASE
              WHEN recent.home_team = tm.home_team THEN recent.home_score - recent.away_score
              ELSE recent.away_score - recent.home_score
            END AS home_goal_diff
          FROM (
            SELECT
              m2.match_id,
              m2.home_team,
              m2.away_team,
              m2.home_score,
              m2.away_score,
              ROW_NUMBER() OVER (
                ORDER BY COALESCE(m2.match_date, DATE '0001-01-01') DESC,
                         COALESCE(m2.match_time, TIME '00:00:00') DESC,
                         m2.match_id DESC
              ) AS rn
            FROM matches m2
            WHERE (
              (m2.home_team = tm.home_team AND m2.away_team = tm.away_team)
              OR (m2.home_team = tm.away_team AND m2.away_team = tm.home_team)
            )
              AND m2.home_score IS NOT NULL
              AND m2.away_score IS NOT NULL
              AND ${priorTarget}
            ORDER BY COALESCE(m2.match_date, DATE '0001-01-01') DESC,
                     COALESCE(m2.match_time, TIME '00:00:00') DESC,
                     m2.match_id DESC
            LIMIT 5
          ) recent
        ) weighted
      ) h2h ON true
      LEFT JOIN LATERAL (
        SELECT
          AVG(recent.home_score)::numeric AS avg_home_goals,
          AVG(recent.away_score)::numeric AS avg_away_goals,
          AVG((recent.home_score + recent.away_score)::numeric) AS avg_total_goals,
          COUNT(*)::int AS match_count
        FROM (
          SELECT
            m2.home_score,
            m2.away_score
          FROM matches m2
          WHERE m2.league = tm.league
            AND COALESCE(m2.season, '') = COALESCE(tm.season, '')
            AND m2.home_score IS NOT NULL
            AND m2.away_score IS NOT NULL
            AND ${priorTarget}
          ORDER BY COALESCE(m2.match_date, DATE '0001-01-01') DESC,
                   COALESCE(m2.match_time, TIME '00:00:00') DESC,
                   m2.match_id DESC
          LIMIT 400
        ) recent
      ) league_recent ON true
      ORDER BY tm.match_date ${orderDir} NULLS LAST, tm.match_time ${orderDir} NULLS LAST, tm.match_id ${orderDir}
    `,
  };
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

app.get("/api/debug", async (req, res, next) => {
  try {
    const query = req.query.q || "SELECT m.match_id, mac.bookmaker FROM matches m INNER JOIN match_all_columns mac ON m.match_id = mac.match_id LIMIT 5";
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/stats/overview", async (req, res, next) => {
  try {
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const values = [];
    const filters = buildBaseFilters(req.query, values);
    const { oddsFilters } = buildOddsFilters(req.query, bookmaker, values);
    values.push(bookmaker);
    const bmIdx = values.length;
    filters.push(`mac.bookmaker = $${bmIdx}`);
    for (const f of oddsFilters) filters.push(f);
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const sql = `
      SELECT
        COUNT(*)::int AS total_matches,
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

app.get("/api/matches", async (req, res, next) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, Math.min(config.dashboardPageSize, 100)), 100);
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const orderDir = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const cursorDate = (req.query.cursorDate || "").trim();
    const cursorTime = (req.query.cursorTime || "").trim();
    const cursorId = (req.query.cursorId || "").trim();
    const sortDateExpr = orderDir === "ASC"
      ? "COALESCE(m.match_date, DATE '9999-12-31')"
      : "COALESCE(m.match_date, DATE '0001-01-01')";
    const sortTimeExpr = orderDir === "ASC"
      ? "COALESCE(m.match_time, TIME '23:59:59.999999')"
      : "COALESCE(m.match_time, TIME '00:00:00')";
    const cursorComparator = orderDir === "ASC" ? ">" : "<";

    const values = [];
    const filters = buildBaseFilters(req.query, values);
    const { oddsFilters } = buildOddsFilters(req.query, bookmaker, values);

    values.push(bookmaker);
    const bmIdx = values.length;
    const allFilters = [...filters, `mac.bookmaker = $${bmIdx}`, ...oddsFilters];

    if (cursorId) {
      values.push(normalizeCursorDate(cursorDate, orderDir));
      const cursorDateIdx = values.length;
      values.push(normalizeCursorTime(cursorTime, orderDir));
      const cursorTimeIdx = values.length;
      values.push(cursorId);
      const cursorIdIdx = values.length;
      allFilters.push(
        `(${sortDateExpr}, ${sortTimeExpr}, m.match_id) ${cursorComparator} ($${cursorDateIdx}::date, $${cursorTimeIdx}::time, $${cursorIdIdx})`,
      );
    }

    const whereClause = allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : "";

    const dataValues = [...values, limit + 1];
    const dataSql = `
      SELECT
        m.match_id, m.country, m.league, m.season, m.round_no,
        m.match_date, m.match_time, m.home_team, m.away_team,
        m.home_score, m.away_score, m.full_time_result, m.scraped_at,
        CASE
          WHEN m.match_time IS NOT NULL THEN TO_CHAR(m.match_time, 'HH24:MI')
          ELSE mac.raw_data->>'SAAT'
        END AS match_time_display,
        mac.raw_data->>'İY' AS iy,
        (mac.raw_data->>'opening_${bookmaker}_home')::numeric AS opening_odds_1,
        (mac.raw_data->>'opening_${bookmaker}_draw')::numeric AS opening_odds_x,
        (mac.raw_data->>'opening_${bookmaker}_away')::numeric AS opening_odds_2,
        (mac.raw_data->>'opening_${bookmaker}_2_5_over')::numeric AS opening_odds_ou25_over,
        (mac.raw_data->>'opening_${bookmaker}_2_5_under')::numeric AS opening_odds_ou25_under,
        (mac.raw_data->>'${bookmaker}_home')::numeric AS closing_odds_1,
        (mac.raw_data->>'${bookmaker}_draw')::numeric AS closing_odds_x,
        (mac.raw_data->>'${bookmaker}_away')::numeric AS closing_odds_2,
        (mac.raw_data->>'${bookmaker}_2_5_over')::numeric AS closing_odds_ou25_over,
        (mac.raw_data->>'${bookmaker}_2_5_under')::numeric AS closing_odds_ou25_under,
        ${sortDateExpr} AS sort_match_date,
        ${sortTimeExpr} AS sort_match_time
      FROM matches m
      INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
      ${whereClause}
      ORDER BY ${sortDateExpr} ${orderDir}, ${sortTimeExpr} ${orderDir}, m.match_id ${orderDir}
      LIMIT $${dataValues.length}
    `;

    const dataResult = await db.query(dataSql, dataValues);
    const hasMore = dataResult.rows.length > limit;
    const pageRows = hasMore ? dataResult.rows.slice(0, limit) : dataResult.rows;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow
      ? {
        date: lastRow.sort_match_date,
        time: lastRow.sort_match_time,
        id: lastRow.match_id,
      }
      : null;
    const processedRows = pageRows.map(({ sort_match_date, sort_match_time, ...row }) => row);

    res.json({
      limit,
      data: processedRows,
      page_count: processedRows.length,
      has_more: hasMore,
      next_cursor: nextCursor,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/matches/:matchId", async (req, res, next) => {
  try {
    const result = await db.query(
      `
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
        source_url,
        scraped_at
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
app.get("/api/model/analysis", async (req, res, next) => {
  try {
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const limit = Math.min(toPositiveInt(req.query.limit, 50), 100);
    const { sql, values } = buildPredictionFeatureQuery(req.query, bookmaker, limit, false);
    const result = await db.query(sql, values);
    const predictions = result.rows.map(createPrediction);

    res.json({
      model: {
        id: "poisson_form_market_blend_v1",
        name: "Poisson + Form + Market Blend",
        weights: MODEL_WEIGHTS,
      },
      bookmaker,
      limit,
      data: predictions,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/model/backtest", async (req, res, next) => {
  try {
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const limit = Math.min(toPositiveInt(req.query.limit, 200), 400);
    const { sql, values } = buildPredictionFeatureQuery(req.query, bookmaker, limit, true);
    const result = await db.query(sql, values);
    const predictions = result.rows.map(createPrediction);
    const summary = backtestSummary(predictions);

    res.json({
      model: {
        id: "poisson_form_market_blend_v1",
        name: "Poisson + Form + Market Blend",
        weights: MODEL_WEIGHTS,
      },
      bookmaker,
      limit,
      summary,
      data: predictions,
    });
  } catch (error) {
    next(error);
  }
});

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
