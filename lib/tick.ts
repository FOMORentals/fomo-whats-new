/**
 * The 15-minute cron:
 * 1. Merged pull requests with a team note → draft DM to Jamie (once per PR).
 * 2. Drafts whose hour is up → posted to #whats-new.
 * 3. Proposals past their reply-by date → closed, summary to the proposer and Jamie.
 * 4. Friday 16:00 London → "this week" round-up.
 * One failure doesn't stop the rest; failures are counted and reported (rule 1).
 */
import { APPS } from "./apps";
import { BACKFILL, BACKFILL_HOLD, BACKFILL_UNTIL } from "./backfill";
import { dm, editDraft, historyUrl, publishDraft, sendDraft, updateDraft, updateProposal } from "./actions";
import { proposalSummary, weeklyBlocks } from "./blocks";
import { mergedPrs } from "./github";
import { parseTeamNote } from "./note";
import { readDraft, readNote, readProposal, WEEKLY } from "./records";
import { report } from "./report";
import { approver, channel, history, messageLink, slack } from "./slack";
import { isWeeklySlot, proposalClosed } from "./time";

const DAY = 24 * 60 * 60_000;
const LOOKBACK = 3 * DAY; // PRs merged in the last 3 days are checked; drafts are kept for 7 days.

/** Only changes merged after the launch are announced, so switching it on doesn't flood the channel. */
function startMs(): number {
  const s = process.env.WHATS_NEW_START?.trim();
  if (!s) throw new Error("WHATS_NEW_START is not set (ISO date-time of launch)");
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) throw new Error(`WHATS_NEW_START is not a date: ${s}`);
  return ms;
}

export type TickResult = { drafted: number; posted: number; closed: number; weekly: boolean; failures: number };

export async function runTick(now = Date.now(), backfill = BACKFILL, hold = BACKFILL_HOLD): Promise<TickResult> {
  const r: TickResult = { drafted: 0, posted: 0, closed: 0, weekly: false, failures: 0 };
  const fail = (err: unknown, ctx: string, extra: Record<string, unknown> = {}) => {
    r.failures++;
    report(err, ctx, extra);
  };

  const { dm: dmId } = await approver();
  const dms = await history(dmId, now - 7 * DAY);
  const drafts = dms.flatMap((m) => {
    const d = readDraft(m.metadata);
    return d ? [{ ts: m.ts, d }] : [];
  });
  const seen = new Set(drafts.map((x) => x.d.key));

  // 1. New merged changes
  const since = Math.max(startMs(), now - LOOKBACK);
  for (const app of APPS) {
    try {
      for (const pr of await mergedPrs(app.repo, since)) {
        const key = `${app.repo}#${pr.number}`;
        if (seen.has(key)) continue;
        const text = parseTeamNote(pr.body);
        if (!text) continue; // behind-the-scenes change; nothing to tell the team
        await sendDraft({ ...text, app: app.key, pr: key, prUrl: pr.html_url, mergedAt: pr.merged_at }, pr.merge_commit_sha, now);
        seen.add(key);
        r.drafted++;
      }
    } catch (err) {
      fail(err, "tick.github", { repo: app.repo });
    }
  }

  // 1b. One-off catch-up notes (lib/backfill.ts)
  if (now < BACKFILL_UNTIL) {
    for (const note of backfill) {
      if (seen.has(note.pr)) continue;
      try {
        await sendDraft(note, "", now);
        seen.add(note.pr);
        r.drafted++;
      } catch (err) {
        fail(err, "tick.backfill", { key: note.pr });
        break;
      }
    }
  }

  // 1c. Catch-up notes pick up their picture: in the DM, and in #whats-new if already posted
  for (const x of drafts) {
    const want = backfill.find((b) => b.pr === x.d.key)?.image;
    if (!want || x.d.note.image === want || x.d.status === "skipped") continue;
    try {
      if (x.d.status === "posted") {
        await editDraft(dmId, x.ts, { image: want }); // also updates the channel post
      } else {
        x.d = { ...x.d, note: { ...x.d.note, image: want } };
        await updateDraft(dmId, x.ts, x.d);
      }
    } catch (err) {
      fail(err, "tick.backfill_image", { key: x.d.key });
    }
  }

  // 2. Drafts whose hold is over
  for (const { ts, d } of drafts) {
    if (d.status !== "waiting" || d.due > now) continue;
    if (hold && d.key.startsWith("backfill#")) continue;
    try {
      if ((await publishDraft(dmId, ts)) === "posted") r.posted++;
    } catch (err) {
      fail(err, "tick.publish", { key: d.key });
    }
  }

  // 3 + 4 read the channel
  let posts: Awaited<ReturnType<typeof history>> = [];
  try {
    posts = await history(channel(), now - 60 * DAY);
  } catch (err) {
    fail(err, "tick.channel_history");
  }

  for (const m of posts) {
    const p = readProposal(m.metadata);
    if (!p || p.closed || !proposalClosed(p.due, now)) continue;
    try {
      const closed = { ...p, closed: true };
      await updateProposal(m.ts, closed);
      const text = proposalSummary(closed, await messageLink(channel(), m.ts), m.reply_count ?? 0);
      const { userId } = await approver();
      for (const u of new Set([p.by, userId])) await dm(u, text);
      r.closed++;
    } catch (err) {
      fail(err, "tick.close_proposal", { ts: m.ts });
    }
  }

  if (isWeeklySlot(now) && !posts.some((m) => m.metadata?.event_type === WEEKLY && Number(m.ts) * 1000 > now - DAY)) {
    try {
      const notes = posts
        .filter((m) => Number(m.ts) * 1000 > now - 7 * DAY)
        .flatMap((m) => {
          const n = readNote(m.metadata);
          return n ? [n.note] : [];
        })
        .reverse();
      const blocks = weeklyBlocks(notes, { history: historyUrl }, now);
      if (blocks) {
        await slack("chat.postMessage", {
          channel: channel(),
          text: `This week's changes: ${notes.length}`,
          blocks,
          metadata: { event_type: WEEKLY, event_payload: { count: String(notes.length) } },
          unfurl_links: false,
        });
        r.weekly = true;
      }
    } catch (err) {
      fail(err, "tick.weekly");
    }
  }

  return r;
}
