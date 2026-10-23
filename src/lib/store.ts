"use client";

import { create } from "zustand";
import {
  alignSegment,
  buildTrack,
  computeAccuracy,
  STRICTNESS_PRESETS,
  type MistakeEvent,
  type TrackWord,
} from "@/lib/alignment";
import { useSettings } from "@/lib/settings";

export interface AyahLite {
  n: number;
  g: number;
  t: string;
  fa: string;
}

export interface SurahLite {
  n: number;
  name: string;
  en: string;
  type: string;
  count: number;
}

export interface FeedbackMsg {
  id: string;
  kind: "info" | "heard" | "mistake" | "praise" | "analysis";
  text: string;
  detail?: string;
  at: number;
}

export type SessionPhase = "setup" | "ready" | "recording" | "paused" | "review";

/** نتیجهٔ موقت تشخیص گفتار مرورگر — فقط برای نمایش زنده، بدون ثبت نهایی */
export interface PreviewState {
  overrides: Record<number, TrackWord["status"]>;
  pos: number;
}

export interface StudioState {
  surah: SurahLite | null;
  fromAyah: number;
  toAyah: number;
  ayahs: AyahLite[];
  track: TrackWord[];
  pos: number;
  mistakes: MistakeEvent[];
  feedback: FeedbackMsg[];
  accuracy: number;
  wordsTotal: number;
  wordsCorrect: number;
  phase: SessionPhase;
  startedAt: number | null;
  elapsedSec: number;
  heardSegments: string[];
  showTranslation: boolean;
  lastAlignQuality: number;
  preview: PreviewState | null;

  setRange: (surah: SurahLite, from: number, to: number, ayahs: AyahLite[]) => void;
  setShowTranslation: (v: boolean) => void;
  begin: () => void;
  startListening: () => void;
  pauseListening: () => void;
  applyHeard: (text: string, alternatives?: string[]) => void;
  pushFeedback: (msg: Omit<FeedbackMsg, "id" | "at">) => void;
  tick: () => void;
  finish: () => void;
  reset: () => void;
  jumpTo: (wordIdx: number) => void;
  applyPreview: (text: string) => void;
  clearPreview: () => void;
}

let msgCounter = 0;

const emptyState = {
  surah: null,
  fromAyah: 1,
  toAyah: 1,
  ayahs: [] as AyahLite[],
  track: [] as TrackWord[],
  pos: 0,
  mistakes: [] as MistakeEvent[],
  feedback: [] as FeedbackMsg[],
  accuracy: 100,
  wordsTotal: 0,
  wordsCorrect: 0,
  phase: "setup" as SessionPhase,
  startedAt: null as number | null,
  elapsedSec: 0,
  heardSegments: [] as string[],
  showTranslation: true,
  lastAlignQuality: 0,
  preview: null as PreviewState | null,
};

