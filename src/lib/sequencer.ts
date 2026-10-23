/**
 * موتور پیگیری ترتیبی حرف‌به‌حرف — قلب همگام‌سازی زندهٔ تلاوت
 *
 * فلسفه (رفع ریشه‌ای «هایلایت می‌پرد جای دیگه»):
 * برخلاف هم‌ترازی DP آزاد که هر قطعه را می‌تواند به «هرجای» پنجره مچ کند،
 * این موتور یک نشانگر (cursor) دارد که فقط رو به جلو و فقط کلمه‌به‌کلمه حرکت می‌کند:
 *
 * ۱) کلمهٔ شنیده‌شده ابتدا با «همان کلمهٔ بعدی مورد انتظار» مقایسه می‌شود.
 * ۲) اگر نخواند، حداکثر ۴ کلمهٔ جلوتر نگاه می‌کند (جاافتادگی کوچک) — نه بیشتر.
 * ۳) اگر شبیه کلمهٔ مورد انتظار ولی ناقص بود → جانشینی واقعی (کلمهٔ غلط) — نشانگر می‌رود جلو.
 * ۴) اگر هیچ ربطی نداشت (نویز ASR) → نادیده گرفته می‌شود و نشانگر سرِ جایش می‌ماند.
 *
 * نتیجه: هایلایت دقیقاً هم‌قدم با صدای کاربر پیش می‌رود و هرگز به عقب یا
 * چندکلمه‌ای جلوتر نمی‌پرد.
 */

import {
  type TrackWord,
  type WordStatus,
  type AlignPreset,
  STRICTNESS_PRESETS,
  wordSimilarity,
  tokenize,
} from "./alignment";

/** حداکثر فاصلهٔ جستجوی جاافتادگی (کلمات) */
const LOOKAHEAD_MAX = 6;
/** آستانهٔ تطبیق برای پرش‌های دور (≥۳ کلمه جلوتر) — فقط تطبیق قوی */
const FAR_SKIP_BAR = 0.85;
/** حداکثر پرش دور در هر قطعه — ضد زنجیره‌شدن پرش‌های کاذب */
const FAR_SKIP_LIMIT = 2;
/** کف شباهت برای «جانشینی واقعی» (کلمهٔ غلط خوانده شده) — زیر آستانهٔ پذیرش */
const WRONG_BAND = 0.45;

export interface SeqMark {
  idx: number; // اندیس مطلق در track
  status: WordStatus;
}

export interface SeqResult {
  /** وضعیت‌های اعمال‌شده روی کلمات (برای ghost preview) */
  marks: SeqMark[];
  newCursor: number;
  exact: number;
  fuzzy: number;
  wrong: { idx: number; expected: string; heard: string }[];
  missed: number[];
  /** کلمات شنیده‌شده که به هیچ کلمه‌ای نچسبیدند (نویز ASR یا کلمات خارج از بازه) */
  unknown: string[];
  /** میانگین شباهت تطبیق‌های پذیرفته‌شده 0..1 */
  quality: number;
  matchedCount: number;
  matchedAny: boolean;
}

function emptySeq(pos: number): SeqResult {
  return {
    marks: [],
    newCursor: pos,
    exact: 0,
    fuzzy: 0,
    wrong: [],
    missed: [],
    unknown: [],
    quality: 0,
    matchedCount: 0,
    matchedAny: false,
  };
}

/**
 * پیگیری ترتیبی یک قطعهٔ شنیده‌شده روی پنجره‌ای از track.
 * window: برش track (کپی قابل تغییر) — startIdx: اندیس مطلق window[0].
 * statuses روی window اعمال می‌شوند و در marks هم گزارش می‌شوند.
 */
