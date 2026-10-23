/**
 * مهاجرت دیتای حافظ به Turso — بون اسکریپت یک‌بارمصرف (idempotent)
 *
 * مصرف:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=eyJ... bun run scripts/turso-migrate.ts
 * یا توکن را در .env بگذار و:
 *   bun run scripts/turso-migrate.ts
 *
 * کارها:
 *  ۱) ساخت جداول روی Turso (اگر نبود)
 *  ۲) کپی User/AuthToken/Session از SQLite محلی (db/custom.db) با INSERT OR IGNORE
 *  ۳) چاپ شمارش نهایی
 */
import { createClient, type Client } from "@libsql/client";
import { config } from "dotenv";

config(); // .env را می‌خواند

const TURSO_URL = (process.env.TURSO_DATABASE_URL ?? "").trim();
const TURSO_TOKEN = (process.env.TURSO_AUTH_TOKEN ?? "").trim();
const LOCAL_FILE = process.env.LOCAL_DB_FILE ?? "file:/home/z/my-project/db/custom.db";

if (!TURSO_TOKEN || !(TURSO_URL.startsWith("libsql://") || TURSO_URL.startsWith("file:"))) {
  console.error("❌ TURSO_DATABASE_URL و TURSO_AUTH_TOKEN لازم است.");
  process.exit(1);
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
  `CREATE TABLE IF NOT EXISTS "AuthToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "AuthToken_userId_idx" ON "AuthToken"("userId")`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "surahName" TEXT NOT NULL,
    "ayahFrom" INTEGER NOT NULL,
    "ayahTo" INTEGER NOT NULL,
    "accuracy" REAL NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "wordsTotal" INTEGER NOT NULL,
    "wordsCorrect" INTEGER NOT NULL,
    "mistakes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "Session_userId_createdAt_idx" ON "Session"("userId", "createdAt")`,
];

async function ensureSchema(turso: Client) {
  for (const sql of DDL) await turso.execute(sql);
  console.log("✅ اسکیمای Turso آماده است");
}

async function copyTable(
  turso: Client,
  local: Client,
  table: "User" | "AuthToken" | "Session",
  cols: string[]
) {
  const rows = await local.execute(`SELECT ${cols.map((c) => `"${c}"`).join(",")} FROM "${table}"`);
  let inserted = 0;
  for (const row of rows.rows) {
    const vals = cols.map((c) => row[c]);
    const placeholders = cols.map(() => "?").join(",");
    const res = await turso.execute({
      sql: `INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders})`,
      args: vals as (string | number | bigint | ArrayBuffer | null)[],
    });
    inserted += Number(res.rowsAffected ?? 0);
  }
  console.log(`✅ ${table}: ${rows.rows.length} ردیف خوانده، ${inserted} کپی شد`);
}

async function main() {
  console.log(`→ اتصال به Turso: ${TURSO_URL}`);
  const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  const local = createClient({ url: LOCAL_FILE });

  await turso.execute("SELECT 1");
  console.log("✅ اتصال Turso برقرار است");
  await ensureSchema(turso);

  await copyTable(turso, local, "User", ["id", "username", "passwordHash", "name", "createdAt"]);
  await copyTable(turso, local, "AuthToken", ["token", "userId", "createdAt", "expiresAt"]);
  await copyTable(turso, local, "Session", [
    "id", "userId", "surahNumber", "surahName", "ayahFrom", "ayahTo",
    "accuracy", "durationSec", "wordsTotal", "wordsCorrect", "mistakes", "createdAt",
  ]);

  const users = await turso.execute('SELECT COUNT(*) AS c FROM "User"');
  const sessions = await turso.execute('SELECT COUNT(*) AS c FROM "Session"');
  console.log(`→ نهایی روی Turso: ${users.rows[0].c} کاربر، ${sessions.rows[0].c} جلسه`);
  console.log("🎉 مهاجرت کامل شد");
}

main().catch((err) => {
  console.error("❌ خطای مهاجرت:", err instanceof Error ? err.message : err);
  process.exit(1);
});
