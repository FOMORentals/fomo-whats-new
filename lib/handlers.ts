/** Slack buttons, forms and the /whatsnew command. */
import { after } from "next/server";
import { appByKey, APPS } from "./apps";
import { editDraft, historyUrl, postProposal, publishDraft, skipDraft, updateProposal } from "./actions";
import { editModal, proposalModal, type Proposal, type Vote } from "./blocks";
import { castVote, readDraft, readNote, readProposal } from "./records";
import { report } from "./report";
import { approver, channel, getMessage, history, slack } from "./slack";
import { londonParts } from "./time";

type Reply = { response_type?: "ephemeral"; text: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = any;

const val = (view: Payload, id: string): string => (view.state.values[id]?.v?.value ?? view.state.values[id]?.v?.selected_date ?? "").trim();

export async function handleCommand(form: URLSearchParams): Promise<Reply> {
  const arg = (form.get("text") ?? "").trim().toLowerCase();
  if (arg === "idea" || arg === "propose") {
    await slack("views.open", { trigger_id: form.get("trigger_id"), view: proposalModal() });
    return { text: "" };
  }
  if (arg) {
    const app = appByKey(arg);
    if (!app) return { response_type: "ephemeral", text: `I don't know "${arg}". Try one of: ${APPS.map((a) => a.key).join(", ")}.` };
    const posts = await history(channel(), Date.now() - 365 * 24 * 60 * 60_000);
    const notes = posts.flatMap((m) => {
      const n = readNote(m.metadata);
      return n && n.note.app === app.key ? [n.note] : [];
    });
    const lines = notes.slice(0, 5).map((n) => `• ${n.headline}`);
    return {
      response_type: "ephemeral",
      text: `${app.emoji} *${app.name}*: latest changes\n${lines.join("\n") || "Nothing yet."}\n<${historyUrl(app.key)}|Full history>`,
    };
  }
  return {
    response_type: "ephemeral",
    text: [
      `📣 *What's new*`,
      `• <${historyUrl()}|History by app>`,
      `• \`/whatsnew overtime\` (or ${APPS.filter((a) => a.key !== "overtime").map((a) => a.key).join(", ")}): latest changes to one app`,
      `• \`/whatsnew idea\`: share an idea and get the team's 👍 / 🤔 / 👎`,
    ].join("\n"),
  };
}

export async function handleInteraction(payload: Payload): Promise<Record<string, unknown> | null> {
  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    const ch: string = payload.channel?.id ?? payload.container?.channel_id;
    const ts: string = payload.message?.ts ?? payload.container?.message_ts;
    const id: string = action?.action_id ?? "";

    if (id.startsWith("draft_")) {
      const { userId } = await approver();
      if (payload.user.id !== userId) return null; // drafts live in Jamie's DM only
      if (id === "draft_edit") {
        const d = readDraft((await getMessage(ch, ts))?.metadata);
        if (!d) throw new Error(`Draft ${ch}/${ts} not found`);
        await slack("views.open", { trigger_id: payload.trigger_id, view: editModal(d.note, JSON.stringify({ ch, ts })) });
      } else if (id === "draft_post") {
        after(() => publishDraft(ch, ts).then(() => undefined).catch((e) => report(e, "draft.post", { ts })));
      } else if (id === "draft_skip") {
        after(() => skipDraft(ch, ts).catch((e) => report(e, "draft.skip", { ts })));
      }
      return null;
    }

    if (id.startsWith("vote_")) {
      const vote = action.value as Vote;
      after(async () => {
        try {
          const p = readProposal((await getMessage(ch, ts))?.metadata);
          if (!p || p.closed) return;
          await updateProposal(ts, { ...p, votes: castVote(p.votes, payload.user.id, vote) });
        } catch (e) {
          report(e, "proposal.vote", { ts });
        }
      });
      return null;
    }
    return null;
  }

  if (payload.type === "view_submission") {
    const view = payload.view;
    if (view.callback_id === "draft_edit_submit") {
      const { ch, ts } = JSON.parse(view.private_metadata);
      const headline = val(view, "headline");
      if (!headline) return { response_action: "errors", errors: { headline: "A headline is needed" } };
      after(() =>
        editDraft(ch, ts, { headline, changed: val(view, "changed"), todo: val(view, "todo"), tryIt: val(view, "tryIt") }).catch((e) =>
          report(e, "draft.edit", { ts }),
        ),
      );
      return null;
    }
    if (view.callback_id === "proposal_submit") {
      const due = val(view, "due");
      if (due < londonParts(Date.now()).date) return { response_action: "errors", errors: { due: "Pick today or a later date" } };
      const link = val(view, "link");
      if (link && !/^https:\/\//.test(link)) return { response_action: "errors", errors: { link: "Paste a full link starting https://" } };
      const p: Proposal = {
        title: val(view, "title"),
        problem: val(view, "problem"),
        idea: val(view, "idea"),
        who: val(view, "who"),
        link: link || undefined,
        due,
        by: payload.user.id,
        votes: {},
        closed: false,
      };
      after(() => postProposal(p).then(() => undefined).catch((e) => report(e, "proposal.post")));
      return null;
    }
  }
  return null;
}
