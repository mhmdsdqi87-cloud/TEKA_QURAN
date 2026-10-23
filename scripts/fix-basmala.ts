/**
 * فیکس دادهٔ قرآن — حذف باسمهٔ چسبیده به آیهٔ اول
 *
 * مشکل: در دادهٔ خام (alquran.cloud عثمانی) «بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ»
 * به ابتدای آیهٔ ۱ همهٔ سوره‌ها (به‌جز فاتحه که خودش آیهٔ ۱ است و توبه که اصلاً
 * باسمه ندارد) چسبیده است → شمارش کلمات آیهٔ اول به‌هم می‌ریزد، نمایش غلط است
 * و ردیابی تلاوتِ آغاز سوره خراب می‌شود.
 *
 * راه‌حل: حذف پیشوند باسمه از متن آیهٔ ۱. (شمارش آیات ۶۲۳۶ و شمارهٔ جهانی g
 * دست‌نخورده می‌ماند — باسمه آیهٔ مستقل نیست.) بکاپ: data/quran.json.bak
 */
import fs from "fs";
import path from "path";

interface AyahData { n: number; g: number; t: string; fa: string }
interface SurahData { n: number; name: string; en: string; enTr: string; type: string; count: number; ayahs: AyahData[] }

/** همان نرمال‌سازیِ اپ (alignment.ts) — فقط برای تشخیص باسمه */
function normAr(s: string): string {
  return s
    .replace(/\u0670/g, "\u0627")
    .replace(/\u06E5/g, "\u0648")
    .replace(/\u06E6/g, "\u064A")
    .replace(/[\u0622\u0623\u0625\u0627\u0671]/g, "\u0627")
    .replace(/[\u064A\u0649\u06CC]/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/\u0621/g, "")
    .replace(/[\u064B-\u065F\u06D6-\u06ED\u08F0-\u08F3\u0610-\u061A]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[^\u0621-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // هم‌سازی با canon اپ: الرحمان (حاصل از الف خنجی) → الرحمن
    .replace(/الرحمان/g, "الرحمن");
}

const BASMALA_NORM = "بسم الله الرحمن الرحيم";

const filePath = path.join(process.cwd(), "data", "quran.json");
const backupPath = path.join(process.cwd(), "data", "quran.json.bak");

// بکاپ فقط بار اول
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(filePath, backupPath);
  console.log("✓ بکاپ ساخته شد: data/quran.json.bak");
}

const quran = JSON.parse(fs.readFileSync(filePath, "utf8")) as SurahData[];

let fixed = 0;
const skipped: string[] = [];

for (const s of quran) {
  if (s.n === 1 || s.n === 9) continue; // فاتحه: باسمه خودِ آیهٔ ۱ است؛ توبه: اصلاً باسمه ندارد
  const a1 = s.ayahs[0];
  if (!a1) continue;
  const words = a1.t.trim().split(/\s+/).filter(Boolean);
  // پیدا کردن کمینهٔ پیشوندی که نرمال‌شده‌اش «بسم الله الرحمن الرحيم» می‌شود (حداکثر ۶ کلمه)
  let stripCount = 0;
  for (let take = 3; take <= Math.min(6, words.length); take++) {
    const joined = normAr(words.slice(0, take).join(" "));
    if (joined === BASMALA_NORM) { stripCount = take; break; }
    // اگر پیشوند از باسمه بلندتر شد، دیگر معنا ندارد
    if (!BASMALA_NORM.startsWith(joined) && joined.length >= BASMALA_NORM.length) break;
  }
  if (stripCount > 0) {
    const rest = words.slice(stripCount).join(" ").trim();
    if (rest.length === 0) {
      skipped.push(`${s.n}:${s.name} — آیهٔ ۱ فقط باسمه بود (حذف نشد؛ نیاز به بررسی دستی)`);
      continue;
    }
    a1.t = rest;
    fixed++;
  } else {
    // یا باسمه ندارد (غلط نبود) یا الگوی ناشناخته
    const n = normAr(a1.t);
    if (!n.startsWith("بسم ")) skipped.push(`${s.n}:${s.name} — باسمه نداشت (سالم)`);
    else skipped.push(`${s.n}:${s.name} — الگوی باسمهٔ ناشناخته: "${a1.t.slice(0, 50)}"`);
  }
}

fs.writeFileSync(filePath, JSON.stringify(quran), "utf8");
console.log(`✓ باسمه از ${fixed} سوره حذف شد`);
console.log(skipped.join("\n"));
