import { appByKey, APPS } from "@/lib/apps";
import { imageUrl } from "@/lib/actions";
import { tally, type Proposal } from "@/lib/blocks";
import type { Note } from "@/lib/note";
import { readNote, readProposal } from "@/lib/records";
import { verify } from "@/lib/sign";
import { channel, history, messageLink } from "@/lib/slack";
import { dayLabel } from "@/lib/time";

export const dynamic = "force-dynamic";

type Item =
  | { kind: "note"; ms: number; note: Note; sha: string }
  | { kind: "idea"; ms: number; p: Proposal; link: string; replies: number };

function twoYearsAgo(): number {
  return Date.now() - 2 * 365 * 24 * 60 * 60_000;
}

function href(k: string, app?: string) {
  const q = new URLSearchParams({ k });
  if (app) q.set("app", app);
  return `/?${q}`;
}

// The page is the history of #whats-new, split by app. It reads Slack directly: the channel is the one source of truth.
export default async function Page({ searchParams }: { searchParams: Promise<{ k?: string; app?: string }> }) {
  const { k = "", app } = await searchParams;
  if (!verify("history", k)) {
    return (
      <main>
        <h1>What&apos;s new</h1>
        <p className="muted">Open this page from a link in the #whats-new channel in Slack.</p>
      </main>
    );
  }

  const ch = channel();
  const posts = await history(ch, twoYearsAgo(), 3000);
  const items: Item[] = [];
  for (const m of posts) {
    const ms = Number(m.ts) * 1000;
    const n = readNote(m.metadata);
    if (n) items.push({ kind: "note", ms, note: n.note, sha: n.sha });
    const p = readProposal(m.metadata);
    if (p) items.push({ kind: "idea", ms, p, link: await messageLink(ch, m.ts), replies: m.reply_count ?? 0 });
  }

  const count = (key: string) => items.filter((i) => i.kind === "note" && i.note.app === key).length;
  const shown = items.filter((i) => (!app ? true : app === "ideas" ? i.kind === "idea" : i.kind === "note" && i.note.app === app));
  const current = app === "ideas" ? "💡 Ideas" : app ? `${appByKey(app)?.emoji ?? ""} ${appByKey(app)?.name ?? app}` : "Everything";

  let lastDay = "";
  return (
    <main>
      <h1>What&apos;s new</h1>
      <p className="muted">Every change to the FOMO team&apos;s apps, newest first. Showing: {current}.</p>
      <nav className="tabs">
        <a className={!app ? "on" : ""} href={href(k)}>All</a>
        {APPS.filter((a) => count(a.key) > 0).map((a) => (
          <a key={a.key} className={app === a.key ? "on" : ""} href={href(k, a.key)}>
            {a.emoji} {a.name}
            <span className="n">{count(a.key)}</span>
          </a>
        ))}
        <a className={app === "ideas" ? "on" : ""} href={href(k, "ideas")}>
          💡 Ideas<span className="n">{items.filter((i) => i.kind === "idea").length}</span>
        </a>
      </nav>

      {shown.length === 0 && <p className="muted">Nothing here yet.</p>}

      {shown.map((i, idx) => {
        const day = dayLabel(i.ms);
        const header = day !== lastDay ? <div className="day">{day}</div> : null;
        lastDay = day;
        if (i.kind === "note") {
          const a = appByKey(i.note.app);
          const img = imageUrl(i.note, i.sha);
          const tryIt = i.note.tryIt;
          return (
            <div key={idx}>
              {header}
              <div className="card">
                <div className="app">{a?.emoji} {a?.name ?? i.note.app}</div>
                <h3>{i.note.headline}</h3>
                {i.note.changed && <p><b>What changed:</b> {i.note.changed}</p>}
                {i.note.todo && <p><b>What you do:</b> {i.note.todo}</p>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img && <img src={img} alt={i.note.headline} loading="lazy" />}
                {tryIt && (
                  <div className="foot">
                    {/^https:\/\//.test(tryIt) ? <a href={tryIt}>Try it</a> : <>Try it: <code>{tryIt}</code></>}
                  </div>
                )}
              </div>
            </div>
          );
        }
        const t = tally(i.p.votes);
        return (
          <div key={idx}>
            {header}
            <div className="card">
              <div className="app">💡 Idea · {i.p.closed ? `closed ${dayLabel(Date.parse(`${i.p.due}T12:00:00Z`))}` : `open until ${dayLabel(Date.parse(`${i.p.due}T12:00:00Z`))} 5pm`}</div>
              <h3>{i.p.title}</h3>
              <p><b>Problem:</b> {i.p.problem}</p>
              <p><b>Idea:</b> {i.p.idea}</p>
              {i.p.who && <p><b>Affects:</b> {i.p.who}</p>}
              <div className="votes">
                <span>👍 {t.yes.length}</span><span>🤔 {t.maybe.length}</span><span>👎 {t.no.length}</span><span>💬 {i.replies}</span>
              </div>
              <div className="foot">
                <a href={i.link}>Open in Slack</a>
                {i.p.link && <> · <a href={i.p.link}>Mock-up</a></>}
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
}
