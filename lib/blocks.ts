/**
 * Everything the team sees in Slack, as Block Kit. Pure functions, no I/O, so they are tested.
 * Keep the words few: headline, what changed, what you do, a picture, a link.
 */
import { appByKey, APPS } from "./apps";
import { NONE, type Note } from "./note";
import { clock, dayLabel } from "./time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Block = Record<string, any>;

export type Links = { image?: string; history: (appKey?: string) => string; tryIt?: string };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appLabel(key: string): string {
  const a = appByKey(key);
  return a ? `${a.emoji} *${a.name}*` : `*${key}*`;
}

/** A "Try it" value becomes a link when it is one; slash commands and words stay as text. */
function tryItText(v: string | undefined): string | null {
  if (!v || NONE.test(v.trim())) return null;
  return /^https:\/\//.test(v) ? `<${v}|Try it>` : `Try it: \`${esc(v)}\``;
}

/** The post in #whats-new. */
export function noteBlocks(note: Note, links: Links): Block[] {
  const app = appByKey(note.app);
  const lines = [`*${esc(note.headline)}*`];
  if (note.changed) lines.push(`*What changed:* ${esc(note.changed)}`);
  if (note.todo) lines.push(`*What you do:* ${esc(note.todo)}`);
  const blocks: Block[] = [
    { type: "context", elements: [{ type: "mrkdwn", text: appLabel(note.app) }] },
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
  ];
  if (links.image) blocks.push({ type: "image", image_url: links.image, alt_text: note.headline });
  const foot = [tryItText(note.tryIt), `<${links.history(note.app)}|All ${esc(app?.name ?? note.app)} updates>`].filter(Boolean);
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: foot.join("  ·  ") }] });
  return blocks;
}

export function noteFallback(note: Note): string {
  const app = appByKey(note.app);
  return `${app?.emoji ?? ""} ${app?.name ?? note.app}: ${note.headline}`.trim();
}

export type DraftStatus = "waiting" | "posted" | "skipped";

/** Jamie's DM: the note as the team will see it, and what will happen to it. */
export function draftBlocks(note: Note, status: DraftStatus, dueMs: number, links: Links, postedLink?: string): Block[] {
  const head =
    status === "waiting" && !links.image
      ? `📝 Ready for #whats-new. <${note.prUrl}|Change on GitHub>`
      : status === "waiting"
      ? `📝 This goes to #whats-new at *${clock(dueMs)}* unless you skip it. <${note.prUrl}|Change on GitHub>`
      : status === "posted"
        ? `✅ Posted to #whats-new${postedLink ? ` · <${postedLink}|see it>` : ""}. You can still edit it.`
        : `⏭️ Skipped. The team won't see this one.`;
  const warn =
    status === "waiting" && !links.image ? "\n⚠️ *No picture*, so this one waits for you: it won't post on its own. Press Post now, or Skip." : "";
  const buttons: Block[] =
    status === "waiting"
      ? [
          { type: "button", action_id: "draft_post", text: { type: "plain_text", text: "Post now" }, style: "primary", value: "post" },
          { type: "button", action_id: "draft_edit", text: { type: "plain_text", text: "Edit" }, value: "edit" },
          { type: "button", action_id: "draft_skip", text: { type: "plain_text", text: "Skip" }, value: "skip" },
        ]
      : status === "posted"
        ? [{ type: "button", action_id: "draft_edit", text: { type: "plain_text", text: "Edit" }, value: "edit" }]
        : [{ type: "button", action_id: "draft_post", text: { type: "plain_text", text: "Post anyway" }, value: "post" }];
  return [
    { type: "section", text: { type: "mrkdwn", text: head + warn } },
    ...noteBlocks(note, links),
    { type: "actions", elements: buttons },
  ];
}

/** Edit form for a note (Jamie). */
export function editModal(note: Note, privateMetadata: string): Block {
  const input = (id: string, label: string, value: string, multiline = false, optional = false) => ({
    type: "input",
    block_id: id,
    optional,
    label: { type: "plain_text", text: label },
    element: { type: "plain_text_input", action_id: "v", initial_value: value, multiline },
  });
  return {
    type: "modal",
    callback_id: "draft_edit_submit",
    private_metadata: privateMetadata,
    title: { type: "plain_text", text: "Edit team note" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      input("headline", "Headline", note.headline),
      input("changed", "What changed", note.changed, true, true),
      input("todo", "What you do", note.todo, true, true),
      input("tryIt", "Try it (link or command)", note.tryIt ?? "", false, true),
    ],
  };
}

// ---------- Weekly round-up ----------

