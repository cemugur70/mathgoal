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
  let whereClause = "";
  const params = [];
  
  if (bookmaker) {
    whereClause = "WHERE EXISTS (SELECT 1 FROM match_all_columns WHERE match_all_columns.match_id = matches.match_id AND match_all_columns.bookmaker = $1)";
    params.push(bookmaker);
  }

  const sql = `
    SELECT
      COUNT(*)::int AS total_matches,
      COUNT(DISTINCT league)::int AS total_leagues,
      COUNT(DISTINCT country)::int AS total_countries,
      MIN(match_date) AS first_match_date,
      MAX(match_date) AS last_match_date
    FROM matches
    ${whereClause}
  `;
  const result = await query(sql, params);
  return result.rows[0];
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
