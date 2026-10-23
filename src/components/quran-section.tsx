"use client";

import { useEffect, useState } from "react";
import { BookOpenText, Loader2 } from "lucide-react";
import SurahExplorer, { type SurahMetaClient } from "@/components/surah-explorer";
import { useStudio, type AyahLite, type SurahLite } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

export default function QuranSection() {
  const { toast } = useToast();
  const [surahs, setSurahs] = useState<SurahMetaClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/quran")
      .then((r) => r.json())
      .then((d: { surahs: SurahMetaClient[] }) => setSurahs(d.surahs ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handlePick = async (s: SurahMetaClient) => {
    setPicking(s.n);
    try {
      const defTo = Math.min(s.count, s.count > 20 ? 10 : s.count);
      const res = await fetch(`/api/quran/${s.n}?from=1&to=${defTo}`);
      const data = (await res.json()) as { surah?: SurahLite & { ayahs: AyahLite[] } };
      if (data.surah) {
        const su = data.surah;
        useStudio.getState().setRange(
          { n: su.n, name: su.name, en: su.en, type: su.type, count: su.count },
          1,
          defTo,
          su.ayahs
        );
        document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
      }
    } catch {
      toast({ title: "خطا", description: "بارگذاری آیات ناموفق بود.", variant: "destructive" });
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black">
          <BookOpenText className="size-5 text-gold" aria-hidden="true" />
          ۱۱۴ سوره، کامل و با رسم‌الخط عثمانی
        </h3>
        <p className="text-sm leading-7 text-muted-foreground">
          کل قرآن کریم با متن عثمانی، ترجمهٔ فارسی و شماره‌گذاری دقیق آیات در این پلتفرم بارگذاری شده است.
          سوره‌ای را انتخاب کن تا مستقیم به استودیوی تلاوت بروی.
        </p>
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[
            { v: "۱۱۴", l: "سوره" },
            { v: "۶۲۳۶", l: "آیه" },
            { v: "۳۰", l: "جزء" },
          ].map((x) => (
            <div key={x.l} className="glass-card rounded-2xl p-3 text-center">
              <p className="font-quran text-2xl font-bold text-gold">{x.v}</p>
              <p className="text-[11px] text-muted-foreground">{x.l}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative">
        <SurahExplorer surahs={surahs} loading={loading} onPick={handlePick} />
        {picking !== null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-gold" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
