"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  CalendarCheck2,
  CalendarDays,
  Flame,
  Gem,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toFa } from "@/components/surah-explorer";
import { getHafezUid } from "@/lib/user";
import { useAuth } from "@/lib/auth-store";
import type { StatsResponse } from "@/app/api/stats/route";

interface HistoryItem {
  id: string;
  surahName: string;
  ayahFrom: number;
  ayahTo: number;
  accuracy: number;
  durationSec: number;
  createdAt: string;
}

const BADGES: { key: string; label: string; test: (s: StatsResponse) => boolean; icon: string }[] = [
  { key: "first", label: "اولین تلاوت", test: (s) => s.sessions >= 1, icon: "🌱" },
  { key: "five", label: "۵ جلسه", test: (s) => s.sessions >= 5, icon: "📗" },
  { key: "ten", label: "۱۰ جلسه", test: (s) => s.sessions >= 10, icon: "📚" },
  { key: "acc90", label: "دقت ۹۰٪+", test: (s) => s.bestAccuracy >= 90, icon: "🎯" },
  { key: "perfect", label: "تلاوت بی‌نقص", test: (s) => s.perfectCount >= 1, icon: "💎" },
  { key: "perfect3", label: "۳ تلاوت بی‌نقص", test: (s) => s.perfectCount >= 3, icon: "👑" },
  { key: "streak3", label: "۳ روز پیوسته", test: (s) => s.streakDays >= 3, icon: "🔥" },
  { key: "streak7", label: "هفتهٔ پیوسته", test: (s) => s.streakDays >= 7, icon: "⭐" },
  { key: "ayat100", label: "۱۰۰ آیهٔ تمرین", test: (s) => s.totalAyat >= 100, icon: "🏆" },
  { key: "ayat500", label: "۵۰۰ آیهٔ تمرین", test: (s) => s.totalAyat >= 500, icon: "🚀" },
];

