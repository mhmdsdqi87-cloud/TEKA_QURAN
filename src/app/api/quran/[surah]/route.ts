import { NextResponse } from "next/server";
import { getSurah } from "@/lib/quran-data";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ surah: string }> }
) {
  const { surah } = await params;
  const num = parseInt(surah, 10);
  if (!Number.isFinite(num) || num < 1 || num > 114) {
    return NextResponse.json({ error: "شماره سوره نامعتبر است" }, { status: 400 });
  }
  const url = new URL(req.url);
  const from = parseInt(url.searchParams.get("from") ?? "1", 10) || 1;
  const toRaw = parseInt(url.searchParams.get("to") ?? "0", 10);
  const data = getSurah(num, from, toRaw > 0 ? toRaw : undefined);
  if (!data) {
    return NextResponse.json({ error: "بازهٔ آیات نامعتبر است" }, { status: 400 });
  }
  return NextResponse.json({ surah: data });
}
