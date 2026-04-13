const path = require("node:path");
const express = require("express");
const cors = require("cors");

const pino = require("pino");
const pinoHttp = require("pino-http");
const { exec } = require("child_process");
const config = require("./config");
const db = require("./db");
const { ALL_COLUMNS, mapRawToColumns } = require("./columns-map");
const predictRoutes = require("./routes/predict.routes");
const backtestRoutes = require("./routes/backtest.routes");
const {
  buildPredictionInput,
  buildModelCalculationPayload,
  syncModelCalculationCache,
  isModelCalculationFresh,
} = require("./services/model-calculation.service");

const app = express();
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

app.use(express.json({ limit: "10mb" }));
app.use(cors());

app.use("/api/predict", predictRoutes);
app.use("/api/backtest", backtestRoutes);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/api/admin/start-backfill", requireIngestKey, (req, res) => {
  res.status(405).json({ message: "POST kullanin." });
});

app.post("/api/admin/start-backfill", requireIngestKey, (req, res) => {
  if (isBackfillRunning) {
    return res.status(409).json({ message: "Islem zaten devam ediyor." });
  }

  isBackfillRunning = true;
  exec("npm run backfill", (err) => {
    isBackfillRunning = false;
    if (err) {
      console.error("Backfill Error:", err);
    }
    console.log("Backfill Finished");
  });

  res.json({ ok: true, message: "Backfill arka planda baslatildi." });
});

let isBackfillRunning = false;
app.get("/api/admin/start-backfill", (req, res) => {
  if (isBackfillRunning) return res.send("Ä°ÅŸlem zaten devam ediyor...");
  isBackfillRunning = true;
  exec("npm run backfill", (err, stdout, stderr) => {
    isBackfillRunning = false;
    if (err) console.error("Backfill Error:", err);
    console.log("Backfill Finished");
  });
  res.send("âœ… Geriye DÃ¶nÃ¼k Hesaplama (Backfill) arka planda baÅŸlatÄ±ldÄ±! YaklaÅŸÄ±k 15-20 dakika iÃ§inde tÃ¼m 1 Milyon maÃ§Ä±n tahminleri veritabanÄ±na kaydedilecektir. LÃ¼tfen bu sekmeyi kapatÄ±n ve bekleyin.");
});

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

// â”€â”€â”€ Shared: Odds range filter builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

