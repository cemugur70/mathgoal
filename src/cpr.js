const CONFIG = {
  ELO_INITIAL: 0,
  ELO_K_FACTOR: 32,
  ELO_HOME_ADVANTAGE: 100,

  W_MARKET: 0.45,
  W_ELO_GENERAL: 0.20,
  W_FORM_5: 0.10,
  W_FORM_10: 0.10,
  W_FORM_20: 0.10,
  W_LAMBDA: 0.05,

  ELO_TO_PROB_HOME_ADJ: 50,
  ELO_DIVISOR: 400,

  POISSON_MAX_GOALS: 7,
  ELO_LAMBDA_FACTOR: 0.001,
  LAMBDA_MIN: 0.1,
  LAMBDA_CLAMP_MIN: 0.5,
  LAMBDA_CLAMP_MAX: 1.5,

  FORM_SCALE: 1000,
  CONFIDENCE_HIGH: 0.60,
  CONFIDENCE_MEDIUM: 0.55,
};

function oddsToProb(oddsHome, oddsDraw, oddsAway) {
  if (!oddsHome || !oddsDraw || !oddsAway) return { pHome: 0.33, pDraw: 0.33, pAway: 0.34 };
  const rawH = 1 / oddsHome;
  const rawD = 1 / oddsDraw;
  const rawA = 1 / oddsAway;
  const total = rawH + rawD + rawA;
  return {
    pHome: rawH / total,
    pDraw: rawD / total,
    pAway: rawA / total
  };
}

function eloToProb(homeEloGeneral, awayEloGeneral) {
  if (homeEloGeneral == null) homeEloGeneral = 0;
  if (awayEloGeneral == null) awayEloGeneral = 0;
  const eloDiff = homeEloGeneral - awayEloGeneral + CONFIG.ELO_TO_PROB_HOME_ADJ;
  const eloExpHome = 1 / (1 + Math.pow(10, -eloDiff / CONFIG.ELO_DIVISOR));
  const eloExpAway = 1 - eloExpHome;
  const drawFactor = 1 - Math.abs(eloExpHome - 0.5) * 1.5;
  const eloProbDraw = Math.max(0.15, Math.min(0.35, 0.25 * drawFactor + 0.15));
  const eloProbHome = eloExpHome * (1 - eloProbDraw);
  const eloProbAway = eloExpAway * (1 - eloProbDraw);
  return { eloProbHome, eloProbDraw, eloProbAway };
}

function calculateFormAdjustment(homeForm5, awayForm5, homeForm10, awayForm10, homeForm20, awayForm20) {
  let formAdj = 0;
  if (homeForm5 !== null && awayForm5 !== null) formAdj += (homeForm5 - awayForm5) * CONFIG.W_FORM_5;
  if (homeForm10 !== null && awayForm10 !== null) formAdj += (homeForm10 - awayForm10) * CONFIG.W_FORM_10;
  if (homeForm20 !== null && awayForm20 !== null) formAdj += (homeForm20 - awayForm20) * CONFIG.W_FORM_20;
  return formAdj / CONFIG.FORM_SCALE;
}

function adjustLambda(baseLambda, teamElo, leagueAvgElo) {
  if (teamElo == null) teamElo = 0;
  if (leagueAvgElo == null) leagueAvgElo = 0;
  const eloFactor = 1 + (teamElo - leagueAvgElo) * CONFIG.ELO_LAMBDA_FACTOR;
  const clampedFactor = Math.max(CONFIG.LAMBDA_CLAMP_MIN, Math.min(CONFIG.LAMBDA_CLAMP_MAX, eloFactor));
  return Math.max(CONFIG.LAMBDA_MIN, baseLambda * clampedFactor);
}

function poissonPmf(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let factorial = 1;
  for (let i = 2; i <= k; i++) factorial *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial;
}

