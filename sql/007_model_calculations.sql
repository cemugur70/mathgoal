CREATE TABLE IF NOT EXISTS model_calculations (
  match_id VARCHAR NOT NULL,
  bookmaker VARCHAR NOT NULL,
  odds_type VARCHAR NOT NULL,
  home_lambda NUMERIC(6,3),
  away_lambda NUMERIC(6,3),
  total_lambda NUMERIC(6,3),
  model_btts NUMERIC(4,3),
  model_over25 NUMERIC(4,3),
  favorite_side VARCHAR(5),
  rounded_score VARCHAR(10),
  source_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, bookmaker, odds_type)
);

ALTER TABLE model_calculations
  ADD COLUMN IF NOT EXISTS source_scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_model_btts ON model_calculations(model_btts);
CREATE INDEX IF NOT EXISTS idx_model_over25 ON model_calculations(model_over25);
CREATE INDEX IF NOT EXISTS idx_model_total_l ON model_calculations(total_lambda);
CREATE INDEX IF NOT EXISTS idx_model_bookmaker_type_source
  ON model_calculations(bookmaker, odds_type, source_scraped_at DESC);
