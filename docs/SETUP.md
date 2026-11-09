# Setup (one-off)

1. **Slack channel.** Create public channel `#whats-new`, add Sam, Louis, Rosie, Will and Margarita. Copy its channel ID (channel name → About → bottom).
2. **Slack app.** https://api.slack.com/apps → Create New App → From an app manifest → paste `docs/slack-app-manifest.yml` (replace APP_URL). Install to workspace. Copy the Bot token (`xoxb-…`) and the Signing secret. Invite the app to `#whats-new` (`/invite @What's new`).
3. **GitHub token.** github.com → Settings → Developer settings → Fine-grained tokens → Generate. Resource owner FOMORentals; repositories: the ones in `lib/apps.ts`; permissions: Pull requests **Read**, Contents **Read**. Longest expiry allowed (put a calendar reminder to renew).
4. **Vercel.** Import the repo as project `fomo-whats-new` (team fomo12). Environment variables (Production), from `.env.example`:
   - `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `WHATS_NEW_CHANNEL_ID`, `GITHUB_TOKEN`
   - `LINK_SECRET` and `CRON_SECRET`: any long random text (different from each other)
   - `WHATS_NEW_START`: launch time, e.g. `2026-11-10T00:00:00Z`
   - `APPROVER_EMAIL`: `jamie@fomorentals.co.uk` · `APP_URL`: the Vercel address · `SENTRY_DSN` (optional)
5. **Each app repo:** add `.github/pull_request_template.md` from this repo and the CLAUDE.md lines in this repo's CLAUDE.md.
