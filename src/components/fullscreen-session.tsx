"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, Minimize2, Pause, Play, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveAyahView from "@/components/live-ayah-view";
import { toFa } from "@/components/surah-explorer";
import { useStudio } from "@/lib/store";
import { useSettings } from "@/lib/settings";

/**
 * نمای تمام‌صفحهٔ تلاوت — با زدن دکمهٔ میکروفن باز می‌شود:
 * سایت پشت آن کاملاً فریز می‌شود (قفل اسکرول) و فقط متن آیات داخل همین
 * نمای ثابت پیمایش می‌کند — دیگر هیچ پرش و تکانی بالا/پایین صفحه نیست.
 */
export default function FullscreenSession({
  onClose,
  onStop,
  onTogglePause,
}: {
  /** کوچک‌کردن — جلسه ادامه پیدا می‌کند */
  onClose: () => void;
  /** پایان جلسه و بازگشت به کارت بازبینی */
  onStop: () => void;
  onTogglePause: () => void;
}) {
  const phase = useStudio((s) => s.phase);
  const surah = useStudio((s) => s.surah);
  const accuracy = useStudio((s) => s.accuracy);
  const pos = useStudio((s) => s.pos);
  const wordsTotal = useStudio((s) => s.wordsTotal);
  const wordsCorrect = useStudio((s) => s.wordsCorrect);
  const elapsedSec = useStudio((s) => s.elapsedSec);
  const interim = useStudio((s) => s.interim);
  const feedback = useStudio((s) => s.feedback);
  const showTranslation = useStudio((s) => s.showTranslation);
  const setShowTranslation = useStudio((s) => s.setShowTranslation);

  // ——— قفل اسکرول بدنه: سایت پشت نمای تمام‌صفحه تکون نمی‌خورد ———
  // + بازگرداندن دقیق جای اسکرول هنگام بستن (کاربر همان‌جا که بود می‌ماند)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevScrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      window.scrollTo({ top: prevScrollY, behavior: "instant" as ScrollBehavior });
    };
  }, []);

  // Escape = کوچک‌کردن
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const recording = phase === "recording";
  const progressPct = wordsTotal > 0 ? Math.min(100, Math.round((pos / wordsTotal) * 100)) : 0;
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");
  const lastMsg = feedback[feedback.length - 1];

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0.6 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0.4 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="fixed inset-0 z-[95] flex flex-col overflow-hidden bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="تلاوت تمام‌صفحه"
      style={{
        backgroundImage:
          "radial-gradient(1200px 500px at 50% -10%, rgba(255,200,100,0.10), transparent 60%), radial-gradient(900px 400px at 50% 110%, rgba(16,185,129,0.08), transparent 60%)",
      }}
    >
      {/* نوار بالا: وضعیت زنده + زمان + دقت */}
      <header className="relative z-10 shrink-0 border-b border-gold/15 bg-card/40 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* نشان زنده */}
            <span
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
                recording
                  ? "border-red-500/40 bg-red-500/10 text-red-500"
                  : "border-gold/40 bg-gold/10 text-gold"
              }`}
            >
              <span
                className={`size-1.5 rounded-full bg-current ${recording ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
              {recording ? "در حال شنیدن" : phase === "paused" ? "مکث" : "آماده"}
            </span>
            <span className="truncate font-quran text-sm text-gold sm:text-base">
              {surah?.name.replace("سُورَةُ ", "") ?? "—"}
              <span className="mr-1.5 text-[11px] text-muted-foreground">
                {toFa(useStudio.getState().fromAyah)}–{toFa(useStudio.getState().toAyah)}
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {/* حلقهٔ دقت کوچک */}
            <div className="relative size-10" role="img" aria-label={`دقت ${accuracy} درصد`}>
              <svg viewBox="0 0 40 40" className="size-10 -rotate-90">
                <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-muted" />
                <circle
                  cx="20" cy="20" r="16" fill="none" strokeWidth="4" strokeLinecap="round"
                  className={accuracy >= 90 ? "stroke-emerald-500" : accuracy >= 70 ? "stroke-gold" : "stroke-red-500"}
                  strokeDasharray={`${(accuracy / 100) * 100.5} 100.5`}
                  style={{ transition: "stroke-dasharray 0.6s ease" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                {toFa(accuracy)}٪
              </span>
            </div>
            <span className="font-mono text-sm font-bold tabular-nums text-foreground/85" aria-label="زمان تلاوت">
              {toFa(mm)}:{toFa(ss)}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 rounded-xl"
              onClick={onClose}
              aria-label="کوچک‌کردن نمای تمام‌صفحه"
              title="کوچک‌کردن (Esc)"
            >
              <Minimize2 className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* متن زنده — تنها ناحیهٔ پیمایش‌پذیر */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
          <LiveAyahView variant="fs" />
        </div>

        {/* ترنسکریپت زندهٔ موقت — «همین حالا داری می‌خوانی» */}
        <div className="mx-auto mt-3 w-full max-w-4xl" aria-live="polite">
          <div
            className={`flex min-h-11 items-center gap-2.5 rounded-2xl border px-4 py-2.5 backdrop-blur-xl transition-all duration-300 ${
              interim
                ? "border-emerald-500/35 bg-emerald-500/8 shadow-[0_0_30px_-12px_rgba(16,185,129,0.5)]"
                : "border-gold/15 bg-card/30"
            }`}
          >
            <Mic
              className={`size-4 shrink-0 ${interim ? "text-emerald-500" : "text-muted-foreground/50"} ${recording ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
            {interim ? (
              <p dir="rtl" className="font-quran truncate text-sm leading-6 text-foreground/90 sm:text-base">
                {interim}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/70">
                {recording ? "گوش می‌دهم… هر کلمه که می‌خوانی همین‌جا زنده ظاهر می‌شود" : "برای ادامه، پخش را بزن و تلاوت کن"}
              </p>
            )}
          </div>

          {/* آخرین پیام معلم */}
          {lastMsg && lastMsg.kind !== "heard" && (
            <div
              className={`mt-2 flex min-h-9 items-center gap-2 rounded-xl border px-3.5 py-2 text-[11px] leading-5 backdrop-blur-xl ${
                lastMsg.kind === "mistake"
                  ? "border-red-500/30 bg-red-500/8 text-red-600 dark:text-red-400"
                  : lastMsg.kind === "praise"
                    ? "border-gold/30 bg-gold/8 text-gold"
                    : "border-border/60 bg-card/30 text-muted-foreground"
              }`}
            >
              <span aria-hidden="true">{lastMsg.kind === "mistake" ? "⚠" : lastMsg.kind === "praise" ? "✦" : "✧"}</span>
              <p className="line-clamp-2">{lastMsg.text}</p>
            </div>
          )}
        </div>
      </main>

      {/* نوار پایین: پیشرفت + کنترل‌ها */}
      <footer className="relative z-10 shrink-0 border-t border-gold/15 bg-card/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-4xl">
          {/* نوار پیشرفت + شمارنده */}
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-l from-gold to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
              {toFa(pos)}/{toFa(wordsTotal)} · ✓{toFa(wordsCorrect)}
            </span>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button
              size="icon"
              variant="outline"
              className="size-12 rounded-full"
              onClick={() => setShowTranslation(!showTranslation)}
              aria-label={showTranslation ? "پنهان‌کردن ترجمه" : "نمایش ترجمه"}
              title="ترجمهٔ فارسی"
            >
              <Volume2 className="size-5" />
            </Button>

            {/* مکث/ادامه */}
            <Button
              size="icon"
              variant="outline"
              className="size-14 rounded-full"
              onClick={onTogglePause}
              aria-label={recording ? "مکث" : "ادامهٔ تلاوت"}
            >
              {recording ? <Pause className="size-6" /> : <Play className="size-6" />}
            </Button>

            {/* پایان جلسه */}
            <button
              type="button"
              onClick={onStop}
              aria-label="پایان تلاوت و دیدن تحلیل"
              className="rec-pulse flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
            >
              <Square className="size-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
