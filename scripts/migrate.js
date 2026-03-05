const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config();

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function ensureAllColumnsTable(client) {
  const allColumnsPath = path.resolve(__dirname, "..", "all_columns.txt");
  if (!fs.existsSync(allColumnsPath)) {
    console.log("all_columns.txt bulunamadi, match_all_columns tablosu atlandi.");
    return;
  }

  const rawColumns = fs.readFileSync(allColumnsPath, "utf8");
  const allColumns = rawColumns
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!allColumns.length) {
    console.log("all_columns.txt bos, match_all_columns tablosu atlandi.");
    return;
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS match_all_columns (
      id BIGSERIAL PRIMARY KEY,
      match_id TEXT NOT NULL,
      bookmaker TEXT NOT NULL,
      source_url TEXT NOT NULL,
      scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (match_id, bookmaker)
    )
  `);

  const existingResult = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match_all_columns'
  `);
  const existingColumns = new Set(existingResult.rows.map((row) => row.column_name));

  let addedColumnCount = 0;
  for (const columnName of allColumns) {
    if (existingColumns.has(columnName)) {
      continue;
    }
    await client.query(
      `ALTER TABLE match_all_columns ADD COLUMN ${quoteIdentifier(columnName)} TEXT`,
    );
    addedColumnCount += 1;
  }

  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_match_all_columns_bookmaker ON match_all_columns (bookmaker)",
  );
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_match_all_columns_scraped_at ON match_all_columns (scraped_at DESC)",
  );

  console.log(
    `match_all_columns hazir. Kolon sayisi: ${allColumns.length}, yeni eklenen: ${addedColumnCount}`,
  );
}

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

    await ensureAllColumnsTable(client);
    console.log("Tum migration dosyalari tamamlandi.");
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error("Migration hatasi:", error.message);
  process.exit(1);
});
