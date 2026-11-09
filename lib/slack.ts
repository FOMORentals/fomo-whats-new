/** Thin Slack Web API wrapper. Every failure throws (FOMO engineering rule 1: nothing fails silently). */
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://slack.com/api";

function token(): string {
  const t = process.env.SLACK_BOT_TOKEN?.trim();
  if (!t) throw new Error("SLACK_BOT_TOKEN is not set");
  return t;
}

export function channel(): string {
  const c = process.env.WHATS_NEW_CHANNEL_ID?.trim();
  if (!c) throw new Error("WHATS_NEW_CHANNEL_ID is not set");
  return c;
}

export class SlackError extends Error {
  constructor(public method: string, public code: string) {
    super(`Slack ${method} failed: ${code}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function slack<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  // Form-encoded, because some read methods (users.info, users.lookupByEmail, chat.getPermalink)
  // ignore JSON bodies. Objects such as blocks and views go in as JSON strings, which Slack accepts.
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    form.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Bearer ${token()}` },
    body: form,
  });
  if (!res.ok) throw new SlackError(method, `HTTP ${res.status}`);
  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!json.ok) throw new SlackError(method, json.error ?? "unknown_error");
  return json as T;
}

/** Slack request signing check (https://api.slack.com/authentication/verifying-requests-from-slack). */
export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null, now = Date.now()): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) throw new Error("SLACK_SIGNING_SECRET is not set");
  if (!timestamp || !signature) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 60 * 5) return false;
  const expected = "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type Meta = { event_type: string; event_payload: Record<string, string> };
export type SlackMessage = { ts: string; text?: string; user?: string; bot_id?: string; reply_count?: number; metadata?: Meta };

/** Messages in a channel (newest first), with the app's metadata, back to `oldestMs`. */
export async function history(channelId: string, oldestMs: number, max = 1000): Promise<SlackMessage[]> {
  const out: SlackMessage[] = [];
  let cursor: string | undefined;
  do {
    const res = await slack<{ messages: SlackMessage[]; response_metadata?: { next_cursor?: string } }>("conversations.history", {
      channel: channelId,
      oldest: String(oldestMs / 1000),
      limit: 200,
      include_all_metadata: true,
      cursor,
    });
    out.push(...res.messages);
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor && out.length < max);
  return out;
}

/** One message by its ts, with metadata. */
export async function getMessage(channelId: string, ts: string): Promise<SlackMessage | null> {
  const res = await slack<{ messages: SlackMessage[] }>("conversations.history", {
    channel: channelId,
    latest: ts,
    inclusive: true,
    limit: 1,
    include_all_metadata: true,
  });
  return res.messages.find((m) => m.ts === ts) ?? null;
}

let approverCache: { userId: string; dm: string } | null = null;

/** The person who checks notes before they post (Jamie). Their Slack id and the bot's DM channel with them. */
export async function approver(): Promise<{ userId: string; dm: string }> {
  if (approverCache) return approverCache;
  const email = (process.env.APPROVER_EMAIL || "jamie@fomorentals.co.uk").trim();
  const u = await slack<{ user: { id: string } }>("users.lookupByEmail", { email });
  const im = await slack<{ channel: { id: string } }>("conversations.open", { users: u.user.id });
  approverCache = { userId: u.user.id, dm: im.channel.id };
  return approverCache;
}

let teamUrlCache: string | null = null;

/** Link to a message, built from the workspace address (saves a chat.getPermalink call per message). */
export async function messageLink(channelId: string, ts: string): Promise<string> {
  if (!teamUrlCache) teamUrlCache = (await slack<{ url: string }>("auth.test", {})).url.replace(/\/$/, "");
  return `${teamUrlCache}/archives/${channelId}/p${ts.replace(".", "")}`;
}
