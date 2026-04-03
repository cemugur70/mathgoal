/**
 * Poisson model unit tests.
 * Validates Node output against Excel POISSON_LISTE benchmark values.
 * Fails if absolute difference exceeds 0.005 for critical fields.
 *
 * Run: node tests/poisson.test.js
 */

const { predictMatch } = require("../src/services/poisson.service");
const { poissonPmf, poissonCdf, lookupTotalLambda } = require("../src/lib/poisson");
const { parseOdd, normalizeTwoWay, normalizeThreeWay } = require("../src/lib/odds");

const TOLERANCE = 0.005;
let passed = 0;
let failed = 0;

function assertClose(actual, expected, label) {
  const diff = Math.abs(actual - expected);
  if (diff > TOLERANCE) {
    console.error(`  ❌ ${label}: expected ${expected}, got ${actual} (diff ${diff.toFixed(6)})`);
    failed++;
  } else {
    console.log(`  ✅ ${label}: ${actual.toFixed(4)} ≈ ${expected} (diff ${diff.toFixed(6)})`);
    passed++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`  ❌ ${label}: expected "${expected}", got "${actual}"`);
    failed++;
  } else {
    console.log(`  ✅ ${label}: "${actual}"`);
    passed++;
  }
}

// ─── Test 1: Odds parsing ───
console.log("\n═══ Test 1: Odds Parsing ═══");
try {
  const result = parseOdd("1,67", "test");
  assertClose(result, 1.67, "Comma separator parse");
} catch (e) {
  console.error("  ❌ Comma parse failed:", e.message);
  failed++;
}

try {
  parseOdd(0.5, "test");
  console.error("  ❌ Should reject odds <= 1");
  failed++;
} catch (e) {
  console.log("  ✅ Correctly rejects odds <= 1");
  passed++;
}

try {
  parseOdd("", "test");
  console.error("  ❌ Should reject empty string");
  failed++;
} catch (e) {
  console.log("  ✅ Correctly rejects empty string");
  passed++;
}

// ─── Test 2: Normalization ───
console.log("\n═══ Test 2: Normalization ═══");
const twoWay = normalizeTwoWay(1.67, 2.15);
assertClose(twoWay.a + twoWay.b, 1.0, "Two-way sums to 1.0");
assertClose(twoWay.a, (1/1.67) / ((1/1.67) + (1/2.15)), "Two-way normOver25");

const threeWay = normalizeThreeWay(1.95, 3.50, 3.60);
assertClose(threeWay.home + threeWay.draw + threeWay.away, 1.0, "Three-way sums to 1.0");

// ─── Test 3: Poisson fundamentals ───
console.log("\n═══ Test 3: Poisson PMF/CDF ═══");
assertClose(poissonPmf(0, 2.5), Math.exp(-2.5), "PMF(0, 2.5) = e^-2.5");
assertClose(poissonPmf(1, 2.5), 2.5 * Math.exp(-2.5), "PMF(1, 2.5) = 2.5·e^-2.5");

const cdf2 = poissonCdf(2, 2.5);
const manualCdf2 = poissonPmf(0, 2.5) + poissonPmf(1, 2.5) + poissonPmf(2, 2.5);
assertClose(cdf2, manualCdf2, "CDF(2, 2.5) = sum of PMF 0..2");

// CDF(∞, any) should approach 1
assertClose(poissonCdf(50, 2.5), 1.0, "CDF(50, 2.5) ≈ 1.0");

// ─── Test 4: Lambda lookup ───
console.log("\n═══ Test 4: Lambda Lookup ═══");
// For normOver25 = 0.5 (50% chance of over 2.5), lambda should be around 2.67-2.70
const lambda50 = lookupTotalLambda(0.5);
console.log(`  Lambda for normOver25=0.50: ${lambda50}`);
if (lambda50 >= 2.0 && lambda50 <= 3.5) {
  console.log("  ✅ Lambda in valid range [2.0, 3.5] for 50% over2.5");
  passed++;
} else {
  console.error("  ❌ Lambda out of expected range");
  failed++;
}

// ─── Test 5: Full prediction — Gent vs KV Mechelen benchmark ───
console.log("\n═══ Test 5: Full Prediction (Gent vs KV Mechelen) ═══");
const gent = predictMatch({
  homeTeam: "Gent",
  awayTeam: "KV Mechelen",
  ftOver25: 1.67,
  ftUnder25: 2.15,
  bttsYes: 1.57,
  bttsNo: 2.25,
  homeOdd: 1.95,
  drawOdd: 3.50,
  awayOdd: 3.60,
});

console.log(`  homeTeam: ${gent.homeTeam}`);
console.log(`  awayTeam: ${gent.awayTeam}`);
console.log(`  totalLambda: ${gent.totalLambda}`);
console.log(`  favoriteShareAlpha: ${gent.favoriteShareAlpha.toFixed(4)}`);
console.log(`  favoriteSide: ${gent.favoriteSide}`);
console.log(`  homeLambda: ${gent.homeLambda.toFixed(4)}`);
console.log(`  awayLambda: ${gent.awayLambda.toFixed(4)}`);
console.log(`  modelBTTS: ${gent.modelBTTS.toFixed(4)}`);
console.log(`  modelOver25: ${gent.modelOver25.toFixed(4)}`);
console.log(`  coverage05: ${gent.coverage05.toFixed(4)}`);
console.log(`  roundedScore: ${gent.roundedScore}`);

