/**
 * موتور صدا — بوق خطای لحظه‌ای، تشویق، شمارش معکوس
 * کاملاً با Web Audio API سنتز می‌شود (بدون فایل صوتی)
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** بعد از اولین کلیک کاربر صدا زده شود تا مرورگر اجازهٔ پخش بدهد */
export function unlockAudio(): void {
  ac();
}

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  delay?: number;
  vol?: number;
  slideTo?: number;
}

function tone(o: ToneOpts, master = 1): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.slideTo), t0 + o.dur);
  const v = Math.max(0, Math.min(1, (o.vol ?? 0.3) * master));
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(v, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.06);
}

export function vibrate(pattern: number | number[] = [70, 50, 90]): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* پشتیبانی نمی‌شود */
  }
}

export const sfx = {
  /** بوق خطا — دو تن نزولی هشداردهنده */
  error(vol = 0.7): void {
    tone({ freq: 760, dur: 0.13, type: "square", vol: 0.26, slideTo: 620 }, vol);
    tone({ freq: 520, dur: 0.22, type: "square", vol: 0.3, delay: 0.14, slideTo: 360 }, vol);
  },

  /** بوق جاافتادگی — تن بم کوتاه */
  missed(vol = 0.7): void {
    tone({ freq: 430, dur: 0.26, type: "sine", vol: 0.32, slideTo: 250 }, vol);
  },

  /** تشویق — آرپژ ماژور دلنشین */
  praise(vol = 0.7): void {
    [523.25, 659.25, 783.99].forEach((f, i) =>
      tone({ freq: f, dur: 0.3, type: "triangle", vol: 0.2, delay: i * 0.085 }, vol)
    );
  },

  /** تیک شمارش معکوس */
  count(vol = 0.7): void {
    tone({ freq: 660, dur: 0.11, type: "sine", vol: 0.28 }, vol);
  },

  /** تُن شروع (بعد از ۳-۲-۱) */
  go(vol = 0.7): void {
    tone({ freq: 880, dur: 0.22, type: "triangle", vol: 0.3 }, vol);
    tone({ freq: 1318.5, dur: 0.18, type: "sine", vol: 0.16, delay: 0.03 }, vol);
  },

  /** پایان جلسه — فانفار ملایم */
  done(vol = 0.7): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, dur: 0.38, type: "triangle", vol: 0.18, delay: i * 0.11 }, vol)
    );
  },
};
