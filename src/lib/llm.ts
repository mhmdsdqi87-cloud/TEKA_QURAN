/**
 * لایهٔ یکپارچهٔ LLM — زنجیرهٔ تأمین مدل
 *
 * ۱) هر سرویس OpenAI-compatible با متغیرهای محیطی (LLM_BASE_URL + LLM_API_KEY + LLM_MODEL)
 * ۲) Pollinations (OpenAI-compatible، بدون کلید، از هر سروری — مثل Vercel — در دسترس است)
 *
 * اگر سرویس اول پیکربندی نشده باشد یا خطا داد، خودکار به بعدی سوییچ می‌کنیم؛
 * در نتیجه «استاد تحفیظ» همیشه وصل است.
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOptions {
  /** خروجی JSON سخت‌گیرانه بخواه */
  json?: boolean;
  /** حالت استدلال عمیق (سرویس‌های سازگار) */
  thinking?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

interface OpenAiChoice {
  message?: { content?: string };
}

/** هر سرویس سازگار با OpenAI که با متغیرهای محیطی پیکربندی شده باشد */
async function viaConfiguredProvider(
  messages: LlmMessage[],
  opts: LlmOptions
): Promise<string | null> {
  const baseUrl = process.env.LLM_BASE_URL;
  if (!baseUrl) return null; // پیکربندی نشده → سوییچ به سرویس بعدی
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 55_000);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LLM_API_KEY
          ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        messages,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
        ...(typeof opts.maxTokens === "number" ? { max_tokens: opts.maxTokens } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: OpenAiChoice[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    return content.trim() ? content.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
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
      choices?: OpenAiChoice[];
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
  const primary = await viaConfiguredProvider(messages, opts);
  if (primary) return primary;
  const fallback = await viaPollinations(messages, opts);
  return fallback;
}
