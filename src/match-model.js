const MODEL_WEIGHTS = {
  homeAttack: 0.6,
  awayAttack: 0.6,
  awayDefense: 0.45,
  homeDefense: 0.45,
  formDelta: 0.35,
  h2hGoalDelta: 0.14,
  marketDelta: 0.3,
  homeAdvantage: 0.12,
  awayHomeAdvantage: 0.08,
  availability: 0.1,
  poissonBlend: 0.58,
  marketBlend: 0.42,
};

const EPSILON = 1e-9;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeThreeWay(home, draw, away) {
  const safeHome = Math.max(home, EPSILON);
  const safeDraw = Math.max(draw, EPSILON);
  const safeAway = Math.max(away, EPSILON);
  const total = safeHome + safeDraw + safeAway;
  return {
    home: safeHome / total,
    draw: safeDraw / total,
    away: safeAway / total,
  };
}

function marketProbabilities(oddsHome, oddsDraw, oddsAway) {
  const oh = toNumber(oddsHome);
  const od = toNumber(oddsDraw);
  const oa = toNumber(oddsAway);
  if (oh <= 1 || od <= 1 || oa <= 1) {
    return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  }

  return normalizeThreeWay(1 / oh, 1 / od, 1 / oa);
}

function poissonDistribution(lambda, maxGoals = 6) {
  const probs = Array(maxGoals + 1).fill(0);
  probs[0] = Math.exp(-lambda);
  let sum = probs[0];
  for (let goal = 1; goal <= maxGoals; goal += 1) {
    probs[goal] = probs[goal - 1] * lambda / goal;
    sum += probs[goal];
  }
  probs[maxGoals] += Math.max(0, 1 - sum);
  return probs;
}

function poissonOutcome(lambdaHome, lambdaAway, maxGoals = 6) {
  const homeDist = poissonDistribution(lambdaHome, maxGoals);
  const awayDist = poissonDistribution(lambdaAway, maxGoals);
  let home = 0;
  let draw = 0;
  let away = 0;
  let bestScore = { home: 0, away: 0, probability: 0 };

  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      const probability = homeDist[homeGoals] * awayDist[awayGoals];
      if (homeGoals > awayGoals) home += probability;
      else if (homeGoals === awayGoals) draw += probability;
      else away += probability;

      if (probability > bestScore.probability) {
        bestScore = { home: homeGoals, away: awayGoals, probability };
      }
    }
  }

  return {
    probabilities: normalizeThreeWay(home, draw, away),
    bestScore,
  };
}

function outcomeCode(probabilities) {
  if (probabilities.home >= probabilities.draw && probabilities.home >= probabilities.away) {
    return "MS 1";
  }
  if (probabilities.draw >= probabilities.home && probabilities.draw >= probabilities.away) {
    return "MS 0";
  }
  return "MS 2";
}

function actualResultCode(row) {
  const homeScore = row.home_score;
  const awayScore = row.away_score;
  if (homeScore == null || awayScore == null) {
    return null;
  }
  if (homeScore > awayScore) return "MS 1";
  if (homeScore === awayScore) return "MS 0";
  return "MS 2";
}

