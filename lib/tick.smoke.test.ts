// End-to-end run of the cron against fake Slack and GitHub.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SLACK_BOT_TOKEN = "x"; process.env.WHATS_NEW_CHANNEL_ID = "CWN"; process.env.GITHUB_TOKEN = "g";
process.env.LINK_SECRET = "s"; process.env.WHATS_NEW_START = "2026-11-01T00:00:00Z";

type Msg = { ts: string; metadata?: { event_type: string; event_payload: Record<string, string> }; channel: string; blocks?: unknown };
const msgs: Msg[] = [];
let n = 1000;
const NOW = Date.parse("2026-11-09T10:00:00Z");

globalThis.fetch = (async (url: string, init?: { body?: URLSearchParams }) => {
  const u = String(url);
  const ok = (o: unknown) => new Response(JSON.stringify({ ok: true, ...(o as object) }), { status: 200 });
  if (u.startsWith("https://api.github.com")) {
    if (u.endsWith("/repos/FOMORentals/fomo-overtime")) return new Response(JSON.stringify({ default_branch: "main" }));
    if (u.includes("/pulls/12/files")) return new Response(JSON.stringify([{ filename: "src/x.ts", status: "modified" }, { filename: "whats-new/give-away.png", status: "added" }]));
    if (u.includes("/files")) return new Response("[]");
    if (u.includes("/repos/FOMORentals/fomo-overtime/pulls"))
      return new Response(JSON.stringify([
        { number: 12, title: "x", body: "## Team note\nHeadline: Give away button\nWhat changed: hand a slot over", html_url: "h", merged_at: "2026-11-09T09:00:00Z", merge_commit_sha: "abc1234" },
        { number: 13, title: "y", body: "## Team note\nNone", html_url: "h", merged_at: "2026-11-09T09:10:00Z", merge_commit_sha: "abc1235" },
      ]));
    if (u.match(/\/repos\/FOMORentals\/[^/]+$/)) return new Response(JSON.stringify({ default_branch: "main" }));
    return new Response("[]");
  }
  const method = u.split("/").pop()!;
  const b = Object.fromEntries(init!.body!.entries());
  const meta = b.metadata ? JSON.parse(b.metadata) : undefined;
  switch (method) {
    case "users.lookupByEmail": return ok({ user: { id: "UJ" } });
    case "conversations.open": return ok({ channel: { id: "DJ" } });
    case "auth.test": return ok({ url: "https://fomo.slack.com/" });
    case "conversations.history": {
      let list = msgs.filter((m) => m.channel === b.channel);
      if (b.latest) list = list.filter((m) => m.ts === b.latest);
      return ok({ messages: [...list].reverse() });
    }
    case "chat.postMessage": { const m = { ts: `${NOW / 1000 + n++}.000100`, channel: b.channel, metadata: meta, blocks: b.blocks }; msgs.push(m); return ok({ ts: m.ts }); }
    case "chat.update": { const m = msgs.find((x) => x.ts === b.ts && x.channel === b.channel)!; m.metadata = meta; m.blocks = b.blocks; return ok({}); }
  }
  throw new Error("unexpected " + method);
}) as typeof fetch;

test("merged PR → draft to Jamie → posts after the hour, once", async () => {
  const { runTick } = await import("./tick");
  let r = await runTick(NOW, []);
  assert.equal(r.drafted, 1); assert.equal(r.failures, 0);
  assert.equal(msgs.filter((m) => m.channel === "DJ").length, 1);
  r = await runTick(NOW + 30 * 60_000, []);
  assert.equal(r.drafted, 0); assert.equal(r.posted, 0);
  r = await runTick(NOW + 61 * 60_000, []);
  assert.equal(r.posted, 1);
  const posted = msgs.filter((m) => m.channel === "CWN");
  assert.equal(posted.length, 1);
  assert.equal(posted[0].metadata?.event_type, "wn_note");
  assert.equal(msgs.find((m) => m.channel === "DJ")!.metadata!.event_payload.status, "posted");
  assert.match(posted[0].metadata!.event_payload.note, /whats-new\/give-away\.png/); // picture found from the files, not the note
  r = await runTick(NOW + 80 * 60_000, []);
  assert.equal(r.posted + r.drafted, 0);
});

test("catch-up notes are drafted once, and not after the cut-off", async () => {
  const { runTick } = await import("./tick");
  const { BACKFILL, BACKFILL_UNTIL } = await import("./backfill");
  const two = BACKFILL.slice(0, 2);
  const T = NOW + 2 * 60 * 60_000;
  assert.equal((await runTick(T, two)).drafted, 2);
  assert.equal((await runTick(T + 15 * 60_000, two)).drafted, 0);
  assert.equal((await runTick(BACKFILL_UNTIL, [{ ...two[0], pr: "backfill#99" }])).drafted, 0);
  assert.equal(new Set(BACKFILL.map((b) => b.pr)).size, BACKFILL.length);
});

test("a catch-up note already posted gets its picture in #whats-new", async () => {
  const { runTick } = await import("./tick");
  const { BACKFILL } = await import("./backfill");
  const one = [{ ...BACKFILL[2], image: "/whats-new/backfill/old.png" }];
  const T = NOW + 5 * 60 * 60_000;
  await runTick(T, one, false);
  assert.equal((await runTick(T + 61 * 60_000, one, false)).posted, 1);
  const r = await runTick(T + 75 * 60_000, [{ ...one[0], image: "/whats-new/backfill/03.png" }], false);
  assert.equal(r.failures, 0);
  const post = msgs.filter((m) => m.channel === "CWN").at(-1)!;
  assert.match(String(post.blocks), /whats-new\/backfill\/03\.png/);
  assert.match(post.metadata!.event_payload.note, /03\.png/);
});

test("a draft with no picture gets a summary card and posts on its own", async () => {
  const { runTick } = await import("./tick");
  const { BACKFILL } = await import("./backfill");
  const bare = [{ ...BACKFILL[4], pr: "backfill#98", image: undefined }];
  const T = NOW + 9 * 60 * 60_000;
  assert.equal((await runTick(T, bare, false)).drafted, 1);
  assert.equal((await runTick(T + 3 * 60 * 60_000, bare, false)).posted, 1);
  assert.match(String(msgs.filter((m) => m.channel === "CWN").at(-1)!.blocks), /\/api\/card\?app=/);
});

test("a picture made later (lib/pictures.ts) is attached before the draft posts", async () => {
  const { runTick } = await import("./tick");
  const { BACKFILL } = await import("./backfill");
  const bare = [{ ...BACKFILL[5], pr: "backfill#97", image: undefined }];
  const T = NOW + 11 * 60 * 60_000; // before the catch-up cut-off
  assert.equal((await runTick(T, bare, false, {})).drafted, 1);
  const r = await runTick(T + 61 * 60_000, bare, false, { "backfill#97": { image: "/whats-new/notes/x.png", changed: "New words" } });
  assert.equal(r.failures, 0);
  assert.equal(r.posted, 1);
  assert.match(msgs.filter((m) => m.channel === "CWN").at(-1)!.metadata!.event_payload.note, /notes\/x\.png/);
  assert.match(msgs.filter((m) => m.channel === "CWN").at(-1)!.metadata!.event_payload.note, /New words/);
});
