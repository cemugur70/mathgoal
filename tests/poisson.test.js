const test = require("node:test");
const assert = require("node:assert/strict");

const { predictMatch } = require("../src/services/poisson.service");
const { runBacktest } = require("../src/services/backtest.service");
const benchmarkRows = require("./fixtures/poisson-benchmark.json");

const TOLERANCE = 0.005;

test("predictMatch returns stable output for first benchmark row", () => {
  const row = benchmarkRows[0];
  const result = predictMatch(row.input);

  assert.ok(Math.abs(result.totalLambda - row.expected.totalLambda) <= TOLERANCE);
  assert.ok(Math.abs(result.favoriteShareAlpha - row.expected.favoriteShareAlpha) <= TOLERANCE);
  assert.ok(Math.abs(result.homeLambda - row.expected.homeLambda) <= TOLERANCE);
  assert.ok(Math.abs(result.awayLambda - row.expected.awayLambda) <= TOLERANCE);
  assert.ok(Math.abs(result.modelBTTS - row.expected.modelBTTS) <= TOLERANCE);
  assert.ok(Math.abs(result.modelOver25 - row.expected.modelOver25) <= TOLERANCE);
  assert.ok(Math.abs(result.coverage05 - row.expected.coverage05) <= TOLERANCE);
  assert.equal(result.favoriteSide, row.expected.favoriteSide);
  assert.equal(result.roundedScore, row.expected.roundedScore);

  assert.equal(result.scoreMatrix.length, 6);
  assert.equal(result.scoreMatrix[0].length, 6);
});

test("runBacktest passes all benchmark rows", () => {
  const result = runBacktest({
    benchmarkRows,
    tolerance: TOLERANCE,
  });

  assert.equal(result.total, benchmarkRows.length);
  assert.equal(result.failed, 0);
  assert.equal(result.passed, benchmarkRows.length);
});

test("runBacktest returns detailed comparisons", () => {
  const result = runBacktest({
    benchmarkRows,
    tolerance: TOLERANCE,
  });

  const first = result.results[0];

  assert.equal(first.pass, true);
  assert.ok(first.comparisons.totalLambda);
  assert.ok(first.comparisons.homeLambda);
  assert.ok(first.comparisons.modelBTTS);
});