function createPrediction(row) {
  const leagueHomeGoals = clamp(toNumber(row.league_home_goals, 1.35), 0.4, 2.8);
  const leagueAwayGoals = clamp(toNumber(row.league_away_goals, 1.1), 0.3, 2.6);
  const leagueTotalGoals = clamp(toNumber(row.league_total_goals, leagueHomeGoals + leagueAwayGoals), 1.2, 4.8);

  const homePpg = clamp(toNumber(row.home_ppg, 1.4), 0.1, 3);
  const awayPpg = clamp(toNumber(row.away_ppg, 1.2), 0.1, 3);
  const homeGoalsFor = clamp(toNumber(row.home_goals_for, leagueHomeGoals), 0.1, 4.5);
  const homeGoalsAgainst = clamp(toNumber(row.home_goals_against, leagueAwayGoals), 0.1, 4.5);
  const awayGoalsFor = clamp(toNumber(row.away_goals_for, leagueAwayGoals), 0.1, 4.5);
  const awayGoalsAgainst = clamp(toNumber(row.away_goals_against, leagueHomeGoals), 0.1, 4.5);
  const h2hHomePpg = clamp(toNumber(row.h2h_home_ppg, 1.5), 0, 3);
  const h2hGoalDiff = clamp(toNumber(row.h2h_home_goal_diff, 0), -3, 3);

  const availabilityHome = clamp(toNumber(row.availability_home, 0), -1, 1);
  const availabilityAway = clamp(toNumber(row.availability_away, 0), -1, 1);

  const homeAttack = clamp(homeGoalsFor / Math.max(leagueHomeGoals, 0.35), 0.45, 2.2);
  const awayAttack = clamp(awayGoalsFor / Math.max(leagueAwayGoals, 0.35), 0.45, 2.2);
  const homeDefense = clamp(homeGoalsAgainst / Math.max(leagueAwayGoals, 0.35), 0.45, 2.2);
  const awayDefense = clamp(awayGoalsAgainst / Math.max(leagueHomeGoals, 0.35), 0.45, 2.2);

  const market = marketProbabilities(row.odds_home, row.odds_draw, row.odds_away);
  const formDelta = (homePpg - awayPpg) / 3;
  const h2hDelta = clamp((h2hHomePpg / 3) - 0.5, -0.35, 0.35);
  const h2hGoalDelta = h2hGoalDiff / 4;
  const homeAdvantage = clamp((leagueHomeGoals - leagueAwayGoals) / Math.max(leagueTotalGoals, 1), 0, 0.35);
  const availabilityDelta = availabilityHome - availabilityAway;

  const lambdaHome = clamp(
    Math.exp(
      Math.log(leagueHomeGoals) +
      MODEL_WEIGHTS.homeAttack * Math.log(homeAttack) -
      MODEL_WEIGHTS.awayDefense * Math.log(awayDefense) +
      MODEL_WEIGHTS.formDelta * formDelta +
      MODEL_WEIGHTS.h2hGoalDelta * (h2hGoalDelta + h2hDelta) +
      MODEL_WEIGHTS.marketDelta * (market.home - market.away) +
      MODEL_WEIGHTS.homeAdvantage * homeAdvantage +
      MODEL_WEIGHTS.availability * availabilityDelta
    ),
    0.2,
    3.8
  );

  const lambdaAway = clamp(
    Math.exp(
      Math.log(leagueAwayGoals) +
      MODEL_WEIGHTS.awayAttack * Math.log(awayAttack) -
      MODEL_WEIGHTS.homeDefense * Math.log(homeDefense) -
      MODEL_WEIGHTS.formDelta * formDelta -
      MODEL_WEIGHTS.h2hGoalDelta * (h2hGoalDelta + h2hDelta) +
      MODEL_WEIGHTS.marketDelta * (market.home - market.away) -
      MODEL_WEIGHTS.awayHomeAdvantage * homeAdvantage -
      MODEL_WEIGHTS.availability * availabilityDelta
    ),
    0.15,
    3.4
  );

  const poisson = poissonOutcome(lambdaHome, lambdaAway);
  const blended = normalizeThreeWay(
    Math.exp(MODEL_WEIGHTS.poissonBlend * Math.log(poisson.probabilities.home + EPSILON) + MODEL_WEIGHTS.marketBlend * Math.log(market.home + EPSILON)),
    Math.exp(MODEL_WEIGHTS.poissonBlend * Math.log(poisson.probabilities.draw + EPSILON) + MODEL_WEIGHTS.marketBlend * Math.log(market.draw + EPSILON)),
    Math.exp(MODEL_WEIGHTS.poissonBlend * Math.log(poisson.probabilities.away + EPSILON) + MODEL_WEIGHTS.marketBlend * Math.log(market.away + EPSILON)),
  );

  const predictedOutcome = outcomeCode(blended);
  const actualOutcome = actualResultCode(row);
  const confidence = Math.max(blended.home, blended.draw, blended.away);
  const marketForPick = predictedOutcome === "MS 1" ? market.home : predictedOutcome === "MS 0" ? market.draw : market.away;
  const modelForPick = predictedOutcome === "MS 1" ? blended.home : predictedOutcome === "MS 0" ? blended.draw : blended.away;
  const selectedOdds = predictedOutcome === "MS 1" ? toNumber(row.odds_home) : predictedOutcome === "MS 0" ? toNumber(row.odds_draw) : toNumber(row.odds_away);
  const expectedValue = selectedOdds > 1 ? (modelForPick * selectedOdds) - 1 : null;

  return {
    ...row,
    market_home: Number((market.home * 100).toFixed(2)),
    market_draw: Number((market.draw * 100).toFixed(2)),
    market_away: Number((market.away * 100).toFixed(2)),
    model_home: Number((blended.home * 100).toFixed(2)),
    model_draw: Number((blended.draw * 100).toFixed(2)),
    model_away: Number((blended.away * 100).toFixed(2)),
    expected_home_goals: Number(lambdaHome.toFixed(2)),
    expected_away_goals: Number(lambdaAway.toFixed(2)),
    predicted_score: `${poisson.bestScore.home}-${poisson.bestScore.away}`,
    predicted_outcome: predictedOutcome,
    confidence: Number((confidence * 100).toFixed(2)),
    edge: Number(((modelForPick - marketForPick) * 100).toFixed(2)),
    expected_value: expectedValue == null ? null : Number((expectedValue * 100).toFixed(2)),
    actual_outcome: actualOutcome,
    hit: actualOutcome ? actualOutcome === predictedOutcome : null,
    feature_snapshot: {
      home_ppg: Number(homePpg.toFixed(2)),
      away_ppg: Number(awayPpg.toFixed(2)),
      home_attack: Number(homeAttack.toFixed(2)),
      away_attack: Number(awayAttack.toFixed(2)),
      home_defense: Number(homeDefense.toFixed(2)),
      away_defense: Number(awayDefense.toFixed(2)),
      h2h_home_ppg: Number(h2hHomePpg.toFixed(2)),
      h2h_goal_diff: Number(h2hGoalDiff.toFixed(2)),
      home_advantage: Number(homeAdvantage.toFixed(2)),
      availability_delta: Number(availabilityDelta.toFixed(2)),
    },
  };
}

