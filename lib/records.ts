/**
 * Slack is the database. Each draft (Jamie's DM), note (channel post) and proposal carries its
 * data as Slack message metadata, so there is one source of truth and nothing else to keep in sync.
 * Pure (de)serialisers, tested.
 */
import type { DraftStatus, Proposal, Vote } from "./blocks";
import type { Note } from "./note";
import type { Meta } from "./slack";

export const DRAFT = "wn_draft";
export const NOTE = "wn_note";
export const PROPOSAL = "wn_proposal";
export const WEEKLY = "wn_weekly";

export type Draft = { key: string; status: DraftStatus; due: number; sha: string; note: Note; postedTs?: string };

export function draftMeta(d: Draft): Meta {
  const p: Record<string, string> = { key: d.key, status: d.status, due: String(d.due), sha: d.sha, note: JSON.stringify(d.note) };
  if (d.postedTs) p.posted_ts = d.postedTs;
  return { event_type: DRAFT, event_payload: p };
}

export function readDraft(meta: Meta | undefined): Draft | null {
  if (meta?.event_type !== DRAFT) return null;
  const p = meta.event_payload;
  try {
    return { key: p.key, status: p.status as DraftStatus, due: Number(p.due), sha: p.sha, note: JSON.parse(p.note), postedTs: p.posted_ts || undefined };
  } catch {
    return null;
  }
}

export function noteMeta(note: Note, sha: string): Meta {
  return { event_type: NOTE, event_payload: { key: note.pr, app: note.app, sha, note: JSON.stringify(note) } };
}

export function readNote(meta: Meta | undefined): { note: Note; sha: string } | null {
  if (meta?.event_type !== NOTE) return null;
  try {
    return { note: JSON.parse(meta.event_payload.note), sha: meta.event_payload.sha };
  } catch {
    return null;
  }
}

export function proposalMeta(p: Proposal): Meta {
  const { votes, closed, link, ...rest } = p;
  return { event_type: PROPOSAL, event_payload: { ...rest, link: link ?? "", votes: JSON.stringify(votes), closed: closed ? "1" : "0" } };
}

export function readProposal(meta: Meta | undefined): Proposal | null {
  if (meta?.event_type !== PROPOSAL) return null;
  const p = meta.event_payload;
  try {
    return {
      title: p.title,
      problem: p.problem,
      idea: p.idea,
      who: p.who ?? "",
      link: p.link || undefined,
      due: p.due,
      by: p.by,
      votes: JSON.parse(p.votes || "{}") as Record<string, Vote>,
      closed: p.closed === "1",
    };
  } catch {
    return null;
  }
}

/** A person's vote: pressing the same button again takes it back. */
export function castVote(votes: Record<string, Vote>, user: string, vote: Vote): Record<string, Vote> {
  const next = { ...votes };
  if (next[user] === vote) delete next[user];
  else next[user] = vote;
  return next;
}
