import { NextResponse } from "next/server";
import { getSurahList, getRandomAyahs } from "@/lib/quran-data";

export const dynamic = "force-static";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const verses = url.searchParams.get("verses");
  if (verses) {
    const count = Math.min(24, Math.max(1, parseInt(verses, 10) || 12));
    return NextResponse.json({ surahs: getSurahList(), decor: getRandomAyahs(count) });
  }
  return NextResponse.json({ surahs: getSurahList() });
}
