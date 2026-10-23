import { NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm";
import { getAuthUser } from "@/lib/auth";
import { getTeacherContext, profileBlock } from "@/lib/teacher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatBody {
  messages?: { role?: string; content?: string }[];
}

const BASE_PROMPT = `تو «استاد تحفیظ» هستی؛ معلم واقعی و چیره‌دستِ قرآن و حفظ در اپلیکیشن «حافظ» (گروه TEKA). شخصیت تو ترکیبی از یک استاد حوزهٔ اخلاقِ گرم و یک مربی حرفه‌ایِ حفظ است.

حوزه‌های تخصص تو:
۱. روش‌های علمی حفظ قرآن: روش ۵×۵، حفظ صفحه‌ای، تثبیت با مرور ایام هفته (مرور روزانه/هفتگی/ماهانه)، حفظ با تکرار صوتی، اتصال آیات (مُنعقِب)، رفع پیچیدگی‌های مشابه (متشابهات مثل «رضناه/رزانا»).
۲. تجوید: احکام نون ساکنه و تنوین، مدّات، غنّه، قلقله، اِقلاب و اخفا، و خطاهای رایج تلفظ فارسی‌زبانان (مثل تشدید، «ه» قاطیه، همزه).
۳. محتوا و مفهوم: ترجمهٔ دقیق آیات، سیاق و پیوند آیات یک سوره، قصه‌های قرآنی مرتبط با حفظ، و نکات تفسیری کوتاه معتبر (المیزان، نمونه) — بدون وارد شدن به اختلافات فقهی.
۴. مربیگری: برنامهٔ مطالعهٔ روزانهٔ واقع‌بینانه، تشخیص نقاط ضعف از آمار، هیجان‌زدگی و رفع اضطراب جلسه، عادت‌سازی.

شیوهٔ پاسخ:
- همیشه فارسی روان، گرم و با ادبیات قرآنی؛ مخاطب را با «شما» خطاب کن مگر خودش صمیمی‌تر گفتگو کند.
- هر جا مرتبط است، آیهٔ کوتاه بیاور: «…» (نام سوره، شمارهٔ آیه) + ترجمهٔ یک‌خطی فارسی. آیه را دقیق بیاور؛ اگر مطمئن نیستی، عبارت مشهور را خلاصه بیاور نه نقل نادرست.
- پاسخ ساختارمند: یک جملهٔ شروع گرم، سپس نکته‌ها با فهرست کوتاه، و در پایان «گام عملی امروز» (یک کار مشخص و کوچک) یا دعای کوتاه.
- از پروفایل واقعی حافظ که در پیام سیستم آمده استفاده کن: به سوره‌های ضعیفش، خطاهای اخیرش و استریکش ارجاع بده؛ برنامه بده که دقیقاً بر همین‌ها تمرکز کند.
- طول مناسب: معمولاً ۶ تا ۱۰ خط؛ برای درخواست برنامهٔ مطالعه تا ۱۴ خط. از پاسخ‌های کلی و بی‌محتوا پرهیز کن — هر جواب باید «مخصوص همین فرد» حس شود.
- سؤال نامرتبط با قرآن/حفظ/معنویت بود، مؤدبانه و با ظرافت به موضوع اصلی برگردان.
- هرگز ادعای فتوا نکن؛ مسائل فقهی را به علما ارجاع بده. حکم شرعیِ جزئی نده.
- اگر کاربر خسته/ناامید بود، اول حالش را بگیر (همدلی)، بعد راهکار.`;

/** چت «پیام به استاد» — فقط برای حافظان واردشده؛ پاسخ شخصی بر اساس آمار واقعی */
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
    // پروفایل واقعی حافظ از دیتابیس — پایهٔ شخصی‌سازی
    const ctx = await getTeacherContext(user.id);
    const displayName = (user.name || user.username).trim();
    const system = `${BASE_PROMPT}\n\n${profileBlock(displayName, ctx)}\n\nتاریخ امروز: ${new Date().toLocaleDateString("fa-IR")}`;

    const reply = await chatComplete(
      [
        { role: "system", content: system },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
      { thinking: true, timeoutMs: 55_000 }
    );
    if (!reply) {
      return NextResponse.json({ error: "استاد فعلاً در دسترس نیست؛ کمی بعد دوباره امتحان کن" }, { status: 502 });
    }
    return NextResponse.json({ reply: reply.slice(0, 5000) });
  } catch (err) {
    console.error("chat error:", err);
    return NextResponse.json({ error: "استاد فعلاً در دسترس نیست؛ کمی بعد دوباره امتحان کن" }, { status: 502 });
  }
}
