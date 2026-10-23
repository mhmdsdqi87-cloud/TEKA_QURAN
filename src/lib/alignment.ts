/**
 * موتور تطبیق تلاوت — هستهٔ هوشمند مقایسهٔ متن شنیده‌شده با متن قرآن
 * - نرمال‌سازی عربی (حذف اعراب، یکسان‌سازی الف/ی/ه ...)
 * - هم‌ترازی برنامه‌نویسی پویا (DP) روی پنجرهٔ لغات
 * - تشخیص: کلمهٔ درست / کلمهٔ اشتباه / کلمهٔ جاافتاده / کلمهٔ اضافه
 */

export type WordStatus = "pending" | "active" | "correct" | "wrong" | "missed";

export interface TrackWord {
  /** متن اصلی (عثمانی) */
  text: string;
  /** متن نرمال‌شده */
  norm: string;
  /** اندیس آیه در بازهٔ انتخابی (0-based) */
  ayahIdx: number;
  status: WordStatus;
}

export interface MistakeEvent {
  type: "wrong" | "missed" | "inserted";
  ayahIdx: number;
  ayahNumber: number;
  expected?: string;
  heard?: string;
  at: number; // timestamp ms
}

export interface AlignmentResult {
  /** اندیس کلمهٔ بعدی مورد انتظار */
  newPos: number;
  /** تعداد تطابق دقیق */
  exact: number;
  /** تعداد تطابق تقریبی (تلفظ متفاوت ولی همان کلمه) */
  fuzzy: number;
  wrong: { idx: number; expected: string; heard: string }[];
  missed: number[];
  inserted: string[];
  /** میانگین کیفیت هم‌ترازی 0..1 (اگر segment قابل تطبیق نبود 0) */
  quality: number;
  matchedAny: boolean;
}

/* ------------------------------------------------------------------ */

const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u08F0-\u08F3\u0610-\u061A]/g;

/** نرمال‌سازی متن عربی برای مقایسه */
export function normalizeArabic(text: string): string {
  return text
    .replace(/\u0670/g, "\u0627") // ٰ الف خنجی → الف کامل (عَٰلَمِينَ → عالمين) — تلفظش الف کامل است
    .replace(/\u06E5/g, "\u0648") // ۥ واو کوچک → واو کامل
    .replace(/\u06E6/g, "\u064A") // ۦ یای کوچک → یای کامل
    .replace(/[\u0622\u0623\u0625\u0627\u0671]/g, "\u0627") // آ أ إ ٱ ا → ا
    .replace(/[\u064A\u0649\u06CC]/g, "\u064A") // ي ى ی → ي
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/\u0624/g, "\u0648") // ؤ → و
    .replace(/\u0626/g, "\u064A") // ئ → ي
    .replace(/\u0621/g, "") // ء حذف
    .replace(DIACRITICS, "") // اعراب و علائم قرآنی
    .replace(/\u0640/g, "") // کشیده
    .replace(/[^\u0621-\u064A\s]/g, " ") // علائم و ارقام → فاصله
    .replace(/\u06E2/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeArabic(text)
    .split(" ")
    .filter(Boolean)
    .map(canonWord);
}

/**
 * هم‌سازی املای عثمانی با املای متداولی که ASR تولید می‌کند.
 * مثلاً «الرحمان» (عثمانی با الف خنجی) ↔ «الرحمن» (متداول)
 */
const CANON: Record<string, string> = {
  الرحمان: "الرحمن",
  صلاوة: "صلاة",
  الحيوة: "الحياة",
  زكوة: "زكاة",
  هاذا: "هذا",
  هاذه: "هذه",
  هاؤلاء: "هؤلاء",
  الطوار: "الطور",
};

function canonWord(w: string): string {
  return CANON[w] ?? w;
}

/** فاصلهٔ لوانشتاین با سقف (برای سرعت) */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  const la = a.length,
    lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

/** شباهت دو کلمهٔ نرمال‌شده 0..1 */
export function wordSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 2) return a === b ? 1 : 0;
  const d = levenshtein(a, b, Math.ceil(maxLen / 2));
  return Math.max(0, 1 - d / maxLen);
}

/* ------------------------------------------------------------------ */

export interface AlignPreset {
  fuzzyAccept: number;
  goodMatch: number;
  fuzzyCost: number;
  deleteCost: number;
  insertCost: number;
}

/** پرست‌های سخت‌گیری — بر اساس تنظیمات کاربر انتخاب می‌شود */
export const STRICTNESS_PRESETS: Record<"lenient" | "normal" | "strict", AlignPreset> = {
  lenient: { fuzzyAccept: 0.58, goodMatch: 0.85, fuzzyCost: 0.68, deleteCost: 0.72, insertCost: 1.1 },
  normal: { fuzzyAccept: 0.66, goodMatch: 0.9, fuzzyCost: 0.85, deleteCost: 0.8, insertCost: 1 },
  strict: { fuzzyAccept: 0.76, goodMatch: 0.94, fuzzyCost: 0.95, deleteCost: 0.92, insertCost: 0.9 },
};

