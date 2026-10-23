/**
 * لایهٔ یکپارچهٔ LLM — زنجیرهٔ تأمین مدل
 *
 * ۱) z-ai-web-dev-sdk (موجود در محیط توسعه/سندباکس؛ کیفیت بالا با thinking)
 * ۲) Pollinations (OpenAI-compatible، بدون کلید، از هر سروری — مثل Vercel — در دسترس است)
 *
 * اگر سرویس اول در دسترس نبود (مثلاً روی Vercel که فایل پیکربندی سندباکس وجود ندارد)،
 * خودکار به بعدی سوییچ می‌کنیم؛ در نتیجه «استاد تحفیظ» همیشه وصل است.
 */

import ZAI from "z-ai-web-dev-sdk";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOptions {
  /** خروجی JSON سخت‌گیرانه بخواه */
  json?: boolean;
  /** thinking برای z-ai (کیفیت بالاتر، سرعت کمتر) */
  thinking?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

async function viaZai(messages: LlmMessage[], opts: LlmOptions): Promise<string | null> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: opts.thinking === false ? "disabled" : "enabled" },
    });
    const content = completion.choices[0]?.message?.content ?? "";
    return content.trim() ? content.trim() : null;
  } catch {
    // پیکربندی وجود ندارد یا سرویس خطا داد → سوییچ به فالبک
    return null;
  }
}

async function viaPollinations(messages: LlmMessage[], opts: LlmOptions): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 55_000);
  try {
    const res = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
        ...(typeof opts.maxTokens === "number" ? { max_tokens: opts.maxTokens } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return content.trim() ? content.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * پاسخ چت از اولین سرویس در دسترس. اگر هیچ‌کدام پاسخ نداد null برمی‌گردد.
 */
export async function chatComplete(
  messages: LlmMessage[],
  opts: LlmOptions = {}
): Promise<string | null> {
  const primary = await viaZai(messages, opts);
  if (primary) return primary;
  const fallback = await viaPollinations(messages, opts);
  return fallback;
}
