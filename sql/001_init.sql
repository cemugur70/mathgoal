CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  full_time_result TEXT,
  country TEXT,
  league TEXT,
  round_no INTEGER,
  season TEXT,
  match_date DATE,
  match_time TIME,
  source_url TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_match_date
  ON matches (match_date DESC);

CREATE INDEX IF NOT EXISTS idx_matches_country_league_date
  ON matches (country, league, match_date DESC);

CREATE INDEX IF NOT EXISTS idx_matches_season
  ON matches (season);

CREATE INDEX IF NOT EXISTS idx_matches_result
  ON matches (full_time_result);

CREATE INDEX IF NOT EXISTS idx_matches_scraped_at
  ON matches (scraped_at DESC);
