"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  CheckCheck,
  ChevronDown,
  Flag,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Target,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import LiveAyahView from "@/components/live-ayah-view";
import FeedbackPanel from "@/components/feedback-panel";
import { toFa, type SurahMetaClient } from "@/components/surah-explorer";
import { RecitationRecorder, listMicrophones } from "@/lib/recorder";
import { SpeechEngine, isBrowserSpeechSupported } from "@/lib/speech";
import { getHafezUid } from "@/lib/user";
import { useAuth } from "@/lib/auth-store";
import { useStudio, type AyahLite, type SurahLite } from "@/lib/store";
import {
  useSettings,
  ERROR_ALERT_LABELS,
  STRICTNESS_LABELS,
  TEXT_SIZE_LABELS,
  type ErrorAlert,
  type Strictness,
  type TextSize,
} from "@/lib/settings";
import { sfx, unlockAudio, vibrate } from "@/lib/sfx";
import type { MistakeEvent } from "@/lib/alignment";

interface AnalyzeResult {
  summary: string;
  scoreNote: string;
  grade?: string;
  tips: string[];
  plan?: string[];
  mistakes: { ayahNumber: number; kind: string; expected: string; heard: string; note: string }[];
  fallback?: boolean;
}

const GRADE_STYLES: Record<string, string> = {
  "درخشان": "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  "خوب": "border-gold/40 bg-gold/10 text-gold",
  "رو به پیشرفت": "border-sky-500/40 bg-sky-500/10 text-sky-600",
  "نیاز به تمرین": "border-red-500/40 bg-red-500/10 text-red-500",
};

