import { Heart, ExternalLink } from "lucide-react";
import pkg from "../../package.json";

/**
 * فوتر شیشه‌ای — «ساخته شده توسط گروه TEKA»
 * کل نشان روی سایت گروه TEKA کلیک می‌شود (تب جدید).
 */
export default function SiteFooter() {
  return (
    <footer className="mt-auto px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 sm:px-6">
      <div
        className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2.5 rounded-2xl border border-gold/25 bg-white/10 px-4 py-3.5 text-center shadow-[0_8px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur-2xl dark:bg-white/5 sm:flex-row sm:px-6"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 40%, rgba(255,215,130,0.06))",
        }}
      >
        <p className="font-quran text-sm text-gold/90">
          وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ ۖ فَهَلْ مِن مُّدَّكِرٍ
        </p>

        {/* نشان کلیک‌خور گروه TEKA → سایت گروه */}
        <a
          href="https://teka-web-beta.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="سایت گروه TEKA — ساخته شده توسط گروه تکا"
          title="ورود به سایت گروه TEKA"
          className="group flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs text-muted-foreground transition-all duration-300 hover:border-gold/60 hover:bg-gold/20 hover:shadow-[0_0_24px_-6px_rgba(255,200,100,0.5)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          ساخته شده توسط گروه
          <span className="relative rounded-lg bg-gradient-to-l from-gold/25 via-gold/15 to-transparent px-2 py-0.5 text-sm font-black tracking-wider text-gold text-glow-gold transition-transform duration-300 group-hover:scale-105">
            TEKA
          </span>
          <Heart
            className="size-3.5 fill-red-500 text-red-500 transition-transform duration-300 group-hover:scale-125"
            aria-hidden="true"
          />
          <ExternalLink
            className="size-3.5 text-gold/70 opacity-60 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
          <span
            dir="ltr"
            title={`نسخهٔ حافظ — ${pkg.version}`}
            className="ms-0.5 rounded-md border border-gold/25 bg-gold/5 px-1.5 py-0.5 font-mono text-[10px] leading-none text-gold/70 transition-colors group-hover:border-gold/50 group-hover:text-gold"
          >
            v{pkg.version}
          </span>
        </a>
      </div>
    </footer>
  );
}
