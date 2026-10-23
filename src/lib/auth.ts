import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db, ensureSchema } from "@/lib/db";

export const AUTH_COOKIE = "hafez_session";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // ۳۰ روز

export interface AuthUserLite {
  id: string;
  username: string;
  name: string;
}

/* ---------- رمز عبور (scrypt) ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const test = scryptSync(password, salt, 64);
    const orig = Buffer.from(hash, "hex");
    return orig.length === test.length && timingSafeEqual(test, orig);
  } catch {
    return false;
  }
}

/* ---------- توکن نشست ---------- */

export async function createAuthToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.authToken.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export function authCookie(token: string) {
  return {
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export function clearAuthCookie() {
  return { ...authCookie(""), maxAge: 0 };
}

/** کاربر جاری از روی کوکی — اگر لاگین نباشد null */
export async function getAuthUser(): Promise<AuthUserLite | null> {
  try {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE)?.value ?? "";
    if (!token) return null;
    await ensureSchema();
    const row = await db.authToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, username: true, name: true } } },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      void db.authToken.delete({ where: { token } }).catch(() => {});
      return null;
    }
    return { id: row.user.id, username: row.user.username, name: row.user.name };
  } catch {
    return null;
  }
}

/* ---------- اعتبارسنجی ورودی ---------- */

export const USERNAME_RE = /^[a-zA-Z0-9_\u0600-\u06FF]{3,20}$/;

export function validateCredentials(username: string, password: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "نام کاربری باید ۳ تا ۲۰ نویسه باشد (حرف فارسی/انگلیسی، عدد، _)";
  }
  if (password.length < 4) return "رمز عبور باید حداقل ۴ نویسه باشد";
  if (password.length > 72) return "رمز عبور طولانی‌تر از حد مجاز است";
  return null;
}
