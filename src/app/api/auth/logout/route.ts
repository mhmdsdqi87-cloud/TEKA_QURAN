import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AUTH_COOKIE, clearAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** خروج — حذف توکن نشست */
export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE)?.value ?? "";
    if (token) {
      await db.authToken.delete({ where: { token } }).catch(() => {});
    }
  } catch {
    // حتی اگر حذف توکن شکست خورد، کوکی پاک می‌شود
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearAuthCookie());
  return res;
}
