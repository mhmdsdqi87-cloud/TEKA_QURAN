"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Repeat, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useStudio } from "@/lib/store";
import { toFa } from "@/components/surah-explorer";

const QARI = "ar.alafasy";
const audioUrl = (g: number) =>
  `https://cdn.islamic.network/quran/audio/128/${QARI}/${g}.mp3`;

export default function PracticeMode() {
  const { toast } = useToast();
  const ayahs = useStudio((s) => s.ayahs);
  const surah = useStudio((s) => s.surah);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(-1);
  const [repeat, setRepeat] = useState("1");
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef(false);
  const repeatRef = useRef(1);

  useEffect(() => {
    repeatRef.current = parseInt(repeat, 10) || 1;
  }, [repeat]);

  /** پخش پشت‌سرهم آیات؛ تابع hoisted تا بتواند خودش را صدا بزند */
  function playFrom(startIdx: number, doneRep: number) {
    if (stopRef.current) return;
    if (startIdx >= ayahs.length) {
      setPlaying(false);
      setCurrent(-1);
      return;
    }
    const ayah = ayahs[startIdx];
    setCurrent(startIdx);
    const rep = repeatRef.current;
    const audio = new Audio(audioUrl(ayah.g));
    audioRef.current = audio;
    setLoading(true);
    audio.oncanplay = () => setLoading(false);
    audio.onended = () => {
      if (stopRef.current) return;
      const nextRep = doneRep + 1;
      if (nextRep < rep) {
        playFrom(startIdx, nextRep);
      } else {
        playFrom(startIdx + 1, 0);
      }
    };
    audio.onerror = () => {
      setLoading(false);
      setPlaying(false);
      setCurrent(-1);
      toast({
        title: "پخش صوت",
        description: "دریافت صوت قاری ناموفق بود؛ اتصال اینترنت را بررسی کن.",
        variant: "destructive",
      });
    };
    void audio.play().catch(() => {
      setLoading(false);
      setPlaying(false);
    });
  }

  const start = () => {
    if (ayahs.length === 0) {
      toast({ title: "بازه انتخاب نشده", description: "اول در استودیو یک سوره و بازه انتخاب کن." });
      return;
    }
    stopRef.current = false;
    setPlaying(true);
    playFrom(0, 0);
  };

  const stop = () => {
    stopRef.current = true;
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
    setCurrent(-1);
  };

  // تغییر بازه در استودیو → توقف پخش
  useEffect(() => {
    const t = setTimeout(() => {
      stopRef.current = true;
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      setCurrent(-1);
    }, 0);
    return () => clearTimeout(t);
  }, [ayahs]);

  useEffect(() => {
    return () => {
      stopRef.current = true;
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  if (!surah) {
    return (
      <p className="rounded-2xl border border-dashed border-gold/25 p-6 text-center text-sm text-muted-foreground">
        برای تمرین با صدای قاری، اول در «استودیوی تلاوت» یک سوره انتخاب کن.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {playing ? (
            <Button
              size="icon"
              variant="outline"
              className="size-12 rounded-full"
              onClick={stop}
              aria-label="توقف پخش"
            >
              <Square className="size-5" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="size-12 rounded-full bg-emerald-600 hover:bg-emerald-500"
              onClick={start}
              aria-label="پخش تمرین"
            >
              <Play className="size-5" />
            </Button>
          )}
          {playing && loading && <Loader2 className="size-4 animate-spin text-gold" aria-hidden="true" />}
          <div className="text-xs leading-5 text-muted-foreground">
            <p className="font-bold text-foreground">شیخ مشاری العفاسی</p>
            <p>
              {playing && current >= 0
                ? `آیهٔ ${toFa(ayahs[current]?.n ?? "")} در حال پخش…`
                : `${toFa(ayahs.length)} آیه در صف پخش`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" aria-hidden="true" />
          <Label htmlFor="repeat-sel" className="sr-only">تعداد تکرار هر آیه</Label>
          <Select value={repeat} onValueChange={setRepeat} disabled={playing}>
            <SelectTrigger id="repeat-sel" className="w-28 rounded-xl" aria-label="تعداد تکرار هر آیه">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">۱ بار</SelectItem>
              <SelectItem value="2">۲ بار</SelectItem>
              <SelectItem value="3">۳ بار</SelectItem>
              <SelectItem value="5">۵ بار</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="nice-scroll max-h-64 space-y-2 overflow-y-auto pl-1" role="list" aria-label="آیات تمرین">
        {ayahs.map((a, i) => (
          <div
            key={a.n}
            role="listitem"
            className={`rounded-xl border px-4 py-2.5 transition-all duration-300 ${
              current === i
                ? "border-gold/50 bg-gold/10 shadow-[0_0_24px_-10px_oklch(0.8_0.13_85/0.6)]"
                : "border-border/50 bg-card/40"
            }`}
          >
            <div className="flex items-start gap-3">
              {current === i && playing ? (
                <Volume2 className="mt-1.5 size-4 shrink-0 animate-pulse text-gold" aria-hidden="true" />
              ) : (
                <Pause className="mt-1.5 size-4 shrink-0 text-transparent" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p dir="rtl" className="font-quran text-lg leading-9 text-foreground">
                  {a.t}
                </p>
                <p dir="rtl" className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{a.fa}</p>
              </div>
              <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-gold/30 text-[10px] font-bold text-gold">
                {toFa(a.n)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
