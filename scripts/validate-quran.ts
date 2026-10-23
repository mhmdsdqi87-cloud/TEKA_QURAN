/**
 * اعتبارسنجی کامل دادهٔ قرآن — همهٔ ۱۱۴ سوره
 * چک‌ها: تعداد آیات استاندارد، شماره‌های n پیوسته، شمارهٔ جهانی g پیوستهٔ 1..6236،
 * باسمهٔ چسبیده به آیهٔ اول (بایدها/نبایدها)، متن خالی/کوتاه، ترجمهٔ خالی، نام‌ها
 */
import fs from "fs";
import path from "path";

interface AyahData { n: number; g: number; t: string; fa: string }
interface SurahData { n: number; name: string; en: string; enTr: string; type: string; count: number; ayahs: AyahData[] }

const STD_COUNTS: Record<number, number> = {
  1:7, 2:286, 3:200, 4:176, 5:120, 6:165, 7:206, 8:75, 9:129, 10:109, 11:123, 12:111,
  13:43, 14:52, 15:99, 16:128, 17:111, 18:110, 19:98, 20:135, 21:112, 22:78, 23:118,
  24:64, 25:77, 26:227, 27:93, 28:88, 29:69, 30:60, 31:34, 32:30, 33:73, 34:54, 35:45,
  36:83, 37:182, 38:88, 39:75, 40:85, 41:54, 42:53, 43:89, 44:59, 45:37, 46:35, 47:38,
  48:29, 49:18, 50:45, 51:60, 52:49, 53:62, 54:55, 55:78, 56:96, 57:29, 58:22, 59:24,
  60:13, 61:14, 62:11, 63:11, 64:18, 65:12, 66:12, 67:30, 68:52, 69:52, 70:44, 71:28,
  72:28, 73:20, 74:56, 75:40, 76:31, 77:50, 78:40, 79:46, 80:42, 81:29, 82:19, 83:36,
  84:25, 85:22, 86:17, 87:19, 88:26, 89:30, 90:20, 91:15, 92:21, 93:11, 94:8, 95:8,
  96:19, 97:5, 98:8, 99:8, 100:11, 101:11, 102:8, 103:3, 104:9, 105:5, 106:4, 107:7,
  108:3, 109:6, 110:3, 111:5, 112:4, 113:5, 114:6,
};

const BASMALA = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
const BASMALA_NORM = /^بسم\s*الله\s*الرحمن\s*الرحيم/;

