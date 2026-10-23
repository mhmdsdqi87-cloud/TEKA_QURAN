"use client";

import { useMemo } from "react";

interface DecorAyah {
  text: string;
  ref: string;
}

const FALLBACK_AYAHS: DecorAyah[] = [
  { text: "إِنَّا نَحْنُ نَزَّلْنَا ٱلذِّكْرَ وَإِنَّا لَهُۥ لَحَٰفِظُونَ", ref: "الحجر ٩" },
  { text: "وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ", ref: "القمر ١٧" },
  { text: "كِتَٰبٌ أَنزَلْنَٰهُ إِلَيْكَ مُبَٰرَكٌ", ref: "الصافات ١" },
  { text: "أَفَلَا يَتَدَبَّرُونَ ٱلْقُرْءَانَ", ref: "النساء ٨٢" },
  { text: "ٱلَّذِينَ ءَاتَيْنَٰهُمُ ٱلْكِتَٰبَ يَتْلُونَهُۥ حَقَّ تِلَاوَتِهِۦ", ref: "البقرة ١٢١" },
  { text: "وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا", ref: "المزمل ٤" },
  { text: "قَدْ أَفْلَحَ ٱلْمُؤْمِنُونَ ٱلَّذِينَ هُمْ فِى صَلَاتِهِمْ خَٰشِعُونَ", ref: "المؤمنون ١-٢" },
  { text: "إِنَّ ٱللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا۟ مَا بِأَنفُسِهِمْ", ref: "الرعد ١١" },
  { text: "وَقُل رَّبِّ زِدْنِى عِلْمًا", ref: "طه ١١٤" },
  { text: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا", ref: "الشرح ٥" },
];

/**
 * پس‌زمینهٔ شناور آیات قرآن — لایهٔ ثابت پشت محتوا با حرکت آرام
 */
export default function FloatingVerses({ ayahs }: { ayahs?: DecorAyah[] }) {
  const items = useMemo(() => {
    const list = ayahs && ayahs.length > 0 ? ayahs : FALLBACK_AYAHS;
    // پیکربندی ثابت برای هر آیه (بدون random در render تا hydration match شود)
    const configs = [
      { top: "8%", left: "6%", size: "clamp(14px, 1.6vw, 22px)", dur: 46, delay: 0, rot: -4 },
      { top: "22%", left: "78%", size: "clamp(12px, 1.3vw, 18px)", dur: 58, delay: -12, rot: 3 },
      { top: "48%", left: "12%", size: "clamp(13px, 1.5vw, 20px)", dur: 52, delay: -25, rot: -2 },
      { top: "66%", left: "82%", size: "clamp(14px, 1.7vw, 24px)", dur: 62, delay: -8, rot: 5 },
      { top: "82%", left: "18%", size: "clamp(11px, 1.2vw, 16px)", dur: 55, delay: -32, rot: -6 },
      { top: "12%", left: "42%", size: "clamp(10px, 1.1vw, 15px)", dur: 66, delay: -18, rot: 2 },
      { top: "38%", left: "55%", size: "clamp(12px, 1.4vw, 19px)", dur: 50, delay: -40, rot: -3 },
      { top: "74%", left: "45%", size: "clamp(11px, 1.25vw, 17px)", dur: 60, delay: -5, rot: 4 },
      { top: "55%", left: "88%", size: "clamp(10px, 1.15vw, 16px)", dur: 57, delay: -22, rot: -5 },
      { top: "5%", left: "88%", size: "clamp(11px, 1.3vw, 17px)", dur: 64, delay: -35, rot: 3 },
    ];
    return configs.map((c, i) => ({
      ...c,
      ayah: list[i % list.length],
    }));
  }, [ayahs]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {items.map((it, i) => (
        <span
          key={i}
          className="font-quran absolute whitespace-nowrap"
          style={
            {
              top: it.top,
              left: it.left,
              fontSize: it.size,
              color: "var(--gold)",
              opacity: 0.07,
              "--rot": `${it.rot}deg`,
              animation: `fv-drift ${it.dur}s ease-in-out ${it.delay}s infinite alternate`,
              textShadow: "0 0 24px oklch(0.8 0.13 85 / 0.25)",
            } as React.CSSProperties
          }
        >
          {it.ayah.text}
        </span>
      ))}
      <style>{`
        @keyframes fv-drift {
          0% { transform: translate(0, 0) rotate(var(--rot, 0deg)); }
          100% { transform: translate(-38px, -26px) rotate(var(--rot, 0deg)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .font-quran.absolute { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
