import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const maxDuration = 60;

interface AsrBody {
  audio?: string;
}

/** تبدیل گفتار به متن (ASR) — قطعات WAV 16kHz از کلاینت */
export async function POST(req: Request) {
  let body: AsrBody;
  try {
    body = (await req.json()) as AsrBody;
  } catch {
    return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });
  }
  const audio = body.audio;
  if (!audio || typeof audio !== "string" || audio.length < 100) {
    return NextResponse.json({ error: "صدایی ارسال نشده است" }, { status: 400 });
  }
  if (audio.length > 16_000_000) {
    return NextResponse.json({ error: "حجم صدا بیش از حد مجاز است" }, { status: 413 });
  }

  try {
    const zai = await ZAI.create();
    const response = await zai.audio.asr.create({ file_base64: audio });
    const text = (response?.text ?? "").trim();
    return NextResponse.json({ text });
  } catch (err) {
    console.error("ASR error:", err);
    return NextResponse.json(
      { error: "تبدیل گفتار به متن ناموفق بود" },
      { status: 502 }
    );
  }
}
