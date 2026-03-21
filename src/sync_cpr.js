const db = require('./db');
const { predictMatch } = require('./cpr');

async function syncAllCpr() {
  console.log("[CPR Sync] Started CPR background calculation process.");
  try {
    await db.query(`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS cpr_home numeric(5,2),
      ADD COLUMN IF NOT EXISTS cpr_draw numeric(5,2),
      ADD COLUMN IF NOT EXISTS cpr_away numeric(5,2),
      ADD COLUMN IF NOT EXISTS cpr_tahmin varchar(10),
      ADD COLUMN IF NOT EXISTS cpr_guven numeric(5,2),
      ADD COLUMN IF NOT EXISTS cpr_cs varchar(5),
      ADD COLUMN IF NOT EXISTS cpr_skor varchar(10);
    `);
    console.log("[CPR Sync] Ensured matches table columns exist.");
  } catch (err) {
    console.error("[CPR Sync] Column error:", err.message);
  }

  while (true) {
    try {
      const res = await db.query(`
        SELECT m.match_id, m.match_date, m.home_team, m.away_team, 
               COALESCE(
                 (mac.raw_data->>'bet365_home')::numeric,
                 (mac.raw_data->>'unibet_home')::numeric,
                 (mac.raw_data->>'williamhill_home')::numeric,
                 (mac.raw_data->>'bwin_home')::numeric
               ) AS odds_1,
               COALESCE(
                 (mac.raw_data->>'bet365_draw')::numeric,
                 (mac.raw_data->>'unibet_draw')::numeric,
                 (mac.raw_data->>'williamhill_draw')::numeric,
                 (mac.raw_data->>'bwin_draw')::numeric
               ) AS odds_x,
               COALESCE(
                 (mac.raw_data->>'bet365_away')::numeric,
                 (mac.raw_data->>'unibet_away')::numeric,
                 (mac.raw_data->>'williamhill_away')::numeric,
                 (mac.raw_data->>'bwin_away')::numeric
               ) AS odds_2,
               get_team_elo(m.home_team, m.match_date, 5) AS home_5m,
               get_team_elo(m.home_team, m.match_date, 10) AS home_10m,
               get_team_elo(m.home_team, m.match_date, 20) AS home_20m,
               get_team_elo(m.away_team, m.match_date, 5) AS away_5m,
               get_team_elo(m.away_team, m.match_date, 10) AS away_10m,
               get_team_elo(m.away_team, m.match_date, 20) AS away_20m,
               get_team_elo(m.home_team, m.match_date, 1000) AS home_general,
               get_team_elo(m.away_team, m.match_date, 1000) AS away_general
        FROM matches m
        LEFT JOIN match_all_columns mac ON m.match_id = mac.match_id
        WHERE m.cpr_home IS NULL
        GROUP BY m.match_id, m.match_date, m.home_team, m.away_team, mac.raw_data
        ORDER BY m.match_date DESC
        LIMIT 250
      `);

      if (res.rows.length === 0) {
        console.log("[CPR Sync] All matches calculated! Waiting 1 hour...");
        await new Promise(r => setTimeout(r, 3600000));
        continue; // Keep worker alive for new matches later
      }

      for (const r of res.rows) {
        try {
          if (!r.odds_1 || !r.odds_x || !r.odds_2) {
              // mark as processed with 0s to avoid infinite loop
              await db.query(`UPDATE matches SET cpr_home = 0 WHERE match_id = $1`, [r.match_id]);
              continue;
          }
          
          const cprData = predictMatch({
            oddsHome: r.odds_1, oddsDraw: r.odds_x, oddsAway: r.odds_2,
            homeEloGeneral: r.home_general, awayEloGeneral: r.away_general,
            homeForm5: r.home_5m, awayForm5: r.away_5m,
            homeForm10: r.home_10m, awayForm10: r.away_10m,
            homeForm20: r.home_20m, awayForm20: r.away_20m,
            leagueAvgElo: 0
          });

          // check for NaN to prevent DB numeric errors
          if (isNaN(parseFloat(cprData.probHome))) {
            throw new Error("ProbHome calculation resulted in NaN");
          }

          await db.query(`
            UPDATE matches 
            SET cpr_home = $1, cpr_draw = $2, cpr_away = $3, 
                cpr_tahmin = $4, cpr_guven = $5, cpr_cs = $6, cpr_skor = $7
            WHERE match_id = $8
          `, [
            parseFloat((cprData.probHome*100).toFixed(1)),
            parseFloat((cprData.probDraw*100).toFixed(1)),
            parseFloat((cprData.probAway*100).toFixed(1)),
            cprData.prediction,
            parseFloat((cprData.confidence*100).toFixed(1)),
            cprData.doubleChance,
            cprData.predictedScore,
            r.match_id
          ]);
        } catch (err) {
          console.error(`[CPR Sync] Skipped match ${r.match_id} due to calc error:`, err.message);
          // Mark as processed (0) so it doesn't loop infinitely
          await db.query(`UPDATE matches SET cpr_home = 0 WHERE match_id = $1`, [r.match_id]).catch(()=>{});
        }
      }
      console.log(`[CPR Sync] Processed batch of ${res.rows.length} matches.`);
      await new Promise(r => setTimeout(r, 2000)); // Sleep 2 seconds between batches to avoid locking DB entirely
    } catch (e) {
      console.error("[CPR Sync] Batch error: ", e.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

module.exports = { syncAllCpr };
