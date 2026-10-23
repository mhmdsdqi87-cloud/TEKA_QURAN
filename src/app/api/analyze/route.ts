import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { getAuthUser } from "@/lib/auth";
import { getTeacherContext, profileBlock } from "@/lib/teacher";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AnalyzeBody {
  surahName?: string;
  expected?: string; // متن مورد انتظار (با شماره آیه)
  heard?: string; // کل متن شنیده‌شده
  mistakes?: { type: string; ayahNumber: number; expected?: string; heard?: string }[];
  accuracy?: number;
}

const SYSTEM_PROMPT = `تو «استاد تحفیظ» هستی؛ استاد چند ده‌سالهٔ قرآن کریم، متخصص حفظ و تجوید، و مربی حافظان در اپ «حافظ» (گروه TEKA). کار تو نقد تلاوت حافظان است — دقیق، منصف، و سازنده.

شیوهٔ نقد تو:
- خطاها را با ملایمت ولی شفاف بگو؛ هر خطا را ریشه‌یابی کن: جاافتادگی معمولاً نشانهٔ ضعف اتصال بین آیات است؛ کلمهٔ اشتباه معمولاً نشانهٔ عدم تثبیت یا متشابه؛ اضافه‌خوانی معمولاً نشانهٔ عجله.
- برای هر مشکل، راه‌حل تمرینی مشخص بده (مثلاً «آیهٔ ۳ را با آیهٔ ۴ ده بار پیوسته بخوان تا اتصال تثبیت شود»).
- نکته‌های تجویدی درست بده: اگر کلمه‌ای قلقله دارد، یا نون ساکنه، یا مدّ واجب، اشاره کن.
- اگر تلاوت خوب بود، تشویق صادقانه کن و سطح بعدی پیشنهاد بده (مثلاً بازهٔ بلندتر، سرعت تلاوت طبیعی‌تر، حفظ متشابهات).
- از پروفایل واقعی حافظ (در پیام سیستم) استفاده کن: اگر این خطا در جلسات قبلی هم بوده، بگو «این خطا تکرارشونده است» و تمرین هدفمند بده.

قوانین خروجی:
- همیشه فقط و فقط JSON معتبر برگردان، بدون هیچ متن اضافه یا markdown.
- همهٔ متن‌ها فارسی روان و گرم با ادبیات قرآنی.

ساختار JSON خروجی:
{
  "summary": "جمع‌بندی صمیمانه و مشخص (۱ تا ۳ جمله فارسی — به عملکرد واقعی و پروفایل حافظ ارجاع بده)",
  "scoreNote": "ارزیابی یک‌خطی کیفیت تلاوت با دلیل",
  "grade": "یکی از این چهار رشته دقیقاً: «درخشان» یا «خوب» یا «رو به پیشرفت» یا «نیاز به تمرین»",
  "tips": ["نکتهٔ تجویدی/حفظی ۱", "نکتهٔ ۲", "نکتهٔ ۳", "حداکثر ۵ نکته — هر نکته مشخص و اجراپذیر"],
  "plan": ["گام ۱ برنامهٔ تمرین امروز/این هفته", "گام ۲", "حداکثر ۳ گام — بر اساس سوره‌های ضعیف و خطاهای همین جلسه"],
  "mistakes": [
    { "ayahNumber": 3, "kind": "wrong|missed|added", "expected": "...", "heard": "...", "note": "ریشه‌یابی کوتاه + راه اصلاح فارسی" }
  ]
}`;

/** تحلیل نهایی تلاوت با LLM — نظر معلم قرآن، شخصی‌سازی‌شده بر اساس پروفایل حافظ */
export async function POST(req: Request) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });
  }

  const expected = (body.expected ?? "").slice(0, 4000);
  const heard = (body.heard ?? "").slice(0, 4000);
  const mistakes = Array.isArray(body.mistakes) ? body.mistakes.slice(0, 40) : [];
  const accuracy = typeof body.accuracy === "number" ? body.accuracy : null;

  if (!expected && !heard) {
    return NextResponse.json({ error: "داده‌ای برای تحلیل نیست" }, { status: 400 });
  }

  // پروفایل حافظ (اگر لاگین باشد) — برای شخصی‌سازی نظر معلم
  let profile = "";
  try {
    const user = await getAuthUser();
    if (user) {
      const ctx = await getTeacherContext(user.id);
      const displayName = (user.name || user.username).trim();
      profile = `\n\n${profileBlock(displayName, ctx)}`;
    }
  } catch {
    // مهمان — بدون پروفایل
  }

  try {
    const zai = await ZAI.create();
    const userMsg = `سوره: ${body.surahName ?? "-"}
دقت الگوریتمی: ${accuracy ?? "نامشخص"}%

متن قرآن (مورد انتظار):
${expected}

آنچه از تلاوت شنیده شد (خروجی تشخیص گفتار، ممکن است خودش خطا داشته باشد):
${heard || "(چیزی شنیده نشد)"}

خطاهای شناسایی‌شدهٔ الگوریتمی:
${mistakes.length ? JSON.stringify(mistakes) : "(خطای ساختاری ثبت نشده)"}

توجه: متن قرآن با رسم‌الخط عثمانی و متن شنیده‌شده خروجی ASR است؛ کلمات مشابه با اختلاف اعراب یا الف/ی را خطا حساب نکن. خطاهای واقعی (کلمهٔ متفاوت، جاافتادگی، اضافه‌گویی) را در mistakes برگردان. اگر ASR متن را خراب transfer کرده ولی الگوی کلی درست است، سخت‌گیر نباش.
فقط JSON برگردان.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT + profile },
        { role: "user", content: userMsg },
      ],
      thinking: { type: "enabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = safeParseJson(raw);
    if (!parsed) {
      return NextResponse.json({
        summary: "تحلیل هوش مصنوعی این بار در دسترس نبود؛ اما گزارش لحظه‌ای معتبر است.",
        scoreNote: "",
        grade: "",
        tips: [],
        plan: [],
        mistakes: [],
        fallback: true,
      });
    }
    return NextResponse.json({
      summary: String(parsed.summary ?? ""),
      scoreNote: String(parsed.scoreNote ?? ""),
      grade: normalizeGrade(parsed.grade),
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 6).map(String) : [],
      plan: Array.isArray(parsed.plan) ? parsed.plan.slice(0, 4).map(String) : [],
      mistakes: Array.isArray(parsed.mistakes)
        ? parsed.mistakes.slice(0, 20).map((m: Record<string, unknown>) => ({
            ayahNumber: Number(m.ayahNumber) || 0,
            kind: String(m.kind ?? "wrong"),
            expected: String(m.expected ?? ""),
            heard: String(m.heard ?? ""),
            note: String(m.note ?? ""),
          }))
        : [],
      fallback: false,
    });
  } catch (err) {
    console.error("analyze error:", err);
    return NextResponse.json(
      {
        summary: "تحلیل هوش مصنوعی در دسترس نبود؛ گزارش لحظه‌ای ذخیره شد.",
        scoreNote: "",
        grade: "",
        tips: [],
        plan: [],
        mistakes: [],
        fallback: true,
      },
      { status: 200 }
    );
  }
}

const VALID_GRADES = ["درخشان", "خوب", "رو به پیشرفت", "نیاز به تمرین"];

function normalizeGrade(g: unknown): string {
  const s = String(g ?? "").trim();
  return VALID_GRADES.find((v) => s.includes(v) || v.includes(s)) ?? "";
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let text = raw.trim();
  // حذف ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}
