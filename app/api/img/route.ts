import { NextResponse } from "next/server";
import { appByRepo } from "@/lib/apps";
import { fileAt } from "@/lib/github";
import { cleanScreenshotPath } from "@/lib/note";
import { report } from "@/lib/report";
import { verify } from "@/lib/sign";

// Serves a screenshot from a FOMO repo so Slack and the history page can show it.
// Only files under whats-new/, only in listed repos, only with a signature the app made.
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const repo = q.get("repo") ?? "";
  const ref = q.get("ref") ?? "";
  const path = cleanScreenshotPath(q.get("path") ?? "");
  if (!appByRepo(repo) || !/^[0-9a-f]{7,40}$/.test(ref) || !path || !verify(`${repo}:${ref}:${path}`, q.get("sig")))
    return new NextResponse("not found", { status: 404 });
  try {
    const file = await fileAt(repo, ref, path);
    const ext = path.split(".").pop()!.toLowerCase();
    return new NextResponse(file.body, {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch (err) {
    report(err, "img", { repo, path });
    return new NextResponse("not found", { status: 404 });
  }
}
