"use client";

import { useMemo, type CSSProperties } from "react";

export type KaabaAnimationProps = {
  /** وقتی true شود انیمیشن «پرتاب» (زوم + انفجار نور طلایی) اجرا می‌گردد؛ با false کلاس برداشته می‌شود */
  launch?: boolean;
  className?: string;
};

type Star = {
  left: string;
  top: string;
  size: string;
  delay: string;
  duration: string;
  min: string;
  max: string;
  warm: boolean;
};

const STAR_COUNT = 28;

/** PRNG با دانهٔ ثابت — خروجی سرور و کلاینت یکسان است (بدون hydration mismatch) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** صحنهٔ سه‌بعدی کعبه — استایل‌ها در src/app/hero.css */
export default function KaabaAnimation({
  launch = false,
  className,
}: KaabaAnimationProps) {
  const stars = useMemo<Star[]>(() => {
    const rand = mulberry32(14020722);
    return Array.from({ length: STAR_COUNT }, () => {
      const warm = rand() > 0.55;
      return {
        left: `${(rand() * 100).toFixed(2)}%`,
        top: `${(rand() * 100).toFixed(2)}%`,
        size: `${(1.4 + rand() * 2.2).toFixed(2)}px`,
        delay: `${(rand() * 5).toFixed(2)}s`,
        duration: `${(2.6 + rand() * 3.6).toFixed(2)}s`,
        min: (0.12 + rand() * 0.2).toFixed(2),
        max: (0.6 + rand() * 0.4).toFixed(2),
        warm,
      };
    });
  }, []);

  return (
    <div
      role="img"
      aria-label="کعبه معظمه"
      className={`kaaba-scene${launch ? " kaaba-launch" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {/* میدان ستارهٔ چشمک‌زن */}
      <div className="kaaba-stars" aria-hidden="true">
        {stars.map((s, i) => (
          <span
            key={i}
            className={`kaaba-star ${s.warm ? "kaaba-star-warm" : "kaaba-star-cool"}`}
            style={
              {
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                animationDelay: s.delay,
                animationDuration: s.duration,
                "--o-min": s.min,
                "--o-max": s.max,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* هالهٔ بیضوی طواف زیر کعبه */}
      <div className="kaaba-orbit-glow" aria-hidden="true" />

      {/* مکعب + نور طواف (درون شناورِ آرام) */}
      <div className="kaaba-float" aria-hidden="true">
        <div className="kaaba-cube">
          <div className="kaaba-face kaaba-face-front" />
          <div className="kaaba-face kaaba-face-back" />
          <div className="kaaba-face kaaba-face-right" />
          <div className="kaaba-face kaaba-face-left" />
          <div className="kaaba-face kaaba-face-top" />
          <div className="kaaba-face kaaba-face-bottom" />
        </div>
        <div className="kaaba-tawaf">
          <span className="kaaba-tawaf-light" />
        </div>
      </div>
    </div>
  );
}

export { KaabaAnimation };