export const useStudio = create<StudioState>((set, get) => ({
  ...emptyState,

  setRange: (surah, from, to, ayahs) => {
    const track = buildTrack(ayahs, from);
    set({
      surah,
      fromAyah: from,
      toAyah: to,
      ayahs,
      track,
      pos: 0,
      mistakes: [],
      feedback: [],
      accuracy: 100,
      wordsTotal: track.length,
      wordsCorrect: 0,
      phase: "ready",
      startedAt: null,
      elapsedSec: 0,
      heardSegments: [],
      preview: null,
    });
  },

  setShowTranslation: (v) => set({ showTranslation: v }),

  begin: () =>
    set((s) => ({
      phase: s.phase === "recording" ? s.phase : "ready",
      startedAt: Date.now(),
    })),

  startListening: () =>
    set((s) => ({
      phase: "recording",
      startedAt: s.startedAt ?? Date.now(),
      feedback: [
        ...s.feedback,
        {
          id: `m${++msgCounter}`,
          kind: "info",
          text: "گوش می‌دهم… تلاوت را شروع کنید. هر خطا را همان لحظه نشان می‌دهم.",
          at: Date.now(),
        },
      ],
    })),

  pauseListening: () =>
    set((s) => ({
      phase: "paused",
      feedback: [
        ...s.feedback,
        { id: `m${++msgCounter}`, kind: "info", text: "مکث. هر وقت آماده بودی ادامه بده.", at: Date.now() },
      ],
    })),

  applyHeard: (text, alternatives) => {
    const s = get();
    if (!text.trim() || s.track.length === 0) return;
    set({ preview: null }); // نتیجهٔ نهایی، پیش‌نمایش را جایگزین می‌کند
    if (s.pos >= s.track.length) {
      set({
        heardSegments: [...s.heardSegments, text],
        feedback: [
          ...s.feedback,
          {
            id: `m${++msgCounter}`,
            kind: "info",
            text: `شنیدم: «${text}» — اما بازهٔ انتخابی تمام شده است. اگر ادامه می‌دهی، بازهٔ جدید انتخاب کن.`,
            at: Date.now(),
          },
        ],
      });
      return;
    }

    // ——— انتخاب بهترین کاندید: متن اصلی + گزینه‌های جایگزین ASR ———
    const cfg = useSettings.getState();
    const preset = STRICTNESS_PRESETS[cfg.strictness];

    const scoreOf = (r: ReturnType<typeof alignSegment>): number =>
      (r.matchedAny || r.exact + r.fuzzy > 0 ? r.quality : 0) +
      r.exact * 0.004 +
      Math.max(0, r.newPos - s.pos) * 0.002;

    // کپی دست‌نخورده برای هر کاندید (وضعیت‌های قبلی جلسه حفظ می‌شود)
    const makeClone = () => s.track.map((w) => ({ ...w }));

    let track = makeClone();
    let res = alignSegment(track, s.pos, text, preset);
    let bestScore = scoreOf(res);

    if (alternatives && alternatives.length > 1) {
      for (const alt of alternatives.slice(1, 4)) {
        if (!alt?.trim() || alt.trim() === text) continue;
        const t2 = makeClone();
        const r2 = alignSegment(t2, s.pos, alt, preset);
        const sc = scoreOf(r2);
        if (sc > bestScore + 0.02) {
          res = r2;
          track = t2;
          bestScore = sc;
        }
      }
    }

    const stats = computeAccuracy(track);
    const newMistakes: MistakeEvent[] = [];
    for (const w of res.wrong) {
      newMistakes.push({
        type: "wrong",
        ayahIdx: track[w.idx].ayahIdx,
        ayahNumber: s.ayahs[track[w.idx].ayahIdx]?.n ?? 0,
        expected: w.expected,
        heard: w.heard,
        at: Date.now(),
      });
    }
    for (const idx of res.missed) {
      newMistakes.push({
        type: "missed",
        ayahIdx: track[idx].ayahIdx,
        ayahNumber: s.ayahs[track[idx].ayahIdx]?.n ?? 0,
        expected: track[idx].text,
        at: Date.now(),
      });
    }
    const insertRefIdx = Math.min(Math.max(0, res.newPos > 0 ? res.newPos - 1 : 0), Math.max(0, track.length - 1));
    for (const ins of res.inserted) {
      newMistakes.push({
        type: "inserted",
        ayahIdx: track[insertRefIdx]?.ayahIdx ?? 0,
        ayahNumber: s.ayahs[track[insertRefIdx]?.ayahIdx ?? 0]?.n ?? 0,
        heard: ins,
        at: Date.now(),
      });
    }

    const fb: FeedbackMsg[] = [...s.feedback];
    fb.push({ id: `m${++msgCounter}`, kind: "heard", text: text, at: Date.now() });

    if (res.wrong.length > 0) {
      const w = res.wrong[0];
      fb.push({
        id: `m${++msgCounter}`,
        kind: "mistake",
        text: `خطا در آیهٔ ${s.ayahs[track[w.idx].ayahIdx]?.n ?? "?"}: به‌جای «${w.expected}» شنیدم «${w.heard}»`,
        detail: "کلمهٔ درست را با رنگ سرخ در متن می‌بینی.",
        at: Date.now(),
      });
    }
    if (res.missed.length > 0) {
      const first = res.missed[0];
      fb.push({
        id: `m${++msgCounter}`,
        kind: "mistake",
        text: `جاافتادگی در آیهٔ ${s.ayahs[track[first].ayahIdx]?.n ?? "?"}: «${track[first].text}» گفته نشد.`,
        at: Date.now(),
      });
    }
    if (cfg.praise && exactPraiseNeeded(res)) {
      fb.push({
        id: `m${++msgCounter}`,
        kind: "praise",
        text: pickPraise(),
        at: Date.now(),
      });
    }

    set({
      track,
      pos: res.newPos,
      mistakes: [...s.mistakes, ...newMistakes],
      feedback: fb,
      accuracy: stats.accuracy,
      wordsCorrect: stats.correct,
      lastAlignQuality: res.quality,
      heardSegments: [...s.heardSegments, text],
    });
  },

  pushFeedback: (msg) =>
    set((s) => ({
      feedback: [...s.feedback, { ...msg, id: `m${++msgCounter}`, at: Date.now() }],
    })),

  tick: () =>
    set((s) => ({
      elapsedSec: s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0,
    })),

  finish: () => set({ phase: "review" }),

  reset: () => set(emptyState),

  jumpTo: (wordIdx) =>
    set((s) => {
      if (wordIdx < 0 || wordIdx > s.track.length) return {};
      const track = s.track.map((w, i) => ({
        ...w,
        status: i < wordIdx && w.status === "pending" ? ("missed" as const) : w.status,
      }));
      return { track, pos: wordIdx, preview: null };
    }),

  /** پیش‌نمایش زندهٔ نتایج موقت SpeechRecognition — بدون تغییر وضعیت نهایی */
  applyPreview: (text) => {
    if (!useSettings.getState().ghostPreview) return;
    const s = get();
    if (!text.trim() || s.track.length === 0) return;
    if (s.pos >= s.track.length) return;
    if (s.phase !== "recording") return;
    const segWords = text.trim().split(/\s+/).length;
    const winLen = Math.min(s.track.length - s.pos, segWords + 14);
    const winStart = s.pos;
    const win = s.track.slice(winStart, winStart + winLen).map((w) => ({ ...w }));
    const res = alignSegment(
      win,
      0,
      text,
      STRICTNESS_PRESETS[useSettings.getState().strictness]
    );
    const overrides: Record<number, TrackWord["status"]> = {};
    for (let i = 0; i < win.length; i++) {
      if (win[i].status !== s.track[winStart + i].status) {
        overrides[winStart + i] = win[i].status;
      }
    }
    const absPos = Math.min(s.track.length, winStart + res.newPos);
    set({ preview: { overrides, pos: absPos } });
  },

  clearPreview: () => set({ preview: null }),
}));

const praises = [
  "ماشاءالله! پیوسته و روان ادامه بده.",
  "بسیار خوب! حفظت محکم است.",
  "عالی! دقیق و شمرده می‌خوانی.",
  "برکت الله! همین ریتم را نگه دار.",
];

function pickPraise(): string {
  return praises[Math.floor(Math.random() * praises.length)];
}

function exactPraiseNeeded(res: { exact: number }): boolean {
  return res.exact >= 14 && Math.floor(res.exact / 14) === 1;
}

// هوک دیباگ برای تست E2E (غیرمخرب — فقط در مرورگر)
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__hafezStudio = useStudio;
}
