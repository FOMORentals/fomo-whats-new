import { test } from "node:test";
import assert from "node:assert/strict";
import { draftBlocks, noteBlocks, proposalBlocks, tallyText, weeklyBlocks, type Proposal } from "./blocks";
import type { Note } from "./note";
import { castVote, draftMeta, proposalMeta, readDraft, readProposal } from "./records";
import { isWeeklySlot, proposalClosed } from "./time";

const note: Note = {
  app: "overtime",
  headline: "New: Give away button",
  changed: "Hand a slot to a colleague",
  todo: "Nothing",
  tryIt: "/overtime",
  pr: "fomo-overtime#12",
  prUrl: "https://github.com/FOMORentals/fomo-overtime/pull/12",
  mergedAt: "2026-11-06T10:00:00Z",
};
const links = { history: (k?: string) => `https://x/?app=${k ?? ""}`, image: "https://x/img.png" };

test("note post: app, headline, picture, try-it and history link", () => {
  const b = noteBlocks(note, links);
  const json = JSON.stringify(b);
  assert.match(json, /🕐 \*Overtime\*/);
  assert.match(json, /New: Give away button/);
  assert.equal(b.find((x) => x.type === "image")?.image_url, "https://x/img.png");
  assert.match(json, /Try it: `\/overtime`/);
  assert.match(json, /All Overtime updates/);
});

test("note post escapes Slack control characters", () => {
  const json = JSON.stringify(noteBlocks({ ...note, headline: "<!channel> & co" }, links));
  assert.match(json, /&lt;!channel&gt; &amp; co/);
});

test("draft DM buttons follow its state", () => {
  const ids = (s: "waiting" | "posted" | "skipped") =>
    draftBlocks(note, s, Date.parse("2026-11-09T14:05:00Z"), links).at(-1)!.elements.map((e: { action_id: string }) => e.action_id);
  assert.deepEqual(ids("waiting"), ["draft_post", "draft_edit", "draft_skip"]);
  assert.deepEqual(ids("posted"), ["draft_edit"]);
  assert.deepEqual(ids("skipped"), ["draft_post"]);
  assert.match(JSON.stringify(draftBlocks(note, "waiting", Date.parse("2026-11-09T14:05:00Z"), links)), /\*14:05\*/);
});

test("weekly round-up groups by app and is empty when nothing shipped", () => {
  assert.equal(weeklyBlocks([], links, 0), null);
  const b = weeklyBlocks([note, { ...note, app: "website", headline: "New homepage" }, { ...note, headline: "Second" }], links, Date.parse("2026-11-06T16:00:00Z"))!;
  const text = JSON.stringify(b);
  assert.match(text, /Overtime\*\\n• New: Give away button\\n• Second/);
  assert.ok(text.indexOf("Website") > 0);
});

test("draft metadata round-trips", () => {
  const d = { key: "fomo-overtime#12", status: "waiting" as const, due: 123, sha: "abc", note };
  assert.deepEqual(readDraft(draftMeta(d)), { ...d, postedTs: undefined });
  assert.equal(readDraft({ event_type: "other", event_payload: {} }), null);
});

const proposal: Proposal = { title: "Tablet check-in", problem: "Paper", idea: "Tablet", who: "", due: "2026-11-13", by: "U1", votes: {}, closed: false };

test("proposal votes: toggle, switch, tally", () => {
  let v = castVote({}, "U1", "yes");
  v = castVote(v, "U2", "no");
  v = castVote(v, "U2", "maybe");
  assert.deepEqual(v, { U1: "yes", U2: "maybe" });
  assert.deepEqual(castVote(v, "U1", "yes"), { U2: "maybe" });
  assert.match(tallyText(v), /👍 Yes 1 \(<@U1>\)   🤔 Not sure 1 \(<@U2>\)   👎 No 0/);
});

test("proposal metadata round-trips; closed ones have no buttons", () => {
  const p = { ...proposal, votes: { U1: "yes" as const } };
  assert.deepEqual(readProposal(proposalMeta(p)), { ...p, link: undefined });
  assert.ok(proposalBlocks(p).some((b) => b.type === "actions"));
  assert.ok(!proposalBlocks({ ...p, closed: true }).some((b) => b.type === "actions"));
});

test("London times: weekly slot and proposal closing", () => {
  assert.equal(isWeeklySlot(Date.parse("2026-11-06T16:05:00Z")), true); // Fri, GMT
  assert.equal(isWeeklySlot(Date.parse("2026-11-06T16:20:00Z")), false);
  assert.equal(isWeeklySlot(Date.parse("2026-07-03T15:00:00Z")), true); // Fri 16:00 BST
  assert.equal(proposalClosed("2026-11-13", Date.parse("2026-11-13T16:59:00Z")), false);
  assert.equal(proposalClosed("2026-11-13", Date.parse("2026-11-13T17:00:00Z")), true);
  assert.equal(proposalClosed("2026-11-13", Date.parse("2026-11-14T08:00:00Z")), true);
});
