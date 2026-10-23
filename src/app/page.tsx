import SiteHeader from "@/components/site-header";
import SplashScreen from "@/components/splash-screen";
import HeroLauncher from "@/components/hero-launcher";
import FloatingVerses from "@/components/floating-verses";
import RecitationStudio from "@/components/recitation-studio";
import QuranSection from "@/components/quran-section";
import PracticeMode from "@/components/practice-mode";
import TestMode from "@/components/test-mode";
import StatsPanel from "@/components/stats-panel";
import FeaturesSection from "@/components/features-section";
import SiteFooter from "@/components/site-footer";
import AuthDialog from "@/components/auth-dialog";
import ChatWidget from "@/components/chat-widget";

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-1.5 text-center">
      <span className="text-[11px] font-bold tracking-widest text-gold/80">{kicker}</span>
      <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
      <span className="mt-1 h-px w-16 bg-gradient-to-l from-transparent via-gold to-transparent" aria-hidden="true" />
    </div>
  );
}

export default function Home() {
  return (
    <div id="top" className="relative flex min-h-screen flex-col">
      <SplashScreen />
      <SiteHeader />

      {/* پس‌زمینهٔ شناور آیات قرآن — پشت کل صفحه */}
      <FloatingVerses />

      <main className="flex-1">
        <HeroLauncher />

        <div className="mx-auto flex max-w-7xl flex-col gap-20 px-4 py-16 sm:gap-24 sm:px-6 sm:py-20">
          <RecitationStudio />

          <section id="quran" className="scroll-mt-24" aria-label="قرآن کریم">
            <SectionTitle kicker="کتاب الله" title="قرآن کریم" />
            <QuranSection />
          </section>

          <section aria-label="حالت‌های تمرین">
            <SectionTitle kicker="تمرین هوشمند" title="تمرین و آزمون حفظ" />
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
              <div className="glass-card gold-border-glow rounded-3xl p-5 sm:p-6">
                <h3 className="mb-4 text-lg font-black">
                  تمرین با صدای <span className="text-gold">قاری</span>
                </h3>
                <PracticeMode />
              </div>
              <div className="glass-card gold-border-glow rounded-3xl p-5 sm:p-6">
                <h3 className="mb-4 text-lg font-black">
                  آزمون <span className="text-gold">حفظ</span>
                </h3>
                <TestMode />
              </div>
            </div>
          </section>

          <section id="stats" className="scroll-mt-24" aria-label="آمار پیشرفت">
            <SectionTitle kicker="مسیر حفظ" title="آمار و پیشرفت تو" />
            <StatsPanel />
          </section>

          <FeaturesSection />
        </div>
      </main>

      <SiteFooter />

      {/* حساب کاربری + چت «پیام به استاد» (فقط با لاگین) */}
      <AuthDialog />
      <ChatWidget />
    </div>
  );
}
