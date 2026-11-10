/**
 * موتور پیگیری ترتیبی حرف‌به‌حرف — نسخهٔ ۳ «تأیید دومرحله‌ای»
 *
 * فلسفه (رفع ریشه‌ای «پشت‌سرهم بوق و خطا روی تلاوت درست»):
 * هیچ سیگنال خطایی نباید از یک قطعهٔ ASR به‌تنهایی صادر شود — چون ASR خودش
 * کلمه‌ها را می‌اندازد/خراب می‌کند. پس هر خطا فقط با «دو شاهد مستقل» صادر می‌شود:
 *
 * ۱) تطبیق مستقیم → سبز، جلو.
 * ۲) تطبیق نرم (گاربل ASR) → سبز، جلو — هرگز خطا نیست.
 * ۳) مورفولوژی (ضمیر/ال متفاوت) → سبز، جلو — هرگز خطا نیست.
 * ۴) جاافتادگی ۱-۲ کلمه‌ای → «هیچ». کلمه pending می‌ماند؛ نه رنگ خطا، نه بوق.
 *    (تقریباً همیشه حذف ASR است؛ بازبینی نهایی حسابش می‌کند)
 * ۵) شکاف ۳+ کلمه‌ای → کلمات کهربایی «ملایم» می‌شوند و «منتظر تأیید» می‌مانند.
 *    بوق فقط وقتی که قطعهٔ بعدی هم از آن ناحیه عبور کند (تأیید دومرحله‌ای).
 *    اگر قطعهٔ بعدی به همان ناحیه برگردد → شکاف تبرئه و کلمات pending می‌شوند.
 * ۶) جانشینی واقعی (کلمهٔ ناشناس که خودش در جای دیگر سوره مچِ قوی شود) → قرمز فوری.
 *    (این تنها خطای فوری است — دو شاهد مستقل دارد)
 * ۷) نویز خالص ASR → هیچ.
 *
 * نتیجه: بوق فقط وقتی به صدا درمی‌آید که «دو قطعهٔ مستقل» هم انحراف را تأیید کرده‌اند.
 */

import {
  type TrackWord,
  type WordStatus,
  type AlignPreset,
  STRICTNESS_PRESETS,
  wordSimilarity,
  normalizeArabic,
  normToken,
  softMinOf,
} from "./alignment";

/* ------------------------------------------------------------------ */
/* باسمهٔ آغازین — شنیده می‌شود اما جزو آیات نیست (به‌جز فاتحه)      */
/* ------------------------------------------------------------------ */

/**
 * اگر قطعهٔ شنیده‌شده با «بسم الله الرحمن الرحيم» شروع شود، آن را برمی‌دارد
 * تا به‌عنوان «کلمهٔ اضافه» خطا شمرده نشود. (فاتحه را حذف نمی‌کنیم — آنجا
 * باسمه خودِ آیهٔ ۱ است؛ تصمیم را caller می‌گیرد.)
 */
export function stripOpeningBasmala(text: string): string {
  const raw = text.trim().split(/\s+/).filter(Boolean);
  if (raw.length === 0) return text;
  const normed = raw.map((w) => normalizeArabic(w));
  // الگوی استاندارد ۴ کلمه‌ای: بسم الله الرحمن الرحيم
  if (
    normed.length >= 4 &&
    normed[0] === "بسم" &&
    normed[1] === "الله" &&
    (normed[2] === "الرحمن" || normed[2] === "الرحمان") &&
    normed[3] === "الرحيم"
  ) {
    return raw.slice(4).join(" ");
  }
  // ASR گاهی «بسم‌الله» را سرهم می‌شنود
  if (
    normed.length >= 3 &&
    normed[0].replace(/\s/g, "") === "بسمالله" &&
    (normed[1] === "الرحمن" || normed[1] === "الرحمان") &&
    normed[2] === "الرحيم"
  ) {
    return raw.slice(3).join(" ");
  }
  return text;
}

