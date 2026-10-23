import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** کاربر جاری — null یعنی مهمان */
export async function GET() {
  const user = await getAuthUser();
  return NextResponse.json({ user });
}
