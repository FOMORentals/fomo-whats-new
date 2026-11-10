import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTeamNote } from "./note";

const template = `## Summary
Adds a give-away button.

## Team note
<!-- For #whats-new. Write "None" if the team won't notice. -->
**Headline:** New: Give away button
**What changed:** You can hand a claimed slot to a colleague, and they accept it.
**What you do:** Nothing, unless you want to use it.
**Screenshot:** whats-new/give-away.png
**Try it:** /overtime

## Test plan
- npm test`;

test("reads a filled-in team note", () => {
  assert.deepEqual(parseTeamNote(template), {
    headline: "New: Give away button",
    changed: "You can hand a claimed slot to a colleague, and they accept it.",
    todo: "Nothing, unless you want to use it.",
    screenshot: "whats-new/give-away.png",
    tryIt: "/overtime",
  });
});

test("no section, None, or no headline means nothing to announce", () => {
  assert.equal(parseTeamNote("## Summary\nfix"), null);
  assert.equal(parseTeamNote(null), null);
  assert.equal(parseTeamNote("## Team note\nNone\n\n## Test plan\nx"), null);
  assert.equal(parseTeamNote("## Team note\n**Headline:** None\n**What changed:**"), null);
  assert.equal(parseTeamNote("## Team note\n**Headline:**\n**What changed:** stuff"), null);
});

test("ignores template placeholders and plain 'Key: value' lines work", () => {
  const n = parseTeamNote("### Team note\n- Headline: Faster search\n- What changed: Results show as you type\n- Screenshot: (optional)\n");
  assert.equal(n?.headline, "Faster search");
  assert.equal(n?.changed, "Results show as you type");
  assert.equal(n?.screenshot, undefined);
});

test("screenshots outside whats-new/ are dropped", () => {
  const n = parseTeamNote("## Team note\nHeadline: X\nScreenshot: ../secrets.png");
  assert.equal(n?.screenshot, undefined);
  assert.equal(parseTeamNote("## Team note\nHeadline: X\nScreenshot: `./whats-new/a.png`")?.screenshot, "whats-new/a.png");
  assert.equal(parseTeamNote("## Team note\nHeadline: X\n**Screenshot:** ![Assign to a freelancer](whats-new/freelancer-invites.png)")?.screenshot, "whats-new/freelancer-invites.png");
  assert.equal(parseTeamNote("## Team note\nHeadline: X\nScreenshot: [pic](./whats-new/b.png)")?.screenshot, "whats-new/b.png");
  assert.equal(parseTeamNote("## Team note\nHeadline: X\nScreenshot: ![x](https://evil.example/a.png)")?.screenshot, undefined);
});

test("note at the very end of the description", () => {
  assert.equal(parseTeamNote("## Team note\nHeadline: Last one")?.headline, "Last one");
});

test("picture path with words after it, and None in optional fields (bookings #80, 10 Nov)", () => {
  const n = parseTeamNote(
    "## Team note\n**Headline:** Verified freelancers\n**What changed:** x\n**What you do:** Nothing.\n**Screenshot:** whats-new/2026-11-10-verified-freelancer-account-pill.png (mock-up)\n**Try it:** None\n",
  )!;
  assert.equal(n.screenshot, "whats-new/2026-11-10-verified-freelancer-account-pill.png");
  assert.equal(n.tryIt, undefined);
});
