"use client";

/**
 * موتور تشخیص گفتار مرورگر (Web Speech API) — نسخهٔ مقاوم‌شده برای اندروید
 *
 * باگ‌های اندروید که این نسخه حل می‌کند:
 * ۱) resultIndex در کروم اندروید نامعتبر است (اغلب صفر برمی‌گردد) → اگر به آن اعتماد
 *    کنیم همهٔ نتایج نهایی قبلی در هر رویداد دوباره پردازش می‌شوند و وضعیت به هم می‌ریزد.
 *    راه‌حل: اندیس نتایج پردازش‌شدهٔ هر نشست را در Set نگه می‌داریم.
 * ۲) بعد از سکوت، اندروید تشخیص را قطع می‌کند؛ اگر start() هنگام بازراه‌اندازی خطا بدهد
 *    موتور برای همیشه می‌میرد. راه‌حل: backoff نمایی + تلاش مجدد + چرخ حیات (watchdog).
 * ۳) نتایج موقت تکراری/برعکس می‌آیند → فقط آخرین فرضیهٔ غیرنهایی استفاده می‌شود.
 */

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechSupported(): boolean {
  return getCtor() !== null;
}

export interface SpeechEngineOptions {
  lang?: string;
  onInterim: (text: string) => void;
  onFinal: (text: string, alternatives: string[]) => void;
  onError: (message: string, fatal: boolean) => void;
  /** وضعیت موتور عوض شد (زنده/مرده) — برای watchdog رابط کاربری */
  onStateChange?: (running: boolean) => void;
}

/** iOS Safari پیوسته را خراب پشتیبانی می‌کند؛ حالت هر-نتیجه-بازراه‌اندازی لازم است */
function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua);
  const ipadOs = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  return ios || ipadOs;
}

/** تأخیرهای بازراه‌اندازی — backoff نمایی برای جلوگیری از حلقهٔ start/abort اندروید */
const RESTART_DELAYS = [250, 500, 900, 1500, 2500, 4000];

export class SpeechEngine {
  private rec: SpeechRecognitionLike | null = null;
  private manualStop = false;
  private restarting = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFinal = false;
  private opts: SpeechEngineOptions;

  /** اندیس نتایج نهایی که در «نشست فعلی» پردازش شده‌اند — ضدتکرار اندروید */
  private processedFinals = new Set<number>();
  /** آخرین متن موقت ارسال‌شده — برای جلوگیری از فراخوانی تکراری onInterim */
  private lastInterim = "";
  /** تعداد تلاش ناموفق پشت‌سرهم برای start */
  private failStreak = 0;
  /** شمار خطاهای aborted پیاپی (طوفان abort اندروید) */
  private abortStorm = 0;
  private lastAbortAt = 0;
  private stormWarned = false;

  running = false;

  constructor(opts: SpeechEngineOptions) {
    this.opts = opts;
  }

  start(): boolean {
    const Ctor = getCtor();
    if (!Ctor) return false;
    this.manualStop = false;
    if (this.running || this.restarting) return true; // از start دوباره جلوگیری
    this.createAndStart();
    return true;
  }

  private setRunning(v: boolean) {
    if (this.running !== v) {
      this.running = v;
      this.opts.onStateChange?.(v);
    }
  }

  private createAndStart() {
    const Ctor = getCtor();
    if (!Ctor || this.manualStop) return;
    try {
      const rec = new Ctor();
      rec.lang = this.opts.lang ?? "ar-SA";
      // iOS: پیوسته مشکل دارد → تک‌نتیجه‌ای + بازراه‌اندازی؛ کروم/اج/اندروید: پیوستهٔ کامل
      const ios = isIosLike();
      rec.continuous = !ios;
      rec.interimResults = true;
      rec.maxAlternatives = 5;

      // نشست تازه → دفتر ضدتکرار تازه
      this.processedFinals = new Set();
      this.lastInterim = "";

      rec.onstart = () => {
        // شروع واقعی تأیید شد → زنجیرهٔ backoff صفر می‌شود
        this.failStreak = 0;
        this.abortStorm = 0;
        this.stormWarned = false;
        this.setRunning(true);
      };

      rec.onresult = (e: SpeechRecognitionEventLike) => {
        let interim = "";
        // مهم: به e.resultIndex اعتماد نمی‌کنیم (در اندروید اغلب ۰ است)؛
        // همهٔ نتایج را می‌پیماییم و فقط نتیجه‌های نهاییِ پردازش‌نشده را یک‌بار اعمال می‌کنیم.
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i];
          const alt = result[0];
          if (!alt) continue;
          if (result.isFinal) {
            if (this.processedFinals.has(i)) continue; // ضدتکرار — قلب رفع باگ اندروید
            this.processedFinals.add(i);
            const t = alt.transcript.trim();
            if (t) {
              const alts: string[] = [];
              for (let k = 0; k < result.length; k++) {
                const a = result[k]?.transcript?.trim();
                if (a && !alts.includes(a)) alts.push(a);
              }
              this.pendingFinal = ios; // iOS: بعد از هر نتیجهٔ نهایی خودش قطع می‌کند
              // متن موقت دیگر معتبر نیست؛ نتیجهٔ نهایی جای آن را می‌گیرد
              this.lastInterim = "";
              this.opts.onFinal(t, alts);
            }
          } else {
            interim += (interim ? " " : "") + alt.transcript;
          }
        }
        const it = interim.trim();
        if (it && it !== this.lastInterim) {
          this.lastInterim = it;
          this.opts.onInterim(it);
        }
      };

      rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
        if (e.error === "no-speech") return; // طبیعی — سکوت
        if (e.error === "aborted") {
          // طوفان abort در اندروید: اگر پشت‌سرهم آمد کمی عقب بکش
          const now = Date.now();
          this.abortStorm = now - this.lastAbortAt < 4000 ? this.abortStorm + 1 : 1;
          this.lastAbortAt = now;
          if (this.abortStorm >= 6 && !this.stormWarned) {
            this.stormWarned = true;
            this.opts.onError(
              "تشخیص گفتار چندبار قطع شد؛ اگر ادامه نداد، یک‌بار مکث کن و دوباره شروع کن.",
              false
            );
          }
          return;
        }
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          this.manualStop = true;
          this.setRunning(false);
          this.opts.onError(
            "دسترسی میکروفون برای تشخیص گفتار داده نشد. از تنظیمات مرورگر اجازهٔ میکروفون را بده.",
            true
          );
        } else if (e.error === "network") {
          this.opts.onError(
            "تشخیص گفتار مرورگر به اینترنت نیاز دارد؛ اتصال را بررسی کردی؟ ادامه تلاش می‌کنم…",
            false
          );
        } else if (e.error === "audio-capture") {
          this.manualStop = true;
          this.setRunning(false);
          this.opts.onError("میکروفون در دسترس نیست؛ شاید برنامهٔ دیگری آن را اشغال کرده.", true);
        } else if (e.error === "language-not-supported") {
          this.opts.onError(
            "زبان عربی در مرورگر تو پشتیبانی نمی‌شود؛ مرورگر کروم را امتحان کن.",
            false
          );
        }
      };

      rec.onend = () => {
        this.setRunning(false);
        if (this.manualStop) return;
        // کروم بعد از سکوت قطع می‌کند؛ iOS بعد از هر نتیجهٔ نهایی؛ خودکار راه‌اندازی مجدد می‌کنیم
        const delay = this.pendingFinal ? 120 : RESTART_DELAYS[Math.min(this.failStreak, RESTART_DELAYS.length - 1)];
        this.pendingFinal = false;
        this.scheduleRestart(delay);
      };

      this.rec = rec;
      rec.start();
      // اگر start موفق شود onstart می‌آید؛ اگر exception بدهد پایین می‌افتیم
    } catch {
      // start() معمولاً وقتی نشست قبلی هنوز در حال بسته‌شدن است exception می‌دهد
      // → به‌جای مردن، با backoff دوباره تلاش می‌کنیم (رفع «مرگ خاموش» اندروید)
      this.failStreak++;
      const delay = RESTART_DELAYS[Math.min(this.failStreak, RESTART_DELAYS.length - 1)];
      if (!this.manualStop) this.scheduleRestart(delay);
    }
  }

  private scheduleRestart(delay: number) {
    if (this.manualStop || this.restarting) return;
    this.restarting = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restarting = false;
      this.restartTimer = null;
      if (!this.manualStop) this.createAndStart();
    }, delay);
  }

  stop() {
    this.manualStop = true;
    this.setRunning(false);
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.restarting = false;
    try {
      this.rec?.stop();
      this.rec?.abort();
    } catch {
      /* ignore */
    }
    this.rec = null;
    this.processedFinals = new Set();
  }
}
