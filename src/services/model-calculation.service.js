const { predictMatch } = require("./poisson.service");

const MODEL_ODDS_FIELDS = {
  homeOdd: ["home"],
  drawOdd: ["draw"],
  awayOdd: ["away"],
  ftOver25: ["2_5_over"],
  ftUnder25: ["2_5_under"],
  bttsYes: ["yes", "btts_yes", "btts_true"],
  bttsNo: ["no", "btts_no", "btts_false"],
};

function isPresentValue(value) {
  return value != null && value !== "" && value !== "-";
}

function bookmakerPrefixes(bookmaker) {
  const value = String(bookmaker || "").trim();
  const variants = [value, value.toLowerCase()].filter(Boolean);
  return Array.from(new Set(variants));
}

function candidateRawKeys(bookmaker, suffix, oddsType) {
  const prefixes = bookmakerPrefixes(bookmaker);
  const phases = oddsType === "opening" ? ["opening", "closing"] : ["closing", "opening"];
  const keys = [];

  for (const phase of phases) {
    for (const prefix of prefixes) {
      keys.push(phase === "opening" ? `opening_${prefix}_${suffix}` : `${prefix}_${suffix}`);
    }
  }

  return keys;
}

function pickRawOdd(rawData, bookmaker, suffixes, oddsType) {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  for (const suffix of suffixes) {
    const keys = candidateRawKeys(bookmaker, suffix, oddsType);
    for (const key of keys) {
      if (isPresentValue(rawData[key])) {
        return rawData[key];
      }
    }
  }

  return null;
}

function buildPredictionInput(rawData, bookmaker, oddsType = "closing") {
  const input = {};
  for (const [field, suffixes] of Object.entries(MODEL_ODDS_FIELDS)) {
    const value = pickRawOdd(rawData, bookmaker, suffixes, oddsType);
    if (value != null) {
      input[field] = value;
    }
  }
  return input;
}

function buildModelCalculationPayload(rawData, bookmaker, oddsType = "closing") {
  const input = buildPredictionInput(rawData, bookmaker, oddsType);

  try {
    const prediction = predictMatch(input);
    return { input, prediction };
  } catch (error) {
    return null;
  }
}

async function syncModelCalculationCache(queryable, params) {
  const {
    matchId,
    bookmaker,
    rawData,
    scrapedAt,
    oddsType = "closing",
  } = params;

  const payload = buildModelCalculationPayload(rawData, bookmaker, oddsType);
  if (!payload) {
    await queryable.query(
      `DELETE FROM model_calculations
       WHERE match_id = $1 AND bookmaker = $2 AND odds_type = $3`,
      [matchId, bookmaker, oddsType],
    );
    return null;
  }

  const { prediction } = payload;
  await queryable.query(
    `
      INSERT INTO model_calculations (
        match_id,
        bookmaker,
        odds_type,
        home_lambda,
        away_lambda,
        total_lambda,
        model_btts,
        model_over25,
        favorite_side,
        rounded_score,
        source_scraped_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (match_id, bookmaker, odds_type) DO UPDATE SET
        home_lambda = EXCLUDED.home_lambda,
        away_lambda = EXCLUDED.away_lambda,
        total_lambda = EXCLUDED.total_lambda,
        model_btts = EXCLUDED.model_btts,
        model_over25 = EXCLUDED.model_over25,
        favorite_side = EXCLUDED.favorite_side,
        rounded_score = EXCLUDED.rounded_score,
        source_scraped_at = EXCLUDED.source_scraped_at,
        updated_at = NOW()
    `,
    [
      matchId,
      bookmaker,
      oddsType,
      prediction.homeLambda,
      prediction.awayLambda,
      prediction.totalLambda,
      prediction.modelBTTS,
      prediction.modelOver25,
      prediction.favoriteSide,
      prediction.roundedScore,
      scrapedAt || null,
    ],
  );

  return payload;
}

function isModelCalculationFresh(modelSourceScrapedAt, rawScrapedAt) {
  if (!modelSourceScrapedAt) {
    return false;
  }
  if (!rawScrapedAt) {
    return true;
  }

  const modelTs = new Date(modelSourceScrapedAt).getTime();
  const rawTs = new Date(rawScrapedAt).getTime();
  if (!Number.isFinite(modelTs) || !Number.isFinite(rawTs)) {
    return false;
  }
  return modelTs >= rawTs;
}

module.exports = {
  buildPredictionInput,
  buildModelCalculationPayload,
  syncModelCalculationCache,
  isModelCalculationFresh,
};