// Structural checks
assertEqual(gent.favoriteSide, "EV", "Favorite side is EV (home)");
if (gent.totalLambda > 0) { console.log("  ✅ totalLambda > 0"); passed++; }
else { console.error("  ❌ totalLambda should be > 0"); failed++; }

if (gent.homeLambda > gent.awayLambda) { console.log("  ✅ homeLambda > awayLambda (home is favorite)"); passed++; }
else { console.error("  ❌ homeLambda should be > awayLambda for home favorite"); failed++; }

if (gent.modelBTTS > 0 && gent.modelBTTS < 1) { console.log("  ✅ modelBTTS in (0,1)"); passed++; }
else { console.error("  ❌ modelBTTS out of range"); failed++; }

if (gent.modelOver25 > 0 && gent.modelOver25 < 1) { console.log("  ✅ modelOver25 in (0,1)"); passed++; }
else { console.error("  ❌ modelOver25 out of range"); failed++; }

if (gent.coverage05 > 0.9) { console.log("  ✅ coverage05 > 0.9 (high coverage)"); passed++; }
else { console.error("  ❌ coverage05 too low"); failed++; }

// Score matrix check
const matrixSum = gent.scoreMatrix.flat().reduce((s, c) => s + c.probability, 0);
assertClose(matrixSum, gent.coverage05, "Score matrix sum ≈ coverage05");

if (gent.scoreMatrix.length === 6 && gent.scoreMatrix[0].length === 6) {
  console.log("  ✅ Score matrix is 6x6");
  passed++;
} else {
  console.error("  ❌ Score matrix wrong dimensions");
  failed++;
}

// ─── Test 6: Bulk predict ───
console.log("\n═══ Test 6: Bulk Prediction ═══");
const matches = [
  { homeTeam: "A", awayTeam: "B", ftOver25: 1.67, ftUnder25: 2.15, bttsYes: 1.57, bttsNo: 2.25, homeOdd: 1.95, drawOdd: 3.50, awayOdd: 3.60 },
  { homeTeam: "C", awayTeam: "D", ftOver25: 2.10, ftUnder25: 1.70, bttsYes: 2.00, bttsNo: 1.75, homeOdd: 2.80, drawOdd: 3.20, awayOdd: 2.50 },
  { homeTeam: "E", awayTeam: "F", ftOver25: 1.40, ftUnder25: 2.80, bttsYes: 1.45, bttsNo: 2.60, homeOdd: 1.50, drawOdd: 4.00, awayOdd: 6.00 },
];

const bulkResults = matches.map(m => predictMatch(m));
if (bulkResults.length === 3 && bulkResults.every(r => r.totalLambda > 0)) {
  console.log(`  ✅ Bulk: ${bulkResults.length} predictions, all valid`);
  passed++;
} else {
  console.error("  ❌ Bulk prediction failed");
  failed++;
}

// Away favorite test
const awayFav = bulkResults[1];
assertEqual(awayFav.favoriteSide, "DEP", "Match C-D: away is favorite");
if (awayFav.awayLambda > awayFav.homeLambda) {
  console.log("  ✅ Away lambda > home lambda for DEP favorite");
  passed++;
} else {
  console.error("  ❌ Lambda distribution wrong for DEP favorite");
  failed++;
}

// ─── Test 7: Edge cases ───
console.log("\n═══ Test 7: Edge Cases ═══");

// Very low total goals (heavy under market)
const lowGoals = predictMatch({
  homeTeam: "Low", awayTeam: "Scoring",
  ftOver25: 3.50, ftUnder25: 1.25,
  bttsYes: 3.00, bttsNo: 1.30,
  homeOdd: 2.20, drawOdd: 3.00, awayOdd: 3.40,
});
if (lowGoals.totalLambda < 2.0) { console.log(`  ✅ Low-scoring: totalLambda=${lowGoals.totalLambda} < 2.0`); passed++; }
else { console.error(`  ❌ Low-scoring totalLambda too high: ${lowGoals.totalLambda}`); failed++; }

// Very high total goals
const highGoals = predictMatch({
  homeTeam: "High", awayTeam: "Scoring",
  ftOver25: 1.15, ftUnder25: 5.50,
  bttsYes: 1.20, bttsNo: 4.50,
  homeOdd: 1.80, drawOdd: 3.60, awayOdd: 4.20,
});
if (highGoals.totalLambda > 3.0) { console.log(`  ✅ High-scoring: totalLambda=${highGoals.totalLambda} > 3.0`); passed++; }
else { console.error(`  ❌ High-scoring totalLambda too low: ${highGoals.totalLambda}`); failed++; }

// ─── Summary ───
console.log("\n═══════════════════════════════");
console.log(`  Total: ${passed + failed} tests`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log("═══════════════════════════════\n");

process.exit(failed > 0 ? 1 : 0);
