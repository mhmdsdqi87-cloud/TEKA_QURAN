"use client";

import { useState, type CSSProperties } from "react";
import { motion, type Variants } from "framer-motion";
import { ChevronDown, LogIn, Mic } from "lucide-react";
import { useAuth } from "@/lib/auth-store";

type HeroSectionProps = {
  /** با کلیک روی CTA صدا زده می‌شود (۹۵۰ms پس از شروع انیمیشن پرتاب) */
  onStart: () => void;
};

/* انیمیشن‌های ورود — پلکانی */
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const ctaStyle: CSSProperties = {
  background:
    "linear-gradient(140deg, oklch(0.9 0.09 96) 0%, oklch(0.8 0.13 86) 48%, oklch(0.64 0.12 78) 100%)",
  boxShadow:
    "0 14px 44px -12px oklch(0.8 0.13 85 / 0.7), 0 4px 20px -8px oklch(0.62 0.12 165 / 0.45), inset 0 1px 0 oklch(0.96 0.05 95 / 0.6)",
};

export default function HeroSection({ onStart }: HeroSectionProps) {
  const [launching, setLaunching] = useState(false);
  const { user, ready, openDialog } = useAuth();

  const handleStart = () => {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(onStart, 950);
  };

  return (
    <section
      dir="rtl"
      aria-label="معرفی حافظ"
      className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden"
    >
      {/* پس‌زمینهٔ سینمایی کعبه (تصویر + فالبک گرادیانی) */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        animate={launching ? { scale: 1.22, filter: "brightness(1.35) saturate(1.15)" } : { scale: 1.06 }}
        transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        style={{
          backgroundImage: "url('/kaaba-hero.png'), linear-gradient(180deg, oklch(0.17 0.02 165) 0%, oklch(0.11 0.02 170) 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center 38%",
        }}
      />

      {/* وینیت و لایه‌های تیره برای خوانایی متن */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(46% 34% at 50% 52%, oklch(0.08 0.02 170 / 0.82) 0%, oklch(0.08 0.02 170 / 0.55) 55%, transparent 100%), radial-gradient(120% 90% at 50% 30%, transparent 30%, oklch(0.08 0.02 170 / 0.72) 100%), linear-gradient(180deg, oklch(0.1 0.02 168 / 0.62) 0%, transparent 32%, transparent 55%, oklch(0.1 0.02 170 / 0.9) 100%)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex w-full max-w-3xl flex-col items-center justify-center gap-5 px-5 pb-24 pt-28 text-center sm:gap-6"
      >
        {/* بسم‌الله */}
        <motion.div variants={item} className="flex items-center gap-3 sm:gap-4">
          <span aria-hidden="true" className="h-px w-10 bg-gradient-to-l from-transparent to-[oklch(0.8_0.13_85/0.8)] sm:w-16" />
          <span className="font-quran text-glow-gold text-sm text-[oklch(0.9_0.07_95)] sm:text-base">
            بسم الله الرحمن الرحیم
          </span>
          <span aria-hidden="true" className="h-px w-10 bg-gradient-to-r from-transparent to-[oklch(0.8_0.13_85/0.8)] sm:w-16" />
        </motion.div>

        {/* عنوان */}
        <motion.h1
          variants={item}
          className="text-glow-gold bg-gradient-to-l from-[oklch(0.95_0.07_95)] via-[oklch(0.85_0.12_86)] to-[oklch(0.78_0.11_163)] bg-clip-text text-[clamp(3.2rem,13vw,6.5rem)] font-black leading-[1.15] text-transparent drop-shadow-[0_6px_30px_oklch(0_0_0/0.6)]"
        >
          حـافـظ
        </motion.h1>

        {/* زیرعنوان */}
        <motion.p
          variants={item}
          className="max-w-xl text-sm leading-8 text-[oklch(0.95_0.015_100/0.95)] drop-shadow-[0_2px_14px_oklch(0_0_0/0.9)] sm:text-base sm:leading-9"
        >
          <span className="block">استودیوی تلاوت با هوش مصنوعی</span>
          <span className="block">
            تلاوت کن، <span className="font-semibold text-[oklch(0.9_0.1_95)]">AI گوش می‌دهد</span> و خط به خط تصحیح می‌کند
          </span>
        </motion.p>

        {/* دکمه‌ها */}
        <motion.div variants={item} className="mt-2 flex flex-col items-center gap-5 sm:mt-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={launching}
            className="group inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-extrabold text-[oklch(0.2_0.04_80)] transition-all duration-300 hover:scale-105 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:scale-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[oklch(0.8_0.13_85)] sm:text-xl"
            style={ctaStyle}
          >
            <Mic
              aria-hidden="true"
              className={`size-5 shrink-0 transition-transform duration-300 sm:size-6 ${
                launching ? "animate-pulse" : "group-hover:-rotate-12"
              }`}
            />
            {launching ? "…به سمت استودیو" : "شروع جلسهٔ تلاوت"}
          </button>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="#features"
              className="inline-flex items-center gap-1.5 text-sm text-[oklch(0.93_0.015_100/0.7)] transition-colors duration-300 hover:text-[oklch(0.9_0.08_95)] sm:text-base"
            >
              مشاهدهٔ امکانات
              <ChevronDown aria-hidden="true" className="size-4 animate-bounce sm:size-5" />
            </a>
            {/* دعوت به ورود — برای مهمان‌ها */}
            {ready && !user && (
              <button
                type="button"
                onClick={openDialog}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[oklch(0.8_0.13_85/0.45)] bg-[oklch(0.12_0.02_170/0.5)] px-4 py-2 text-sm font-bold text-[oklch(0.9_0.08_95)] backdrop-blur-sm transition-all duration-300 hover:bg-[oklch(0.8_0.13_85/0.15)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[oklch(0.8_0.13_85)] sm:text-base"
              >
                <LogIn aria-hidden="true" className="size-4" />
                ورود / ثبت‌نام — ساخت حساب و ذخیرهٔ آمار
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
