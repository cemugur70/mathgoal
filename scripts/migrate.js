const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config();

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL zorunludur.");
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  const sqlDir = path.resolve(__dirname, "..", "sql");
  const files = fs
    .readdirSync(sqlDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log("Calistirilacak migration dosyasi yok.");
    return;
  }

  await client.connect();

  try {
    for (const file of files) {
      const filePath = path.join(sqlDir, file);
      const sql = fs.readFileSync(filePath, "utf8");
      await client.query(sql);
      console.log(`Uygulandi: ${file}`);
    }
    console.log("Tum migration dosyalari tamamlandi.");
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error("Migration hatasi:", error.message);
  process.exit(1);
});