/** آستانهٔ تطبیق برای پرش‌های دور (۳-۶ کلمه جلوتر) — فقط تطبیق قوی */
const FAR_SKIP_BAR = 0.85;
/** حداکثر پرش دور در هر قطعه — ضد زنجیره‌شدن پرش‌های کاذب */
const FAR_SKIP_LIMIT = 2;
/** آستانهٔ تأیید پرش آیه‌ای (کلمهٔ دوم مؤید) */
const VERSE_JUMP_BAR = 0.8;
/** سقف جستجوی پرش آیه‌ای (کلمه) */
const VERSE_JUMP_RANGE = 60;
/** حداقل شباهت کلمهٔ ناشناس برای «کاندید خطا» شدن — زیرش یعنی آشغال ASR خالص */
const SUSPECT_MIN = 0.22;
/** حداکثر کاندیدهای خطا در هر قطعه */
const SUSPECT_CAP = 3;
/** آستانهٔ ترکیب دو توکن ↔ یک کلمه (و بالعکس) */
const COMPOUND_BAR = 0.82;

/** آستانهٔ «کلمهٔ واقعی از جای دیگر سوره» — برای تأیید جانشینی واقعی */
const REAL_WORD_BAR = 0.85;
/** عمق جستجوی عقب برای کلمهٔ واقعی (تداخل آیات) */
const REAL_WORD_BACK = 40;

/* ------------------------------------------------------------------ */
/* شکاف‌های در انتظار تأیید                                            */
/* ------------------------------------------------------------------ */

/** شکاف [from,to) با اندیس مطلق — از روی این کلمات عبور شده اما هنوز «تأیید قطعی» نشده */
export interface GapInfo {
  from: number; // مطلق —inclusive
  to: number; // مطلق — exclusive
  at: number; // زمان شنیده‌شدن
}

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
  /** شکاف‌های بزرگ (۳+ کلمه) — کهربایی شده و منتظر تأیید قطعهٔ بعد */
  missed: number[];
  /** جاافتادگی ۱-۲ کلمه‌ای — عمداً بی‌رنگ و بی‌آمار لحظه‌ای (pending مانده) */
  softMiss: number[];
  /** شکاف‌های تازهٔ این قطعه — caller نگه می‌دارد تا قطعهٔ بعد تأیید/تبرئه کند */
  gaps: GapInfo[];
  /** کلمات شنیده‌شده که به هیچ کلمه‌ای نچسبیدند (نویز ASR یا کلمات خارج از بازه) */
  unknown: string[];
  /** میانگین شباهت تطبیق‌های پذیرفته‌شده 0..1 */
  quality: number;
  matchedCount: number;
  matchedAny: boolean;
  /** اندیس مطلق اولین تطبیق این قطعه — برای منطق تأیید/تبرئهٔ شکاف قبلی */
  firstMatchAbs: number | null;
}

