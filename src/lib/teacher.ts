import { db, ensureSchema } from "@/lib/db";

/**
 * موتور «معلم تحفیظ» — پروفایل واقعی حافظ را از دیتابیس می‌سازد تا
 * استادِ هوش مصنوعی به‌جای جواب‌های عمومی، شخصی و مبتنی بر عملکرد واقعی حرف بزند.
 */

export interface MistakeItem {
  type?: string;
  kind?: string;
  ayahNumber?: number;
  expected?: string;
  heard?: string;
}

export interface TeacherContext {
  sessions: number;
  avgAccuracy: number;
  bestAccuracy: number;
  totalAyat: number;
  perfectCount: number;
  streakDays: number;
  /** ضعیف‌ترین سوره‌ها (با حداقل ۱ جلسه) */
  weakSurahs: { surahName: string; avgAccuracy: number; sessions: number }[];
  /** قوی‌ترین سوره‌ها */
  strongSurahs: { surahName: string; avgAccuracy: number; sessions: number }[];
  /** خطاهای تکرارشوندهٔ اخیر */
  recentMistakes: { surahName: string; ayahNumber: number; kind: string; expected: string }[];
  /** خلاصهٔ جلسهٔ آخر */
  lastSession: { surahName: string; accuracy: number; daysAgo: number; ayahCount: number } | null;
}

