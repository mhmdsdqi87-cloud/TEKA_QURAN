import {
  Bot,
  ChartNoAxesColumn,
  Ear,
  GraduationCap,
  ListChecks,
  Mic2,
} from "lucide-react";

const FEATURES = [
  {
    icon: Ear,
    title: "AI همزمان گوش می‌دهد",
    desc: "تلاوت تو را قطعه‌به‌قطعه می‌شنود و خط به خط دنبال می‌کند؛ کلمه‌به‌کلمه جلو می‌روی.",
  },
  {
    icon: Bot,
    title: "تصحیح لحظه‌ای خطا",
    desc: "کلمهٔ اشتباه سرخ، کلمهٔ جاافتاده خط‌خورده؛ همان لحظه می‌بینی و فوری اصلاح می‌کنی.",
  },
  {
    icon: GraduationCap,
    title: "معلم قرآنی هوشمند",
    desc: "پایان هر جلسه، معلم AI جمع‌بندی می‌کند، نکتهٔ تجویدی می‌دهد و مسیر بهتر نشان می‌دهد.",
  },
  {
    icon: ListChecks,
    title: "آزمون حفظ چهارسطحی",
    desc: "از پنهان‌سازی ۲۵٪ تا حافظ کامل؛ با راهنمای حرف اول، حافظه‌ات را محک بزن.",
  },
  {
    icon: Mic2,
    title: "تمرین با صدای قاری",
    desc: "هر آیه را با صدای شیخ العفاسی بشنو، تکرار کن و همراهش تلاوت کن.",
  },
  {
    icon: ChartNoAxesColumn,
    title: "آمار، روند و نشان‌ها",
    desc: "دقت، روزهای پیوسته و روند پیشرفت با نمودار؛ با نشان‌ها انگیزه‌ات را نگه دار.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24" aria-label="امکانات">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-black sm:text-3xl">
          چرا <span className="text-gold text-glow-gold">حافظ</span>؟
        </h2>
        <p className="max-w-lg text-sm leading-7 text-muted-foreground">
          یک معلم قرآنی صبور که همیشه در دسترس است؛ برای حافظانی که معلم و هم‌تمرین ندارند.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article
            key={f.title}
            className="glass-card group rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_-20px_oklch(0.8_0.13_85/0.45)]"
          >
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 transition-transform group-hover:scale-110">
              <f.icon className="size-5 text-gold" aria-hidden="true" />
            </span>
            <h3 className="mb-1.5 font-bold text-foreground">{f.title}</h3>
            <p className="text-xs leading-6 text-muted-foreground">{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
