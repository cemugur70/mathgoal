DROP INDEX IF EXISTS idx_matches_cpr_home;
DROP INDEX IF EXISTS idx_matches_cpr_tahmin;
DROP INDEX IF EXISTS idx_matches_cpr_cs;

ALTER TABLE matches
  DROP COLUMN IF EXISTS cpr_home,
  DROP COLUMN IF EXISTS cpr_draw,
  DROP COLUMN IF EXISTS cpr_away,
  DROP COLUMN IF EXISTS cpr_tahmin,
  DROP COLUMN IF EXISTS cpr_guven,
  DROP COLUMN IF EXISTS cpr_cs,
  DROP COLUMN IF EXISTS cpr_skor;

DROP FUNCTION IF EXISTS get_team_elo(text, date, int);
