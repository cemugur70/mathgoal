/**
 * Odds parsing and normalization utilities.
 * Ported from Excel POISSON_LISTE workbook logic.
 */

function parseOdd(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${fieldName} is required`);
  }

  const normalized = String(value).trim().replace(/\s+/g, "").replace(",", ".");
  const num = Number(normalized);

  if (!Number.isFinite(num) || num <= 1) {
    throw new Error(`${fieldName} must be a decimal odd > 1`);
  }

  return num;
}

/**
 * Normalize two-way market (e.g. O/U 2.5, BTTS Yes/No).
 * Returns implied probabilities summing to 1.
 */
function normalizeTwoWay(a, b) {
  const pa = 1 / a;
  const pb = 1 / b;
  const denom = pa + pb;

  return {
    a: pa / denom,
    b: pb / denom,
  };
}

/**
 * Normalize three-way market (1X2).
 * Returns implied probabilities summing to 1.
 */
function normalizeThreeWay(home, draw, away) {
  const ph = 1 / home;
  const pd = 1 / draw;
  const pa = 1 / away;
  const denom = ph + pd + pa;

  return {
    home: ph / denom,
    draw: pd / denom,
    away: pa / denom,
  };
}

module.exports = {
  parseOdd,
  normalizeTwoWay,
  normalizeThreeWay,
};
