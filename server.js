const config = require("./src/config");
const db = require("./src/db");
const { app, logger } = require("./src/app");

const server = app.listen(config.port, () => {
  logger.info(`API ayakta: http://0.0.0.0:${config.port}`);
});

async function gracefulShutdown(signal) {
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
