import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";


export const maxDuration = 120;

interface AnalyzeBody {
  surahName?: string;
  expected?: string; // متن مورد انتظار (با شماره آیه)
  heard?: string; // کل متن شنیده‌شده
  mistakes?: { type: string; ayahNumber: number; expected?: string; heard?: string }[];
  accuracy?: number;
}

const SYSTEM_PROMPT = `تو «استاد تحفیظ» هستی؛ یک مربی قرآنی مهربان، دقیق و مشوق. کار تو بررسی تلاوت حافظان قرآن است.
قوانین:
- همیشه فقط و فقط JSON معتبر برگردان، بدون هیچ متن اضافه یا markdown.
- همهٔ متن‌های فارسی باید روان، گرم و با ادبیات قرآنی باشد.
- خطاها را با ملایمت ولی شفاف بگو و راه اصلاح بده.
- اگر تلاوت خوب بود، تشویق کن و نکتهٔ تجویدی کوتاه بده.

ساختار JSON خروجی:
{
  "summary": "جمله‌ای جمع‌بندی (۱ تا ۲ جمله فارسی)",
  "scoreNote": "ارزیابی کوتاه کیفیت (۱ جمله)",
  "tips": ["نکته ۱", "نکته ۲", "نکته ۳"],
  "mistakes": [
    { "ayahNumber": 3, "kind": "wrong|missed|added", "expected": "...", "heard": "...", "note": "توضیح کوتاه فارسی" }
  ]
}`;

/** تحلیل نهایی تلاوت با LLM — بازخورد معلم قرآن */
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
        { role: "assistant", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = safeParseJson(raw);
    if (!parsed) {
      return NextResponse.json({
        summary: "تحلیل هوش مصنوعی این بار در دسترس نبود؛ اما گزارش لحظه‌ای معتبر است.",
        scoreNote: "",
        tips: [],
        mistakes: [],
        fallback: true,
      });
    }
    return NextResponse.json({
      summary: String(parsed.summary ?? ""),
      scoreNote: String(parsed.scoreNote ?? ""),
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 6).map(String) : [],
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
        tips: [],
        mistakes: [],
        fallback: true,
      },
      { status: 200 }
    );
  }
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
