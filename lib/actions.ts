/** Side effects: draft DMs, channel posts, proposal updates. Every failure throws (rule 1). */
import { appByKey } from "./apps";
import { draftBlocks, noteBlocks, noteFallback, proposalBlocks, type Links, type Proposal } from "./blocks";
import type { Note } from "./note";
import { draftMeta, noteMeta, proposalMeta, readDraft, readNote, type Draft } from "./records";
import { appUrl } from "./report";
import { sign } from "./sign";
import { approver, channel, getMessage, messageLink, slack } from "./slack";

export const HOLD_MS = 60 * 60_000;

export function historyUrl(appKey?: string): string {
  const q = new URLSearchParams({ k: sign("history") });
  if (appKey) q.set("app", appKey);
  return `${appUrl()}/?${q}`;
}

export function imageUrl(note: Note, sha: string): string | undefined {
  if (note.image) return `${appUrl()}${note.image}`;
  if (!note.screenshot) return undefined;
  const repo = appByKey(note.app)?.repo;
  if (!repo) return undefined;
  const q = new URLSearchParams({ repo, ref: sha, path: note.screenshot, sig: sign(`${repo}:${sha}:${note.screenshot}`) });
  return `${appUrl()}/api/img?${q}`;
}

export function linksFor(note: Note, sha: string): Links {
  return { history: historyUrl, image: imageUrl(note, sha) };
}

/** New change → DM Jamie the draft. It posts itself when the hold runs out. */
export async function sendDraft(note: Note, sha: string, now = Date.now()): Promise<void> {
  const { dm } = await approver();
  const d: Draft = { key: note.pr, status: "waiting", due: now + HOLD_MS, sha, note };
  await slack("chat.postMessage", {
    channel: dm,
    text: `Team note ready: ${noteFallback(note)}`,
    blocks: draftBlocks(note, d.status, d.due, linksFor(note, sha)),
    metadata: draftMeta(d),
    unfurl_links: false,
  });
}

export async function updateDraft(dm: string, ts: string, d: Draft): Promise<void> {
  const postedLink = d.postedTs ? await messageLink(channel(), d.postedTs) : undefined;
  await slack("chat.update", {
    channel: dm,
    ts,
    text: `Team note: ${noteFallback(d.note)}`,
    blocks: draftBlocks(d.note, d.status, d.due, linksFor(d.note, d.sha), postedLink),
    metadata: draftMeta(d),
  });
}

/** Post a draft to #whats-new (now, or because its hour is up). Re-reads it first so a skip or a second click wins. */
export async function publishDraft(dm: string, ts: string): Promise<"posted" | "already"> {
  const msg = await getMessage(dm, ts);
  const d = readDraft(msg?.metadata);
  if (!d) throw new Error(`Draft ${dm}/${ts} not found`);
  if (d.status === "posted") return "already";
  const res = await slack<{ ts: string }>("chat.postMessage", {
    channel: channel(),
    text: noteFallback(d.note),
    blocks: noteBlocks(d.note, linksFor(d.note, d.sha)),
    metadata: noteMeta(d.note, d.sha),
    unfurl_links: false,
    unfurl_media: false,
  });
  await updateDraft(dm, ts, { ...d, status: "posted", postedTs: res.ts });
  return "posted";
}

export async function skipDraft(dm: string, ts: string): Promise<void> {
  const d = readDraft((await getMessage(dm, ts))?.metadata);
  if (!d) throw new Error(`Draft ${dm}/${ts} not found`);
  if (d.status !== "waiting") return;
  await updateDraft(dm, ts, { ...d, status: "skipped" });
}

/** Jamie edited the words. Updates the draft and, if it is already out, the channel post too. */
export async function editDraft(dm: string, ts: string, text: Partial<Pick<Note, "headline" | "changed" | "todo" | "tryIt" | "image">>): Promise<void> {
  const d = readDraft((await getMessage(dm, ts))?.metadata);
  if (!d) throw new Error(`Draft ${dm}/${ts} not found`);
  const note = { ...d.note, ...text, tryIt: "tryIt" in text ? text.tryIt || undefined : d.note.tryIt };
  if (d.postedTs) {
    await slack("chat.update", {
      channel: channel(),
      ts: d.postedTs,
      text: noteFallback(note),
      blocks: noteBlocks(note, linksFor(note, d.sha)),
      metadata: noteMeta(note, d.sha),
    });
  }
  await updateDraft(dm, ts, { ...d, note });
}

export async function readPostedNote(ts: string) {
  return readNote((await getMessage(channel(), ts))?.metadata);
}

export async function postProposal(p: Proposal): Promise<string> {
  const res = await slack<{ ts: string }>("chat.postMessage", {
    channel: channel(),
    text: `💡 Idea for your input: ${p.title}`,
    blocks: proposalBlocks(p),
    metadata: proposalMeta(p),
    unfurl_links: false,
  });
  return res.ts;
}

export async function updateProposal(ts: string, p: Proposal): Promise<void> {
  await slack("chat.update", { channel: channel(), ts, text: `💡 ${p.title}`, blocks: proposalBlocks(p), metadata: proposalMeta(p) });
}

export async function dm(userId: string, text: string): Promise<void> {
  const im = await slack<{ channel: { id: string } }>("conversations.open", { users: userId });
  await slack("chat.postMessage", { channel: im.channel.id, text, unfurl_links: false });
}
