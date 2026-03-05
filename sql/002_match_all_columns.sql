-- match_all_columns tablosunu all_columns.txt verilerini saklamak icin olusturur.
-- Veriler schema degisikligine gerek kalmadan raw_data JSONB icinde tutulur.

CREATE TABLE IF NOT EXISTS match_all_columns (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE match_all_columns
  ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE match_all_columns
  ADD COLUMN IF NOT EXISTS raw_data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mac_match_bookmaker
  ON match_all_columns (match_id, bookmaker);

CREATE INDEX IF NOT EXISTS idx_mac_match_id
  ON match_all_columns (match_id);

CREATE INDEX IF NOT EXISTS idx_mac_bookmaker
  ON match_all_columns (bookmaker);

CREATE INDEX IF NOT EXISTS idx_mac_scraped_at
  ON match_all_columns (scraped_at DESC);
