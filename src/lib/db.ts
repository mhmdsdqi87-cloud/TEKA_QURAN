import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * پیکربندی Turso (دیتابیس ابری پایدار) — فقط وقتی هر دو env ست شده باشند.
 * اگر توکن نبود، بی‌سروصدا به SQLite محلی برمی‌گردیم تا توسعه/استارت سرد نشکند.
 */
function tursoConfig(): { url: string; authToken: string } | null {
  const url = process.env.TURSO_DATABASE_URL?.trim()
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim()
  // «file:» برای تست محلی مسیر درایور؛ «libsql://» آدرس واقعی Turso است
  if (url && authToken && (url.startsWith("libsql://") || url.startsWith("file:"))) {
    return { url, authToken };
  }
  return null;
}

/** آدرس SQLite محلی — روی ورکل (FS فقط-خواندنی) به /tmp می‌رود */
function localDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.VERCEL) return "file:/tmp/hafez.db";
  return undefined;
}

function createDb(): PrismaClient {
  const turso = tursoConfig();
  if (turso) {
    // دیتابیس ابری Turso — پایدار بین cold-startهای ورکل
    // نکته: تایپ‌های باندل‌شدهٔ runtime با driver-adapter-utils ظاهراً ناسازگارند
    // ولی نسخه‌های runtime جفت هماهنگ‌اند (هر دو 6.11.1)؛ فقط تایپ کست لازم است.
    type PrismaOptions = NonNullable<ConstructorParameters<typeof PrismaClient>[0]>;
    const adapter = new PrismaLibSQL(turso) as unknown as NonNullable<PrismaOptions["adapter"]>;
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
    });
  }
  // فایل SQLite محلی (توسعه یا ورکل بدون Turso)
  const dsUrl = localDatabaseUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
    ...(dsUrl ? { datasourceUrl: dsUrl } : {}),
  });
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

const globalForSchema = globalThis as unknown as {
  __hafezSchemaReady?: Promise<void>
}

/**
 * ساخت جداول در صورت نبود — با Turso یا SQLite محلی کار می‌کند.
 * روی ورکل فایل /tmp در هر شروع سرد خالی است، پس اسکیمای لازم
 * را در اولین درخواست می‌سازیم (بدون آسیب به دیتای موجود).
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
