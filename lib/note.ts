/**
 * Team notes: the short, plain-English line about a change that the team sees in #whats-new.
 * They are written in the pull request description under a "## Team note" heading
 * (see .github/pull_request_template.md, copied into every FOMO repo).
 */

export type Note = {
  app: string; // App key, see lib/apps.ts
  headline: string;
  changed: string;
  todo: string; // "What you do"
  screenshot?: string; // path in the repo, under whats-new/
  tryIt?: string; // link
  image?: string; // picture served by this app, e.g. "/whats-new/backfill/01.png" (catch-up notes only)
  pr: string; // "repo#123"
  prUrl: string;
  mergedAt: string; // ISO
};

export type NoteText = Pick<Note, "headline" | "changed" | "todo" | "screenshot" | "tryIt">;

const FIELDS: Record<string, keyof NoteText> = {
  headline: "headline",
  "what changed": "changed",
  "what you do": "todo",
  screenshot: "screenshot",
  "try it": "tryIt",
};

/** Words that mean "the team won't notice this, don't announce it". */
const NONE = /^(none|n\/a|no|-|nothing|behind the scenes)\.?$/i;

/**
 * Pull the team note out of a PR description. Returns null when there is no note,
 * when it says "None", or when it has no headline (nothing to announce).
 */
export function parseTeamNote(body: string | null | undefined): NoteText | null {
  if (!body) return null;
  const text = body.replace(/<!--[\s\S]*?-->/g, "").replace(/\r/g, "");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^#{2,3}\s*team note\s*$/i.test(l.trim()));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^#{1,3}\s/.test(l.trim()));
  if (end < 0) end = lines.length;
  const section = lines.slice(start + 1, end).join("\n").trim();
  if (!section || NONE.test(section)) return null;
  const out: Partial<NoteText> = {};
  for (const raw of section.split("\n")) {
    const line = raw.replace(/^\s*[-*]\s+/, "").trim();
    const f = line.replace(/\*\*/g, "").match(/^([a-z ]+?)\s*:\s*(.*)$/i);
    if (!f) continue;
    const key = FIELDS[f[1].toLowerCase()];
    if (!key) continue;
    const value = f[2].replace(/^\*+|\*+$/g, "").trim();
    if (value && !/^\(.*\)$/.test(value)) out[key] = value;
  }
  if (!out.headline || NONE.test(out.headline)) return null;
  if (out.screenshot) out.screenshot = cleanScreenshotPath(out.screenshot);
  return { headline: out.headline, changed: out.changed ?? "", todo: out.todo ?? "", screenshot: out.screenshot, tryIt: out.tryIt };
}

/** Screenshots must live under whats-new/ in the repo (that is all the image route will serve). */
export function cleanScreenshotPath(p: string): string | undefined {
  // Accept a bare path, `path`, <path>, or a Markdown image/link: ![alt](path) / [text](path).
  const md = p.trim().match(/^!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/);
  const s = (md ? md[1] : p).trim().replace(/^[`<]|[`>]$/g, "").replace(/^\.?\//, "").trim();
  if (!/^whats-new\/[\w./-]+\.(png|jpe?g|gif|webp)$/i.test(s) || s.includes("..")) return undefined;
  return s;
}
