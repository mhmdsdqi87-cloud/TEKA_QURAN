"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, MapPin, Search } from "lucide-react";

export interface SurahMetaClient {
  n: number;
  name: string;
  en: string;
  enTr: string;
  type: string;
  count: number;
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export function toFa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export default function SurahExplorer({
  surahs,
  loading,
  onPick,
}: {
  surahs: SurahMetaClient[];
  loading: boolean;
  onPick?: (s: SurahMetaClient) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return surahs;
    return surahs.filter(
      (s) =>
        s.en.toLowerCase().includes(needle) ||
        s.enTr.toLowerCase().includes(needle) ||
        s.name.includes(needle) ||
        String(s.n) === needle
    );
  }, [q, surahs]);

  const open = (s: SurahMetaClient) => {
    if (onPick) onPick(s);
    else router.push(`#studio`);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی سوره… (مثلاً: یس، Mulk، 36)"
          aria-label="جستجوی سوره"
          className="rounded-xl border-gold/25 bg-card/60 pr-10 text-sm"
        />
      </div>

      <ScrollArea className="nice-scroll h-[420px] rounded-2xl border border-gold/15 bg-card/40 pr-2">
        <ul className="flex flex-col gap-1.5 p-2" role="listbox" aria-label="فهرست سوره‌ها">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-14 w-full rounded-xl" />
              </li>
            ))}
          {!loading &&
            filtered.map((s) => (
              <li key={s.n}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => open(s)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-right transition-all hover:border-gold/35 hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-gold"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gradient-to-br from-gold/12 to-transparent font-quran text-sm text-gold transition-transform group-hover:scale-105">
                    {toFa(s.n)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-quran text-lg leading-snug text-foreground">
                        {s.name.replace("سُورَةُ ", "")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{s.en}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{toFa(s.count)} آیه</span>
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {s.type === "Meccan" ? "مکی" : "مدنی"}
                      </Badge>
                    </span>
                  </span>
                  <MapPin
                    className="size-4 shrink-0 text-gold/0 transition-colors group-hover:text-gold"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          {!loading && filtered.length === 0 && (
            <li className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <BookOpen className="size-6 opacity-40" aria-hidden="true" />
              سوره‌ای با این نام پیدا نشد.
            </li>
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}