/** Friday's "this week" post: one line per change, grouped by app. Null when nothing changed. */
export function weeklyBlocks(notes: Note[], links: Links, weekEndingMs: number): Block[] | null {
  if (notes.length === 0) return null;
  const blocks: Block[] = [
    { type: "header", text: { type: "plain_text", text: `This week's changes · w/e ${dayLabel(weekEndingMs)}` } },
  ];
  for (const app of APPS) {
    const mine = notes.filter((n) => n.app === app.key);
    if (mine.length === 0) continue;
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `${app.emoji} *${app.name}*\n${mine.map((n) => `• ${esc(n.headline)}`).join("\n")}` },
    });
  }
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `<${links.history()}|Full history by app>` }] });
  return blocks;
}

// ---------- Proposals (ideas that need the team's buy-in) ----------

export type Vote = "yes" | "maybe" | "no";
export type Proposal = {
  title: string;
  problem: string;
  idea: string;
  who: string;
  link?: string;
  due: string; // YYYY-MM-DD, closes 17:00 London
  by: string; // Slack user id
  votes: Record<string, Vote>;
  closed: boolean;
};

export const VOTE_LABEL: Record<Vote, string> = { yes: "👍 Yes", maybe: "🤔 Not sure", no: "👎 No" };

export function tally(votes: Record<string, Vote>): Record<Vote, string[]> {
  const t: Record<Vote, string[]> = { yes: [], maybe: [], no: [] };
  for (const [user, v] of Object.entries(votes)) t[v]?.push(user);
  return t;
}

export function tallyText(votes: Record<string, Vote>): string {
  const t = tally(votes);
  return (Object.keys(t) as Vote[])
    .map((v) => `${VOTE_LABEL[v]} ${t[v].length}${t[v].length ? ` (${t[v].map((u) => `<@${u}>`).join(", ")})` : ""}`)
    .join("   ");
}

function dueLabel(due: string): string {
  return dayLabel(Date.parse(`${due}T12:00:00Z`));
}

export function proposalBlocks(p: Proposal): Block[] {
  const lines = [
    `*Problem:* ${esc(p.problem)}`,
    `*Idea:* ${esc(p.idea)}`,
    p.who ? `*Affects:* ${esc(p.who)}` : "",
    p.link ? `*Mock-up:* <${p.link}|have a look>` : "",
  ].filter(Boolean);
  const blocks: Block[] = [
    { type: "context", elements: [{ type: "mrkdwn", text: `💡 *Idea for your input* from <@${p.by}>` }] },
    { type: "section", text: { type: "mrkdwn", text: `*${esc(p.title)}*\n${lines.join("\n")}` } },
    { type: "context", elements: [{ type: "mrkdwn", text: tallyText(p.votes) }] },
  ];
  if (p.closed) {
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `🔒 Closed ${dueLabel(p.due)}. Thanks for your input.` }] });
  } else {
    blocks.push(
      {
        type: "actions",
        elements: (Object.keys(VOTE_LABEL) as Vote[]).map((v) => ({
          type: "button",
          action_id: `vote_${v}`,
          value: v,
          text: { type: "plain_text", text: VOTE_LABEL[v] },
        })),
      },
      { type: "context", elements: [{ type: "mrkdwn", text: `Reply in the thread with thoughts · closes ${dueLabel(p.due)} 5pm` }] },
    );
  }
  return blocks;
}

export function proposalModal(): Block {
  const text = (id: string, label: string, placeholder: string, multiline = false, optional = false) => ({
    type: "input",
    block_id: id,
    optional,
    label: { type: "plain_text", text: label },
    element: { type: "plain_text_input", action_id: "v", multiline, placeholder: { type: "plain_text", text: placeholder } },
  });
  return {
    type: "modal",
    callback_id: "proposal_submit",
    title: { type: "plain_text", text: "Share an idea" },
    submit: { type: "plain_text", text: "Post to #whats-new" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      text("title", "Idea in a few words", "e.g. Kit check-in on a tablet"),
      text("problem", "The problem", "What's annoying or slow today?", true),
      text("idea", "The idea", "What would change?", true),
      text("who", "Who it affects", "e.g. Warehouse team", false, true),
      text("link", "Mock-up link", "https://…", false, true),
      {
        type: "input",
        block_id: "due",
        label: { type: "plain_text", text: "Replies by" },
        element: { type: "datepicker", action_id: "v" },
      },
    ],
  };
}

/** Sent to the proposer and Jamie when a proposal closes. */
export function proposalSummary(p: Proposal, link: string, replies: number): string {
  const t = tally(p.votes);
  return `💡 *${esc(p.title)}* closed: 👍 ${t.yes.length} · 🤔 ${t.maybe.length} · 👎 ${t.no.length} · 💬 ${replies} ${replies === 1 ? "reply" : "replies"}. <${link}|Read the thread>`;
}
