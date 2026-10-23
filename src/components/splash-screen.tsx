"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { toFa } from "@/components/surah-explorer";

/** آیات سنگین و مشهور قرآن — ترتیب نمایش در اسپلش */
const VERSES = [
  {
    text: "إِنَّا نَحْنُ نَزَّلْنَا ٱلذِّكْرَ وَإِنَّا لَهُۥ لَحَٰفِظُونَ",
    ref: "سورهٔ الحجر — آیهٔ ۹",
  },
  {
    text: "ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ",
    ref: "آیةالکرسی — سورهٔ البقرة",
  },
  {
    text: "كِتَٰبٌ أَنزَلْنَٰهُ إِلَيْكَ مُبَٰرَكٌ لِّيَدَّبَّرُوٓا۟ ءَايَٰتِهِۦ وَلِيَتَفَكَّرَ أُولُو ٱلْأَلْبَٰبِ",
    ref: "سورهٔ ص — آیهٔ ۲۹",
  },
  {
    text: "أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ",
    ref: "سورهٔ الرعد — آیهٔ ۲۸",
  },
  {
    text: "وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ",
    ref: "سورهٔ القمر — آیهٔ ۱۷",
  },
  {
    text: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
    ref: "سورهٔ الشرح — آیهٔ ۵–۶",
  },
];

const TOTAL_MS = 13000;
const SLICE = TOTAL_MS / VERSES.length;

export default function SplashScreen() {
  // از اولین رندر نمایش داده می‌شود — اولین چیزی که کاربر می‌بیند
  const [show, setShow] = useState(true);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const readyRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    const tick = setInterval(() => {
      const timeP = (performance.now() - start) / TOTAL_MS;
      // تا آماده‌شدن دادهٔ قرآن حداکثر ۹۲٪ پیش می‌رود (لود واقعی)
      const p = Math.min(timeP, readyRef.current ? 1 : 0.92);
      setProgress(p);
      const i = Math.min(VERSES.length - 1, Math.floor((p * TOTAL_MS) / SLICE));
      setIdx(i);
      if (p >= 1) {
        clearInterval(tick);
        setShow(false);
      }
    }, 60);

    // پیش‌بارگذاری واقعی فهرست قرآن هنگام اسپلش (کش برای استودیو)
    const prewarm = fetch("/api/quran")
      .then((r) => r.json())
      .then((d: { surahs?: unknown[] }) => {
        try {
          if (d?.surahs) sessionStorage.setItem("hafez-surahs", JSON.stringify(d.surahs));
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined)
      .finally(() => {
        readyRef.current = true;
      });
    // اطمینان: بعد از ۱۷ ثانیه به‌هرحال تمام می‌شود
    const force = setTimeout(() => {
      readyRef.current = true;
    }, 17000);

    return () => {
      clearInterval(tick);
      clearTimeout(force);
      void prewarm;
    };
  }, []);

  // قفل اسکرول هنگام اسپلش
  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  const verse = VERSES[idx];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 110%, oklch(0.8 0.13 85 / 0.14) 0%, transparent 55%), linear-gradient(180deg, oklch(0.15 0.02 165) 0%, oklch(0.11 0.02 168) 55%, oklch(0.08 0.02 170) 100%)",
          }}
          role="dialog"
          aria-label="در حال بارگذاری حافظ"
        >
          {/* هالهٔ نورانی مرکز */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, oklch(0.8 0.13 85 / 0.12) 0%, transparent 62%)",
              animation: "splash-breath 3.4s ease-in-out infinite",
            }}
          />

          {/* آیات متوالی */}
          <div className="relative z-10 flex min-h-64 max-w-3xl flex-col items-center justify-center px-6 text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              >
                <p
                  dir="rtl"
                  className="font-quran text-glow-gold text-[clamp(1.35rem,4vw,2.3rem)] leading-[2.3] text-[oklch(0.93_0.04_95)]"
                >
                  {verse.text}
                </p>
                <p
                  dir="rtl"
                  className="mt-4 text-xs tracking-widest text-[oklch(0.8_0.13_85)]/80"
                >
                  ﴿ {verse.ref} ﴾
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* لوگو + نوار پیشرفت */}
          <div className="relative z-10 mt-10 flex flex-col items-center gap-4">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-l from-[oklch(0.88_0.1_95)] via-[oklch(0.8_0.13_85)] to-[oklch(0.72_0.12_163)] bg-clip-text text-4xl font-black tracking-wide text-transparent"
            >
              حـافـظ
            </motion.p>
            <div
              className="h-1 w-56 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-l from-[oklch(0.8_0.13_85)] to-[oklch(0.72_0.12_165)]"
                style={{ width: `${progress * 100}%`, transition: "width 0.12s linear" }}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <span>آماده‌سازی استودیوی تلاوت</span>
              <span className="font-bold text-[oklch(0.8_0.13_85)]/80">
                {toFa(Math.round(progress * 100))}٪
              </span>
            </div>
          </div>

          {/* رد کردن */}
          <button
            type="button"
            onClick={() => setShow(false)}
            className="absolute bottom-6 left-6 z-10 flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="رد کردن انیمیشن شروع"
          >
            <X className="size-3.5" aria-hidden="true" />
            رد کردن
          </button>

          <style>{`
            @keyframes splash-breath {
              0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.94); }
              50% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
