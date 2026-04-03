/**
 * Core Poisson math functions.
 * Ported from Excel POISSON sheet: lambda lookup, alpha solver, score matrix.
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Poisson probability mass function: P(X = k) for given lambda.
 */
function poissonPmf(k, lambda) {
  if (k < 0) return 0;
  let result = Math.exp(-lambda);
  for (let i = 1; i <= k; i += 1) {
    result *= lambda / i;
  }
  return result;
}

/**
 * Poisson cumulative distribution function: P(X <= k) for given lambda.
 */
function poissonCdf(k, lambda) {
  let sum = 0;
  for (let i = 0; i <= k; i += 1) {
    sum += poissonPmf(i, lambda);
  }
  return sum;
}

/**
 * P(total goals > 2.5) = 1 - P(X <= 2).
 */
function over25Prob(lambda) {
  return 1 - poissonCdf(2, lambda);
}

/**
 * Build lookup grid: lambda 0.10 → 7.00 (step 0.01) with over2.5 probability.
 * Mirrors Excel POISSON!D6:E18 lookup table.
 */
function buildLambdaLookup() {
  const rows = [];
  for (let i = 10; i <= 700; i += 1) {
    const lambda = i / 100;
    rows.push({
      lambda,
      over25: over25Prob(lambda),
    });
  }
  return rows;
}

const lambdaLookup = buildLambdaLookup();

/**
 * Find totalLambda from normOver25 using floor-match.
 * Mirrors Excel MATCH(normOver25, over25Column, 1) behavior:
 * finds the largest lambda whose over25Prob <= normOver25.
 */
function lookupTotalLambda(normOver25) {
  let match = lambdaLookup[0].lambda;

  for (const row of lambdaLookup) {
    if (row.over25 <= normOver25) {
      match = row.lambda;
    } else {
      break;
    }
  }

  return match;
}

/**
 * Solve favorite share alpha from BTTS-implied equation.
 * Mirrors Excel POISSON_LISTE alpha column logic.
 *
 * If normBttsYes > 0:
 *   term = 1 + exp(-totalLambda) - normBttsYes
 *   disc = max(0, term² - 4·exp(-totalLambda))
 *   root = (term - √disc) / 2
 *   alphaRaw = -ln(root) / totalLambda
 * Else:
 *   alphaRaw = max(normHome, normAway) / (normHome + normAway)
 *
 * Clamp result to [0.50, 0.95].
 */
function solveAlpha(totalLambda, normBttsYes, normHome, normAway) {
  let alphaRaw;

  if (normBttsYes > 0) {
    const expNegT = Math.exp(-totalLambda);
    const term = 1 + expNegT - normBttsYes;
    const disc = Math.max(0, term * term - 4 * expNegT);
    const root = (term - Math.sqrt(disc)) / 2;
    alphaRaw = root > 0 ? -Math.log(root) / totalLambda : 0.5;
  } else {
    alphaRaw = Math.max(normHome, normAway) / (normHome + normAway);
  }

  return clamp(alphaRaw, 0.5, 0.95);
}

/**
 * Build 0..maxGoals × 0..maxGoals score matrix.
 * Each cell = P(homeGoals) × P(awayGoals) using independent Poisson.
 * Mirrors Excel POISSON!G6:M13 matrix.
 */
function buildScoreMatrix(homeLambda, awayLambda, maxGoals = 5) {
  const matrix = [];

  for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
    const row = [];
    for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
      row.push({
        homeGoals,
        awayGoals,
        probability:
          poissonPmf(homeGoals, homeLambda) *
          poissonPmf(awayGoals, awayLambda),
      });
    }
    matrix.push(row);
  }

  return matrix;
}

module.exports = {
  poissonPmf,
  poissonCdf,
  over25Prob,
  lookupTotalLambda,
  solveAlpha,
  buildScoreMatrix,
  lambdaLookup,
};
