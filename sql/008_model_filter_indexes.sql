-- Additional indexes on model_calculations for direct SQL filtering
CREATE INDEX IF NOT EXISTS idx_model_home_lambda ON model_calculations(home_lambda);
CREATE INDEX IF NOT EXISTS idx_model_away_lambda ON model_calculations(away_lambda);
CREATE INDEX IF NOT EXISTS idx_model_favorite_side ON model_calculations(favorite_side);
CREATE INDEX IF NOT EXISTS idx_model_rounded_score ON model_calculations(rounded_score);

-- Composite index for the most common filter pattern (bookmaker + odds_type + filters)
CREATE INDEX IF NOT EXISTS idx_model_bm_type_lambdas
  ON model_calculations(bookmaker, odds_type, total_lambda, model_btts, model_over25);
