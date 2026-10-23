import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface StatsResponse {
  sessions: number;
  avgAccuracy: number;
  bestAccuracy: number;
  totalAyat: number;
  totalMinutes: number;
  streakDays: number;
  todayAyat: number;
  perfectCount: number;
  bySurah: { surahNumber: number; surahName: string; sessions: number; avgAccuracy: number }[];
  trend: { at: string; accuracy: number; surahName: string }[];
  daily: { day: string; label: string; ayat: number }[];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** آمار واقعی و شخصی هر حافظ بر اساس uid */
export async function GET(req: Request) {
  const empty: StatsResponse = {
    sessions: 0,
    avgAccuracy: 0,
    bestAccuracy: 0,
    totalAyat: 0,
    totalMinutes: 0,
    streakDays: 0,
    todayAyat: 0,
    perfectCount: 0,
    bySurah: [],
    trend: [],
    daily: [],
  };
  try {
    await ensureSchema();
    const url = new URL(req.url);
    // اگر لاگین باشد، همیشه آمار حساب خودش؛ وگرنه شناسهٔ محلی
    const authUser = await getAuthUser();
    const uid = authUser ? authUser.id : (url.searchParams.get("uid") ?? "").slice(0, 64);
    if (!uid) return NextResponse.json(empty);

    const sessions = await db.session.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });

    const count = sessions.length;
    if (count === 0) return NextResponse.json(empty);

    const avgAccuracy =
      Math.round((sessions.reduce((a, s) => a + s.accuracy, 0) / count) * 10) / 10;
    const bestAccuracy = Math.max(...sessions.map((s) => s.accuracy));
    const totalAyat = sessions.reduce((a, s) => a + (s.ayahTo - s.ayahFrom + 1), 0);
    const totalMinutes = Math.round(sessions.reduce((a, s) => a + s.durationSec, 0) / 60);
    const perfectCount = sessions.filter((s) => s.accuracy >= 99.5).length;

    // آیات امروز
    const now = new Date();
    const todayKeyStr = dayKey(now);
    const todayAyat = sessions
      .filter((s) => dayKey(new Date(s.createdAt)) === todayKeyStr)
      .reduce((a, s) => a + (s.ayahTo - s.ayahFrom + 1), 0);

    // streak روزهای متوالی
    const daySet = new Set(sessions.map((s) => dayKey(new Date(s.createdAt))));
    let streakDays = 0;
    const cursor = new Date(now);
    if (!daySet.has(todayKeyStr)) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 400; i++) {
      if (daySet.has(dayKey(cursor))) {
        streakDays++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }

    // به تفکیک سوره
    const surahMap = new Map<number, { surahName: string; sessions: number; sum: number }>();
    for (const s of sessions) {
      const prev = surahMap.get(s.surahNumber) ?? { surahName: s.surahName, sessions: 0, sum: 0 };
      prev.sessions++;
      prev.sum += s.accuracy;
      surahMap.set(s.surahNumber, prev);
    }
    const bySurah = Array.from(surahMap.entries())
      .map(([surahNumber, v]) => ({
        surahNumber,
        surahName: v.surahName,
        sessions: v.sessions,
        avgAccuracy: Math.round((v.sum / v.sessions) * 10) / 10,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);

    const trend = sessions.slice(-14).map((s) => ({
      at: s.createdAt.toISOString(),
      accuracy: s.accuracy,
      surahName: s.surahName,
    }));

    // فعالیت ۱۴ روز اخیر
    const daily: StatsResponse["daily"] = [];
    const faDays = ["ی", "د", "س", "چ", "پ", "ج", "ش"];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const ayat = sessions
        .filter((s) => dayKey(new Date(s.createdAt)) === k)
        .reduce((a, s) => a + (s.ayahTo - s.ayahFrom + 1), 0);
      daily.push({
        day: k,
        label: faDays[d.getDay()],
        ayat,
      });
    }

    return NextResponse.json({
      sessions: count,
      avgAccuracy,
      bestAccuracy,
      totalAyat,
      totalMinutes,
      streakDays,
      todayAyat,
      perfectCount,
      bySurah,
      trend,
      daily,
    } satisfies StatsResponse);
  } catch (err) {
    console.error("stats error:", err);
    return NextResponse.json(empty);
  }
}
