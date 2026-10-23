/**
 * تست شبیه‌سازی منطق Task 18 روی store واقعی:
 * ۱) باسمهٔ آغازین شنیده شود → هیچ خطایی ثبت نشود + پیام «بسم‌الله شنیدم»
 * ۲) تلاوت کامل اخلاص با باسمه در ابتدا → ۱۰۰٪ درست
 * ۳) دور تکرار خودکار: پس از پایان، قطعهٔ جدید باعث شروع دور تازه می‌شود
 * ۴) بعد از اتمام دورهای تکرار → پیام «بازه تمام شد»
 * ۵) فاتحه: باسمه نباید حذف شود (خودِ آیهٔ ۱ است)
 */
import { useStudio } from "../src/lib/store";
import { useSettings } from "../src/lib/settings";
import { stripOpeningBasmala } from "../src/lib/sequencer";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name} ${extra}`); }
}

const IKHLAS = [
  { n: 1, g: 6222, t: "قُلْ هُوَ ٱللَّهُ أَحَدٌ", fa: "بگو: او الله یگانه است" },
  { n: 2, g: 6223, t: "ٱللَّهُ ٱلصَّمَدُ", fa: "الله بی‌نیاز است" },
  { n: 3, g: 6224, t: "لَمْ يَلِدْ وَلَمْ يُولَدْ", fa: "نزاده و زاده نشده" },
  { n: 4, g: 6225, t: "وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ", fa: "و هیچ‌کس همتای او نیست" },
];
const FATIHA_A1 = { n: 1, g: 1, t: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", fa: "به نام الله که رحمان و رحیم است" };

const SURAH_IKHLAS = { n: 112, name: "سُورَةُ الإِخۡلَاصِ", en: "Al-Ikhlaas", type: "Meccan", count: 4 };
const SURAH_FATIHA = { n: 1, name: "سُورَةُ الفَاتِحَةِ", en: "Al-Faatiha", type: "Meccan", count: 7 };

// ——— ۰) واحد حذف باسمه ———
const s0 = stripOpeningBasmala("بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيمِ قُلْ هُوَ اللهُ أَحَدٌ");
check("حذف باسمه از قطعهٔ ترکیبی", s0 === "قُلْ هُوَ اللهُ أَحَدٌ", JSON.stringify(s0));
const s0b = stripOpeningBasmala("بسم الله الرحمن الرحيم");
check("قطعهٔ فقط-باسمه → خالی", s0b.trim() === "", JSON.stringify(s0b));
const s0c = stripOpeningBasmala("قل هو الله احد");
check("قطعهٔ بدون باسمه دست‌نخورده", s0c === "قل هو الله احد", JSON.stringify(s0c));

// ——— ۱) باسمه در اخلاص → صفر خطا ———
useSettings.getState().update("repeatRounds", 0);
useStudio.getState().setRange(SURAH_IKHLAS, 1, 4, IKHLAS);
useStudio.getState().startListening();
useStudio.getState().applyHeard("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
const st1 = useStudio.getState();
check("باسمه → pos همان صفر", st1.pos === 0, `pos=${st1.pos}`);
check("باسمه → صفر خطا", st1.mistakes.length === 0, JSON.stringify(st1.mistakes));
check("باسمه → پیام شنیدم", st1.feedback.some((f) => f.text.includes("بسم‌الله")), "");

// ——— ۲) تلاوت کامل اخلاص (قطعه‌های ریز اندرویدی) ———
const segs = [
  "قُلْ هُوَ ٱللَّهُ أَحَدٌ",
  "ٱللَّهُ ٱلصَّمَدُ",
  "لَمْ يَلِدْ وَلَمْ يُولَدْ",
  "وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ",
];
for (const seg of segs) useStudio.getState().applyHeard(seg);
const st2 = useStudio.getState();
check("اخلاص کامل → pos=۱۵ (همهٔ کلمات)", st2.pos === 15, `pos=${st2.pos}/${st2.track.length}`);
check("اخلاص کامل → دقت ۱۰۰٪", st2.accuracy === 100, `acc=${st2.accuracy}`);
check("اخلاص کامل → صفر wrong", st2.mistakes.filter((m) => m.type === "wrong").length === 0, "");

// ——— ۳) دور تکرار خودکار ———
useStudio.getState().reset();
useSettings.getState().update("repeatRounds", 1);
useStudio.getState().setRange(SURAH_IKHLAS, 1, 4, IKHLAS);
useStudio.getState().startListening();
const st3a = useStudio.getState();
check("roundsLeft=۱ با تنظیم ۱ دور", st3a.roundsLeft === 1, `roundsLeft=${st3a.roundsLeft}`);
for (const seg of segs) useStudio.getState().applyHeard(seg);
const st3b = useStudio.getState();
check("پایان دور اول → pos=len", st3b.pos === 15, `pos=${st3b.pos}`);
// حالا دور دوم شروع می‌شود: همان قطعهٔ اول دوباره
useStudio.getState().applyHeard(segs[0]);
const st3c = useStudio.getState();
check("دور تکرار شروع شد → pos=۴ (قطعهٔ اول دور جدید)", st3c.pos === 4, `pos=${st3c.pos}`);
check("roundsLeft صفر شد", st3c.roundsLeft === 0, `roundsLeft=${st3c.roundsLeft}`);
check("پیام شروع دور تکرار", st3c.feedback.some((f) => f.text.includes("دور تکرار")), "");
// ادامهٔ دور دوم تا پایان
for (const seg of segs.slice(1)) useStudio.getState().applyHeard(seg);
const st3d = useStudio.getState();
check("پایان دور دوم → pos=len", st3d.pos === 15, `pos=${st3d.pos}`);
// ——— ۴) دیگر دور تکرار نیست → پیام «تمام شده» ———
useStudio.getState().applyHeard(segs[0]);
const st4 = useStudio.getState();
check("پس از اتمام دورها → pos ثابت", st4.pos === 15, `pos=${st4.pos}`);
check("پیام «بازهٔ انتخابی تمام شده»", st4.feedback.some((f) => f.text.includes("تمام شده")), "");

// ——— ۵) فاتحه: باسمه حذف نمی‌شود (آیهٔ ۱ است) ———
useStudio.getState().reset();
useSettings.getState().update("repeatRounds", 0);
useStudio.getState().setRange(SURAH_FATIHA, 1, 1, [FATIHA_A1]);
useStudio.getState().startListening();
useStudio.getState().applyHeard("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
const st5 = useStudio.getState();
check("فاتحه: باسمه = آیهٔ ۱ → pos=۴", st5.pos === 4, `pos=${st5.pos}`);
check("فاتحه: صفر خطا", st5.mistakes.length === 0, JSON.stringify(st5.mistakes));

// ——— ۶) بازهٔ از آیهٔ ۳: باسمهٔ گفتاری هم حذف می‌شود ———
useStudio.getState().reset();
useStudio.getState().setRange(SURAH_IKHLAS, 3, 4, IKHLAS.slice(2));
useStudio.getState().startListening();
useStudio.getState().applyHeard("بسم الله الرحمن الرحيم لَمْ يَلِدْ وَلَمْ يُولَدْ");
const st6 = useStudio.getState();
check("باسمهٔ وسط بازهٔ داخلی → از آیهٔ ۳ شروع درست", st6.pos === 4, `pos=${st6.pos}`);
check("باسمهٔ وسط بازهٔ داخلی → صفر خطا", st6.mistakes.length === 0, JSON.stringify(st6.mistakes));

console.log(`\n———— ${pass} موفق، ${fail} ناموفق ————`);
process.exit(fail > 0 ? 1 : 0);
