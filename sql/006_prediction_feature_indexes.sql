CREATE INDEX IF NOT EXISTS idx_matches_home_team_date
  ON matches (home_team, match_date DESC, match_time DESC, match_id DESC);

CREATE INDEX IF NOT EXISTS idx_matches_away_team_date
  ON matches (away_team, match_date DESC, match_time DESC, match_id DESC);

CREATE INDEX IF NOT EXISTS idx_matches_completed_date
  ON matches (match_date DESC, match_time DESC, match_id DESC)
  WHERE home_score IS NOT NULL AND away_score IS NOT NULL;
