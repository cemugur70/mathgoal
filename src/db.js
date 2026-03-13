const { Pool } = require("pg");
const config = require("./config");

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getStats(bookmaker) {
  if (bookmaker) {
    const sql = `
      SELECT
        COUNT(DISTINCT m.match_id)::int AS total_matches,
        COUNT(DISTINCT m.league)::int AS total_leagues,
        COUNT(DISTINCT m.country)::int AS total_countries,
        MIN(m.match_date) AS first_match_date,
        MAX(m.match_date) AS last_match_date,
        COUNT(mac.match_id)::int AS total_odds
      FROM matches m
      INNER JOIN match_all_columns mac ON m.match_id = mac.match_id
      WHERE mac.bookmaker = $1
    `;
    const result = await query(sql, [bookmaker]);
    return result.rows[0];
  }

  // No bookmaker filter — global stats
  const sql = `
    SELECT
      COUNT(*)::int AS total_matches,
      COUNT(DISTINCT league)::int AS total_leagues,
      COUNT(DISTINCT country)::int AS total_countries,
      MIN(match_date) AS first_match_date,
      MAX(match_date) AS last_match_date
    FROM matches
  `;
  const result2 = await query(sql);

  // Also get total odds count across all bookmakers
  const oddsResult = await query(`SELECT COUNT(*)::int AS total_odds FROM match_all_columns`);
  const row = result2.rows[0];
  row.total_odds = oddsResult.rows[0]?.total_odds || 0;
  return row;
}

async function closePool() {
  await pool.end();
}

module.exports = {
  query,
  getStats,
  closePool,
  pool,
};
