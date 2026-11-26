import { NextResponse, type NextRequest } from "next/server";
import { generateRecurring, sendDailyDigest, syncHolidays } from "@/lib/scheduler";
import { db } from "@/lib/supabase/server";

export const maxDuration = 60;

// Called by Vercel Cron once a day (see vercel.json). Vercel sends the CRON_SECRET as a bearer token.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result: Record<string, unknown> = {};
  try {
    // refresh holidays weekly (Sundays) or whenever ?holidays=1
    const dhakaDay = new Date(Date.now() + 6 * 3600 * 1000).getUTCDay();
    const { count } = await db().from("holidays").select("id", { count: "exact", head: true });
    if (dhakaDay === 0 || !count || request.nextUrl.searchParams.get("holidays") === "1") result.holidays = await syncHolidays();
  } catch (e) {
    result.holidaysError = (e as Error).message;
  }
  result.posted = await generateRecurring();
  if (request.nextUrl.searchParams.get("digest") !== "0") result.digests = await sendDailyDigest();
  return NextResponse.json(result);
}
