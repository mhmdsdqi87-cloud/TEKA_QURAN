import fs from "fs";
import path from "path";

export interface AyahData {
  /** ayah number within surah */
  n: number;
  /** global ayah number (1..6236) — used for audio CDN */
  g: number;
  /** Uthmani arabic text */
  t: string;
  /** Persian translation */
  fa: string;
}

export interface SurahData {
  n: number;
  name: string;
  en: string;
  enTr: string;
  type: "Meccan" | "Medinan";
  count: number;
  ayahs: AyahData[];
}

export interface SurahMeta {
  n: number;
  name: string;
  en: string;
  enTr: string;
  type: "Meccan" | "Medinan";
  count: number;
}

const globalForQuran = globalThis as unknown as {
  __quranCache?: SurahData[];
};

function loadQuran(): SurahData[] {
  if (globalForQuran.__quranCache) return globalForQuran.__quranCache;
  const filePath = path.join(process.cwd(), "data", "quran.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as SurahData[];
  globalForQuran.__quranCache = parsed;
  return parsed;
}

/** Full list of surahs (metadata only, without ayahs) */
export function getSurahList(): SurahMeta[] {
  return loadQuran().map((s) => ({
    n: s.n,
    name: s.name,
    en: s.en,
    enTr: s.enTr,
    type: s.type,
    count: s.count,
  }));
}

/** One surah with ayahs, optionally sliced from..to (1-based inclusive) */
export function getSurah(
  number: number,
  from?: number,
  to?: number
): SurahData | null {
  const surahs = loadQuran();
  const s = surahs.find((x) => x.n === number);
  if (!s) return null;
  const f = Math.max(1, from ?? 1);
  const t = Math.min(s.count, to ?? s.count);
  if (f > t) return null;
  return {
    ...s,
    count: t - f + 1,
    ayahs: s.ayahs.filter((a) => a.n >= f && a.n <= t),
  };
}

/** Random notable ayahs for background decoration */
export function getRandomAyahs(count: number): { text: string; ref: string }[] {
  const surahs = loadQuran();
  const out: { text: string; ref: string }[] = [];
  const famousSurahs = [1, 2, 3, 12, 18, 24, 36, 41, 55, 59, 67, 73, 87, 91, 93, 94, 97, 112, 113, 114];
  let i = 0;
  while (out.length < count && i < 500) {
    const sn = famousSurahs[Math.floor(Math.random() * famousSurahs.length)];
    const s = surahs.find((x) => x.n === sn)!;
    const a = s.ayahs[Math.floor(Math.random() * s.ayahs.length)];
    if (a.t.length > 12 && a.t.length < 130) {
      out.push({ text: a.t, ref: `${s.name} : ${a.n}` });
    }
    i++;
  }
  return out;
}