function emptySeq(pos: number): SeqResult {
  return {
    marks: [],
    newCursor: pos,
    exact: 0,
    fuzzy: 0,
    wrong: [],
    missed: [],
    softMiss: [],
    gaps: [],
    unknown: [],
    quality: 0,
    matchedCount: 0,
    matchedAny: false,
    firstMatchAbs: null,
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
  preset: AlignPreset = STRICTNESS_PRESETS.normal,
  /** track کامل — فقط برای جستجوی عقب‌رو در تأیید جانشینی واقعی (اختیاری) */
  fullTrack?: TrackWord[]
): SeqResult {
  const softMin = softMinOf(preset);

  // ——— جفت‌سازی امن raw/norm ———
  // توکن‌هایی که نرمال‌سازی خالی‌شان می‌کند (لاتین/عدد/علامت) حذف می‌شوند
  // تا raw[i] همیشه با norm[i] همان کلمه جفت شود (رفع باگ جابجایی ایندکس).
  const rawAll = heardText.trim().split(/\s+/).filter(Boolean);
  const pairs: { raw: string; norm: string }[] = [];
  for (const raw of rawAll) {
    const norm = normToken(raw);
    if (norm.length > 0) pairs.push({ raw, norm });
  }
  if (pairs.length === 0 || window.length === 0) return emptySeq(startIdx);

  let cursor = 0; // محلی داخل window
  let exact = 0,
    fuzzy = 0,
    simSum = 0,
    simCount = 0;
  let farSkips = 0;
  const marks: SeqMark[] = [];
  const wrong: SeqResult["wrong"] = [];
  const missed: number[] = [];
  const softMiss: number[] = [];
  const gaps: GapInfo[] = [];
  const unknown: string[] = [];
  /** کلمات ناشناس پارک‌شده — فقط اگر کلمهٔ واقعی سوره در جای دیگر باشند قرمز می‌شوند */
  const suspects: { local: number; heard: string; norm: string }[] = [];
  let firstMatchAbs: number | null = null;

  const setStatus = (local: number, status: WordStatus) => {
    window[local].status = status;
    marks.push({ idx: startIdx + local, status });
  };

  const noteMatch = (local: number) => {
    if (firstMatchAbs === null) firstMatchAbs = startIdx + local;
  };

  /**
   * تأیید کاندیدهای خطا در بازهٔ [from, to):
   * کلمهٔ ناشناس پارک‌شده فقط وقتی «جانشینی واقعی» است که خودِ آن کلمه در
   * جای دیگری از سوره مچِ قوی شود (تداخل آیه — مثل گفتن «العالمین» به‌جای «الرحیم»)
   * — گاربلِ ASR هیچ‌جا مچ نمی‌شود و ساکت رها می‌شود (صفر خطای کاذب).
   */
  const resolveSuspects = (from: number, to: number) => {
    for (let s = suspects.length - 1; s >= 0; s--) {
      const sus = suspects[s];
      if (sus.local >= from && sus.local < to) {
        const absLocal = startIdx + sus.local;
        let realWord = false;
        const pool = fullTrack ?? window;
        for (let j = 0; j < pool.length; j++) {
          // مجاورت را جستجوی پرش خودش آزموده — فقط عقب‌تر و دورتر
          if (j >= absLocal && j <= absLocal + 6) continue;
          if (j < absLocal - REAL_WORD_BACK) continue;
          if (wordSimilarity(sus.norm, pool[j].norm) >= REAL_WORD_BAR) {
            realWord = true;
            break;
          }
        }
        if (realWord) {
          const w = window[sus.local];
          if (w.status === "pending" || w.status === "active") {
            setStatus(sus.local, "wrong");
            wrong.push({
              idx: absLocal,
              expected: w.text,
              heard: sus.heard,
            });
          }
        }
        suspects.splice(s, 1);
      }
    }
  };

  /**
   * علامت‌گذاری بلوک ردشدگی [from, to):
   * — ۱-۲ کلمه: هیچ (pending می‌ماند — حذف ASR یا مکث کوتاه؛ بازبینی نهایی حساب می‌کند)
   * — ۳+ کلمه: کهربایی ملایم + ثبت شکاف برای تأیید دومرحله‌ای (بوق اینجا ممنوع!)
   */
  const markSkipBlock = (from: number, to: number) => {
    const dist = to - from;
    for (let k = from; k < to; k++) {
      const st = window[k].status;
      if (st !== "pending" && st !== "active") continue;
      if (dist > 2) {
        setStatus(k, "missed");
        missed.push(startIdx + k);
      } else {
        softMiss.push(startIdx + k);
      }
    }
    if (dist > 2) {
      gaps.push({ from: startIdx + from, to: startIdx + to, at: Date.now() });
    }
  };

  const acceptMatch = (local: number, sim: number) => {
    if (sim >= preset.goodMatch) exact++;
    else fuzzy++;
    simSum += sim;
    simCount++;
    noteMatch(local);
    setStatus(local, "correct");
  };

  for (let i = 0; i < pairs.length; i++) {
    const { raw, norm } = pairs[i];
    if (cursor >= window.length) {
      unknown.push(raw); // بازه تمام شد — بقیه اضافه است
      continue;
    }

    // ۰) ترکیب‌ها — ASR گاهی «و» را جدا یا دو کلمه را سرهم می‌شنود
    if (i + 1 < pairs.length) {
      const join = norm + pairs[i + 1].norm;
      if (wordSimilarity(join, window[cursor].norm) >= COMPOUND_BAR) {
        acceptMatch(cursor, 1);
        cursor += 1;
        continue; // هر دو توکن مصرف شد
      }
    }
    if (cursor + 1 < window.length) {
      const joinE = window[cursor].norm + window[cursor + 1].norm;
      if (wordSimilarity(norm, joinE) >= COMPOUND_BAR) {
        acceptMatch(cursor, 1);
        setStatus(cursor + 1, "correct");
        cursor += 2;
        continue;
      }
    }

    // ۱) تطبیق مستقیم با همان کلمهٔ بعدی مورد انتظار
    const s0 = wordSimilarity(norm, window[cursor].norm);
    if (s0 >= preset.fuzzyAccept) {
      acceptMatch(cursor, s0);
      cursor += 1;
      continue;
    }

    // ۲) تطبیق نرم — گاربل ASR از کلمهٔ درست: جلو برو، هرگز خطا نشمار
    if (s0 >= softMin) {
      fuzzy++;
      simSum += s0;
      simCount++;
      noteMatch(cursor);
      setStatus(cursor, "correct");
      cursor += 1;
      continue;
    }

    // ۳) جاافتادگی: جستجوی پله‌ای ۱..۶
    //    نزدیک (۱ کلمه): آستانهٔ عادی — دوتایی (۲ کلمه): کمی سخت‌گیرتر (تا دو موقعیت خراب نشود)
    //    دور (۳-۶ کلمه): فقط تطبیق قوی + سقف ۲ بار
    let skipJ = -1;
    const limit = Math.min(cursor + 6, window.length - 1);
    for (let j = cursor + 1; j <= limit; j++) {
      const dist = j - cursor;
      if (dist > 2 && farSkips >= FAR_SKIP_LIMIT) break;
      const bar =
        dist === 1
          ? preset.fuzzyAccept
          : dist === 2
            ? Math.max(preset.fuzzyAccept, 0.74)
            : FAR_SKIP_BAR;
      if (wordSimilarity(norm, window[j].norm) >= bar) {
        skipJ = j;
        break; // نزدیک‌ترین — نه دورترین
      }
    }
    if (skipJ > 0) {
      const dist = skipJ - cursor;
      // کلمات ناشناس پارک‌شدهٔ مسیر — اگر علامت نخورده‌اند جانشینی واقعی‌اند
      resolveSuspects(cursor, skipJ);
      markSkipBlock(cursor, skipJ);
      if (dist > 2) farSkips++;
      simSum += 0.95;
      simCount++;
      exact++;
      noteMatch(skipJ);
      setStatus(skipJ, "correct");
      cursor = skipJ + 1;
      continue;
    }

    // ۴) پرش آیه‌ای دور (۷..۶۰) — فقط با تأیید دومین کلمه:
    //    این کلمه و کلمهٔ بعدی هر دو قوی به همان ناحیهٔ دور بچسبند
    //    (یک کلمهٔ پرتکرار مثل «الله» تنها هرگز نشانگر را نمی‌رباید)
    if (i + 1 < pairs.length && farSkips < FAR_SKIP_LIMIT && cursor + 7 < window.length) {
      let jFar = -1;
      const limit2 = Math.min(cursor + VERSE_JUMP_RANGE, window.length - 1);
      for (let j = cursor + 7; j <= limit2; j++) {
        if (
          wordSimilarity(norm, window[j].norm) >= FAR_SKIP_BAR &&
          wordSimilarity(pairs[i + 1].norm, window[j + 1]?.norm ?? "") >= VERSE_JUMP_BAR
        ) {
          jFar = j;
          break;
        }
      }
      if (jFar > 0) {
        resolveSuspects(cursor, jFar);
        markSkipBlock(cursor, jFar);
        farSkips++;
        simSum += 1;
        simCount++;
        exact++;
        noteMatch(jFar);
        setStatus(jFar, "correct");
        cursor = jFar + 1;
        continue;
      }
    }

    // ۵) ناشناس — نشانگر نمی‌جنبد؛ اگر معنادار بود کاندید خطا پارک می‌شود
    unknown.push(raw);
    if (
      norm.length >= 3 &&
      suspects.length < SUSPECT_CAP &&
      s0 >= SUSPECT_MIN
    ) {
      suspects.push({ local: cursor, heard: raw, norm });
    }
  }

  // پایان قطعه: کاندیدهای بی‌تأیید ساکت رها می‌شوند — نه قرمز، نه بوق.
  // (قطعهٔ بعدی از همان نشانگر دوباره آن‌ها را می‌آزماید)

  const matchedCount = exact + fuzzy + wrong.length;
  return {
    marks,
    newCursor: startIdx + cursor,
    exact,
    fuzzy,
    wrong,
    missed,
    softMiss,
    gaps,
    unknown,
    quality: simCount > 0 ? simSum / simCount : 0,
    matchedCount,
    matchedAny: matchedCount > 0,
    firstMatchAbs,
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
