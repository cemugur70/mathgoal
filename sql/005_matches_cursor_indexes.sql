CREATE INDEX IF NOT EXISTS idx_matches_cursor_desc
  ON matches (
    COALESCE(match_date, DATE '0001-01-01') DESC,
    COALESCE(match_time, TIME '00:00:00') DESC,
    match_id DESC
  );

CREATE INDEX IF NOT EXISTS idx_matches_cursor_asc
  ON matches (
    COALESCE(match_date, DATE '9999-12-31') ASC,
    COALESCE(match_time, TIME '23:59:59.999999') ASC,
    match_id ASC
  );
