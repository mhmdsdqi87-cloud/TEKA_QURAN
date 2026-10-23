"use client";

import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";
import { BookOpenText, ChartNoAxesColumn, Download, LogIn, LogOut, Mic, Moon, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

const NAV = [
  { href: "#studio", label: "استودیو", icon: Mic },
  { href: "#quran", label: "قرآن", icon: BookOpenText },
  { href: "#features", label: "امکانات", icon: Sparkles },
  { href: "#stats", label: "آمار", icon: ChartNoAxesColumn },
];

/** رویداد پیش‌ازنصب کروم (اندروید/دسکتاپ) */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const { user, ready, refresh, openDialog, logout } = useAuth();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // دکمهٔ نصب برنامه (PWA) — فقط وقتی مرورگر اجازهٔ نصب بدهد (اندروید کروم و…)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const doInstall = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try {
      await installEvt.userChoice;
    } catch {
      /* ignore */
    }
    setInstallEvt(null);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-card border-x-0 border-t-0" : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5" aria-label="حافظ — صفحهٔ اصلی">
          <span className="relative flex size-10 items-center justify-center overflow-hidden rounded-xl shadow-lg ring-1 ring-gold/40">
            <Image
              src="/logo.png"
              alt="لوگوی حافظ — قرآن طلایی روی زمینهٔ زمردی"
              width={40}
              height={40}
              className="size-10 object-cover"
              priority
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-black tracking-tight text-foreground">حـافـظ</span>
            <span className="text-[10px] text-muted-foreground">تحفیظ با هوش مصنوعی</span>
          </span>
        </a>

        <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* نصب برنامه (PWA) — وقتی مرورگر اجازه دهد نمایش داده می‌شود */}
          {installEvt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void doInstall()}
              className="rounded-xl border-emerald-500/40 font-bold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              aria-label="نصب برنامهٔ حافظ روی گوشی"
              title="نصب برنامه روی گوشی یا دسکتاپ"
            >
              <Download className="size-4" aria-hidden="true" />
              نصب
            </Button>
          )}
          {/* حساب کاربری */}
          {user ? (
            <div
              className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-2 py-1"
              aria-label="حساب کاربری"
            >
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.8_0.13_85)] to-[oklch(0.6_0.12_165)] text-sm font-black text-[oklch(0.18_0.03_165)]"
              >
                {(user.name || user.username).trim().charAt(0)}
              </span>
              <span className="hidden max-w-24 truncate text-sm font-bold sm:block">
                {user.name || user.username}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="خروج از حساب"
                title="خروج"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog()}
              className="rounded-xl border-gold/40 font-bold hover:bg-gold/10"
              aria-label={ready ? "ورود یا ثبت‌نام" : "در حال بررسی حساب"}
            >
              <LogIn className="size-4" aria-hidden="true" />
              ورود / ثبت‌نام
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="تغییر حالت روشن/تاریک"
            className="rounded-xl"
          >
            <Sun className="hidden size-4 dark:block" aria-hidden="true" />
            <Moon className="block size-4 dark:hidden" aria-hidden="true" />
          </Button>
          <Button
            asChild
            className="hidden rounded-xl bg-gradient-to-l from-[oklch(0.8_0.13_85)] to-[oklch(0.68_0.12_82)] font-bold text-[oklch(0.2_0.04_80)] shadow-md hover:brightness-110 sm:inline-flex"
          >
            <a href="#studio">
              <Mic className="size-4" aria-hidden="true" />
              شروع تلاوت
            </a>
          </Button>
        </div>
      </div>

      {/* ناوبری موبایل */}
      <nav
        aria-label="ناوبری موبایل"
        className="glass-card flex items-center justify-around gap-1 border-x-0 border-b-0 px-2 py-1.5 md:hidden"
      >
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium text-foreground/75 transition-colors hover:text-foreground"
          >
            <n.icon className="size-4" aria-hidden="true" />
            {n.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
