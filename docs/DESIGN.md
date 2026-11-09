# What's new: design

Agreed with Jamie, 6–9 Nov 2026 (thread "Keep the team informed of app changes").

## The problem
Jamie changes the team's apps (bookings board, portal, inventory/status dashboards, website, overtime…) often, and the team, who use them every day, weren't told.

## Decisions
1. **One channel, #whats-new.** Every change the team will notice gets one short post: app, headline, *What changed*, *What you do*, a screenshot, a *Try it* link, and a link to that app's history.
2. **It writes itself.** Each pull request description has a `## Team note` section (PR template). Claude fills it in when it opens the PR. "None" means behind the scenes, so nothing is posted.
3. **1-hour hold (Jamie's choice, 9 Nov).** When a PR with a team note is merged, Jamie gets the note by DM. It posts itself 60–75 minutes later (the cron runs every 15 minutes) unless Jamie taps **Skip**. **Post now** and **Edit** are there too, and Edit still works after posting (it updates the channel post).
4. **History by app.** The web page `/` reads #whats-new and shows tabs per app plus Ideas. It is opened from the links in Slack (signed link, no login). `/whatsnew <app>` shows the latest five in Slack.
5. **Friday round-up.** Fridays 16:00 London: one post listing the week's changes grouped by app. Nothing is posted in a week with no changes.
6. **Ideas that need buy-in.** `/whatsnew idea` opens a form (idea, problem, who it affects, mock-up link, reply-by date). It posts to #whats-new with 👍 Yes / 🤔 Not sure / 👎 No buttons; pressing your vote again takes it back. Thoughts go in the thread. It closes at 17:00 on the reply-by date, and the proposer and Jamie get a summary (votes, reply count, link). Anyone in the channel can post one.
7. **Slack is the database.** Drafts, notes and proposals keep their data in Slack message metadata. The channel is the one source of truth and there is no other store to keep in sync.
8. **Only changes after launch** (`WHATS_NEW_START`) are announced, so switching it on doesn't flood the channel. PRs merged in the last 3 days are checked, so a team note added to a PR soon after merging is still picked up.
9. **Screenshots** live in the app's own repo under `whats-new/` and are served through `/api/img` with a signed link. Only listed repos and only that folder are served.
10. **External calls:** Slack and GitHub (read-only). No Rentman, HubSpot or Xero.

## Known limits
- Two votes on the same idea in the same second can lose one (read-then-write on the message). Fine for a team of six.
- If Jamie taps Post now at the exact moment the hold runs out, the note could post twice. Delete one.
