"use client";

import { create } from "zustand";
import {
  buildTrack,
  computeAccuracy,
  fullResweep,
  STRICTNESS_PRESETS,
  type MistakeEvent,
  type TrackWord,
} from "@/lib/alignment";
import { seqAlign, seqScore, stripOpeningBasmala } from "@/lib/sequencer";
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
  /** دورهای تکرار باقی‌ماندهٔ جلسه (از تنظیمات repeatRounds) */
  roundsLeft: number;

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

/**
 * شمار کلمات پیاپیِ نچسبیده (نویز ASR) — اگر زیاد شد یعنی پیگیری گم شده
 * و باید با هم‌ترازی سراسری دوباره همگام شود.
 */
let unknownStreak = 0;

/** سقف پیام‌های بازخورد — جلوگیری از شلوغی/کندی رابط در جلسه‌های بلند */
const FEEDBACK_CAP = 60;

function appendFeedback(list: FeedbackMsg[], msg: FeedbackMsg): FeedbackMsg[] {
  const next = [...list, msg];
  return next.length > FEEDBACK_CAP ? next.slice(next.length - FEEDBACK_CAP) : next;
}

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
  roundsLeft: 0,
};

export const useStudio = create<StudioState>((set, get) => ({
  ...emptyState,

  setRange: (surah, from, to, ayahs) => {
    const track = buildTrack(ayahs, from);
    unknownStreak = 0;
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
      roundsLeft: 0,
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
      roundsLeft: useSettings.getState().repeatRounds,
      feedback: [
        ...s.feedback,
        {
          id: `m${++msgCounter}`,
          kind: "info",
          text: "گوش می‌دهم… کلمه‌به‌کلمه دنبالت هستم. تلاوت را شروع کن؛ هر خطا را همان لحظه نشان می‌دهم.",
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

    // ——— باسمهٔ آغازین: اگر شنیده شد (به‌جز فاتحه)، حذف می‌شود تا خطا نشمارد ———
    let heard = text;
    if ((s.surah?.n ?? 0) !== 1) {
      const stripped = stripOpeningBasmala(text);
      if (stripped !== text) {
        heard = stripped;
        if (!heard.trim()) {
          // فقط باسمه خوانده شد — میکروفون سالم است؛ فرصت شروع تلاوت
          set({
            heardSegments: [...s.heardSegments, text],
            feedback: appendFeedback(s.feedback, {
              id: `m${++msgCounter}`,
              kind: "info",
              text: "بسم‌الله — شنیدم! حالا تلاوت آیات را شروع کن؛ کلمه‌به‌کلمه دنبالت هستم.",
              at: Date.now(),
            }),
          });
          return;
        }
      }
    }

    // ضدتکرار دوم: همان متن پشت‌سرهم با فاصلهٔ خیلی کم را نادیده بگیر
    const lastSeg = s.heardSegments[s.heardSegments.length - 1];
    if (lastSeg && lastSeg.trim() === heard.trim() && s.feedback.length > 0) {
      const lastFb = s.feedback[s.feedback.length - 1];
      if (Date.now() - lastFb.at < 800) return;
    }

    if (s.pos >= s.track.length) {
      // ——— تکرار خودکار بازه (تثبیت حفظ) ———
      const repCfg = useSettings.getState().repeatRounds;
      if (repCfg > 0 && s.roundsLeft > 0) {
        const fresh = s.track.map((w) => ({ ...w, status: "pending" as const }));
        set({
          track: fresh,
          pos: 0,
          roundsLeft: s.roundsLeft - 1,
          accuracy: 100,
          wordsCorrect: 0,
          heardSegments: [],
          preview: null,
          feedback: appendFeedback(s.feedback, {
            id: `m${++msgCounter}`,
            kind: "praise",
            text: `یک دور کامل شد — ماشاءالله! دور تکرار شروع می‌شود (تثبیت حفظ). از اول بخوان.`,
            at: Date.now(),
          }),
        });
        // اعمال همین قطعهٔ شنیده‌شده روی دور تازه
        get().applyHeard(text, alternatives);
        return;
      }
      set({
        heardSegments: [...s.heardSegments, heard],
        feedback: appendFeedback(s.feedback, {
          id: `m${++msgCounter}`,
          kind: "info",
          text: `شنیدم: «${heard}» — اما بازهٔ انتخابی تمام شده است. اگر ادامه می‌دهی، بازهٔ جدید انتخاب کن.`,
          at: Date.now(),
        }),
      });
      return;
    }

    // ——— پیگیری ترتیبی حرف‌به‌حرف: کاندید اصلی + گزینه‌های جایگزین ASR ———
    // نکته: seqAlign روی «برش از pos» کار می‌کند (پنجرهٔ جلو) و وضعیت‌ها را
    // روی همان آبجکت‌های track اعمال می‌کند — پس اندیس‌های مطلق درست می‌مانند.
    const cfg = useSettings.getState();
    const preset = STRICTNESS_PRESETS[cfg.strictness];
    const makeClone = () => s.track.map((w) => ({ ...w }));

    let track = makeClone();
    let res = seqAlign(track.slice(s.pos), s.pos, heard, preset);
    let bestScore = seqScore(res, s.pos);

    if (alternatives && alternatives.length > 1) {
      for (const alt of alternatives.slice(1, 4)) {
        if (!alt?.trim() || alt.trim() === text) continue;
        const t2 = makeClone();
        const r2 = seqAlign(t2.slice(s.pos), s.pos, alt, preset);
        const sc = seqScore(r2, s.pos);
        if (sc > bestScore + 0.02) {
          res = r2;
          track = t2;
          bestScore = sc;
        }
      }
    }

    const fb: FeedbackMsg[] = [...s.feedback];
    let heardSegments = [...s.heardSegments, heard];

    // ——— تکرار آیه: اگر هیچ‌کدام جلو نچسبید، ببین آیا عقب‌تر (آیه‌ای که رد شده) مچ می‌شود ———
    // تکرار هرگز نشانگر را جابه‌جا نمی‌کند (رفع «می‌پره»)
    if (res.matchedCount === 0 && s.pos >= 4) {
      const backStart = Math.max(0, s.pos - 24);
      const bWin = s.track.slice(backStart, s.pos).map((w) => ({ ...w }));
      const b = seqAlign(bWin, backStart, heard, preset);
      if (b.matchedCount >= 2) {
        fb.push({ id: `m${++msgCounter}`, kind: "heard", text: heard, at: Date.now() });
        fb.push({
          id: `m${++msgCounter}`,
          kind: "praise",
          text: "تکرار آیه — عالی برای تثبیت حفظ! هر وقت آماده بودی از همین‌جا ادامه بده.",
          at: Date.now(),
        });
        set({ feedback: fb.length > FEEDBACK_CAP ? fb.slice(fb.length - FEEDBACK_CAP) : fb, heardSegments });
        return;
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
    const insertRefIdx = Math.min(
      Math.max(0, res.newCursor > 0 ? res.newCursor - 1 : 0),
      Math.max(0, track.length - 1)
    );
    for (const ins of res.unknown) {
      newMistakes.push({
        type: "inserted",
        ayahIdx: track[insertRefIdx]?.ayahIdx ?? 0,
        ayahNumber: s.ayahs[track[insertRefIdx]?.ayahIdx ?? 0]?.n ?? 0,
        heard: ins,
        at: Date.now(),
      });
    }

    fb.push({ id: `m${++msgCounter}`, kind: "heard", text: heard, at: Date.now() });

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

    // ——— خودهمگام‌سازی: اگر پیاپی کلمه‌ای نچسبید (گیر کردن پیگیری)،
      // کل شنیده‌های جلسه را یک‌جا با بازه هم‌تراز کن تا نشانگر به جای درست برگردد ———
    unknownStreak = res.matchedCount > 0 ? 0 : unknownStreak + res.unknown.length;
    if (unknownStreak >= 8 && heardSegments.length >= 2) {
      const heardAll = heardSegments.join(" ");
      const swept = fullResweep(track, heardAll, preset);
      if (swept !== track) {
        const st2 = computeAccuracy(swept);
        let sweptPos = 0;
        for (let i = 0; i < swept.length; i++) {
          if (swept[i].status !== "pending") sweptPos = i + 1;
        }
        unknownStreak = 0;
        set({
          track: swept,
          pos: Math.max(0, sweptPos),
          accuracy: st2.accuracy,
          wordsCorrect: st2.correct,
          heardSegments,
          feedback: appendFeedback(fb, {
            id: `m${++msgCounter}`,
            kind: "info",
            text: "همگام‌سازی دقیق انجام شد — از کلمهٔ هایلایت‌شده ادامه بده.",
            at: Date.now(),
          }),
        });
        return;
      }
      unknownStreak = 0;
      fb.push({
        id: `m${++msgCounter}`,
        kind: "info",
        text: "این جمله با بازهٔ انتخابی نمی‌خواند — اگر جای دیگری می‌خوانی، بازه را عوض کن یا روی کلمهٔ فعلی در متن بزن.",
        at: Date.now(),
      });
    }

    set({
      track,
      pos: Math.max(s.pos, res.newCursor), // نشانگر فقط رو به جلو
      mistakes: [...s.mistakes, ...newMistakes],
      feedback: fb.length > FEEDBACK_CAP ? fb.slice(fb.length - FEEDBACK_CAP) : fb,
      accuracy: stats.accuracy,
      wordsCorrect: stats.correct,
      lastAlignQuality: res.quality,
      heardSegments,
    });
  },

  pushFeedback: (msg) =>
    set((s) => ({
      feedback: appendFeedback(
        s.feedback,
        { ...msg, id: `m${++msgCounter}`, at: Date.now() }
      ),
    })),

  tick: () =>
    set((s) => ({
      elapsedSec: s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0,
    })),

  finish: () =>
    set((s) => {
      // ——— بازبینی سراسری پایانی: هم‌ترازی همهٔ شنیده‌ها با کل بازه ———
      // خطاهای انباشتهٔ هم‌ترازی لحظه‌ای را اصلاح می‌کند (دقت نهایی واقعی‌تر)
      if (s.heardSegments.length > 0 && s.track.length > 0) {
        const preset = STRICTNESS_PRESETS[useSettings.getState().strictness];
        const heardAll = s.heardSegments.join(" ");
        const swept = fullResweep(s.track, heardAll, preset);
        if (swept !== s.track) {
          const stats = computeAccuracy(swept);
          let newPos = 0;
          for (let i = 0; i < swept.length; i++) {
            if (swept[i].status !== "pending") newPos = i + 1;
          }
          return {
            track: swept,
            pos: Math.max(newPos, s.pos),
            accuracy: stats.accuracy,
            wordsCorrect: stats.correct,
            phase: "review" as const,
            feedback: [
              ...s.feedback,
              {
                id: `m${++msgCounter}`,
                kind: "analysis" as const,
                text: "بازبینی نهایی انجام شد؛ آمار با هم‌ترازی سراسری کل تلاوت محاسبه شد.",
                at: Date.now(),
              },
            ],
          };
        }
      }
      return { phase: "review" as const };
    }),

  reset: () => {
    unknownStreak = 0;
    set(emptyState);
  },

  jumpTo: (wordIdx) =>
    set((s) => {
      if (wordIdx < 0 || wordIdx > s.track.length) return {};
      unknownStreak = 0; // همگام‌سازی دستی کاربر — اعتماد تازه
      const track = s.track.map((w, i) => ({
        ...w,
        status: i < wordIdx && w.status === "pending" ? ("missed" as const) : w.status,
      }));
      return { track, pos: wordIdx, preview: null };
    }),

  /** پیش‌نمایش زندهٔ حرف‌به‌حرف نتایج موقت — فقط رو به جلو، بدون هیچ پرشی */
  applyPreview: (text) => {
    if (!useSettings.getState().ghostPreview) return;
    const s = get();
    if (!text.trim() || s.track.length === 0) return;
    if (s.pos >= s.track.length) return;
    if (s.phase !== "recording") return;
    // باسمهٔ آغازین را از پیش‌نمایش هم حذف کن تا هایلایت نپرد
    const heard = (s.surah?.n ?? 0) !== 1 ? stripOpeningBasmala(text) : text;
    if (!heard.trim()) return;
    const preset = STRICTNESS_PRESETS[useSettings.getState().strictness];
    const segWords = heard.trim().split(/\s+/).length;
    const winStart = s.pos;
    const winLen = Math.min(s.track.length - winStart, segWords + 6);
    const win = s.track.slice(winStart, winStart + winLen).map((w) => ({ ...w }));
    const res = seqAlign(win, winStart, heard, preset);
    const overrides: Record<number, TrackWord["status"]> = {};
    for (const m of res.marks) {
      if (s.track[m.idx]?.status !== m.status) {
        overrides[m.idx] = m.status;
      }
    }
    // seqAlign تضمین می‌کند newCursor حداکثر segWords+4 جلوتر است — پرش ناممکن
    const absPos = Math.min(s.track.length, Math.max(s.pos, res.newCursor));
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