function backtestSummary(predictions) {
  const finished = predictions.filter((row) => row.actual_outcome);
  if (!finished.length) {
    return {
      sample_size: 0,
      accuracy: 0,
      high_conf_accuracy: 0,
      avg_confidence: 0,
      avg_edge: 0,
      brier_score: 0,
      log_loss: 0,
      roi_pct: 0,
      bets: 0,
    };
  }

  let hits = 0;
  let highConfHits = 0;
  let highConfTotal = 0;
  let confidenceSum = 0;
  let edgeSum = 0;
  let brierSum = 0;
  let logLossSum = 0;
  let roiSum = 0;
  let betCount = 0;

  for (const row of finished) {
    const probs = {
      home: toNumber(row.model_home) / 100,
      draw: toNumber(row.model_draw) / 100,
      away: toNumber(row.model_away) / 100,
    };
    const actual = row.actual_outcome;
    const predicted = row.predicted_outcome;
    const hit = predicted === actual;
    if (hit) hits += 1;

    const confidence = toNumber(row.confidence) / 100;
    confidenceSum += confidence;
    edgeSum += toNumber(row.edge);
    if (confidence >= 0.55) {
      highConfTotal += 1;
      if (hit) highConfHits += 1;
    }

    const y = {
      home: actual === "MS 1" ? 1 : 0,
      draw: actual === "MS 0" ? 1 : 0,
      away: actual === "MS 2" ? 1 : 0,
    };
    brierSum += ((probs.home - y.home) ** 2 + (probs.draw - y.draw) ** 2 + (probs.away - y.away) ** 2) / 3;
    const actualProb = actual === "MS 1" ? probs.home : actual === "MS 0" ? probs.draw : probs.away;
    logLossSum += -Math.log(Math.max(actualProb, EPSILON));

    const odds = predicted === "MS 1" ? toNumber(row.odds_home) : predicted === "MS 0" ? toNumber(row.odds_draw) : toNumber(row.odds_away);
    if (odds > 1) {
      roiSum += hit ? odds - 1 : -1;
      betCount += 1;
    }
  }

  return {
    sample_size: finished.length,
    accuracy: Number(((hits / finished.length) * 100).toFixed(2)),
    high_conf_accuracy: Number((highConfTotal ? (highConfHits / highConfTotal) * 100 : 0).toFixed(2)),
    avg_confidence: Number(((confidenceSum / finished.length) * 100).toFixed(2)),
    avg_edge: Number((edgeSum / finished.length).toFixed(2)),
    brier_score: Number((brierSum / finished.length).toFixed(4)),
    log_loss: Number((logLossSum / finished.length).toFixed(4)),
    roi_pct: Number((betCount ? (roiSum / betCount) * 100 : 0).toFixed(2)),
    bets: betCount,
  };
}

module.exports = {
  MODEL_WEIGHTS,
  createPrediction,
  backtestSummary,
};
