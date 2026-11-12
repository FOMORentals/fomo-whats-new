import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { appByKey } from "@/lib/apps";
import { verify } from "@/lib/sign";

// A picture drawn from the note itself, for a change that arrived with no screenshot, mock-up or diagram,
// so no note goes out without one (Jamie, 12 Nov 2026). Only links the app signed are drawn.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const app = q.get("app") ?? "";
  const h = q.get("h") ?? "";
  const c = q.get("c") ?? "";
  const t = q.get("t") ?? "";
  const a = appByKey(app);
  if (!a || !h || !verify(`card:${app}:${h}:${c}:${t}`, q.get("sig"))) return new NextResponse("not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f4f2ee", padding: "48px 60px", fontFamily: "sans-serif", color: "#1d1d1f" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 24, fontWeight: 600, color: "#55524c" }}>
          <div style={{ display: "flex" }}>{a.name}</div>
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 16, letterSpacing: 2, color: "#8a857c", border: "2px solid #c9c4ba", borderRadius: 999, padding: "6px 14px" }}>{"WHAT’S NEW"}</div>
        </div>
        <div style={{ display: "flex", fontSize: 50, fontWeight: 800, lineHeight: 1.1, marginTop: 30, letterSpacing: -1 }}>{h}</div>
        {c ? (
          <div style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 18, padding: "26px 30px", marginTop: 32, boxShadow: "0 12px 32px rgba(0,0,0,.08)" }}>
            <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: "#8a857c", letterSpacing: 1.5 }}>WHAT CHANGED</div>
            <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, marginTop: 10 }}>{c}</div>
          </div>
        ) : null}
        {t ? (
          <div style={{ display: "flex", flexDirection: "column", background: "#1d1d1f", color: "#fff", borderRadius: 18, padding: "22px 30px", marginTop: 18 }}>
            <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: "#ff8a5c", letterSpacing: 1.5 }}>WHAT YOU DO</div>
            <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, marginTop: 8 }}>{t}</div>
          </div>
        ) : null}
      </div>
    ),
    { width: 1200, height: 675, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