const FUZZY_ACCEPT = STRICTNESS_PRESETS.normal.fuzzyAccept; // پیش‌فرض (سازگاری)
const GOOD_MATCH = STRICTNESS_PRESETS.normal.goodMatch; // بالای این = دقیق

/**
 * هم‌ترازی یک قطعهٔ شنیده‌شده با پنجره‌ای از کلمات مورد انتظار.
 * بازگشت: مسیر عملیات‌ها
 */
interface PathOp {
  heard?: string; // اندیس در segment
  heardNorm?: string;
  expectedIdx?: number; // اندیس مطلق در track
  expectedNorm?: string;
  score: number; // 0..1 یا -1 برای insert/delete
  kind: "match" | "insert" | "delete";
}

function dpAlign(
  seg: string[],
  segNorm: string[],
  window: TrackWord[],
  windowStart: number,
  preset: AlignPreset = STRICTNESS_PRESETS.normal
): { ops: PathOp[]; scoreSum: number; matches: number } {
  const m = seg.length;
  const n = window.length;
  const INF = 1e9;
  // dp[i][j]: هزینه تا مصرف i کلمهٔ شنیده و j کلمهٔ مورد انتظار
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(INF));
  const bt: number[][][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => [0, 0])
  );
  dp[0][0] = 0;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (dp[i][j] >= INF) continue;
      // match/substitution
      if (i < m && j < n) {
        const sim = wordSimilarity(segNorm[i], window[j].norm);
        const cost =
          sim >= preset.goodMatch ? 0 : sim >= preset.fuzzyAccept ? preset.fuzzyCost : 1;
        const nc = dp[i][j] + cost;
        if (nc < dp[i + 1][j + 1]) {
          dp[i + 1][j + 1] = nc;
          bt[i + 1][j + 1] = [i, j];
        }
      }
      // insert (کلمهٔ اضافه گفته شده)
      if (i < m && dp[i][j] + preset.insertCost < dp[i + 1][j]) {
        dp[i + 1][j] = dp[i][j] + preset.insertCost;
        bt[i + 1][j] = [i, j];
      }
      // delete (کلمه جا افتاده)
      if (j < n && dp[i][j] + preset.deleteCost < dp[i][j + 1]) {
        dp[i][j + 1] = dp[i][j] + preset.deleteCost;
        bt[i][j + 1] = [i, j];
      }
    }
  }
  // backtrack از بهترین نقطهٔ پایانی (اولویت: مصرف کامل segment، بعدی مصرف بیشتر expected)
  let bestI = m;
  let bestJ = 0;
  let bestCost = INF;
  for (let j = 0; j <= n; j++) {
    const c = dp[m][j] - j * 0.05; // پاداش پیشروی
    if (c < bestCost) {
      bestCost = c;
      bestJ = j;
    }
  }
  const ops: PathOp[] = [];
  let i = bestI,
    j = bestJ;
  let scoreSum = 0,
    matches = 0;
  while (i > 0 || j > 0) {
    const [pi, pj] = bt[i][j];
    if (i === pi + 1 && j === pj + 1) {
      const sim = wordSimilarity(segNorm[i - 1], window[j - 1].norm);
      ops.push({
        heard: seg[i - 1],
        heardNorm: segNorm[i - 1],
        expectedIdx: windowStart + j - 1,
        expectedNorm: window[j - 1].norm,
        score: sim,
        kind: "match",
      });
      if (sim >= preset.fuzzyAccept) {
        scoreSum += sim;
        matches++;
      }
    } else if (i === pi + 1 && j === pj) {
      ops.push({ heard: seg[i - 1], heardNorm: segNorm[i - 1], score: -1, kind: "insert" });
    } else {
      ops.push({
        expectedIdx: windowStart + j - 1,
        expectedNorm: window[j - 1].norm,
        score: -1,
        kind: "delete",
      });
    }
    i = pi;
    j = pj;
  }
  ops.reverse();
  return { ops, scoreSum, matches };
}

/**
 * اعمال یک قطعهٔ متن شنیده‌شده (خروجی ASR) روی track.
 * pos: اندیس فعلی. track آینهٔ زنده تغییر وضعیت کلمات است.
 */
