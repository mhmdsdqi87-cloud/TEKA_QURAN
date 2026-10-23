"use client";

import { useEffect, useMemo, useRef } from "react";
import type { TrackWord } from "@/lib/alignment";
import { useStudio } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { toFa } from "@/components/surah-explorer";

interface AyahGroup {
  ayahIdx: number;
  startIdx: number;
  words: TrackWord[];
}

export default function LiveAyahView() {
  const track = useStudio((s) => s.track);
  const ayahs = useStudio((s) => s.ayahs);
  const pos = useStudio((s) => s.pos);
  const preview = useStudio((s) => s.preview);
  const showTranslation = useStudio((s) => s.showTranslation);
  const phase = useStudio((s) => s.phase);
  const jumpTo = useStudio((s) => s.jumpTo);
  const autoScroll = useSettings((s) => s.autoScroll);
  const hideUpcoming = useSettings((s) => s.hideUpcoming);
  const textSize = useSettings((s) => s.textSize);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeAyahRef = useRef<HTMLDivElement>(null);

  // نمایش: اگر پیش‌نمایش زنده هست، جای‌گذاری‌های آن اولویت دارند
  const effPos = preview ? preview.pos : pos;
  const statusOf = (idx: number, base: TrackWord["status"]) =>
    preview?.overrides[idx] ?? base;

  const groups = useMemo<AyahGroup[]>(() => {
    const g: AyahGroup[] = [];
    track.forEach((w, i) => {
      if (g.length === 0 || g[g.length - 1].ayahIdx !== w.ayahIdx) {
        g.push({ ayahIdx: w.ayahIdx, startIdx: i, words: [] });
      }
      g[g.length - 1].words.push(w);
    });
    return g;
  }, [track]);

  const activeAyahIdx = useMemo(() => {
    if (effPos >= track.length) return groups.length - 1;
    const w = track[Math.min(effPos, track.length - 1)];
    return w ? w.ayahIdx : 0;
  }, [effPos, track, groups.length]);

  useEffect(() => {
    if (!autoScroll) return;
    const t = setTimeout(() => {
      activeAyahRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    return () => clearTimeout(t);
  }, [activeAyahIdx, autoScroll]);

  if (track.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gold/25 p-8 text-center">
        <p className="font-quran text-2xl text-muted-foreground/70">
          ٱخْتَرْ سُورَةً لِبَدْءِ ٱلتِّلَٰوَةِ
        </p>
        <p className="text-sm text-muted-foreground">
          سوره و بازهٔ آیات را انتخاب کن تا استودیو آمادهٔ تلاوت شود.
        </p>
      </div>
    );
  }

  const done = effPos >= track.length;

  // نقشهٔ اندازهٔ متن بر اساس تنظیمات
  const sizeMap = {
    sm: { active: "text-[1.3rem] leading-[2] sm:text-[1.5rem]", rest: "text-[1.05rem] leading-[1.85] sm:text-[1.2rem]" },
    md: { active: "text-[1.55rem] leading-[2.15] sm:text-[1.9rem]", rest: "text-[1.25rem] leading-[1.95] sm:text-[1.45rem]" },
    lg: { active: "text-[1.85rem] leading-[2.2] sm:text-[2.3rem]", rest: "text-[1.5rem] leading-[2] sm:text-[1.75rem]" },
  } as const;
  const sizes = sizeMap[textSize];
  // حالت تمرین کور: کلمات پیش‌رو محو می‌شوند تا از حفظ بخوانی
  const blind = hideUpcoming && (phase === "recording" || phase === "paused");

  return (
    <div
      ref={scrollRef}
      className="nice-scroll max-h-[52vh] min-h-56 overflow-y-auto rounded-2xl border border-gold/15 bg-card/50 p-4 sm:p-6"
      role="region"
      aria-label="متن زندهٔ تلاوت"
    >
      <div className="flex flex-col gap-5">
        {groups.map((g) => {
          const isActive = g.ayahIdx === activeAyahIdx && !done;
          const isPassed = g.ayahIdx < activeAyahIdx || done;
          const ayah = ayahs[g.ayahIdx];
          return (
            <div
              key={g.ayahIdx}
              ref={isActive ? activeAyahRef : undefined}
              className={`relative rounded-xl px-3 py-3 transition-all duration-500 sm:px-4 ${
                isActive
                  ? "bg-gold/8 shadow-[0_0_36px_-14px_oklch(0.8_0.13_85/0.5)] ring-1 ring-gold/35"
                  : isPassed
                    ? "opacity-60"
                    : "opacity-35"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* مدال شمارهٔ آیه */}
                <span
                  aria-label={`آیهٔ ${ayah?.n ?? ""}`}
                  className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    isActive
                      ? "border-gold bg-gold/20 text-gold"
                      : "border-gold/30 bg-transparent text-gold/70"
                  }`}
                >
                  {toFa(ayah?.n ?? g.ayahIdx + 1)}
                </span>
                <p
                  dir="rtl"
                  className={`font-quran flex-1 text-justify transition-all duration-500 ${
                    isActive ? sizes.active : sizes.rest
                  }`}
                >
                  {g.words.map((w, wi) => {
                    const idx = g.startIdx + wi;
                    const eff = statusOf(idx, w.status);
                    const isCurrent = idx === effPos && !done && (phase === "recording" || phase === "paused");
                    const veiled = blind && idx >= effPos && (eff === "pending" || isCurrent);
                    return (
                      <span
                        key={idx}
                        onClick={() => !veiled && jumpTo(idx)}
                        title={veiled ? undefined : `پرش به این کلمه (آیهٔ ${ayah?.n ?? ""})`}
                        className={`word word-${isCurrent ? "active" : eff} ${veiled ? "word-veiled" : ""} ${
                          !veiled && jumpable(eff) ? "cursor-pointer hover:bg-gold/10" : ""
                        }`}
                      >
                        {w.text}{" "}
                      </span>
                    );
                  })}
                </p>
              </div>
              {showTranslation && ayah && (
                <p
                  dir="rtl"
                  className="mt-1.5 pr-12 text-[12px] leading-6 text-muted-foreground/85"
                >
                  {ayah.fa}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {done && (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
          تمام آیات این بازه تلاوت شد — ماشاءالله!
        </div>
      )}

      {blind && !done && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/5 py-2.5 text-xs font-bold text-gold">
          حالت تمرین کور فعال است — کلمات پیش‌رو پنهان‌اند، از حفظ بخوان تا آشکار شوند
        </div>
      )}
    </div>
  );
}

function jumpable(status: TrackWord["status"]): boolean {
  return status === "pending" || status === "active";
}
