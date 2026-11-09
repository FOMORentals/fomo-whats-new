# Setup (one-off)

1. **Slack channel.** `#whats-new` exists (ID C0CFKGHRCNT, created 9 Nov 2026). Add Sam, Louis, Rosie, Will and Margarita at launch.
2. **Slack app.** https://api.slack.com/apps → Create New App → From an app manifest → paste `docs/slack-app-manifest.yml` (replace APP_URL). Install to workspace. Copy the Bot token (`xoxb-…`) and the Signing secret. Invite the app to `#whats-new` (`/invite @What's new`).
3. **GitHub token.** github.com → Settings → Developer settings → Fine-grained tokens → Generate. Resource owner FOMORentals; repositories: the ones in `lib/apps.ts`; permissions: Pull requests **Read**, Contents **Read**. Longest expiry allowed (put a calendar reminder to renew).
4. **Vercel.** Project `fomo-whats-new` (team fomo12, prj_TR7Y1fwHEOaiRxqzrkOBBpM62wNL) exists; LINK_SECRET, CRON_SECRET, WHATS_NEW_CHANNEL_ID, WHATS_NEW_START (2026-11-09), APPROVER_EMAIL, APP_URL are set. Still to add (Production, Sensitive):
   - `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `GITHUB_TOKEN` (optional: `SENTRY_DSN`)
5. **Each app repo:** add `.github/pull_request_template.md` from this repo and the CLAUDE.md lines in this repo's CLAUDE.md.
