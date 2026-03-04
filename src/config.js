const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config();

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  dashboardPageSize: Number(process.env.DASHBOARD_PAGE_SIZE || 50),
  staticDir: path.resolve(__dirname, "..", "public"),
};

if (!config.databaseUrl) {
  // Keep startup strict in production to avoid silent misconfiguration.
  throw new Error("DATABASE_URL is required. Define it in environment variables.");
}

module.exports = config;
