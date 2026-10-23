import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatBody {
  messages?: { role?: string; content?: string }[];
}

const SYSTEM_PROMPT = `تو «استاد تحفیظ» هستی؛ استاد مهربان و دانای قرآن و حفظ در اپلیکیشن «حافظ» (گروه TEKA).
قوانین:
- همیشه فارسی روان، گرم و با ادبیات قرآنی جواب بده؛ از آیات و روایات کوتاه مرتبط استفاده کن (با ذکر منبع مثل «بقره ۱۵۲»).
- تخصص تو: روش‌های حفظ قرآن، مرور و تثبیت، تجوید و روخوانی، ترجمه و تفسیر کوتاه آیات، پاسخ به سؤالات قرآنی، و انگیزهٔ معنوی.
- پاسخ‌ها کوتاه و کاربردی باشند (حداکثر ۶–۸ خط)، در صورت لزوم با فهرست شماره‌دار.
- سؤال نامرتبط با قرآن و حفظ بود، مؤدبانه به موضوع اصلی برگردان.
- هرگز ادعای فتوا نکن و برای مسائل فقهی به علما ارجاع بده.`;

/** چت «پیام به استاد» — فقط برای حافظان واردشده */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: "برای گفتگو با استاد، ابتدا وارد حساب شو", needAuth: true },
      { status: 401 }
    );
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });
  }

  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content ?? "").slice(0, 2000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "پیامی برای ارسال نیست" }, { status: 400 });
  }

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
      thinking: { type: "disabled" },
    });
    const reply = (completion.choices[0]?.message?.content ?? "").trim();
    if (!reply) {
      return NextResponse.json({ error: "پاسخی دریافت نشد؛ دوباره تلاش کن" }, { status: 502 });
    }
    return NextResponse.json({ reply: reply.slice(0, 4000) });
  } catch (err) {
    console.error("chat error:", err);
    return NextResponse.json({ error: "استاد فعلاً در دسترس نیست؛ کمی بعد دوباره امتحان کن" }, { status: 502 });
  }
}
