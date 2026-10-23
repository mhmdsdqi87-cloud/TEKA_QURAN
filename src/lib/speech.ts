"use client";

/**
 * موتور تشخیص گفتار مرورگر (Web Speech API) — پشتیبانی از عربی زنده
 * در کروم/اج عالی کار می‌کند و نتایج موقت (interim) لحظه‌ای می‌دهد.
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
}

export class SpeechEngine {
  private rec: SpeechRecognitionLike | null = null;
  private manualStop = false;
  private restarting = false;
  private opts: SpeechEngineOptions;

  running = false;

  constructor(opts: SpeechEngineOptions) {
    this.opts = opts;
  }

  start(): boolean {
    const Ctor = getCtor();
    if (!Ctor) return false;
    this.manualStop = false;
    this.createAndStart();
    return true;
  }

  private createAndStart() {
    const Ctor = getCtor();
    if (!Ctor) return;
    try {
      this.rec = new Ctor();
      const rec = this.rec;
      rec.lang = this.opts.lang ?? "ar-SA";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;

      rec.onresult = (e: SpeechRecognitionEventLike) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const alt = result[0];
          if (!alt) continue;
          if (result.isFinal) {
            const t = alt.transcript.trim();
            if (t) {
              // همهٔ گزینه‌های جایگزین برای دقت بالاتر
              const alts: string[] = [];
              for (let k = 0; k < result.length; k++) {
                const a = result[k]?.transcript?.trim();
                if (a && !alts.includes(a)) alts.push(a);
              }
              this.opts.onFinal(t, alts);
            }
          } else {
            interim += alt.transcript;
          }
        }
        if (interim.trim()) this.opts.onInterim(interim.trim());
      };

      rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
        if (e.error === "no-speech" || e.error === "aborted") return; // طبیعی
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          this.running = false;
          this.opts.onError("دسترسی به میکروفون برای تشخیص گفتار داده نشد.", true);
        } else if (e.error === "network") {
          this.opts.onError(
            "تشخیص گفتار مرورگر به اینترنت نیاز دارد؛ اتصال را بررسی کردی؟ ادامه تلاش می‌کنم…",
            false
          );
        } else if (e.error === "audio-capture") {
          this.running = false;
          this.opts.onError("میکروفون در دسترس نیست.", true);
        } else if (e.error === "language-not-supported") {
          this.opts.onError("زبان عربی در مرورگر تو پشتیبانی نمی‌شود؛ یک مرورگر دیگر (کروم/اج) امتحان کن.", false);
        }
      };

      rec.onend = () => {
        if (this.manualStop) {
          this.running = false;
          return;
        }
        // کروم بعد از سکوت قطع می‌کند؛ خودکار راه‌اندازی مجدد می‌کنیم
        if (!this.restarting) {
          this.restarting = true;
          setTimeout(() => {
            this.restarting = false;
            if (!this.manualStop) this.createAndStart();
          }, 250);
        }
      };

      rec.start();
      this.running = true;
    } catch {
      // start() وقتی در حال اجراست exception می‌دهد؛ نادیده بگیر
    }
  }

  stop() {
    this.manualStop = true;
    this.running = false;
    try {
      this.rec?.stop();
      this.rec?.abort();
    } catch {
      /* ignore */
    }
    this.rec = null;
  }
}