const EMPTY_CONTEXT: TeacherContext = {
  sessions: 0,
  avgAccuracy: 0,
  bestAccuracy: 0,
  totalAyat: 0,
  perfectCount: 0,
  streakDays: 0,
  weakSurahs: [],
  strongSurahs: [],
  recentMistakes: [],
  lastSession: null,
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** استخراج پروفایل واقعی حافظ از جلسات ثبت‌شده */
export async function getTeacherContext(userId: string): Promise<TeacherContext> {
  try {
    await ensureSchema();
    const sessions = await db.session.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    if (sessions.length === 0) return EMPTY_CONTEXT;

    const count = sessions.length;
    const avgAccuracy = Math.round((sessions.reduce((a, s) => a + s.accuracy, 0) / count) * 10) / 10;
    const bestAccuracy = Math.max(...sessions.map((s) => s.accuracy));
    const totalAyat = sessions.reduce((a, s) => a + (s.ayahTo - s.ayahFrom + 1), 0);
    const perfectCount = sessions.filter((s) => s.accuracy >= 99.5).length;

    // streak
    const now = new Date();
    const daySet = new Set(sessions.map((s) => dayKey(new Date(s.createdAt))));
    let streakDays = 0;
    const cursor = new Date(now);
    if (!daySet.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 400; i++) {
      if (daySet.has(dayKey(cursor))) {
        streakDays++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }

    // سوره‌ها
    const surahMap = new Map<string, { name: string; sessions: number; sum: number }>();
    for (const s of sessions) {
      const prev = surahMap.get(s.surahName) ?? { name: s.surahName, sessions: 0, sum: 0 };
      prev.sessions++;
      prev.sum += s.accuracy;
      surahMap.set(s.surahName, prev);
    }
    const perSurah = Array.from(surahMap.values()).map((v) => ({
      surahName: v.name,
      sessions: v.sessions,
      avgAccuracy: Math.round((v.sum / v.sessions) * 10) / 10,
    }));
    // ضعیف‌ترین: میانگین پایین‌تر، ولی سوره‌هایی که در آن‌ها جلسهٔ جدی داشته (>=1 جلسه)
    const weakSurahs = [...perSurah].sort((a, b) => a.avgAccuracy - b.avgAccuracy).slice(0, 3);
    const strongSurahs = [...perSurah].sort((a, b) => b.avgAccuracy - a.avgAccuracy).slice(0, 2);

    // خطاهای اخیر (از ۳ جلسهٔ آخر)
    const recentMistakes: TeacherContext["recentMistakes"] = [];
    for (const s of sessions.slice(-3).reverse()) {
      try {
        const arr = JSON.parse(s.mistakes) as MistakeItem[];
        if (!Array.isArray(arr)) continue;
        for (const m of arr.slice(0, 3)) {
          recentMistakes.push({
            surahName: s.surahName,
            ayahNumber: Number(m.ayahNumber ?? 0),
            kind: String(m.type ?? m.kind ?? "wrong"),
            expected: String(m.expected ?? "").slice(0, 40),
          });
          if (recentMistakes.length >= 6) break;
        }
      } catch {
        // خطای JSON بی‌اهمیت
      }
      if (recentMistakes.length >= 6) break;
    }

    // جلسهٔ آخر
    const last = sessions[count - 1];
    const daysAgo = Math.floor((now.getTime() - new Date(last.createdAt).getTime()) / 86_400_000);
    const lastSession = {
      surahName: last.surahName,
      accuracy: Math.round(last.accuracy * 10) / 10,
      daysAgo,
      ayahCount: last.ayahTo - last.ayahFrom + 1,
    };

    return {
      sessions: count,
      avgAccuracy,
      bestAccuracy,
      totalAyat,
      perfectCount,
      streakDays,
      weakSurahs,
      strongSurahs,
      recentMistakes,
      lastSession,
    };
  } catch (err) {
    console.error("teacher context error:", err);
    return EMPTY_CONTEXT;
  }
}

/** بلوک متنی پروفایل حافظ — به پرامپت سیستم اضافه می‌شود */
export function profileBlock(name: string, ctx: TeacherContext): string {
  if (ctx.sessions === 0) {
    return `پروفایل حافظ:
- نام: ${name}
- هنوز هیچ جلسهٔ تلاوتی ثبت نکرده است؛ او را با محبت تشویق کن اولین جلسه‌اش را در «استودیو» شروع کند (از سورهٔ کوچک مثل حمد یا اخلاص شروع کردن را پیشنهاد بده).`;
  }

  const lines: string[] = [
    "پروفایل واقعی حافظ (از آمار واقعی اپ — این‌ها را جدی بگیر و در جواب‌هایت استفاده کن):",
    `- نام: ${name}`,
    `- تعداد جلسات تلاوت: ${ctx.sessions}`,
    `- میانگین دقت: ${ctx.avgAccuracy}٪ | بهترین دقت: ${ctx.bestAccuracy}٪ | تلاوت بی‌نقص: ${ctx.perfectCount} بار`,
    `- مجموع آیات تمرین‌شده: ${ctx.totalAyat} آیه | روزهای پیوستهٔ تمرین (استریک): ${ctx.streakDays} روز`,
  ];

  if (ctx.lastSession) {
    lines.push(
      `- آخرین جلسه: سورهٔ ${ctx.lastSession.surahName} (${ctx.lastSession.ayahCount} آیه) با دقت ${ctx.lastSession.accuracy}٪، ${ctx.lastSession.daysAgo === 0 ? "امروز" : `${ctx.lastSession.daysAgo} روز پیش`}`
    );
  }
  if (ctx.weakSurahs.length > 0) {
    lines.push(
      `- سوره‌های نیازمند تمرین بیشتر: ${ctx.weakSurahs.map((s) => `${s.surahName} (${s.avgAccuracy}٪)`).join("، ")}`
    );
  }
  if (ctx.strongSurahs.length > 0) {
    lines.push(
      `- نقاط قوت: ${ctx.strongSurahs.map((s) => `${s.surahName} (${s.avgAccuracy}٪)`).join("، ")}`
    );
  }
  if (ctx.recentMistakes.length > 0) {
    lines.push(
      `- خطاهای اخیر: ${ctx.recentMistakes
        .map((m) => `${m.surahName} ${m.ayahNumber} (${m.kind === "missed" ? "جاافتادگی" : m.kind === "wrong" ? "کلمهٔ اشتباه" : "اضافه"}: «${m.expected}»)`)
        .join("؛ ")}`
    );
  }
  return lines.join("\n");
}
