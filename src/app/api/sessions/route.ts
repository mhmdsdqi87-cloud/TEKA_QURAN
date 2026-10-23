import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SaveBody {
  userId?: string;
  surahNumber?: number;
  surahName?: string;
  ayahFrom?: number;
  ayahTo?: number;
  accuracy?: number;
  durationSec?: number;
  wordsTotal?: number;
  wordsCorrect?: number;
  mistakes?: unknown[];
}

const UID_MAX = 64;

/** ذخیرهٔ جلسهٔ تلاوت — فقط برای حافظان واردشده */
export async function POST(req: Request) {
  try {
    // قفل لاگین: مهمان اجازهٔ ذخیرهٔ جلسه ندارد
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "برای ذخیرهٔ جلسه، ابتدا وارد حساب شو", needAuth: true },
        { status: 401 }
      );
    }
    await ensureSchema();
    const body = (await req.json()) as SaveBody;
    const surahNumber = Number(body.surahNumber);
    const ayahFrom = Number(body.ayahFrom);
    const ayahTo = Number(body.ayahTo);
    const accuracy = Number(body.accuracy);
    const userId = authUser.id;
    if (
      !userId ||
      !Number.isFinite(surahNumber) || surahNumber < 1 || surahNumber > 114 ||
      !Number.isFinite(ayahFrom) || !Number.isFinite(ayahTo) ||
      ayahFrom < 1 || ayahTo < ayahFrom ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100
    ) {
      return NextResponse.json({ error: "داده‌های جلسه نامعتبر است" }, { status: 400 });
    }
    const session = await db.session.create({
      data: {
        userId,
        surahNumber,
        surahName: String(body.surahName ?? "").slice(0, 120),
        ayahFrom,
        ayahTo,
        accuracy,
        durationSec: Math.max(0, Math.round(Number(body.durationSec) || 0)),
        wordsTotal: Math.max(0, Math.round(Number(body.wordsTotal) || 0)),
        wordsCorrect: Math.max(0, Math.round(Number(body.wordsCorrect) || 0)),
        mistakes: JSON.stringify(Array.isArray(body.mistakes) ? body.mistakes.slice(0, 100) : []),
      },
    });
    return NextResponse.json({ ok: true, id: session.id });
  } catch (err) {
    console.error("session save error:", err);
    return NextResponse.json({ error: "ذخیرهٔ جلسه ناموفق بود" }, { status: 500 });
  }
}

/** آخرین جلسات یک حافظ */
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const authUser = await getAuthUser();
    const uid = authUser ? authUser.id : (url.searchParams.get("uid") ?? "").slice(0, UID_MAX);
    const sessions = await db.session.findMany({
      where: uid ? { userId: uid } : undefined,
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({
      sessions: sessions.map((s) => ({ ...s, mistakes: JSON.parse(s.mistakes) as unknown[] })),
    });
  } catch (err) {
    console.error("session list error:", err);
    return NextResponse.json({ sessions: [] });
  }
}
