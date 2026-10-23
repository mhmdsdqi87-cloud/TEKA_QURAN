/**
 * تست شبیه‌سازی موتور صفرخطای کاذب (sequencer v2)
 * اجرا: bun scripts/test-sequencer-v2.ts
 * هدف: تلاوتِ درستِ آسیب‌دیده توسط ASR هرگز خطا/بوق تولید نکند؛
 *       خطاهای واقعی (جانشینی/پرش آیه‌ای) همچنان گرفته شوند.
 */
import { readFileSync } from "fs";
import path from "path";
import { useStudio, type AyahLite, type SurahLite } from "../src/lib/store";
import { wordSimilarity, normalizeArabic } from "../src/lib/alignment";

type AnySurah = {
  n: number;
  name: string;
  en: string;
  enTr?: string;
  type: string;
  count: number;
  ayahs: { n: number; g: number; t: string; fa: string }[];
};

const raw = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "quran.json"), "utf8")
) as AnySurah[];
const fatiha = raw[0];
const asr = raw[102]; // عصر
const ikhlas = raw[111]; // اخلاص

const sl = (s: AnySurah): SurahLite => ({
  n: s.n,
  name: s.name,
  en: s.en,
  type: s.type,
  count: s.count,
});
const ay = (s: AnySurah, from: number, to: number): AyahLite[] =>
  s.ayahs.slice(from - 1, to).map((a) => ({ n: a.n, g: a.g, t: a.t, fa: a.fa }));

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ❌ ${name} ${extra}`);
  }
}

const S = () => useStudio.getState();
const loudCount = () => S().mistakes.filter((m) => !m.mild).length;
const wrongCount = () => S().mistakes.filter((m) => m.type === "wrong").length;
const missedCount = () => S().mistakes.filter((m) => m.type === "missed").length;
const wrongIdxs = () =>
  S().track
    .map((w, i) => (w.status === "wrong" ? i : -1))
    .filter((i) => i >= 0);

/** گاربل واقعی ASR: حذف/افتادگی/جابجایی/تکرار حرف */
function garble(w: string, k: number): string {
  const letters = [...normalizeArabic(w)];
  if (letters.length <= 2) return w;
  const m = k % 4;
  if (m === 0 && letters.length > 3) return letters.slice(1).join("");
  if (m === 1) return letters.slice(0, -1).join("");
  if (m === 2 && letters.length > 2) {
    const c = [...letters];
    const t = c[1];
    c[1] = c[2];
    c[2] = t;
    return c.join("");
  }
  return letters.join("") + letters[letters.length - 1];
}

function setup(surah: AnySurah, from: number, to: number) {
  useStudio.getState().reset();
  useStudio.getState().setRange(sl(surah), from, to, ay(surah, from, to));
  useStudio.getState().startListening();
}

console.log("— S0: واحدهای شباهت —");
check("گاربل یلمون↔یعلمون ≥ 0.66", wordSimilarity("یلمون", "یعلمون") >= 0.66);
check("العالمين↔الرحيم < 0.48 (غیر soft)", wordSimilarity("العالمين", "الرحيم") < 0.48);
check("ناس↔الناس ≥ 0.9", wordSimilarity("ناس", "الناس") >= 0.9);
check("فقط↔الرحيم < 0.22 (آشغال)", wordSimilarity("فقط", "الرحيم") < 0.22);
check("جابجایی مكل↔ملك ≥ 0.66", wordSimilarity("مكل", "ملك") >= 0.66);

console.log("— S1: تلاوت تمیز فاتحه —");
setup(fatiha, 1, 7);
const words = S().track.map((w) => w.text);
const total = words.length;
S().applyHeard(words.join(" "));
check("pos = پایان", S().pos === total, `pos=${S().pos}/${total}`);
check("صفر خطای کاذب", S().mistakes.length === 0 && loudCount() === 0, JSON.stringify(S().mistakes));

console.log("— S2: تلاوت گاربل‌شده (هر کلمه آسیب ASR) —");
setup(fatiha, 1, 7);
S().applyHeard(words.map((w, i) => garble(w, i)).join(" "));
check("pos = پایان", S().pos === total, `pos=${S().pos}/${total}`);
check("صفر wrong", wrongCount() === 0, JSON.stringify(wrongIdxs()));
check("صفر missed", missedCount() === 0);
check("صفر رویداد بلند (بی‌بوق)", loudCount() === 0);

console.log("— S3: حذف ASR — هر ۷مین کلمه نشنود —");
setup(fatiha, 1, 7);
S().applyHeard(words.filter((_, i) => i % 7 !== 6).join(" "));
check("pos = پایان", S().pos === total, `pos=${S().pos}/${total}`);
check("صفر wrong", wrongCount() === 0);
check("همهٔ missed ملایم (بی‌بوق)", loudCount() === 0, `loud=${loudCount()}`);
check("missed ثبت شده برای آمار", missedCount() >= 1);

console.log("— S4: نویز ASR بین کلمات —");
setup(fatiha, 1, 7);
const junk = ["یا", "اه", "امم", "هه", "و", "فقط", "سلام", "درست"];
const noisy: string[] = [];
words.forEach((w, i) => {
  noisy.push(w);
  if (i % 3 === 2) noisy.push(junk[i % junk.length]);
});
S().applyHeard(noisy.join(" "));
check("pos = پایان", S().pos === total, `pos=${S().pos}/${total}`);
check("صفر خطا (نویز هرگز خطا نیست)", S().mistakes.length === 0, JSON.stringify(S().mistakes));
check("صفر رویداد بلند", loudCount() === 0);

console.log("— S5: جانشین واقعی — «الرحیم» → «العالمین» —");
setup(fatiha, 1, 7);
const idxRahim = S().track.findIndex((w) => w.norm === "الرحيم" && w.ayahIdx === 2);
S().applyHeard(
  [
    ...words.slice(0, idxRahim),
    "العالمين",
    ...words.slice(idxRahim + 1),
  ].join(" ")
);
check("کلمهٔ اشتباه علامت خورد", wrongIdxs().includes(idxRahim), `wrong=${JSON.stringify(wrongIdxs())} expect=${idxRahim}`);
check("رویداد بلند (بوق مستحق)", loudCount() >= 1);
check("pos = پایان", S().pos === total, `pos=${S().pos}/${total}`);

console.log("— S6: پرش آیه‌ای — مستقیم آیهٔ ۵ —");
setup(fatiha, 1, 7);
const idxIhdina = S().track.findIndex((w) => w.norm === "اهدنا");
S().applyHeard(words.slice(idxIhdina, idxIhdina + 3).join(" "));
const st6 = S();
check("بلوک پرش جاافتادهٔ بلند", st6.mistakes.filter((m) => m.type === "missed" && !m.mild).length >= 10, `missed=${missedCount()}`);
check("صفر wrong", wrongCount() === 0);
check("pos بعد از آیهٔ ۵", st6.pos === idxIhdina + 3, `pos=${st6.pos} expect=${idxIhdina + 3}`);

console.log("— S7: تکرار آیه — بدون خطا —");
setup(fatiha, 1, 3);
S().applyHeard(words.slice(0, 4).join(" ")); // آیهٔ ۱
S().applyHeard(words.slice(4, 8).join(" ")); // آیهٔ ۲
S().applyHeard(words.slice(0, 4).join(" ")); // تکرار آیهٔ ۱
const st7 = S();
check("هیچ خطایی برای تکرار", st7.mistakes.length === 0, JSON.stringify(st7.mistakes));
check("نشانگر عقب نرفت و قفل نشد", st7.pos >= 8, `pos=${st7.pos}`);

console.log("— S8: ترکیب توکن‌ها — «و العصر» سرهم —");
setup(asr, 1, 3);
const asrWords = S().track.map((w) => w.text);
S().applyHeard("و العصر");
check("والعصر شنیده شد", S().pos === 1, `pos=${S().pos}`);
S().applyHeard(asrWords.slice(1).join(" "));
check("پایان سوره", S().pos === asrWords.length, `pos=${S().pos}/${asrWords.length}`);
check("صفر خطا", S().mistakes.length === 0, JSON.stringify(S().mistakes));

console.log("— S9: جلسهٔ ترکیبی اخلاص (گاربل+نویز+حذف) —");
setup(ikhlas, 1, 4);
const ik = S().track.map((w) => w.text);
const mixed: string[] = [];
ik.forEach((w, i) => {
  if (i === 6) return; // حذف ASR
  mixed.push(i % 2 === 0 ? garble(w, i + 1) : w);
  if (i % 4 === 3) mixed.push("امم");
});
S().applyHeard(mixed.join(" "));
const st9 = S();
check("pos = پایان", st9.pos === ik.length, `pos=${st9.pos}/${ik.length}`);
check("صفر wrong", wrongCount() === 0, JSON.stringify(wrongIdxs()));
check("صفر رویداد بلند", loudCount() === 0);
check("دقت ≥ 90", st9.accuracy >= 90, `acc=${st9.accuracy}`);

console.log("— S10: قطعهٔ تکراری ASR —");
setup(fatiha, 1, 2);
S().applyHeard(words.slice(0, 4).join(" "));
const segLen = S().heardSegments.length;
const fbLen = S().feedback.length;
S().applyHeard(words.slice(0, 4).join(" ")); // همان قطعه بلافاصله
check("قطعهٔ تکراری نادیده گرفته شد", S().heardSegments.length === segLen && S().feedback.length === fbLen);

console.log("— S11: جریان زندهٔ چندقطعه‌ای (شبیه‌سازی اندروید) —");
setup(fatiha, 1, 7);
// قطعه‌های ریز اندرویدی با گاربل و نویز — کامل و بدون حذف آیه
S().applyHeard("بسم الله الرحمن");
S().applyHeard("یلمون و"); // گاربل الرحیم + نویز
S().applyHeard("الحمد الله رب");
S().applyHeard("العالمین الرحمن");
S().applyHeard("یلمین مالك يوم الدين");
S().applyHeard("ایاک نعبد وایاک نستعین");
S().applyHeard("اهدنا الصراط المستقیم");
S().applyHeard("صراط الذين انعمت");
S().applyHeard("عليهم غير المغضوب عليهم ولا الضالين امم");
const st11 = S();
check("pos = پایان", st11.pos === total, `pos=${st11.pos}/${total}`);
check("صفر wrong", wrongCount() === 0, JSON.stringify(wrongIdxs()));
check("صفر رویداد بلند", loudCount() === 0, `loud=${loudCount()} misses=${JSON.stringify(st11.mistakes)}`);

console.log("— S12: بازبینی نهایی (finish) — گاربل جلسهٔ S2 قرمز نشود —");
setup(fatiha, 1, 7);
S().applyHeard(words.map((w, i) => garble(w, i + 2)).join(" "));
S().finish();
check("بعد از resweep صفر wrong", wrongCount() === 0, JSON.stringify(wrongIdxs()));
check("دقت نهایی ≥ 95", S().accuracy >= 95, `acc=${S().accuracy}`);

console.log("— S13: جانشینِ خارج از سوره («الکریم» به‌جای «الرحیم») — صفرخطا —");
setup(fatiha, 1, 7);
S().applyHeard([...words.slice(0, idxRahim), "الکریم", ...words.slice(idxRahim + 1)].join(" "));
check("بدون مچ جای دیگر → قرمز نمی‌شود (ساکت)", wrongCount() === 0, JSON.stringify(wrongIdxs()));
check("رویداد بلند ندارد", loudCount() === 0);
check("pos = پایان (گیر نکرد)", S().pos === total, `pos=${S().pos}/${total}`);

console.log("— S14: پرست سخت‌گیر — تلاوت گاربل‌شده باز هم صفرخطا —");
const { useSettings } = await import("../src/lib/settings");
useSettings.setState({ strictness: "strict" });
setup(fatiha, 1, 7);
S().applyHeard(words.map((w, i) => garble(w, i + 1)).join(" "));
check("strict: صفر wrong", wrongCount() === 0, JSON.stringify(wrongIdxs()));
check("strict: صفر رویداد بلند", loudCount() === 0);
check("strict: pos = پایان", S().pos === total, `pos=${S().pos}/${total}`);
useSettings.setState({ strictness: "normal" });

console.log("— S15: جریان چندقطعه‌ای + بازبینی نهایی — قرمز هرگز کاذب نیست —");
setup(fatiha, 1, 7);
S().applyHeard("بسم الله الرحمن");
S().applyHeard("یلمون و");
S().applyHeard("الحمد الله رب");
S().applyHeard("العالمین الرحمن");
S().applyHeard("یلمین مالك يوم الدين");
S().applyHeard("ایاک نعبد وایاک نستعین");
S().applyHeard("اهدنا الصراط المستقیم");
S().applyHeard("صراط الذين انعمت");
S().applyHeard("عليهم غير المغضوب عليهم ولا الضالين امم");
S().finish();
const st15 = S();
check("بعد از بازبینی: صفر wrong", wrongCount() === 0, JSON.stringify(wrongIdxs()));
check("بعد از بازبینی: رویداد بلند ندارد", loudCount() === 0);
check("دقت ≥ 90", st15.accuracy >= 90, `acc=${st15.accuracy}`);

console.log("— S16: جانشین واقعی پس از بازبینی قرمز می‌ماند —");
setup(fatiha, 1, 7);
S().applyHeard([...words.slice(0, idxRahim), "العالمين", ...words.slice(idxRahim + 1)].join(" "));
check("زنده: قرمز خورد", wrongIdxs().includes(idxRahim));
S().finish();
check("بازبینی: قرمز حفظ شد (تبرئه نشد)", wrongIdxs().includes(idxRahim), JSON.stringify(wrongIdxs()));

console.log(`\nنتیجه: ${pass} پاس / ${fail} خطا`);
if (fail > 0) {
  console.log("شکست‌ها:", failures.join(" | "));
  process.exit(1);
}
console.log("همهٔ سناریوها پاس شدند ✅");
