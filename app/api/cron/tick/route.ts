import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { report } from "@/lib/report";
import { runTick } from "@/lib/tick";

// Vercel cron, every 15 min (vercel.json).
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not set");
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorised(req)) return new NextResponse("unauthorised", { status: 401 });
  const started = Date.now();
  try {
    const result = await runTick(started);
    console.log("TICK", JSON.stringify({ ...result, ms: Date.now() - started }));
    return NextResponse.json(result, { status: result.failures > 0 ? 502 : 200 });
  } catch (err) {
    report(err, "tick");
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
