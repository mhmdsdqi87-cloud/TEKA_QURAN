/**
 * تست مسیر درایور libsql/Turso — با فایل محلی شبیه‌سازی می‌شود (بدون نیاز به توکن واقعی)
 *   TURSO_DATABASE_URL=file:/tmp/hafez-turso-test.db TURSO_AUTH_TOKEN=test bun run scripts/driver-smoke.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

type PrismaOptions = NonNullable<ConstructorParameters<typeof PrismaClient>[0]>;

async function main() {
  const url = process.env.TURSO_DATABASE_URL!;
  console.log(`→ تست درایور روی: ${url}`);
  const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN! }) as unknown as NonNullable<PrismaOptions["adapter"]>;
  const db = new PrismaClient({ adapter });

  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`);

  const id = `test-${Date.now()}`;
  await db.user.create({
    data: { id, username: `smoke_${Date.now()}`, passwordHash: "x:y", name: "تست درایور" },
  });
  const found = await db.user.findUnique({ where: { id } });
  if (!found) throw new Error("کاربر ساخته‌شده خوانده نشد!");
  console.log(`✅ create/read روی درایور libsql موفق: ${found.username} / ${found.name}`);
  await db.user.delete({ where: { id } });
  console.log("✅ delete موفق — مسیر درایور کاملاً سالم است");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ خطای تست درایور:", err);
    process.exit(1);
  });