export function seqAlign(
  window: TrackWord[],
  startIdx: number,
  heardText: string,
  preset: AlignPreset = STRICTNESS_PRESETS.normal
): SeqResult {
  const words = tokenize(heardText);
  const rawWords = heardText
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || window.length === 0) return emptySeq(startIdx);

  let cursor = 0; // محلی داخل window
  let exact = 0,
    fuzzy = 0,
    simSum = 0,
    simCount = 0;
  let farSkips = 0;
  const marks: SeqMark[] = [];
  const wrong: SeqResult["wrong"] = [];
  const missed: number[] = [];
  const unknown: string[] = [];

  const setStatus = (local: number, status: WordStatus) => {
    window[local].status = status;
    marks.push({ idx: startIdx + local, status });
  };

  for (let i = 0; i < rawWords.length; i++) {
    const raw = rawWords[i];
    const norm = words[i];
    if (!norm) continue;
    if (cursor >= window.length) {
      unknown.push(raw); // بازه تمام شد — بقیه اضافه است
      continue;
    }

    // ۱) همان کلمهٔ بعدی مورد انتظار
    const simCursor = wordSimilarity(norm, window[cursor].norm);
    if (simCursor >= preset.fuzzyAccept) {
      if (simCursor >= preset.goodMatch) {
        exact++;
      } else {
        fuzzy++;
      }
      simSum += simCursor;
      simCount++;
      setStatus(cursor, "correct");
      cursor++;
      continue;
    }

    // ۲) جاافتادگی: جستجوی پله‌ای رو به جلو
    // نزدیک (۱-۲ کلمه): آستانهٔ عادی — دور (۳-۶ کلمه، مثلاً پرش یک آیهٔ کوتاه):
    // فقط تطبیق قوی (۰.۸۵+) و حداکثر ۲ بار در قطعه — تا کلمات پرتکرار نشانگر را نربانند
    let skipJ = -1;
    let skipFar = false;
    const limit = Math.min(cursor + LOOKAHEAD_MAX, window.length - 1);
    for (let j = cursor + 1; j <= limit; j++) {
      const dist = j - cursor;
      const bar = dist <= 2 ? preset.fuzzyAccept : FAR_SKIP_BAR;
      if (dist > 2 && farSkips >= FAR_SKIP_LIMIT) break;
      if (wordSimilarity(norm, window[j].norm) >= bar) {
        skipJ = j;
        skipFar = dist > 2;
        break; // نزدیک‌ترین — نه دورترین
      }
    }
    if (skipJ > 0) {
      // کلمات بین راه جا افتاده‌اند (فقط اگر قبلاً ارزیابی نشده بودند)
      for (let k = cursor; k < skipJ; k++) {
        const st = window[k].status;
        if (st === "pending" || st === "active") {
          setStatus(k, "missed");
          missed.push(startIdx + k);
        }
      }
      simSum += 1;
      simCount++;
      exact++;
      if (skipFar) farSkips++;
      setStatus(skipJ, "correct");
      cursor = skipJ + 1;
      continue;
    }

    // ۳) جانشینی واقعی: شبیه کلمهٔ مورد انتظار است ولی همان نیست (کلمهٔ غلط)
    if (simCursor >= WRONG_BAND) {
      setStatus(cursor, "wrong");
      wrong.push({
        idx: startIdx + cursor,
        expected: window[cursor].text,
        heard: raw,
      });
      simSum += simCursor;
      simCount++;
      cursor++;
      continue;
    }

    // ۴) نویز ASR — نشانگر نمی‌جنبد
    unknown.push(raw);
  }

  const matchedCount = exact + fuzzy + wrong.length;
  return {
    marks,
    newCursor: startIdx + cursor,
    exact,
    fuzzy,
    wrong,
    missed,
    unknown,
    quality: simCount > 0 ? simSum / simCount : 0,
    matchedCount,
    matchedAny: matchedCount > 0,
  };
}

/** امتیاز مقایسهٔ کاندیدها (متن اصلی در برابر گزینه‌های جایگزین ASR) */
export function seqScore(r: SeqResult, pos: number): number {
  return (
    (r.exact + r.fuzzy) * 1 +
    r.wrong.length * 0.2 +
    r.quality * 0.5 +
    (r.newCursor - pos) * 0.01 -
    r.unknown.length * 0.05
  );
}
