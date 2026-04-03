/**
 * Poisson prediction service.
 * Orchestrates the full pipeline: parse odds → normalize → totalLambda →
 * alpha → home/away lambda → model outputs → score matrix.
 *
 * Mirrors POISSON_LISTE!A3:AB1003 chain:
 *   Norm O2.5 P → Toplam λ → Favori Payı α → Ev/Dep λ
 */

const {
  parseOdd,
  normalizeTwoWay,
  normalizeThreeWay,
} = require("../lib/odds");

const {
  poissonCdf,
  lookupTotalLambda,
  solveAlpha,
  buildScoreMatrix,
} = require("../lib/poisson");

/**
 * Run full prediction for a single match.
 * @param {Object} payload - Match odds input
 * @returns {Object} Full prediction output
 */
function predictMatch(payload) {
  // 1) Parse all odds (handles comma/dot separators, validates > 1)
  const ftOver25 = parseOdd(payload.ftOver25, "ftOver25");
  const ftUnder25 = parseOdd(payload.ftUnder25, "ftUnder25");
  const bttsYes = parseOdd(payload.bttsYes, "bttsYes");
  const bttsNo = parseOdd(payload.bttsNo, "bttsNo");
  const homeOdd = parseOdd(payload.homeOdd, "homeOdd");
  const drawOdd = parseOdd(payload.drawOdd, "drawOdd");
  const awayOdd = parseOdd(payload.awayOdd, "awayOdd");

  // 2) Normalize implied probabilities
  const normalizedOU = normalizeTwoWay(ftOver25, ftUnder25);
  const normalizedBTTS = normalizeTwoWay(bttsYes, bttsNo);
  const normalized1X2 = normalizeThreeWay(homeOdd, drawOdd, awayOdd);

  // 3) totalLambda via lookup grid (Excel MATCH floor behavior)
  const totalLambda = lookupTotalLambda(normalizedOU.a);

  // 4) Favorite side
  const favoriteSide = normalized1X2.home >= normalized1X2.away ? "EV" : "DEP";

  // 5) Favorite share alpha (BTTS-implied equation or fallback)
  const favoriteShareAlpha = solveAlpha(
    totalLambda,
    normalizedBTTS.a,
    normalized1X2.home,
    normalized1X2.away,
  );

  // 6) Home lambda
  const homeLambda =
    favoriteSide === "EV"
      ? totalLambda * favoriteShareAlpha
      : totalLambda * (1 - favoriteShareAlpha);

  // 7) Away lambda
  const awayLambda = totalLambda - homeLambda;

  // 8) Model BTTS probability
  const modelBTTS =
    1 -
    Math.exp(-homeLambda) -
    Math.exp(-awayLambda) +
    Math.exp(-(homeLambda + awayLambda));

  // 9) Model Over 2.5 probability
  const modelOver25 = 1 - poissonCdf(2, homeLambda + awayLambda);

  // 10) Coverage 0-5 (probability both teams score 0-5)
  const coverage05 = poissonCdf(5, homeLambda) * poissonCdf(5, awayLambda);

  // 11) Rounded expected score
  const roundedScore = `${Math.round(homeLambda)}-${Math.round(awayLambda)}`;

  // 12) Full score matrix (6x6)
  const scoreMatrix = buildScoreMatrix(homeLambda, awayLambda, 5);

  return {
    homeTeam: payload.homeTeam || null,
    awayTeam: payload.awayTeam || null,
    normalized: {
      over25: normalizedOU.a,
      bttsYes: normalizedBTTS.a,
      home: normalized1X2.home,
      draw: normalized1X2.draw,
      away: normalized1X2.away,
    },
    totalLambda,
    favoriteShareAlpha,
    favoriteSide,
    homeLambda,
    awayLambda,
    modelBTTS,
    modelOver25,
    coverage05,
    roundedScore,
    scoreMatrix,
  };
}

module.exports = {
  predictMatch,
};