function calculateScoreProbabilities(adjLambdaHome, adjLambdaAway) {
  let probHome = 0, probDraw = 0, probAway = 0;
  let allScores = [];
  for (let h = 0; h <= CONFIG.POISSON_MAX_GOALS; h++) {
    for (let a = 0; a <= CONFIG.POISSON_MAX_GOALS; a++) {
      const p = poissonPmf(h, adjLambdaHome) * poissonPmf(a, adjLambdaAway);
      if (h > a) probHome += p;
      else if (h === a) probDraw += p;
      else probAway += p;
      allScores.push({ home: h, away: a, probability: p });
    }
  }
  allScores.sort((a, b) => b.probability - a.probability);
  return {
    lambdaProbHome: probHome,
    lambdaProbDraw: probDraw,
    lambdaProbAway: probAway,
    topScores: allScores.slice(0, 7)
  };
}

function compositePrediction(market, elo, form, poisson) {
  let compHome = market.pHome * CONFIG.W_MARKET
               + elo.eloProbHome * CONFIG.W_ELO_GENERAL
               + poisson.lambdaProbHome * CONFIG.W_LAMBDA
               + form.adjustment;

  let compDraw = market.pDraw * CONFIG.W_MARKET
               + elo.eloProbDraw * CONFIG.W_ELO_GENERAL
               + poisson.lambdaProbDraw * CONFIG.W_LAMBDA;

  let compAway = market.pAway * CONFIG.W_MARKET
               + elo.eloProbAway * CONFIG.W_ELO_GENERAL
               + poisson.lambdaProbAway * CONFIG.W_LAMBDA
               - form.adjustment;

  // normalize strictly to positive bounds
  compHome = Math.max(0.01, compHome);
  compDraw = Math.max(0.01, compDraw);
  compAway = Math.max(0.01, compAway);

  const total = compHome + compDraw + compAway;
  compHome /= total;
  compDraw /= total;
  compAway /= total;

  const maxProb = Math.max(compHome, compDraw, compAway);
  let prediction;
  if (compHome >= compDraw && compHome >= compAway) prediction = '1';
  else if (compAway >= compDraw) prediction = '2';
  else prediction = 'X';

  const doubleChance = compHome > compAway ? '1X' : 'X2';
  return {
    probHome: compHome,
    probDraw: compDraw,
    probAway: compAway,
    prediction,
    confidence: maxProb,
    doubleChance,
    confidenceLevel: maxProb > CONFIG.CONFIDENCE_HIGH ? 'YÜKSEK' : maxProb > CONFIG.CONFIDENCE_MEDIUM ? 'ORTA' : 'DÜŞÜK'
  };
}

function predictMatch(input) {
  const market = oddsToProb(input.oddsHome, input.oddsDraw, input.oddsAway);
  
  // Approximate lambda expected goals if we don't have explicit goals logic (Using 2.6 Avg Goals per match)
  const baseTotalGoals = 2.6;
  let baseLambdaHome = baseTotalGoals * (market.pHome / (market.pHome + market.pAway || 1));
  let baseLambdaAway = baseTotalGoals * (market.pAway / (market.pHome + market.pAway || 1));
  if (input.lambdaHome) baseLambdaHome = input.lambdaHome;
  if (input.lambdaAway) baseLambdaAway = input.lambdaAway;

  const eloData = eloToProb(input.homeEloGeneral, input.awayEloGeneral);
  
  const formAdj = calculateFormAdjustment(
    input.homeForm5, input.awayForm5,
    input.homeForm10, input.awayForm10,
    input.homeForm20, input.awayForm20
  );

  const adjLH = adjustLambda(baseLambdaHome, input.homeEloGeneral, input.leagueAvgElo);
  const adjLA = adjustLambda(baseLambdaAway, input.awayEloGeneral, input.leagueAvgElo);
  const poisson = calculateScoreProbabilities(adjLH, adjLA);

  const result = compositePrediction(market, eloData, { adjustment: formAdj }, poisson);

  return {
    ...result,
    predictedScore: `${poisson.topScores[0].home} - ${poisson.topScores[0].away}`,
    top3Scores: poisson.topScores.slice(0, 3).map(s => `${s.home}-${s.away}`),
  };
}

module.exports = { predictMatch };
