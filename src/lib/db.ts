import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/** آدرس دیتابیس — روی ورکل (FS فقط-خواندنی) به /tmp می‌رود */
function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.VERCEL) return "file:/tmp/hafez.db";
  return undefined;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    ...(resolveDatabaseUrl() ? { datasourceUrl: resolveDatabaseUrl() } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

const globalForSchema = globalThis as unknown as {
  __hafezSchemaReady?: Promise<void>
}

/**
 * ساخت جداول در صورت نبود — روی ورکل فایل /tmp در هر شروع سرد خالی است،
 * پس اسکیمای لازم را در اولین درخواست می‌سازیم (بدون آسیب به دیتای محلی).
 */
export function ensureSchema(): Promise<void> {
  if (globalForSchema.__hafezSchemaReady) return globalForSchema.__hafezSchemaReady;
  const p = (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AuthToken" (
      "token" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" DATETIME NOT NULL
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuthToken_userId_idx" ON "AuthToken"("userId")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Session" (
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
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Session_userId_createdAt_idx" ON "Session"("userId", "createdAt")`);
  })();
  globalForSchema.__hafezSchemaReady = p.catch((err) => {
    globalForSchema.__hafezSchemaReady = undefined; // اجازهٔ تلاش مجدد
    throw err;
  });
  return globalForSchema.__hafezSchemaReady;
}