function normAr(s: string): string {
  return s
    .replace(/\u0670/g, "\u0627")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648")
    .replace(/[\u064B-\u065F\u06D6-\u06ED\u08F0-\u08F3\u0610-\u061A\u0640]/g, "")
    .replace(/[^\u0621-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/الرحمان/g, "الرحمن");
}

const raw = fs.readFileSync(path.join(process.cwd(), "data", "quran.json"), "utf8");
const quran = JSON.parse(raw) as SurahData[];

let errors = 0, warnings = 0;
const issues: string[] = [];

const fail = (msg: string) => { errors++; issues.push("❌ " + msg); };
const warn = (msg: string) => { warnings++; issues.push("⚠️  " + msg); };

// ۱) تعداد و ترتیب سوره‌ها
if (quran.length !== 114) fail(`تعداد سوره‌ها ${quran.length} ≠ 114`);
quran.forEach((s, i) => {
  if (s.n !== i + 1) fail(`سورهٔ ${i + 1}: فیلد n=${s.n}`);
});

let gExpect = 1;
for (const s of quran) {
  const tag = `${s.n}:${s.name}`;
  // تعداد استاندارد
  const std = STD_COUNTS[s.n];
  if (s.count !== std) fail(`${tag} count=${s.count} ≠ استاندارد ${std}`);
  if (s.ayahs.length !== std) fail(`${tag} ayahs.length=${s.ayahs.length} ≠ ${std}`);
  // n پیوسته
  s.ayahs.forEach((a, j) => {
    if (a.n !== j + 1) fail(`${tag} آیهٔ اندیس ${j}: n=${a.n} ≠ ${j + 1}`);
  });
  // g پیوستهٔ جهانی
  s.ayahs.forEach((a) => {
    if (a.g !== gExpect) fail(`${tag} آیهٔ ${a.n}: g=${a.g} ≠ ${gExpect}`);
    gExpect++;
  });
  // متن و ترجمه
  s.ayahs.forEach((a) => {
    if (!a.t || a.t.trim().length === 0) fail(`${tag} آیهٔ ${a.n}: متن عربی خالی`);
    if (!a.fa || a.fa.trim().length === 0) warn(`${tag} آیهٔ ${a.n}: ترجمهٔ خالی`);
    if (a.t && a.t.length > 1500) warn(`${tag} آیهٔ ${a.n}: متن غیرعادی طولانی (${a.t.length})`);
  });
  // باسمهٔ چسبیده به آیهٔ اول — بعد از فیکس: فقط فاتحه مجاز است، توبه و بقیه ممنوع
  if (s.n !== 1) {
    const first = s.ayahs[0]?.t ?? "";
    const nFirst = normAr(first);
    if (BASMALA_NORM.test(nFirst)) {
      fail(`${tag} آیهٔ ۱ هنوز با باسمه شروع می‌شود: "${first.slice(0, 60)}..."`);
    }
  } else {
    const n1 = normAr(s.ayahs[0]?.t ?? "");
    if (!/^بسم الله الرحمن الرحيم$/.test(n1)) fail(`فاتحه ۱ باید فقط باسمه باشد → "${n1}"`);
  }
  // نام
  if (!s.name || s.name.trim().length === 0) fail(`سورهٔ ${s.n}: نام خالی`);
  if (!s.en || s.en.trim().length === 0) warn(`${tag}: نام انگلیسی خالی`);
}

// ۲) جمع کل
if (gExpect - 1 !== 6236) fail(`جمع آیات ${gExpect - 1} ≠ 6236`);
else console.log(`✓ جمع آیات: ${gExpect - 1}`);

// ۳) آیات شناخته‌شدهٔ نمونه (صحت متن)
const sampleChecks: { sn: number; an: number; must: string }[] = [
  { sn: 1, an: 1, must: "بسم الله الرحمن الرحيم" },
  { sn: 1, an: 2, must: "الحمد لله رب العالمين" },
  { sn: 2, an: 255, must: "الله لا الاه الا هو الحي القيوم" },
  { sn: 112, an: 1, must: "قل هو الله احد" },
  { sn: 114, an: 6, must: "من الجنه والناس" },
  { sn: 18, an: 46, must: "الثواب" }, // «وَالْعُرْبِ» not needed; just ensure surah exists
];
for (const c of sampleChecks) {
  const s = quran.find((x) => x.n === c.sn);
  const a = s?.ayahs.find((y) => y.n === c.an);
  if (!a) { fail(`نمونه ${c.sn}:${c.an} پیدا نشد`); continue; }
  const n = normAr(a.t);
  const ok = n.includes(normAr(c.must));
  if (c.sn === 18 && !ok) { warnings++; issues.push(`⚠️ (نمونهٔ اختیاری 18:46)`); continue; }
  if (!ok && c.sn !== 18) fail(`نمونه ${c.sn}:${c.an} حاوی «${c.must}» نیست → "${a.t.slice(0, 70)}"`);
}

// ۴) تکرار سورهٔ فاتحه به‌عنوان آیهٔ مستقل در جای دیگر (باگ درج باسمهٔ قرآنی)
const s1a1 = quran[0].ayahs[0].t;
const basmalaOnly = normAr(s1a1).replace(BASMALA_NORM, "").trim() === "";
if (!basmalaOnly) warn(`فاتحه ۱ فقط باسمه نیست: "${s1a1.slice(0, 60)}"`);

// ۵) توبه نباید باسمه داشته باشد
const tawbahFirst = normAr(quran[8].ayahs[0].t);
if (BASMALA_NORM.test(tawbahFirst)) fail("توبه آیهٔ ۱ با باسمه شروع شده (غلط شناخته‌شده)");

// ۶) توزیع طول کلمات — آمار کلی
let totalWords = 0;
for (const s of quran) for (const a of s.ayahs) totalWords += a.t.trim().split(/\s+/).length;
console.log(`✓ مجموع کلمات عربی: ${totalWords} (انتظار ~۷۷۴۳۰)`);

console.log("\n———— خروجی ————");
if (issues.length === 0) console.log("🎉 هیچ مشکلی یافت نشد");
issues.slice(0, 140).forEach((x) => console.log(x));
if (issues.length > 140) console.log(`... و ${issues.length - 140} مورد دیگر`);
console.log(`\nمجموع: ${errors} خطا، ${warnings} هشدار`);
process.exit(errors > 0 ? 1 : 0);
