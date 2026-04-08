const fs = require("node:fs");
const path = require("node:path");
const config = require("./src/config");
const db = require("./src/db");
const { app, logger } = require("./src/app");

// ─── Auto-migrate: sql/ klasöründeki dosyaları başlangıçta çalıştır ───
async function runStartupMigrations() {
  const sqlDir = path.resolve(__dirname, "sql");
  if (!fs.existsSync(sqlDir)) return;

  const files = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  // Timeout ayarla — lock varsa takılmaması için
  try { await db.query("SET statement_timeout = '15s'"); } catch (e) { /* ignore */ }

  for (const file of files) {
    try {
      const sql = fs.readFileSync(path.join(sqlDir, file), "utf8");
      await db.query(sql);
      logger.info(`Migration OK: ${file}`);
    } catch (err) {
      logger.warn({ err: err.message }, `Migration atlandı: ${file}`);
    }
  }

  // Timeout'u geri al
  try { await db.query("SET statement_timeout = '0'"); } catch (e) { /* ignore */ }
}

(async () => {
  try {
    await runStartupMigrations();
  } catch (e) {
    logger.warn({ err: e.message }, "Migration sistemi atlandı");
  }

  const server = app.listen(config.port, () => {
    logger.info(`API ayakta: http://0.0.0.0:${config.port}`);
  });

  function gracefulShutdown(signal) {
    logger.info({ signal }, "Kapatma sinyali alindi");
    server.close(async () => {
      try {
        await db.closePool();
        logger.info("DB havuzu kapatildi");
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, "DB havuzu kapatilamadi");
        process.exit(1);
      }
    });
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
