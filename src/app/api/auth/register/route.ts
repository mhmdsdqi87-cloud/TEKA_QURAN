import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { authCookie, createAuthToken, hashPassword, validateCredentials } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface RegisterBody {
  username?: string;
  password?: string;
  name?: string;
}

/** ثبت‌نام حافظ جدید — پس از موفقیت، خودکار وارد می‌شود */
export async function POST(req: Request) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim().slice(0, 40);

  const invalid = validateCredentials(username, password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    await ensureSchema();
    const exists = await db.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json({ error: "این نام کاربری قبلاً گرفته شده است" }, { status: 409 });
    }
    const user = await db.user.create({
      data: { username, passwordHash: hashPassword(password), name: name || username },
    });
    const { token } = await createAuthToken(user.id);
    const res = NextResponse.json({
      user: { id: user.id, username: user.username, name: user.name },
    });
    res.cookies.set(authCookie(token));
    return res;
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json({ error: "ثبت‌نام در دسترس نبود؛ دوباره تلاش کن" }, { status: 500 });
  }
}