export default function RecitationStudio() {
  const { toast } = useToast();
  const st = useStudio();
  const cfg = useSettings();
  const setCfg = useSettings((s) => s.update);
  const {
    surah, fromAyah, toAyah, ayahs, track, pos, phase, accuracy, wordsTotal, wordsCorrect,
    mistakes, showTranslation, elapsedSec, feedback,
  } = st;

  const [allSurahs, setAllSurahs] = useState<SurahMetaClient[]>([]);
  const [selSurah, setSelSurah] = useState<string>("");
  const [selFrom, setSelFrom] = useState<string>("");
  const [selTo, setSelTo] = useState<string>("");
  const [loadingRange, setLoadingRange] = useState(false);

  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string>("default");
  const [starting, setStarting] = useState(false);
  const [level, setLevel] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const recorderRef = useRef<RecitationRecorder | null>(null);
  const engineRef = useRef<SpeechEngine | null>(null);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedRef = useRef(false);
  const lastPreviewAtRef = useRef(0);
  const [browserSpeech, setBrowserSpeech] = useState<boolean | null>(null);

  useEffect(() => {
    setBrowserSpeech(isBrowserSpeechSupported());
  }, []);

  /* ---------- بارگذاری فهرست سوره‌ها (با کش اسپلش) ---------- */
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("hafez-surahs");
      if (cached) {
        const parsed = JSON.parse(cached) as SurahMetaClient[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllSurahs(parsed);
          return;
        }
      }
    } catch {
      /* کش نامعتبر — از سرور */
    }
    fetch("/api/quran")
      .then((r) => r.json())
      .then((d: { surahs: SurahMetaClient[] }) => setAllSurahs(d.surahs ?? []))
      .catch(() => toast({ title: "خطا", description: "بارگذاری فهرست سوره‌ها ناموفق بود.", variant: "destructive" }));
  }, [toast]);

  /* ---------- بارگذاری بازهٔ آیات ---------- */
  const loadRange = useCallback(
    async (surahNum: number, from: number, to: number) => {
      setLoadingRange(true);
      try {
        const res = await fetch(`/api/quran/${surahNum}?from=${from}&to=${to}`);
        const data = (await res.json()) as { surah?: SurahLite & { ayahs: AyahLite[] }; error?: string };
        if (!res.ok || !data.surah) {
          toast({ title: "خطا", description: data.error ?? "بارگذاری آیات ناموفق بود.", variant: "destructive" });
          return;
        }
        const s = data.surah;
        st.setRange(
          { n: s.n, name: s.name, en: s.en, type: s.type, count: s.count },
          from,
          to,
          s.ayahs
        );
        setAnalysis(null);
        setSaved(false);
        savedRef.current = false;
      } catch {
        toast({ title: "خطا", description: "ارتباط با سرور برقرار نشد.", variant: "destructive" });
      } finally {
        setLoadingRange(false);
      }
    },
    [toast]
  );

  /* ---------- انتخاب سوره ---------- */
  const handleSurahChange = (v: string) => {
    setSelSurah(v);
    const s = allSurahs.find((x) => String(x.n) === v);
    if (!s) return;
    const defTo = Math.min(s.count, s.count > 20 ? 10 : s.count);
    setSelFrom("1");
    setSelTo(String(defTo));
    void loadRange(s.n, 1, defTo);
  };

  const handleFromChange = (v: string) => {
    setSelFrom(v);
    const s = allSurahs.find((x) => String(x.n) === selSurah);
    if (!s) return;
    const from = parseInt(v, 10);
    let to = parseInt(selTo, 10) || from;
    if (to < from) {
      to = Math.min(s.count, from + 9);
      setSelTo(String(to));
    }
    void loadRange(s.n, from, to);
  };

  const handleToChange = (v: string) => {
    setSelTo(v);
    const s = allSurahs.find((x) => String(x.n) === selSurah);
    if (!s) return;
    const to = parseInt(v, 10);
    const from = parseInt(selFrom, 10) || 1;
    if (to >= from) void loadRange(s.n, from, to);
  };

  /* ---------- صف ASR ---------- */
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const b64 = queueRef.current.shift()!;
      let done = false;
      for (let attempt = 0; attempt < 2 && !done; attempt++) {
        try {
          const res = await fetch("/api/asr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: b64 }),
          });
          if (!res.ok) throw new Error(`ASR ${res.status}`);
          const data = (await res.json()) as { text?: string };
          if (data.text && data.text.trim()) {
            useStudio.getState().applyHeard(data.text);
          }
          done = true;
        } catch {
          if (attempt === 1) {
            useStudio.getState().pushFeedback({
              kind: "info",
              text: "یک قطعهٔ صوتی ارسال نشد؛ ادامه می‌دهم. اتصال اینترنت را بررسی کن.",
            });
          } else {
            await new Promise((r) => setTimeout(r, 900));
          }
        }
      }
    }
    processingRef.current = false;
  }, []);

  /* ---------- شروع / توقف ضبط ---------- */
  const refreshMics = useCallback(async () => {
    const list = await listMicrophones();
    setMics(list);
  }, []);

  const startRecording = useCallback(async () => {
    // قفل لاگین: کاربر تا وارد نشود، اجازهٔ تلاوت (ارسال صدا به هوش مصنوعی) ندارد
    const au = useAuth.getState();
    if (!au.user) {
      toast({
        title: "اول وارد حساب شو",
        description: "برای تلاوت، ذخیرهٔ آمار و پیام به استاد، وارد شو یا حساب بساز.",
        variant: "destructive",
      });
      au.openDialog();
      return;
    }
    if (!surah || track.length === 0) {
      toast({ title: "اول بازه را انتخاب کن", description: "سوره و بازهٔ آیات را مشخص کن." });
      return;
    }
    if (countdown !== null) return;
    unlockAudio();
    const c = useSettings.getState();
    setStarting(true);
    // شمارش معکوس آماده‌سازی ۳-۲-۱ (قابل خاموش‌کردن در تنظیمات)
    if (c.countdown) {
      setCountdown(3);
      if (c.sounds) sfx.count(c.volume);
      await new Promise((r) => setTimeout(r, 900));
      setCountdown(2);
      if (c.sounds) sfx.count(c.volume);
      await new Promise((r) => setTimeout(r, 900));
      setCountdown(1);
      if (c.sounds) sfx.count(c.volume);
      await new Promise((r) => setTimeout(r, 900));
      setCountdown(null);
      if (c.sounds) sfx.go(c.volume);
    }
    try {
      const useBrowser = isBrowserSpeechSupported();
      if (useBrowser) {
        // موتور اصلی: تشخیص گفتار مرورگر — زنده و کلمه‌به‌کلمه با گزینه‌های جایگزین
        const engine = new SpeechEngine({
          lang: "ar-SA",
          onInterim: (text) => {
            const now = performance.now();
            if (now - lastPreviewAtRef.current < 100) return;
            lastPreviewAtRef.current = now;
            useStudio.getState().applyPreview(text);
          },
          onFinal: (text, alts) => {
            useStudio.getState().applyHeard(text, alts);
          },
          onError: (msg, fatal) => {
            toast({ title: fatal ? "تشخیص گفتار" : "توجه", description: msg, variant: fatal ? "destructive" : "default" });
          },
        });
        const ok = engine.start();
        if (!ok) throw new Error("engine-failed");
        engineRef.current = engine;
      } else {
        // فالبک: ضبط قطعه‌ای + ASR سروری
        const rec = new RecitationRecorder({
          chunkMs: 6000,
          onChunk: (b64) => {
            queueRef.current.push(b64);
            void processQueue();
          },
          onError: (msg) => toast({ title: "میکروفون", description: msg, variant: "destructive" }),
          onLevel: (rms) => setLevel(rms),
        });
        await rec.start(micId === "default" ? undefined : micId);
        recorderRef.current = rec;
      }
      st.startListening();
      st.begin();
      void refreshMics();
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => useStudio.getState().tick(), 1000);
    } catch {
      toast({
        title: "میکروفون",
        description: "شروع ضبط ناموفق بود؛ دسترسی میکروفون را بررسی کن و دوباره امتحان کن.",
        variant: "destructive",
      });
    } finally {
      setStarting(false);
      setCountdown(null);
    }
  }, [surah, track.length, micId, processQueue, refreshMics, toast, st, countdown]);

  const stopRecording = useCallback(async () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec) await rec.stop();
    const eng = engineRef.current;
    engineRef.current = null;
    eng?.stop();
    useStudio.getState().clearPreview();
    setLevel(0);
    const c = useSettings.getState();
    if (c.sounds) sfx.done(c.volume);
    st.finish();
  }, [st]);

  const togglePause = useCallback(() => {
    if (st.phase === "recording") {
      const eng = engineRef.current;
      if (eng) {
        eng.stop();
        useStudio.getState().clearPreview();
      }
      const rec = recorderRef.current;
      rec?.pause();
      st.pauseListening();
    } else if (st.phase === "paused") {
      const eng = engineRef.current;
      if (eng) eng.start();
      const rec = recorderRef.current;
      rec?.resume();
      st.startListening();
    }
  }, [st.phase]);

  const restartRange = useCallback(() => {
    const s = st.surah;
    if (!s) return;
    void loadRange(s.n, st.fromAyah, st.toAyah);
    setAnalysis(null);
  }, [st.surah, st.fromAyah, st.toAyah, loadRange]);

  /* ---------- پایان خودکار ---------- */
  const finishedAll = track.length > 0 && pos >= track.length;
  useEffect(() => {
    if (finishedAll && phase === "recording" && cfg.autoStop) {
      void stopRecording();
    }
  }, [finishedAll, phase, cfg.autoStop, stopRecording]);

  /* ---------- هشدار لحظه‌ای خطا: بوق + لرزش + توست + فلاش ---------- */
  const [flash, setFlash] = useState(0);
  const prevMistakesRef = useRef(0);
  const prevFeedbackRef = useRef(0);
  useEffect(() => {
    const mCount = mistakes.length;
    if (mCount < prevMistakesRef.current) {
      prevMistakesRef.current = mCount; // جلسهٔ جدید
      prevFeedbackRef.current = feedback.length;
      return;
    }
    if (mCount > prevMistakesRef.current) {
      prevMistakesRef.current = mCount;
      const last = mistakes[mCount - 1];
      setFlash((f) => f + 1);
      if (cfg.sounds) {
        if (cfg.errorAlert === "all") {
          sfx.error(cfg.volume);
          vibrate();
        } else if (cfg.errorAlert === "beep") {
          sfx.error(cfg.volume);
        } else if (cfg.errorAlert === "vibrate") {
          vibrate();
        }
      }
      if (cfg.liveFeedback && (phase === "recording" || phase === "paused")) {
        const desc =
          last.type === "wrong"
            ? `به‌جای «${last.expected}» شنیدم «${last.heard}»`
            : last.type === "missed"
              ? `کلمهٔ «${last.expected}» گفته نشد`
              : `کلمهٔ «${last.heard}» اضافه خوانده شد`;
        toast({
          title: `خطا در آیهٔ ${toFa(last.ayahNumber)}`,
          description: desc,
          variant: "destructive",
          duration: 2800,
        });
      }
    }
    // صدای تشویق
    const fLen = feedback.length;
    if (fLen > prevFeedbackRef.current) {
      const lastMsg = feedback[fLen - 1];
      if (lastMsg?.kind === "praise" && cfg.sounds && cfg.praise) sfx.praise(cfg.volume);
    }
    prevFeedbackRef.current = Math.max(prevFeedbackRef.current < fLen ? fLen : prevFeedbackRef.current, fLen);
  }, [mistakes, feedback, cfg.sounds, cfg.errorAlert, cfg.volume, cfg.liveFeedback, cfg.praise, phase, toast]);

  /* ---------- تحلیل LLM + ذخیرهٔ جلسه ---------- */
  const runAnalysis = useCallback(async () => {
    if (st.ayahs.length === 0 || savedRef.current) return;
    savedRef.current = true;
    setAnalyzing(true);
    try {
      const expected = st.ayahs.map((a) => `آیهٔ ${a.n}: ${a.t}`).join("\n");
      const heard = st.heardSegments.join(" ");
      const mistakeSummary = st.mistakes.slice(0, 30).map((m: MistakeEvent) => ({
        type: m.type,
        ayahNumber: m.ayahNumber,
        expected: m.expected,
        heard: m.heard,
      }));
      const [anRes, svRes] = await Promise.allSettled([
        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            surahName: st.surah?.name ?? "",
            expected,
            heard,
            mistakes: mistakeSummary,
            accuracy: st.accuracy,
          }),
        }).then((r) => r.json() as Promise<AnalyzeResult>),
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: useAuth.getState().user?.id ?? getHafezUid(),
            surahNumber: st.surah?.n ?? 1,
            surahName: st.surah?.name ?? "",
            ayahFrom: st.fromAyah,
            ayahTo: st.toAyah,
            accuracy: st.accuracy,
            durationSec: st.elapsedSec,
            wordsTotal: st.wordsTotal,
            wordsCorrect: st.wordsCorrect,
            mistakes: mistakeSummary,
          }),
        }),
      ]);
      if (anRes.status === "fulfilled") {
        setAnalysis(anRes.value);
        const a = anRes.value;
        st.pushFeedback({
          kind: "analysis",
          text: a.summary || "تحلیل آماده شد.",
          detail: a.tips?.length ? a.tips.join(" • ") : undefined,
        });
      }
      if (svRes.status === "fulfilled") {
        setSaved(true);
        window.dispatchEvent(new CustomEvent("hafez:session-saved"));
      } else {
        toast({ title: "ذخیرهٔ جلسه", description: "ذخیرهٔ جلسه در سرور ناموفق بود.", variant: "destructive" });
        setSaved(false);
      }
    } catch {
      toast({ title: "تحلیل", description: "تحلیل هوش مصنوعی در دسترس نبود.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [st.ayahs, st.heardSegments, st.mistakes, st.accuracy, st.surah, st.fromAyah, st.toAyah, st.elapsedSec, st.wordsTotal, st.wordsCorrect, toast]);

  useEffect(() => {
    if (phase === "review" && !savedRef.current) {
      void runAnalysis();
    }
  }, [phase]);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    recorderRef.current?.stop();
    engineRef.current?.stop();
  }, []);

  const progressPct = wordsTotal > 0 ? Math.min(100, Math.round((pos / wordsTotal) * 100)) : 0;
  const wrongCount = mistakes.filter((m) => m.type === "wrong").length;
  const missedCount = mistakes.filter((m) => m.type === "missed").length;
  const insertedCount = mistakes.filter((m) => m.type === "inserted").length;

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  return (
    <section id="studio" className="scroll-mt-24" aria-label="استودیوی تلاوت">
      {/* شمارش معکوس آماده‌سازی */}
      {countdown !== null && (
        <div
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-md"
          role="alert"
          aria-live="assertive"
          aria-label={`آماده شو؛ ${toFa(countdown)}`}
        >
          <motion.p
            key={countdown}
            initial={{ scale: 2.2, opacity: 0, filter: "blur(10px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="font-quran text-glow-gold text-[7rem] font-black leading-none text-gold sm:text-[10rem]"
          >
            {toFa(countdown)}
          </motion.p>
          <p className="text-sm text-muted-foreground">آماده شو… بعد از این عدد تلاوت را شروع کن</p>
          <div className="flex gap-2">
            {[3, 2, 1].map((n) => (
              <span
                key={n}
                className={`size-2.5 rounded-full transition-colors ${countdown >= n ? "bg-gold" : "bg-muted"}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-black sm:text-3xl">
          استودیوی <span className="text-gold text-glow-gold">تلاوت</span>
        </h2>
        <p className="max-w-xl text-sm leading-7 text-muted-foreground">
          میکروفونت را انتخاب کن، بازهٔ آیات را مشخص کن و تلاوت را شروع کن. هوش مصنوعی همزمان گوش می‌دهد،
          خط به خط دنبال می‌کند و اشکالات را لحظه‌ای نشان می‌دهد.
        </p>
      </div>

      {/* انتخاب بازه */}
      <div className="glass-card gold-border-glow mb-5 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="surah-select" className="text-xs text-muted-foreground">سوره</Label>
            <Select value={selSurah} onValueChange={handleSurahChange}>
              <SelectTrigger id="surah-select" className="w-full rounded-xl" aria-label="انتخاب سوره">
                <SelectValue placeholder="یک سوره انتخاب کن…" />
              </SelectTrigger>
              <SelectContent className="nice-scroll max-h-72">
                {allSurahs.map((s) => (
                  <SelectItem key={s.n} value={String(s.n)}>
                    <span className="font-quran text-base">{s.name.replace("سُورَةُ ", "")}</span>
                    <span className="mr-2 text-xs text-muted-foreground">({s.en} — {toFa(s.count)} آیه)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="w-28 space-y-1.5">
              <Label className="text-xs text-muted-foreground">از آیه</Label>
              <Select value={selFrom} onValueChange={handleFromChange} disabled={!selSurah}>
                <SelectTrigger className="w-full rounded-xl" aria-label="از آیه">
                  <SelectValue placeholder="۱" />
                </SelectTrigger>
                <SelectContent className="nice-scroll max-h-72">
                  {ayahNumbers(selSurah, allSurahs).map((n) => (
                    <SelectItem key={n} value={String(n)}>{toFa(n)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28 space-y-1.5">
              <Label className="text-xs text-muted-foreground">تا آیه</Label>
              <Select value={selTo} onValueChange={handleToChange} disabled={!selSurah}>
                <SelectTrigger className="w-full rounded-xl" aria-label="تا آیه">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="nice-scroll max-h-72">
                  {ayahNumbers(selSurah, allSurahs)
                    .filter((n) => n >= (parseInt(selFrom, 10) || 1))
                    .map((n) => (
                      <SelectItem key={n} value={String(n)}>{toFa(n)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {surah && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gold/15 pt-3 text-xs text-muted-foreground">
            <span className="font-quran text-base text-foreground">{surah.name.replace("سُورَةُ ", "")}</span>
            <span>بازهٔ {toFa(fromAyah)} تا {toFa(toAyah)}</span>
            <span>{toFa(wordsTotal)} کلمه</span>
            {loadingRange && <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> در حال بارگذاری…</span>}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* ستون اصلی */}
        <div className="flex flex-col gap-5">
          <div className="relative">
            <LiveAyahView />
            {flash > 0 && (
              <div
                key={flash}
                className="error-flash pointer-events-none absolute inset-0 z-10 rounded-2xl ring-2 ring-red-500"
                aria-hidden="true"
              />
            )}
          </div>

          {/* نوار پیشرفت + آمار زنده */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {/* حلقهٔ دقت */}
                <div className="relative size-16" role="img" aria-label={`دقت ${accuracy} درصد`}>
                  <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
                    <circle cx="32" cy="32" r="27" fill="none" strokeWidth="6" className="stroke-muted" />
                    <circle
                      cx="32" cy="32" r="27" fill="none" strokeWidth="6" strokeLinecap="round"
                      className={accuracy >= 90 ? "stroke-emerald-500" : accuracy >= 70 ? "stroke-gold" : "stroke-red-500"}
                      strokeDasharray={`${(accuracy / 100) * 169.6} 169.6`}
                      style={{ transition: "stroke-dasharray 0.6s ease" }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-black">
                    {toFa(accuracy)}٪
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-bold text-foreground">
                    {phase === "recording" || phase === "paused" ? `${mm}:${ss}` : "۰۰:۰۰"}
                  </span>
                  <span className="text-muted-foreground">
                    {toFa(pos)} از {toFa(wordsTotal)} کلمه ({toFa(progressPct)}٪)
                  </span>
                  <span className="flex gap-2 text-muted-foreground">
                    <span className="text-emerald-600 dark:text-emerald-400">✓ {toFa(wordsCorrect)}</span>
                    <span className="text-red-500">✗ {toFa(wrongCount)}</span>
                    <span className="text-gold">— {toFa(missedCount)}</span>
                    {insertedCount > 0 && <span>+{toFa(insertedCount)}</span>}
                  </span>
                </div>
              </div>

              {/* کنترل‌ها */}
              <div className="flex items-center gap-2.5">
                {(phase === "recording" || phase === "paused") ? (
                  <>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-12 rounded-full"
                      onClick={togglePause}
                      aria-label={phase === "recording" ? "مکث" : "ادامه"}
                    >
                      {phase === "recording" ? <Pause className="size-5" /> : <Play className="size-5" />}
                    </Button>
                    <button
                      type="button"
                      onClick={() => void stopRecording()}
                      aria-label="پایان تلاوت"
                      className="rec-pulse flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
                    >
                      <Square className="size-6" aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={starting || !surah || loadingRange}
                    aria-label="شروع تلاوت با میکروفون"
                    className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-xl transition-all hover:scale-105 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {starting ? (
                      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                    ) : (
                      <Mic className="size-6" aria-hidden="true" />
                    )}
                  </button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11 rounded-full"
                  onClick={restartRange}
                  disabled={!surah || phase === "recording"}
                  aria-label="شروع مجدد بازه"
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11 rounded-full"
                  onClick={() => void stopRecording()}
                  disabled={phase !== "recording" && phase !== "paused"}
                  aria-label="پایان و تحلیل"
                >
                  <Flag className="size-4" />
                </Button>
              </div>
            </div>

            {/* نوار پیشرفت */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-l from-gold to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ستون کناری: میکروفون + بازخورد */}
        <aside className="flex flex-col gap-5">
          <div className="glass-card rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm font-bold">
                {phase === "recording" ? (
                  <Volume2 className="size-4 text-emerald-500" aria-hidden="true" />
                ) : (
                  <MicOff className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                میکروفون
              </Label>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-lg"
                onClick={() => void refreshMics()}
                aria-label="تازه‌سازی فهرست میکروفون‌ها"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
            <Select value={micId} onValueChange={setMicId}>
              <SelectTrigger className="w-full rounded-xl" aria-label="انتخاب میکروفون">
                <SelectValue placeholder="میکروفون پیش‌فرض" />
              </SelectTrigger>
              <SelectContent className="nice-scroll max-h-52">
                <SelectItem value="default">پیش‌فرض سیستم</SelectItem>
                {mics.map((m, i) => (
                  <SelectItem key={m.deviceId || i} value={m.deviceId || `dev${i}`}>
                    {m.label || `میکروفون ${toFa(i + 1)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* موتور تشخیص گفتار */}
            <div
              className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] leading-5 ${
                browserSpeech === false
                  ? "border-gold/30 bg-gold/8 text-gold"
                  : "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  browserSpeech === false ? "bg-gold" : "bg-emerald-500"
                } ${phase === "recording" ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
              {browserSpeech === null
                ? "در حال بررسی موتور تشخیص…"
                : browserSpeech
                  ? "موتور زندهٔ مرورگر فعال — هایلایت کلمه‌به‌کلمه همزمان با تلاوت"
                  : "مرورگر تو تشخیص زنده ندارد؛ از حالت قطعه‌ای سرور استفاده می‌شود (هر ۶ ثانیه)"}
            </div>
            {/* نمایشگر سطح صدا */}
            <div className="mt-3 flex h-6 items-center gap-1" aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => {
                const on = level * 60 > i;
                return (
                  <span
                    key={i}
                    className={`h-full w-1.5 rounded-full transition-colors duration-100 ${
                      on ? (i > 10 ? "bg-red-500" : i > 7 ? "bg-gold" : "bg-emerald-500") : "bg-muted"
                    }`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
              <Label htmlFor="tr-sw" className="text-xs text-muted-foreground">نمایش ترجمهٔ فارسی</Label>
              <Switch id="tr-sw" checked={showTranslation} onCheckedChange={st.setShowTranslation} />
            </div>
          </div>

          <StudioSettingsCard />

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
              <Bot className="size-4 text-emerald-500" aria-hidden="true" />
              معلم هوش مصنوعی
            </h3>
            <FeedbackPanel />
          </div>
        </aside>
      </div>

      {/* کارت بازبینی نهایی */}
      {phase === "review" && (
        <div className="glass-card gold-border-glow mt-6 rounded-3xl p-5 sm:p-7">
          {analyzing ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-gold" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">معلم هوش مصنوعی در حال تحلیل تلاوت توست…</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-2">
                <div className="relative size-28">
                  <svg viewBox="0 0 64 64" className="size-28 -rotate-90">
                    <circle cx="32" cy="32" r="27" fill="none" strokeWidth="5" className="stroke-muted" />
                    <circle
                      cx="32" cy="32" r="27" fill="none" strokeWidth="5" strokeLinecap="round"
                      className={accuracy >= 90 ? "stroke-emerald-500" : accuracy >= 70 ? "stroke-gold" : "stroke-red-500"}
                      strokeDasharray={`${(accuracy / 100) * 169.6} 169.6`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black">{toFa(accuracy)}٪</span>
                    <span className="text-[10px] text-muted-foreground">دقت</span>
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>✗ {toFa(wrongCount)} اشتباه</span>
                  <span>— {toFa(missedCount)} جاافتاده</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {saved ? "جلسه ذخیره شد ✓" : "جلسه ذخیره نشد"}
                </p>
              </div>
              <div className="space-y-3">
                {analysis && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-lg font-black">
                        <Bot className="size-5 text-emerald-500" aria-hidden="true" />
                        نظر معلم
                      </h3>
                      {analysis.grade && (
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black ${GRADE_STYLES[analysis.grade] ?? "border-border bg-muted text-muted-foreground"}`}
                        >
                          {analysis.grade}
                        </span>
                      )}
                    </div>
                    {analysis.summary && <p className="text-sm leading-7 text-foreground/90">{analysis.summary}</p>}
                    {analysis.scoreNote && (
                      <p className="text-xs leading-6 text-muted-foreground">{analysis.scoreNote}</p>
                    )}
                    {analysis.tips?.length > 0 && (
                      <ul className="flex flex-col gap-1.5">
                        {analysis.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs leading-6 text-foreground/85">
                            <CheckCheck className="mt-1 size-3.5 shrink-0 text-gold" aria-hidden="true" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                    {analysis.plan && analysis.plan.length > 0 && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-emerald-600">
                          <Target className="size-3.5" aria-hidden="true" />
                          برنامهٔ تمرین معلم
                        </p>
                        <ol className="flex list-inside list-decimal flex-col gap-1 text-xs leading-6 text-foreground/85">
                          {analysis.plan.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {analysis.mistakes?.length > 0 && (
                      <div className="nice-scroll max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                        {analysis.mistakes.map((m, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs leading-6">
                            <AlertTriangle className="mt-1 size-3.5 shrink-0 text-red-500" aria-hidden="true" />
                            <span>
                              <b>آیهٔ {toFa(m.ayahNumber)}</b> —{" "}
                              {m.kind === "missed" ? "جاافتادگی" : m.kind === "added" ? "اضافه‌خوانی" : "کلمهٔ اشتباه"}
                              {m.expected ? `: انتظار «${m.expected}»` : ""}
                              {m.heard ? `، شنیده شد «${m.heard}»` : ""}
                              {m.note ? ` — ${m.note}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={() => {
                      setAnalysis(null);
                      savedRef.current = false;
                      setSaved(false);
                      void loadRange(surah?.n ?? 1, fromAyah, toAyah);
                    }}
                    className="rounded-xl bg-emerald-600 font-bold hover:bg-emerald-500"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    تلاوت مجدد
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      st.reset();
                      setSelSurah("");
                      setSelFrom("");
                      setSelTo("");
                      setAnalysis(null);
                      savedRef.current = false;
                      setSaved(false);
                    }}
                    className="rounded-xl"
                  >
                    جلسهٔ جدید
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ayahNumbers(surahNum: string, all: SurahMetaClient[]): number[] {
  const s = all.find((x) => String(x.n) === surahNum);
  if (!s) return [];
  return Array.from({ length: s.count }, (_, i) => i + 1);
}

/* ------------------------------------------------------------------ */
/* تنظیمات پیشرفتهٔ استودیو — همه‌چیز قابل شخصی‌سازی                    */
/* ------------------------------------------------------------------ */

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold text-foreground/90">{label}</span>
        {hint && <span className="text-[10px] leading-4 text-muted-foreground">{hint}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-black tracking-wider text-gold/90">
      <span aria-hidden="true" className="h-px w-4 bg-gradient-to-l from-gold/60 to-transparent" />
      {children}
    </p>
  );
}

function StudioSettingsCard() {
  const cfg = useSettings();
  const update = useSettings((s) => s.update);
  const showTranslation = useStudio((s) => s.showTranslation);
  const setShowTranslation = useStudio((s) => s.setShowTranslation);
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="glass-card rounded-2xl p-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg p-1 transition-colors hover:bg-gold/5"
            aria-expanded={open}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <SlidersHorizontal className="size-4 text-gold" aria-hidden="true" />
              تنظیمات پیشرفته
              <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[9px] font-bold text-gold">
                {toFa(13)} گزینه
              </span>
            </span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden">
          <div className="mt-4 space-y-4">
            {/* صدا و هشدار */}
            <div className="space-y-3">
              <SettingsSectionTitle>صدا و هشدار</SettingsSectionTitle>
              <SettingRow label="صداهای برنامه" hint="بوق خطا، تشویق، شمارش معکوس و پایان جلسه">
                <Switch checked={cfg.sounds} onCheckedChange={(v) => update("sounds", v)} aria-label="صداهای برنامه" />
              </SettingRow>
              <SettingRow label="هشدار لحظه‌ای خطا" hint="همان لحظهٔ شنیدن خطا یا جاافتادگی هشدار می‌دهد">
                <Select value={cfg.errorAlert} onValueChange={(v) => update("errorAlert", v as ErrorAlert)}>
                  <SelectTrigger className="w-40 rounded-lg" aria-label="نوع هشدار خطا">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ERROR_ALERT_LABELS) as ErrorAlert[]).map((k) => (
                      <SelectItem key={k} value={k}>{ERROR_ALERT_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="بلندی صدا">
                <Slider
                  value={[cfg.volume]}
                  min={0.1}
                  max={1}
                  step={0.1}
                  onValueChange={(v) => update("volume", v[0] ?? 0.7)}
                  className="w-32"
                  aria-label="بلندی صدا"
                />
              </SettingRow>
              <SettingRow label="تشویق‌ها" hint="پیام و صدای تشویق پس از تلاوت روان">
                <Switch checked={cfg.praise} onCheckedChange={(v) => update("praise", v)} aria-label="تشویق‌ها" />
              </SettingRow>
            </div>

            <Separator className="bg-gold/10" />

            {/* دقت تشخیص */}
            <div className="space-y-3">
              <SettingsSectionTitle>دقت تشخیص</SettingsSectionTitle>
              <SettingRow label="سخت‌گیری تطبیق" hint={STRICTNESS_LABELS[cfg.strictness].hint}>
                <Select value={cfg.strictness} onValueChange={(v) => update("strictness", v as Strictness)}>
                  <SelectTrigger className="w-28 rounded-lg" aria-label="سخت‌گیری تطبیق">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STRICTNESS_LABELS) as Strictness[]).map((k) => (
                      <SelectItem key={k} value={k}>{STRICTNESS_LABELS[k].title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="بازخورد لحظه‌ای معلم" hint="توست فوری با جزئیات خطا هنگام تلاوت">
                <Switch checked={cfg.liveFeedback} onCheckedChange={(v) => update("liveFeedback", v)} aria-label="بازخورد لحظه‌ای" />
              </SettingRow>
              <SettingRow label="هایلایت زندهٔ موقت" hint="کلمه‌هایی که همین حالا می‌خوانی همان لحظه طلایی می‌شوند">
                <Switch checked={cfg.ghostPreview} onCheckedChange={(v) => update("ghostPreview", v)} aria-label="هایلایت زندهٔ موقت" />
              </SettingRow>
            </div>

            <Separator className="bg-gold/10" />

            {/* نمایش و متن */}
            <div className="space-y-3">
              <SettingsSectionTitle>نمایش و متن</SettingsSectionTitle>
              <SettingRow label="ترجمهٔ فارسی">
                <Switch checked={showTranslation} onCheckedChange={setShowTranslation} aria-label="نمایش ترجمه" />
              </SettingRow>
              <SettingRow label="اندازهٔ متن آیات">
                <Select value={cfg.textSize} onValueChange={(v) => update("textSize", v as TextSize)}>
                  <SelectTrigger className="w-28 rounded-lg" aria-label="اندازهٔ متن">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TEXT_SIZE_LABELS) as TextSize[]).map((k) => (
                      <SelectItem key={k} value={k}>{TEXT_SIZE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="پیمایش خودکار" hint="آیهٔ فعال همیشه جلوی چشم بماند">
                <Switch checked={cfg.autoScroll} onCheckedChange={(v) => update("autoScroll", v)} aria-label="پیمایش خودکار" />
              </SettingRow>
              <SettingRow label="تمرین کور" hint="کلمات پیش‌رو پنهان می‌شوند تا از حفظ بخوانی — چالش‌برانگیز!">
                <Switch checked={cfg.hideUpcoming} onCheckedChange={(v) => update("hideUpcoming", v)} aria-label="تمرین کور" />
              </SettingRow>
            </div>

            <Separator className="bg-gold/10" />

            {/* جلسه */}
            <div className="space-y-3">
              <SettingsSectionTitle>جلسه</SettingsSectionTitle>
              <SettingRow label="شمارش معکوس ۳-۲-۱" hint="چند ثانیه فرصت آماده‌شدن قبل از شروع">
                <Switch checked={cfg.countdown} onCheckedChange={(v) => update("countdown", v)} aria-label="شمارش معکوس" />
              </SettingRow>
              <SettingRow label="توقف خودکار در پایان" hint="وقتی همهٔ آیات را خواندی جلسه تمام و تحلیل می‌شود">
                <Switch checked={cfg.autoStop} onCheckedChange={(v) => update("autoStop", v)} aria-label="توقف خودکار" />
              </SettingRow>
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => useSettings.getState().reset()}
                >
                  <RotateCcw className="size-3" aria-hidden="true" />
                  بازگشت به پیش‌فرض‌ها
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
