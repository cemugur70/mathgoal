require("dotenv").config();

const db = require("../src/db");
const { buildModelCalculationPayload } = require("../src/services/model-calculation.service");

async function createTable() {
  await db.query(`
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
  `);
  console.log("Table model_calculations created/verified.");
}

async function run() {
  await createTable();

  const countRes = await db.query("SELECT COUNT(*)::int AS count FROM match_all_columns");
  const total = countRes.rows[0]?.count || 0;
  console.log(`Total rows to process: ${total}`);

  let offset = 0;
  const LIMIT = 5000;
  let processed = 0;

  while (offset < total) {
    const res = await db.query(
      `
        SELECT match_id, bookmaker, raw_data, scraped_at
        FROM match_all_columns
        ORDER BY match_id, bookmaker
        LIMIT $1 OFFSET $2
      `,
      [LIMIT, offset],
    );

    if (res.rows.length === 0) break;

    const values = [];
    const pushVal = (row, oddsType, payload) => {
      values.push(
        row.match_id,
        row.bookmaker,
        oddsType,
        payload.prediction.homeLambda || null,
        payload.prediction.awayLambda || null,
        payload.prediction.totalLambda || null,
        payload.prediction.modelBTTS || null,
        payload.prediction.modelOver25 || null,
        payload.prediction.favoriteSide || null,
        payload.prediction.roundedScore || null,
        row.scraped_at || null,
      );
    };

    for (const row of res.rows) {
      if (!row.raw_data) continue;

      const closingPayload = buildModelCalculationPayload(row.raw_data, row.bookmaker, "closing");
      if (closingPayload) {
        pushVal(row, "closing", closingPayload);
      }

      const openingPayload = buildModelCalculationPayload(row.raw_data, row.bookmaker, "opening");
      if (openingPayload) {
        pushVal(row, "opening", openingPayload);
      }
    }

    if (values.length > 0) {
      const chunks = [];
      for (let i = 0; i < values.length / 11; i++) {
        chunks.push(`($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`);
      }

      const insertQuery = `
        INSERT INTO model_calculations (
          match_id,
          bookmaker,
          odds_type,
          home_lambda,
          away_lambda,
          total_lambda,
          model_btts,
          model_over25,
          favorite_side,
          rounded_score,
          source_scraped_at
        )
        VALUES ${chunks.join(",")}
        ON CONFLICT (match_id, bookmaker, odds_type) DO UPDATE SET
          home_lambda = EXCLUDED.home_lambda,
          away_lambda = EXCLUDED.away_lambda,
          total_lambda = EXCLUDED.total_lambda,
          model_btts = EXCLUDED.model_btts,
          model_over25 = EXCLUDED.model_over25,
          favorite_side = EXCLUDED.favorite_side,
          rounded_score = EXCLUDED.rounded_score,
          source_scraped_at = EXCLUDED.source_scraped_at,
          updated_at = NOW()
      `;

      try {
        await db.query(insertQuery, values);
      } catch (error) {
        console.error("Batch insert error:", error.message);
      }
    }

    processed += res.rows.length;
    offset += LIMIT;
    console.log(`Processed ${processed} / ${total}`);
  }

  console.log("Backfill complete!");
  await db.closePool();
  process.exit(0);
}

run().catch(async (error) => {
  console.error("Script error:", error);
  await db.closePool().catch(() => {});
  process.exit(1);
});
