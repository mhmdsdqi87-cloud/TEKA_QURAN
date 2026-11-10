"use client";

import { motion } from "framer-motion";
import { BookHeart, Code2, ExternalLink, Heart, Quote, Sparkles, Users } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

/**
 * بخش «درباره ما» — حکایت حافظ
 * بنیان‌گذار: محمد صادقی | تقدیم به مادرش: شعله نعمتی (هایلایت طلایی)
 * گروه TEKA — teka-web-beta.vercel.app
 */
export default function AboutSection() {
  return (
    <section id="about" className="scroll-mt-28" aria-label="درباره ما و تقدیم‌نامه">
      {/* تیتر بخش */}
      <div className="mb-8 flex flex-col items-center gap-1.5 text-center">
        <span className="text-[11px] font-bold tracking-widest text-gold/80">درباره ما</span>
        <h2 className="text-2xl font-black sm:text-3xl">
          حکایتِ <span className="text-gold text-glow-gold">حافظ</span>
        </h2>
        <span
          className="mt-1 h-px w-16 bg-gradient-to-l from-transparent via-gold to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* آیهٔ تقدیم‌نامه — اسراء ۲۴ */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card gold-border-glow mx-auto max-w-3xl rounded-3xl px-5 py-7 text-center sm:px-8"
      >
        <Sparkles className="mx-auto mb-3 size-4 text-gold/70" aria-hidden="true" />
        <p
          className="font-quran text-2xl leading-[2.2] text-gold text-glow-gold sm:text-3xl sm:leading-[2.2]"
          dir="rtl"
        >
          وَقُل رَّبِّ ٱرْحَمْهُمَا كَمَا رَبَّيَانِى صَغِيرًا
        </p>
        <p className="mt-3 text-xs leading-6 text-muted-foreground sm:text-sm">
          «و بگو: پروردگارا، به پدر و مادرم مهربانی کن، چنان‌که آن دو مرا در کودکی پروراندند.»
          <span className="mx-1.5 text-gold/60">—</span>
          <span className="font-bold text-gold/80">اسراء ۲۴</span>
        </p>
      </motion.div>

      {/* تقدیم‌نامهٔ اصلی — مادر */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto mt-8 max-w-3xl overflow-hidden rounded-3xl border border-gold/40 p-[1.5px]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(255,200,100,0.65), rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.05) 65%, rgba(16,185,129,0.45))",
        }}
      >
        <div
          className="relative rounded-[calc(1.5rem-1.5px)] px-5 py-9 text-center backdrop-blur-2xl sm:px-10"
          style={{
            backgroundImage:
              "linear-gradient(160deg, rgba(255,200,100,0.12), rgba(255,255,255,0.03) 45%, rgba(16,185,129,0.08))",
          }}
        >
          {/* هالهٔ نور پشت نام مادر */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl"
          />

          <span className="relative inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-4 py-1 text-[11px] font-black tracking-widest text-gold">
            <Heart className="size-3.5 fill-red-500 text-red-500" aria-hidden="true" />
            تقدیم به
          </span>

          {/* نام مادر — هایلایت طلایی */}
          <h3
            className="font-quran mt-4 bg-gradient-to-l from-[oklch(0.85_0.14_85)] via-gold to-[oklch(0.78_0.13_70)] bg-clip-text text-4xl font-black leading-snug text-transparent drop-shadow-[0_2px_18px_rgba(255,190,80,0.35)] sm:text-5xl"
            dir="rtl"
          >
            شعله نعمتی
          </h3>
          <p className="mt-2 text-sm font-bold text-gold/85 sm:text-base">
            بهترین مادر دنیا؛ اولین معلمِ قرآنِ من
          </p>

          <div className="mx-auto mt-6 max-w-2xl">
            <Quote className="mx-auto mb-3 size-5 text-gold/50" aria-hidden="true" />
            <blockquote className="text-sm leading-8 text-foreground/90 sm:text-[15px]">
              همهٔ پایهٔ این پروژه مدیون مادرم،{" "}
              <span className="rounded-md bg-gold/15 px-1.5 py-0.5 font-black text-gold">
                شعله نعمتی
              </span>
              ، هستم. کمترین کاری که می‌توانستم برایش بکنم، ساختنِ سایتی بود که راحت‌تر به حفظ
              قرآنش ادامه بدهد.
            </blockquote>
            <p className="mt-4 text-xs font-bold text-muted-foreground">
              —{" "}
              <span className="text-foreground/85">
                محمد صادقی
              </span>
              ، بنیان‌گذار گروه TEKA و سازندهٔ «حافظ»
            </p>
          </div>
        </div>
      </motion.div>

      {/* بنیان‌گذار + گروه TEKA */}
      <div className="mx-auto mt-8 grid max-w-4xl gap-5 md:grid-cols-2">
        {/* کارت بنیان‌گذار */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card rounded-3xl p-6"
        >
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.8_0.13_85)] to-[oklch(0.6_0.12_165)] text-2xl font-black text-[oklch(0.18_0.03_165)] shadow-lg ring-1 ring-gold/40"
            >
              م
            </span>
            <div>
              <h4 className="text-lg font-black">محمد صادقی</h4>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Code2 className="size-3.5 text-emerald-500" aria-hidden="true" />
                بنیان‌گذار و سازندهٔ «حافظ»
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-6 text-foreground/80">
            حافظِ قرآن و توسعه‌دهنده؛ «حافظ» را با یک هدف ساده ساخت: هر کسی — در هر جای دنیا، با هر
            گوشی — یک استاد حفظ شخصی کنارش باشد. میکروفونت را باز کن، بخوان؛ استادِ هوشمند گوش
            می‌دهد، کلمه‌به‌کلمه دنبالت می‌آید و لحظه‌ای راهنمایی‌ات می‌کند.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <BookHeart className="size-3.5 text-gold" aria-hidden="true" />
            «این اپ هدیه‌ای است به همهٔ مادرهایی که قلبشان به نور قرآن روشن است.»
          </p>
        </motion.div>

        {/* کارت گروه TEKA */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card gold-border-glow flex flex-col rounded-3xl p-6"
        >
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10 text-base font-black tracking-widest text-gold shadow-lg"
            >
              TEKA
            </span>
            <div>
              <h4 className="text-lg font-black">گروه TEKA</h4>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5 text-gold" aria-hidden="true" />
                تیم سازندهٔ تجربه‌های دیجیتال
              </p>
            </div>
          </div>
          <p className="mt-4 flex-1 text-xs leading-6 text-foreground/80">
            «حافظ» یکی از پروژه‌های گروه TEKA است؛ تیمی کوچک اما عاشق، که محصولاتش را با دقت،
            سادگی و احترام به کاربر می‌سازد. برای دیدن دیگر کارها و پروژه‌های ما، به سایت گروه
            سر بزن.
          </p>
          <a
            href="https://teka-web-beta.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-bold text-gold transition-all duration-300 hover:bg-gold/20 hover:shadow-[0_0_28px_-8px_rgba(255,200,100,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            دیدن سایت گروه TEKA
          </a>
        </motion.div>
      </div>
    </section>
  );
}
