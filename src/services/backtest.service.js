/**
 * Backtest service.
 * Compares Poisson model predictions against Excel benchmark values.
 * Uses field-level tolerance comparison (default 0.005).
 */

const { predictMatch } = require("./poisson.service");

const DEFAULT_FIELDS = [
  "totalLambda",
  "favoriteShareAlpha",
  "homeLambda",
  "awayLambda",
  "modelBTTS",
  "modelOver25",
  "coverage05",
  "favoriteSide",
  "roundedScore",
];

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function compareField(expected, actual, tolerance) {
  if (isFiniteNumber(expected) && isFiniteNumber(actual)) {
    const diff = Math.abs(actual - expected);
    return {
      expected,
      actual,
      diff,
      pass: diff <= tolerance,
    };
  }

  return {
    expected,
    actual,
    diff: null,
    pass: expected === actual,
  };
}

/**
 * Run backtest against benchmark data.
 * @param {Object} options
 * @param {Array} options.benchmarkRows - Array of { id?, input, expected }
 * @param {number} [options.tolerance=0.005] - Maximum allowed absolute diff
 * @param {string[]} [options.fields] - Fields to compare
 * @returns {Object} Backtest summary + detailed results
 */
function runBacktest({ benchmarkRows, tolerance = 0.005, fields = DEFAULT_FIELDS }) {
  if (!Array.isArray(benchmarkRows) || benchmarkRows.length === 0) {
    throw new Error("benchmarkRows must be a non-empty array");
  }

  const results = benchmarkRows.map((row, index) => {
    if (!row.input || !row.expected) {
      throw new Error(`benchmark row ${index + 1} must contain input and expected`);
    }

    const predicted = predictMatch(row.input);
    const { scoreMatrix, ...actual } = predicted;

    const comparisons = {};
    let pass = true;

    for (const field of fields) {
      if (!(field in row.expected)) continue;

      const cmp = compareField(row.expected[field], actual[field], tolerance);
      comparisons[field] = cmp;

      if (!cmp.pass) pass = false;
    }

    return {
      id: row.id ?? `row-${index + 1}`,
      homeTeam: row.input.homeTeam ?? null,
      awayTeam: row.input.awayTeam ?? null,
      pass,
      comparisons,
      actual,
    };
  });

  const passed = results.filter((x) => x.pass).length;
  const failed = results.length - passed;

  return {
    tolerance,
    total: results.length,
    passed,
    failed,
    passRate: results.length ? passed / results.length : 0,
    results,
  };
}

module.exports = {
  runBacktest,
};