export function alignSegment(
  track: TrackWord[],
  pos: number,
  heardText: string,
  preset: AlignPreset = STRICTNESS_PRESETS.normal
): AlignmentResult {
  const empty: AlignmentResult = {
    newPos: pos,
    exact: 0,
    fuzzy: 0,
    wrong: [],
    missed: [],
    inserted: [],
    quality: 0,
    matchedAny: false,
  };
  const heard = heardText.trim();
  if (!heard) return empty;
  const segNorm = tokenize(heard);
  const segRaw = heard
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u08F0-\u08F3]/g, "")
    .split(/\s+/)
    .filter(Boolean); // متن اصلی بدون اعراب — برای نمایش «شنیده شد»
  if (segNorm.length === 0) return empty;

  const forwardWindowLen = Math.min(track.length - pos, segNorm.length + 14);
  if (forwardWindowLen <= 0) return { ...empty, inserted: segRaw };

  const fwd = dpAlign(segNorm, segNorm, track.slice(pos, pos + forwardWindowLen), pos, preset);
  const segLen = segNorm.length;
  const fwdQuality = fwd.matches > 0 ? fwd.scoreSum / fwd.matches : 0;
  const fwdProgress = bestProgress(fwd.ops, pos);

  // پنجرهٔ عقب‌رو برای تکرار آیه
  const backStart = Math.max(0, pos - 18);
  let back: ReturnType<typeof dpAlign> | null = null;
  let backQuality = 0;
  if (backStart < pos && pos - backStart >= 4) {
    const bWin = track.slice(backStart, pos);
    const b = dpAlign(segNorm, segNorm, bWin, backStart, preset);
    backQuality = b.matches > 0 ? b.scoreSum / b.matches : 0;
    if (backQuality > fwdQuality + 0.12) back = b;
  }

  const chosen = back ?? fwd;
  const chosenQuality = back ? backQuality : fwdQuality;

  if (!chosen.ops.length || (chosenQuality < 0.55 && countMatches(chosen.ops, preset) < 2)) {
    // قطعه قابل تطبیق نبود؛ همه را اضافه در نظر بگیر اما position دست نمی‌خورد
    return {
      ...empty,
      inserted: segRaw,
      quality: chosenQuality,
    };
  }

  let newPos = pos;
  let exact = 0,
    fuzzy = 0;
  const wrong: AlignmentResult["wrong"] = [];
  const missed: number[] = [];
  const inserted: string[] = [];

  for (const op of chosen.ops) {
    if (op.kind === "match" && op.expectedIdx !== undefined) {
      const w = track[op.expectedIdx];
      if (op.score !== undefined && op.score >= preset.fuzzyAccept) {
        if (op.score >= preset.goodMatch) {
          if (w.status !== "correct") exact++;
          w.status = "correct";
        } else {
          if (w.status !== "correct" && w.status !== "wrong") fuzzy++;
          w.status = "correct";
        }
      } else {
        w.status = "wrong";
        wrong.push({
          idx: op.expectedIdx,
          expected: w.text,
          heard: op.heard ?? "",
        });
      }
      if (op.expectedIdx + 1 > newPos) newPos = op.expectedIdx + 1;
    } else if (op.kind === "delete" && op.expectedIdx !== undefined) {
      const w = track[op.expectedIdx];
      if (w.status === "pending" || w.status === "active") {
        w.status = "missed";
        missed.push(op.expectedIdx);
      }
    } else if (op.kind === "insert" && op.heard) {
      inserted.push(op.heard);
    }
  }

  return {
    newPos,
    exact,
    fuzzy,
    wrong,
    missed,
    inserted,
    quality: chosenQuality,
    matchedAny: newPos > pos || exact + fuzzy > 0,
  };
}

function countMatches(ops: PathOp[], preset: AlignPreset = STRICTNESS_PRESETS.normal): number {
  return ops.filter((o) => o.kind === "match" && o.score >= preset.fuzzyAccept).length;
}

function bestProgress(ops: PathOp[], pos: number): number {
  let maxPos = pos;
  for (const op of ops) {
    if (op.kind === "match" && op.expectedIdx !== undefined && op.expectedIdx + 1 > maxPos) {
      maxPos = op.expectedIdx + 1;
    }
  }
  return maxPos;
}

/** ساخت track از آیات */
export function buildTrack(
  ayahs: { n: number; t: string }[],
  startAyahNumber: number
): TrackWord[] {
  const track: TrackWord[] = [];
  ayahs.forEach((a, ayahIdx) => {
    const words = a.t.split(/\s+/).filter(Boolean);
    for (const w of words) {
      track.push({ text: w, norm: canonWord(normalizeArabic(w)), ayahIdx, status: "pending" });
    }
  });
  void startAyahNumber;
  return track;
}

/** محاسبهٔ آمار دقت از وضعیت فعلی track */
export function computeAccuracy(track: TrackWord[]): {
  accuracy: number;
  total: number;
  correct: number;
  wrong: number;
  missed: number;
} {
  let total = 0,
    correct = 0,
    wrong = 0,
    missed = 0;
  for (const w of track) {
    if (w.status === "pending" || w.status === "active") continue;
    total++;
    if (w.status === "correct") correct++;
    else if (w.status === "wrong") wrong++;
    else if (w.status === "missed") missed++;
  }
  const accuracy = total === 0 ? 100 : Math.round((correct / total) * 1000) / 10;
  return { accuracy, total, correct, wrong, missed };
}
