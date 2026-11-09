# fomo-whats-new

Read `../FOMO-ENGINEERING-RULES.md` first (and the guidelines it points to) when it is there. Jamie is not an engineer: explain in business terms.

What this is: the FOMO team's changelog. Changes to Jamie's apps are announced in Slack #whats-new, with a history page split by app, and ideas can be put to the team for a vote. Designed with Jamie on 6–9 Nov 2026. Decisions are in `docs/DESIGN.md`; keep it current. Setup: `docs/SETUP.md`.

- `lib/note.ts` reads the "## Team note" section of a pull request description.
- `lib/blocks.ts` everything the team sees in Slack (pure, tested). `lib/records.ts` the data stored on Slack messages.
- `lib/tick.ts` the 15-minute cron. `lib/actions.ts` Slack side effects. `lib/handlers.ts` buttons, forms, `/whatsnew`.
- `app/page.tsx` the history page. `lib/apps.ts` which repos count as which app.

Slack is the database (message metadata). No Firestore. External calls: Slack and GitHub (read-only). Nothing else.
Before saying done: `npm test`, `npm run lint`, `npm run build`.

## Every FOMO repo
Each app repo should have `.github/pull_request_template.md` from this repo, and its CLAUDE.md should say:
"Every PR description has a `## Team note` section (see the PR template). It is what the team reads in #whats-new: a headline, what changed, what they do differently, a screenshot under `whats-new/` when the change is visible, and a link. Write `None` when the team won't notice the change."
