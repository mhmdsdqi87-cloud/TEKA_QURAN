"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Bot, Ear, Info, Sparkles } from "lucide-react";
import { useStudio, type FeedbackMsg } from "@/lib/store";

const KIND_STYLE: Record<
  FeedbackMsg["kind"],
  { icon: typeof Info; cls: string; label: string }
> = {
  info: { icon: Info, cls: "text-muted-foreground", label: "وضعیت" },
  heard: { icon: Ear, cls: "text-gold", label: "شنیدم" },
  mistake: { icon: AlertTriangle, cls: "text-red-500 dark:text-red-400", label: "خطا" },
  praise: { icon: Sparkles, cls: "text-gold", label: "تشویق" },
  analysis: { icon: Bot, cls: "text-emerald-600 dark:text-emerald-400", label: "تحلیل معلم AI" },
};

export default function FeedbackPanel() {
  const feedback = useStudio((s) => s.feedback);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feedback.length]);

  return (
    <div
      className="nice-scroll max-h-96 min-h-40 overflow-y-auto rounded-2xl border border-gold/15 bg-card/50 p-3"
      role="log"
      aria-live="polite"
      aria-label="بازخورد زندهٔ هوش مصنوعی"
    >
      {feedback.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
          <Bot className="size-7 text-muted-foreground/50" aria-hidden="true" />
          <p className="max-w-56 text-xs leading-6 text-muted-foreground">
            وقتی تلاوت را شروع کنی، اینجا لحظه‌به‌لحظه می‌نویسم چه شنیدم و کجا خطا بود.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {feedback.map((m) => {
            const st = KIND_STYLE[m.kind];
            const Icon = st.icon;
            return (
              <li
                key={m.id}
                className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs leading-6 ${
                  m.kind === "mistake"
                    ? "border-red-500/25 bg-red-500/8"
                    : m.kind === "praise"
                      ? "border-gold/25 bg-gold/8"
                      : m.kind === "analysis"
                        ? "border-emerald-500/25 bg-emerald-500/8"
                        : "border-border/60 bg-background/40"
                }`}
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${st.cls}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <span className="sr-only">{st.label}: </span>
                  <p className="font-medium text-foreground/90">{m.text}</p>
                  {m.detail && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{m.detail}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={endRef} />
    </div>
  );
}
