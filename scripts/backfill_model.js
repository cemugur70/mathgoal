require('dotenv').config();
const { predictMatch } = require('../src/services/poisson.service');
const { mapRawToColumns } = require('../src/columns-map');
const db = require('../src/db');

async function createTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS model_calculations (
      match_id VARCHAR NOT NULL,
      bookmaker VARCHAR NOT NULL,
      odds_type VARCHAR NOT NULL, /* 'opening' or 'closing' */
      home_lambda NUMERIC(6,3),
      away_lambda NUMERIC(6,3),
      total_lambda NUMERIC(6,3),
      model_btts NUMERIC(4,3),
      model_over25 NUMERIC(4,3),
      favorite_side VARCHAR(5),
      rounded_score VARCHAR(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (match_id, bookmaker, odds_type)
    );

    CREATE INDEX IF NOT EXISTS idx_model_btts ON model_calculations(model_btts);
    CREATE INDEX IF NOT EXISTS idx_model_over25 ON model_calculations(model_over25);
    CREATE INDEX IF NOT EXISTS idx_model_total_l ON model_calculations(total_lambda);
  `);
  console.log("Table model_calculations created/verified.");
}

async function run() {
  await createTable();

  // Find out total records
  const countRes = await db.query(`SELECT COUNT(*) as count FROM match_all_columns`);
  const total = parseInt(countRes.rows[0].count, 10);
  console.log(`Total rows to process: ${total}`);

  let offset = 0;
  const LIMIT = 5000;
  let processed = 0;

  while (offset < total) {
    const res = await db.query(
      `SELECT match_id, bookmaker, raw_data FROM match_all_columns ORDER BY match_id, bookmaker LIMIT $1 OFFSET $2`,
      [LIMIT, offset]
    );

    if (res.rows.length === 0) break;

    const values = [];
    const pushVal = (r, oddsType, pred) => {
      values.push(
        r.match_id, r.bookmaker, oddsType,
        pred.homeLambda || null, pred.awayLambda || null, pred.totalLambda || null,
        pred.modelBTTS || null, pred.modelOver25 || null,
        pred.favoriteSide || null, pred.roundedScore || null
      );
    };

    for (const r of res.rows) {
      if (!r.raw_data) continue;
      
      // Calculate Closing
      const closingMapped = mapRawToColumns(r.raw_data, r.bookmaker, false, true);
      const predClosing = predictMatch(closingMapped);
      if (predClosing.homeLambda) pushVal(r, 'closing', predClosing);

      // Calculate Opening
      const openingMapped = mapRawToColumns(r.raw_data, r.bookmaker, true, false);
      const predOpening = predictMatch(openingMapped);
      if (predOpening.homeLambda) pushVal(r, 'opening', predOpening);
    }

    if (values.length > 0) {
      // Build batch insert query
      const chunks = [];
      for (let i = 0; i < values.length / 10; i++) {
        chunks.push(`($${i*10+1}, $${i*10+2}, $${i*10+3}, $${i*10+4}, $${i*10+5}, $${i*10+6}, $${i*10+7}, $${i*10+8}, $${i*10+9}, $${i*10+10})`);
      }
      
      const insertQuery = `
        INSERT INTO model_calculations 
        (match_id, bookmaker, odds_type, home_lambda, away_lambda, total_lambda, model_btts, model_over25, favorite_side, rounded_score)
        VALUES ${chunks.join(',')}
        ON CONFLICT (match_id, bookmaker, odds_type) DO UPDATE SET
          home_lambda = EXCLUDED.home_lambda,
          away_lambda = EXCLUDED.away_lambda,
          total_lambda = EXCLUDED.total_lambda,
          model_btts = EXCLUDED.model_btts,
          model_over25 = EXCLUDED.model_over25,
          favorite_side = EXCLUDED.favorite_side,
          rounded_score = EXCLUDED.rounded_score
      `;
      try {
        await db.query(insertQuery, values);
      } catch(err) {
         console.error("Batch insert error:", err.message);
      }
    }

    processed += res.rows.length;
    offset += LIMIT;
    console.log(`Processed ${processed} / ${total}`);
  }

  console.log("Backfill complete!");
  process.exit(0);
}

run().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
