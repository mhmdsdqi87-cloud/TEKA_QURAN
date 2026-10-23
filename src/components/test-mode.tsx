"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudio } from "@/lib/store";
import { toFa } from "@/components/surah-explorer";

type HideLevel = "25" | "50" | "75" | "100";

/** الگوی ثابت پنهان‌سازی بر اساس سطح و اندیس کلمه (بدون random → hydration امن) */
function shouldHide(idx: number, level: HideLevel): boolean {
  const pct = parseInt(level, 10);
  const step = Math.max(2, Math.round(100 / pct));
  return idx % step === 0;
}

export default function TestMode() {
  const ayahs = useStudio((s) => s.ayahs);
  const surah = useStudio((s) => s.surah);
  const [level, setLevel] = useState<HideLevel>("50");
  const [firstLetterHint, setFirstLetterHint] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const reset = () => setRevealed(new Set());

  const words = useMemo(
    () =>
      ayahs.map((a) => ({
        n: a.n,
        t: a.t,
        fa: a.fa,
        tokens: a.t.split(/\s+/).filter(Boolean),
      })),
    [ayahs]
  );

  const total = useMemo(
    () => words.reduce((acc, w) => acc + w.tokens.length, 0),
    [words]
  );
  const hiddenTotal = useMemo(
    () => words.reduce((acc, w) => acc + w.tokens.filter((_, i) => shouldHide(i, level)).length, 0),
    [words, level]
  );
  const shownCount = hiddenTotal - revealed.size;

  if (!surah || ayahs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gold/25 p-6 text-center text-sm text-muted-foreground">
        برای آزمون حفظ، اول در «استودیوی تلاوت» یک سوره و بازه انتخاب کن.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="hide-lvl" className="text-xs text-muted-foreground">سختی:</Label>
          <Select value={level} onValueChange={(v) => { setLevel(v as HideLevel); reset(); }}>
            <SelectTrigger id="hide-lvl" className="w-40 rounded-xl" aria-label="سطح سختی آزمون">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">آسان — ۲۵٪ پنهان</SelectItem>
              <SelectItem value="50">متوسط — ۵۰٪ پنهان</SelectItem>
              <SelectItem value="75">سخت — ۷۵٪ پنهان</SelectItem>
              <SelectItem value="100">حافظ کامل — ۱۰۰٪ پنهان</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={firstLetterHint ? "default" : "outline"}
            onClick={() => setFirstLetterHint((v) => !v)}
            className="rounded-xl text-xs"
            aria-pressed={firstLetterHint}
          >
            {firstLetterHint ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
            راهنمای حرف اول
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>باقی‌مانده: <b className="text-gold">{toFa(shownCount)}</b> از {toFa(hiddenTotal)}</span>
          <Button size="icon" variant="ghost" className="size-8 rounded-lg" onClick={reset} aria-label="پنهان‌سازی مجدد">
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="nice-scroll max-h-64 space-y-2 overflow-y-auto pl-1">
        {words.map((w) => (
          <div key={w.n} className="rounded-xl border border-border/50 bg-card/40 px-4 py-2.5">
            <p dir="rtl" className="font-quran text-lg leading-9 text-foreground">
              {w.tokens.map((tok, i) => {
                const key = `${w.n}-${i}`;
                const hidden = shouldHide(i, level) && !revealed.has(key);
                if (hidden) {
                  return (
                    <span
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setRevealed((s) => new Set(s).add(key))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setRevealed((s) => new Set(s).add(key));
                      }}
                      aria-label="نمایش کلمه"
                      className="cursor-pointer select-none rounded px-1 text-muted-foreground/40 transition-all hover:bg-gold/10 hover:text-gold"
                      title="برای نمایش کلیک کن"
                    >
                      {firstLetterHint && tok.length > 1 ? tok[0] + "…" : "●●●"}{" "}
                    </span>
                  );
                }
                return (
                  <span key={key} className="word word-correct">
                    {tok}{" "}
                  </span>
                );
              })}
            </p>
            <p dir="rtl" className="mt-0.5 flex items-baseline justify-between text-[11px] leading-5 text-muted-foreground">
              <span>{w.fa}</span>
              <span className="shrink-0 pr-2 text-gold">{toFa(w.n)}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