app.get("/api/debug", requireIngestKey, async (req, res) => {
  try {
    const query =
      req.query.q ||
      "SELECT m.match_id, mac.bookmaker FROM matches m INNER JOIN match_all_columns mac ON m.match_id = mac.match_id LIMIT 5";
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/debug", requireIngestKey, async (req, res) => {
  try {
    const query =
      req.body?.q ||
      "SELECT m.match_id, mac.bookmaker FROM matches m INNER JOIN match_all_columns mac ON m.match_id = mac.match_id LIMIT 5";
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        mac.raw_data->>'Ä°Y' AS iy,
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

// â”€â”€â”€ Matches Model Endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MODEL_INPUT_SUFFIXES = {
  homeOdd: ["home"],
  drawOdd: ["draw"],
  awayOdd: ["away"],
  ftOver25: ["2_5_over"],
  ftUnder25: ["2_5_under"],
  bttsYes: ["yes", "btts_yes", "btts_true"],
  bttsNo: ["no", "btts_no", "btts_false"],
};

function getBookmakerKeyVariants(bookmaker) {
  const normalized = String(bookmaker || "").trim().replace(/[^a-zA-Z0-9]/g, "");
  const variants = [normalized, normalized.toLowerCase()].filter(Boolean);
  return Array.from(new Set(variants));
}

function getModelCandidateKeys(bookmaker, suffix, oddsType = "closing") {
  const phases = oddsType === "opening" ? ["opening", "closing"] : ["closing", "opening"];
  const variants = getBookmakerKeyVariants(bookmaker);
  const keys = [];

  for (const phase of phases) {
    for (const variant of variants) {
      keys.push(phase === "opening" ? `opening_${variant}_${suffix}` : `${variant}_${suffix}`);
    }
  }

  return keys;
}

function buildPredictionPresenceSql(alias, bookmaker, oddsType = "closing") {
  const conditions = Object.values(MODEL_INPUT_SUFFIXES).map((suffixes) => {
    const accessors = [];
    for (const suffix of suffixes) {
      for (const key of getModelCandidateKeys(bookmaker, suffix, oddsType)) {
        accessors.push(`${alias}.raw_data->>'${key}'`);
      }
    }
    return accessors.length ? `COALESCE(${accessors.join(", ")}) IS NOT NULL` : "FALSE";
  });

  return conditions.length ? conditions.join(" AND ") : "FALSE";
}

function parseNumericFilter(filterStr, scale = 1) {
  if (!filterStr) return null;
  const t = String(filterStr).trim();
  const numVal = parseFloat(t.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numVal)) return null;

  let operator = null;
  if (t.startsWith(">=")) operator = ">=";
  if (t.startsWith("<=")) operator = "<=";
  if (t.startsWith(">")) operator = ">";
  if (t.startsWith("<")) operator = "<";
  if (t.startsWith("=")) operator = "=";
  if (!operator) return null;

  return { operator, value: numVal * scale };
}

function parseSqlCondition(col, filterStr, values, scale = 1) {
  const parsed = parseNumericFilter(filterStr, scale);
  if (!parsed) return null;

  values.push(parsed.value);
  return `${col} ${parsed.operator} $${values.length}`;
}

/**
 * Model hesaplama filtreleri iÃ§in: dÃ¼z sayÄ± girildiÄŸinde = (tam eÅŸleÅŸme) olarak SQL'e Ã§evir.
 * Ã–rn: "1.22" â†’ mc.home_lambda = 1.22, ">=1.5" â†’ mc.home_lambda >= 1.5
 */
function parseModelSqlCondition(col, filterStr, values, scale = 1) {
  if (!filterStr) return null;
  const t = String(filterStr).trim().replace(/%/g, "");
  if (!t) return null;
  const numVal = parseFloat(t.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numVal)) return null;

  let operator = "=";
  if (t.startsWith(">=")) operator = ">=";
  else if (t.startsWith("<=")) operator = "<=";
  else if (t.startsWith(">")) operator = ">";
  else if (t.startsWith("<")) operator = "<";
  else if (t.startsWith("=")) operator = "=";

  values.push(numVal * scale);
  return `${col} ${operator} $${values.length}`;
}

function matchesNumericFilter(value, filterStr, scale = 1) {
  const parsed = parseNumericFilter(filterStr, scale);
  if (!parsed) return true;

  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return false;

  if (parsed.operator === ">=") return numericValue >= parsed.value;
  if (parsed.operator === "<=") return numericValue <= parsed.value;
  if (parsed.operator === ">") return numericValue > parsed.value;
  if (parsed.operator === "<") return numericValue < parsed.value;
  if (parsed.operator === "=") return numericValue === parsed.value;

  return true;
}

function matchesModelPredictionFilters(row, query) {
  const prediction = row?.prediction || null;
  const favorite = String(query.fFav || "").trim();
  const roundedScore = String(query.fScore || "").trim().toLowerCase();

  if (!matchesNumericFilter(prediction?.homeLambda, query.fHL)) return false;
  if (!matchesNumericFilter(prediction?.awayLambda, query.fAL)) return false;
  if (!matchesNumericFilter(prediction?.totalLambda, query.fTL)) return false;
  if (!matchesNumericFilter(prediction?.modelBTTS, query.fMBTTS, 0.01)) return false;
  if (!matchesNumericFilter(prediction?.modelOver25, query.fMO25, 0.01)) return false;

  if (favorite && prediction?.favoriteSide !== favorite) {
    return false;
  }

  if (roundedScore) {
    const candidateScore = String(prediction?.roundedScore || "").toLowerCase();
    if (!candidateScore.includes(roundedScore)) {
      return false;
    }
  }

  return true;
}

app.get("/api/matches/model", async (req, res, next) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, 100), 500);
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const orderDir = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const sortDateExpr = orderDir === "ASC" ? "COALESCE(m.match_date, DATE '9999-12-31')" : "COALESCE(m.match_date, DATE '0001-01-01')" ;
    const sortTimeExpr = orderDir === "ASC" ? "COALESCE(m.match_time, TIME '23:59:59.999999')" : "COALESCE(m.match_time, TIME '00:00:00')";

    const values = [];
    const filters = buildBaseFilters(req.query, values);
    const { oddsFilters } = buildOddsFilters(req.query, bookmaker, values);

    values.push(bookmaker);
    const bmIdx = values.length;
    const allFilters = [...filters, `mac.bookmaker = $${bmIdx}`, ...oddsFilters];

    // Model filters — always LEFT JOIN so unbackfilled rows are still reachable.
    // Model-specific filters applied in-memory after on-the-fly prediction so ALL
    // 242k calculable matches are searchable, not just the backfilled ones.
    const fHL = req.query.fHL;
    const fAL = req.query.fAL;
    const fTL = req.query.fTL;
    const fMBTTS = req.query.fMBTTS;
    const fMO25 = req.query.fMO25;
    const fFav = (req.query.fFav || "").trim();
    const fScore = (req.query.fScore || "").trim();
    const fDate = (req.query.fDate || "").trim();
    const fLeague = (req.query.fLeague || "").trim();
    const fHome = (req.query.fHome || "").trim();
    const fAway = (req.query.fAway || "").trim();
    const f1 = (req.query.f1 || "").trim();
    const fX = (req.query.fX || "").trim();
    const f2 = (req.query.f2 || "").trim();
    const fOU25 = (req.query.fOU25 || "").trim();
    const fBTTS = (req.query.fBTTS || "").trim();

    const hasModelFilters = !!(fHL || fAL || fTL || fMBTTS || fMO25 || fFav || fScore || f1 || fX || f2 || fOU25 || fBTTS);

    // Always LEFT JOIN — never restrict to backfilled rows only
    const modelJoins = `LEFT JOIN model_calculations mc ON m.match_id = mc.match_id AND mc.bookmaker = $${bmIdx} AND mc.odds_type = 'closing'`;

    // SQL-pushable text/date filters
    if (fDate) { values.push(`%${fDate}%`); allFilters.push(`TO_CHAR(m.match_date, 'DD.MM.YYYY') ILIKE $${values.length}`); }
    if (fLeague) { values.push(`%${fLeague}%`); allFilters.push(`m.league ILIKE $${values.length}`); }
    if (fHome) { values.push(`%${fHome}%`); allFilters.push(`m.home_team ILIKE $${values.length}`); }
    if (fAway) { values.push(`%${fAway}%`); allFilters.push(`m.away_team ILIKE $${values.length}`); }

    const whereClause = allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : "";

    // Fetch more rows when model filters active so in-memory filter can find enough matches
    const fetchBatch = hasModelFilters ? Math.min(limit * 50, 10000) : limit;
    values.push(fetchBatch);
    const limitIdx = values.length;

    const dataSql = `
      SELECT
        m.match_id, m.match_date, m.match_time, m.league,
        m.home_team, m.away_team, m.home_score, m.away_score,
        CASE
          WHEN m.match_time IS NOT NULL THEN TO_CHAR(m.match_time, 'HH24:MI')
          ELSE mac.raw_data->>'SAAT'
        END AS match_time_display,
        mac.raw_data,
        mac.scraped_at AS raw_scraped_at,
        mc.home_lambda, mc.away_lambda, mc.total_lambda, mc.model_btts, mc.model_over25, mc.favorite_side, mc.rounded_score,
        mc.source_scraped_at
      FROM matches m
      INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
      ${modelJoins}
      ${whereClause}
      ORDER BY ${sortDateExpr} ${orderDir}, ${sortTimeExpr} ${orderDir}, m.match_id ${orderDir}
      LIMIT $${limitIdx}
    `;

    const dataResult = await db.query(dataSql, values);
    const { rows } = dataResult;

    // Resolve prediction for a row (cached or on-the-fly)
    function getPrediction(r) {
      if (r.home_lambda != null && isModelCalculationFresh(r.source_scraped_at, r.raw_scraped_at)) {
        return {
          homeLambda: parseFloat(r.home_lambda),
          awayLambda: parseFloat(r.away_lambda),
          totalLambda: parseFloat(r.total_lambda),
          modelBTTS: parseFloat(r.model_btts),
          modelOver25: parseFloat(r.model_over25),
          favoriteSide: r.favorite_side,
          roundedScore: r.rounded_score,
        };
      }
      const payload = buildModelCalculationPayload(r.raw_data || {}, bookmaker, "closing");
      if (payload) {
        syncModelCalculationCache(db, {
          matchId: r.match_id, bookmaker,
          rawData: r.raw_data || {}, scrapedAt: r.raw_scraped_at, oddsType: "closing",
        }).catch(() => {});
        return payload.prediction;
      }
      return null;
    }

    // In-memory model filter (supports >=, <=, >, <, = prefixes or plain number = exact)
    function checkModelVal(val, filterStr) {
      if (!filterStr) return true;
      const t = String(filterStr).trim().replace(/%/g, "");
      if (!t) return true;
      const numVal = parseFloat(t.replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(numVal)) return true;
      if (val == null || !Number.isFinite(Number(val))) return false;
      const n = Number(val);
      if (t.startsWith(">=")) return n >= numVal;
      if (t.startsWith("<=")) return n <= numVal;
      if (t.startsWith(">")) return n > numVal;
      if (t.startsWith("<")) return n < numVal;
      if (t.startsWith("=")) return Math.abs(n - numVal) < 0.001;
      return Math.abs(n - numVal) < 0.001; // bare number: exact match
    }

    function passesModelFilter(prediction, predictionInput) {
      if (!hasModelFilters) return true;
      if (f1 && !checkModelVal(predictionInput.homeOdd, f1)) return false;
      if (fX && !checkModelVal(predictionInput.drawOdd, fX)) return false;
      if (f2 && !checkModelVal(predictionInput.awayOdd, f2)) return false;
      if (fOU25 && !checkModelVal(predictionInput.ftOver25, fOU25)) return false;
      if (fBTTS && !checkModelVal(predictionInput.bttsYes, fBTTS)) return false;

      if (!prediction) return false;
      if (fHL && !checkModelVal(prediction.homeLambda, fHL)) return false;
      if (fAL && !checkModelVal(prediction.awayLambda, fAL)) return false;
      if (fTL && !checkModelVal(prediction.totalLambda, fTL)) return false;
      // BTTS/O25 stored as 0..1, frontend sends >=50 meaning >=50%
      if (fMBTTS && !checkModelVal(prediction.modelBTTS != null ? prediction.modelBTTS * 100 : null, fMBTTS)) return false;
      if (fMO25 && !checkModelVal(prediction.modelOver25 != null ? prediction.modelOver25 * 100 : null, fMO25)) return false;
      if (fFav && prediction.favoriteSide !== fFav) return false;
      if (fScore && !String(prediction.roundedScore || "").toLowerCase().includes(fScore.toLowerCase())) return false;
      return true;
    }

    const mapped = [];
    let totalFiltered = 0;

    for (const r of rows) {
      const predictionInput = buildPredictionInput(r.raw_data || {}, bookmaker, "closing");
      const prediction = getPrediction(r);
      const ok = prediction != null;

      if (!passesModelFilter(prediction, predictionInput)) continue;

      totalFiltered++;
      if (mapped.length < limit) {
        mapped.push({
          match_id: r.match_id,
          match_date: r.match_date,
          match_time_display: r.match_time_display,
          league: r.league,
          home_team: r.home_team,
          away_team: r.away_team,
          home_score: r.home_score,
          away_score: r.away_score,
          odds: {
            homeOdd: parseFloat(predictionInput.homeOdd),
            drawOdd: parseFloat(predictionInput.drawOdd),
            awayOdd: parseFloat(predictionInput.awayOdd),
            ftOver25: parseFloat(predictionInput.ftOver25),
            ftUnder25: parseFloat(predictionInput.ftUnder25),
            bttsYes: parseFloat(predictionInput.bttsYes),
            bttsNo: parseFloat(predictionInput.bttsNo),
          },
          prediction,
          ok,
        });
      }
    }

    res.json({
      ok: true,
      data: mapped,
      total_filtered: hasModelFilters ? totalFiltered : null,
      scanned: rows.length,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/model/coverage", async (req, res, next) => {
  try {
    const bookmaker = (req.query.bookmaker || "bet365").trim();
    const values = [];
    const filters = buildBaseFilters(req.query, values);
    const { oddsFilters } = buildOddsFilters(req.query, bookmaker, values);

    values.push(bookmaker);
    const bmIdx = values.length;
    const predictionPresenceSql = buildPredictionPresenceSql("mac", bookmaker, "closing");
    const whereClause = [...filters, `mac.bookmaker = $${bmIdx}`, ...oddsFilters].length
      ? `WHERE ${[...filters, `mac.bookmaker = $${bmIdx}`, ...oddsFilters].join(" AND ")}`
      : "";

    const sql = `
      SELECT
        COUNT(*)::int AS total_matches,
        COUNT(*) FILTER (WHERE ${predictionPresenceSql})::int AS calculable_matches,
        COUNT(*) FILTER (
          WHERE ${predictionPresenceSql}
            AND mc.source_scraped_at IS NOT NULL
            AND mc.source_scraped_at >= mac.scraped_at
        )::int AS backfilled_matches
      FROM matches m
      INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
      LEFT JOIN model_calculations mc
        ON mc.match_id = m.match_id
        AND mc.bookmaker = $${bmIdx}
        AND mc.odds_type = 'closing'
      ${whereClause}
    `;

    const result = await db.query(sql, values);
    res.json(result.rows[0] || {
      total_matches: 0,
      calculable_matches: 0,
      backfilled_matches: 0,
    });
  } catch (error) {
    next(error);
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

        -- MaÃ§ Sonucu (Full Time Result)
        COUNT(*) FILTER (WHERE m.full_time_result = 'MS 1')::int AS ft_home_wins,
        COUNT(*) FILTER (WHERE m.full_time_result = 'MS 0')::int AS ft_draws,
        COUNT(*) FILTER (WHERE m.full_time_result = 'MS 2')::int AS ft_away_wins,

        -- Skor tabanlÄ± istatistikler
        ROUND(AVG(m.home_score)::numeric, 2) AS avg_home_goals,
        ROUND(AVG(m.away_score)::numeric, 2) AS avg_away_goals,
        ROUND(AVG(COALESCE(m.home_score,0) + COALESCE(m.away_score,0))::numeric, 2) AS avg_total_goals,

        -- KG VAR/YOK (BTTS)
        COUNT(*) FILTER (WHERE m.home_score > 0 AND m.away_score > 0)::int AS btts_yes,
        COUNT(*) FILTER (WHERE m.home_score = 0 OR m.away_score = 0)::int AS btts_no,

        -- Alt/Ãœst 2.5
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) > 2)::int AS over_2_5,
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) <= 2)::int AS under_2_5,

        -- Alt/Ãœst 1.5
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) > 1)::int AS over_1_5,
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) <= 1)::int AS under_1_5,

        -- Alt/Ãœst 3.5
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) > 3)::int AS over_3_5,
        COUNT(*) FILTER (WHERE COALESCE(m.home_score,0) + COALESCE(m.away_score,0) <= 3)::int AS under_3_5,

        -- Alt/Ãœst 0.5
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

        -- Tek/Ã‡ift
        COUNT(*) FILTER (WHERE (COALESCE(m.home_score,0) + COALESCE(m.away_score,0)) % 2 = 1)::int AS total_odd,
        COUNT(*) FILTER (WHERE (COALESCE(m.home_score,0) + COALESCE(m.away_score,0)) % 2 = 0)::int AS total_even,

        -- Ã‡ifte Åans
        COUNT(*) FILTER (WHERE m.full_time_result IN ('MS 1', 'MS 0'))::int AS dc_1x,
        COUNT(*) FILTER (WHERE m.full_time_result IN ('MS 0', 'MS 2'))::int AS dc_x2,
        COUNT(*) FILTER (WHERE m.full_time_result IN ('MS 1', 'MS 2'))::int AS dc_12,

        -- Ä°lk yarÄ± gol
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
        "MaÃ§ Sonucu": {
          "Ev KazanÄ±r (1)": { count: row.ft_home_wins, pct: pct(row.ft_home_wins) },
          "Beraberlik (X)": { count: row.ft_draws, pct: pct(row.ft_draws) },
          "Dep. KazanÄ±r (2)": { count: row.ft_away_wins, pct: pct(row.ft_away_wins) },
        },
        "Ã‡ifte Åans": {
          "1X (Ev veya Ber.)": { count: row.dc_1x, pct: pct(row.dc_1x) },
          "X2 (Ber. veya Dep.)": { count: row.dc_x2, pct: pct(row.dc_x2) },
          "12 (Ev veya Dep.)": { count: row.dc_12, pct: pct(row.dc_12) },
        },
        "KG VAR/YOK (BTTS)": {
          "KG VAR": { count: row.btts_yes, pct: pct(row.btts_yes) },
          "KG YOK": { count: row.btts_no, pct: pct(row.btts_no) },
        },
        "Alt/Ãœst 2.5": {
          "2.5 Ãœst": { count: row.over_2_5, pct: pct(row.over_2_5) },
          "2.5 Alt": { count: row.under_2_5, pct: pct(row.under_2_5) },
        },
        "Alt/Ãœst 1.5": {
          "1.5 Ãœst": { count: row.over_1_5, pct: pct(row.over_1_5) },
          "1.5 Alt": { count: row.under_1_5, pct: pct(row.under_1_5) },
        },
        "Alt/Ãœst 3.5": {
          "3.5 Ãœst": { count: row.over_3_5, pct: pct(row.over_3_5) },
          "3.5 Alt": { count: row.under_3_5, pct: pct(row.under_3_5) },
        },
        "Alt/Ãœst 0.5": {
          "0.5 Ãœst": { count: row.over_0_5, pct: pct(row.over_0_5) },
          "0.5 Alt (Gol Yok)": { count: row.under_0_5, pct: pct(row.under_0_5) },
        },
        "Tek/Ã‡ift": {
          "Tek": { count: row.total_odd, pct: pct(row.total_odd) },
          "Ã‡ift": { count: row.total_even, pct: pct(row.total_even) },
        },
        "Gol OrtalamalarÄ±": {
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

// â”€â”€â”€ Ingestion API (Python scraper -> DB via HTTPS) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// POST /api/ingest/batch â€” match_all_columns tablosuna batch upsert
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
        const scrapedAt = new Date();
        await client.query(
          `INSERT INTO match_all_columns (match_id, bookmaker, raw_data, scraped_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (match_id, bookmaker)
           DO UPDATE SET raw_data = $3, scraped_at = $4`,
          [matchId, bookmaker, JSON.stringify(row), scrapedAt],
        );
        await syncModelCalculationCache(client, {
          matchId,
          bookmaker,
          rawData: row,
          scrapedAt,
          oddsType: "closing",
        }).catch(() => null);
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

// POST /api/ingest/sync-matches â€” match_all_columns -> matches senkronizasyonu
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
        raw_data->>'ÃœLKE',
        raw_data->>'LÄ°G',
        raw_data->>'SEZON',
        CASE WHEN raw_data->>'TARÄ°H' ~ '^\\d'
             THEN TO_DATE(raw_data->>'TARÄ°H', 'DD.MM.YYYY')
             ELSE NULL END,
        CASE WHEN raw_data->>'SAAT' ~ '^\\d{1,2}:\\d{2}'
             THEN (raw_data->>'SAAT')::time
             ELSE NULL END,
        raw_data->>'EV SAHÄ°BÄ°',
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
      WHERE raw_data->>'EV SAHÄ°BÄ°' IS NOT NULL
        AND raw_data->>'EV SAHÄ°BÄ°' != ''
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

// GET /api/ingest/status â€” DB durumunu kontrol et
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

// â”€â”€â”€ Poisson Prediction API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api/predict", predictRoutes);
app.use("/api/backtest", backtestRoutes);

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