const EMPTY_STATS: StatsResponse = {
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

export default function StatsPanel() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, ready, openDialog } = useAuth();

  const load = useCallback(() => {
    // اگر وارد شده باشد، آمار حساب؛ وگرنه شناسهٔ محلی دستگاه
    const uid = useAuth.getState().user?.id ?? getHafezUid();
    Promise.all([
      fetch(`/api/stats?uid=${encodeURIComponent(uid)}`).then(
        (r) => r.json() as Promise<StatsResponse>
      ),
      fetch(`/api/sessions?uid=${encodeURIComponent(uid)}`).then(
        (r) => r.json() as Promise<{ sessions: HistoryItem[] }>
      ),
    ])
      .then(([st, hs]) => {
        setStats(st);
        setHistory(hs.sessions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onSaved = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("hafez:session-saved", onSaved);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("hafez:session-saved", onSaved);
    };
  }, [load, user?.id]);

  const s = stats ?? EMPTY_STATS;

  const cards = [
    { icon: CalendarCheck2, label: "جلسات تلاوت", value: toFa(s.sessions), color: "text-emerald-500" },
    { icon: CalendarDays, label: "آیات امروز", value: toFa(s.todayAyat), color: "text-gold" },
    { icon: Target, label: "میانگین دقت", value: `${toFa(s.avgAccuracy)}٪`, color: "text-emerald-500" },
    { icon: TrendingUp, label: "بهترین دقت", value: `${toFa(s.bestAccuracy)}٪`, color: "text-emerald-500" },
    { icon: Flame, label: "روزهای پیوسته", value: toFa(s.streakDays), color: "text-gold" },
    { icon: Gem, label: "تلاوت بی‌نقص", value: toFa(s.perfectCount), color: "text-emerald-500" },
    { icon: Award, label: "آیات تمرین‌شده", value: toFa(s.totalAyat), color: "text-emerald-500" },
    { icon: Timer, label: "دقایق تمرین", value: toFa(s.totalMinutes), color: "text-gold" },
  ];

  const chartData = s.trend.map((t, i) => ({
    name: `ج${toFa(i + 1)}`,
    accuracy: t.accuracy,
  }));

  const dailyData = s.daily.map((d) => ({ name: d.label, ayat: d.ayat }));

  return (
    <div className="space-y-6">
      {/* دعوت به ورود برای مهمان‌ها */}
      {ready && !user && (
        <div className="glass-card gold-border-glow flex flex-col items-center justify-between gap-3 rounded-2xl border-gold/30 p-4 text-center sm:flex-row sm:text-start">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-black text-foreground">آمارت دائمی بشه 🌙</span> با ساخت حساب،
            جلسات و نشان‌هایت روی هر دستگاهی همراهت می‌مانند و «پیام به استاد» باز می‌شود.
          </p>
          <Button
            size="sm"
            onClick={() => openDialog()}
            className="shrink-0 rounded-xl bg-gradient-to-l from-[oklch(0.8_0.13_85)] to-[oklch(0.68_0.12_82)] font-bold text-[oklch(0.2_0.04_80)] shadow hover:brightness-110"
          >
            ورود / ثبت‌نام
          </Button>
        </div>
      )}

      {/* کارت‌های آمار واقعی */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-2xl p-3.5 text-center">
            <c.icon className={`mx-auto size-4.5 ${c.color}`} aria-hidden="true" />
            <div className="mt-1.5 text-lg font-black">
              {loading ? <Skeleton className="mx-auto h-5 w-9" /> : c.value}
            </div>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* نشان‌ها */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
          <Award className="size-4 text-gold" aria-hidden="true" />
          نشان‌های تو
        </h3>
        <div className="flex flex-wrap gap-2">
          {BADGES.map((b) => {
            const earned = !loading && b.test(s);
            return (
              <span
                key={b.key}
                title={earned ? "کسب شده!" : "هنوز کسب نشده"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  earned
                    ? "border-gold/50 bg-gold/12 text-foreground shadow-[0_0_16px_-6px_oklch(0.8_0.13_85/0.6)]"
                    : "border-border/60 bg-transparent text-muted-foreground/50 opacity-60"
                }`}
              >
                <span aria-hidden="true">{b.icon}</span>
                {b.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* روند دقت */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-3 text-sm font-bold">روند دقت (آخرین جلسات)</h3>
          {loading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : chartData.length === 0 ? (
            <p className="py-12 text-center text-xs text-muted-foreground">
              هنوز جلسه‌ای ثبت نشده؛ اولین تلاوت را شروع کن تا اینجا واقعی پر شود!
            </p>
          ) : (
            <div className="h-48" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.02 120 / 0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.21 0.025 165)",
                      border: "1px solid oklch(0.8 0.13 85 / 0.3)",
                      borderRadius: 12,
                      fontSize: 12,
                      direction: "rtl",
                    }}
                    formatter={(v: number) => [`${v}٪`, "دقت"]}
                  />
                  <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.accuracy >= 90
                            ? "oklch(0.72 0.13 165)"
                            : d.accuracy >= 70
                              ? "oklch(0.8 0.13 85)"
                              : "oklch(0.65 0.2 25)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* فعالیت ۱۴ روز اخیر */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-3 text-sm font-bold">فعالیت ۱۴ روز اخیر (آیات)</h3>
          {loading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : dailyData.every((d) => d.ayat === 0) ? (
            <p className="py-12 text-center text-xs text-muted-foreground">
              هنوز فعالیتی ثبت نشده؛ هر روز تمرین کن تا نمودار پر شود.
            </p>
          ) : (
            <div className="h-48" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.02 120 / 0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.21 0.025 165)",
                      border: "1px solid oklch(0.8 0.13 85 / 0.3)",
                      borderRadius: 12,
                      fontSize: 12,
                      direction: "rtl",
                    }}
                    formatter={(v: number) => [toFa(v), "آیه"]}
                  />
                  <Bar dataKey="ayat" radius={[6, 6, 0, 0]} fill="oklch(0.8 0.13 85)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* تاریخچه */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="mb-3 text-sm font-bold">آخرین جلسات تو</h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            تاریخچه‌ای نیست؛ پس از پایان هر جلسهٔ تلاوت، اینجا ثبت می‌شود.
          </p>
        ) : (
          <ul className="nice-scroll max-h-56 space-y-1.5 overflow-y-auto pl-1">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2 text-xs"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-quran text-sm text-foreground">{h.surahName.replace("سُورَةُ ", "")}</span>
                  <span className="mr-2 text-muted-foreground">
                    آیهٔ {toFa(h.ayahFrom)}–{toFa(h.ayahTo)}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(h.createdAt).toLocaleDateString("fa-IR", { month: "short", day: "numeric" })}
                </span>
                <Badge
                  className={`shrink-0 ${
                    h.accuracy >= 90
                      ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400"
                      : h.accuracy >= 70
                        ? "bg-gold/20 text-gold"
                        : "bg-red-500/15 text-red-500"
                  }`}
                >
                  {toFa(h.accuracy)}٪
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
