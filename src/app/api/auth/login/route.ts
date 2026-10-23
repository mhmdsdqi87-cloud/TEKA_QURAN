import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { authCookie, createAuthToken, USERNAME_RE, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface LoginBody {
  username?: string;
  password?: string;
}

/** ورود حافظ با نام کاربری و رمز */
export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "نام کاربری معتبر نیست" }, { status: 400 });
  }
  if (!password) return NextResponse.json({ error: "رمز عبور را وارد کن" }, { status: 400 });

  try {
    await ensureSchema();
    const user = await db.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
    }
    const { token } = await createAuthToken(user.id);
    const res = NextResponse.json({
      user: { id: user.id, username: user.username, name: user.name },
    });
    res.cookies.set(authCookie(token));
    return res;
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ error: "ورود در دسترس نبود؛ دوباره تلاش کن" }, { status: 500 });
  }
}
