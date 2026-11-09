/**
 * One-off catch-up (Jamie, 9 Nov 2026): notes for changes merged 30 Oct – 9 Nov, before
 * What's new existed. The cron sends each to Jamie's DM as an ordinary draft, once
 * (the draft key "backfill#N" is the seen-check). Nothing is sent after UNTIL, so the
 * 7-day draft lookback can't resend them. Delete this file once they are out.
 */
import type { Note } from "./note";

export const BACKFILL_UNTIL = Date.parse("2026-11-10T00:00:00Z");

const gh = (repo: string, n?: number) => `https://github.com/FOMORentals/${repo}${n ? `/pull/${n}` : "/commits"}`;
const B = "fomo-bookings-board-v2";
const P = "fomo-client-portal";
const W = "fomo-rentals-website-rebuild";

type Item = [app: string, repo: string, pr: number | undefined, mergedAt: string, headline: string, changed: string, todo: string];

const ITEMS: Item[] = [
  ["bookings", B, 37, "2026-10-31", "New: Proofread button in the reply box", "One click checks spelling and tone before you send.", "Press Proofread before Send on anything important."],
  ["bookings", B, 46, "2026-11-02", "One \"Attach\" menu for files, quotes and invoices", "Attach a file, or a Rentman quote or invoice, from one menu in the reply box.", "Use Attach ▾ instead of downloading the PDF from Rentman first."],
  ["bookings", B, 52, "2026-11-03", "Quote column on the Order Tracker", "Each order shows Approved, By phone, To approve, or N/A.", "If a client approved on the phone, press \"Mark approved by phone\"."],
  ["bookings", B, 63, "2026-11-05", "Rentman's new statuses, in plain words", "Rentman changed its statuses on 4 Nov. The board now shows Prep started, On location, and Dropped off / overdue.", "Nothing. \"Prep started\" means one item is scanned, not that the job is ready."],
  ["bookings", B, 73, "2026-11-06", "Notifications cut down to three tabs", "Couriers, Payments and Needs Ticket Link. Nothing else.", "Nothing."],
  ["bookings", B, undefined, "2026-11-06", "Xtra Mile bookings fill in the board for you", "Put the Rentman job number in the Reference box. XHIRE for cross-hire, FOMO for our own runs. Cross-hire returns are marked booked automatically.", "Always fill the Reference that way when booking Xtra Mile."],
  ["bookings", B, undefined, "2026-11-06", "Bank transfers match by reference", "When two jobs have the same amount, the payment goes to the one whose invoice or job number is in the bank reference.", "Fewer payments to pick by hand."],
  ["bookings", B, 56, "2026-11-04", "New: Status page for the data feeds", "If HubSpot, Rentman or Stripe stops updating the board, an alert goes to #portal-alerts.", "If you see an alert there, tell Jamie."],
  ["portal", P, 218, "2026-11-03", "Project page redesigned", "Clear to-do cards, the quote up top, Download PDF, and a history of every quote sent.", "Nothing. Clients see it next time they open a link."],
  ["portal", P, 203, "2026-11-02", "Email links open without signing in", "Clients go straight to their project from the email.", "Nothing."],
  ["portal", P, 223, "2026-11-04", "Pay now by card, for anyone with the link", "The client's accounts team can pay without an account. Payment opens in a new tab.", "To switch card payment off for one job, tick \"Remove Stripe payment\" in Rentman."],
  ["portal", P, 251, "2026-11-07", "New: Approve kit list button", "Clients approve the kit list in the portal, and we see when and who.", "Send the portal link instead of asking for approval by email."],
  ["portal", P, 256, "2026-11-07", "Kit checklist (was packing slip)", "Tick items off online, share it, or download a PDF. It has its own link with no prices on it, so it's safe for crew.", "Send crew the checklist link, not the project link."],
  ["portal", P, 231, "2026-11-05", "Hide a client's portal from HubSpot", "Tick \"Hide portal\" on the contact in HubSpot to turn their portal off.", "Use it for clients who shouldn't see the portal."],
  ["portal", P, 249, "2026-11-07", "Insurance to-do says \"Upload policy\"", "Clearer wording, so clients know what to send.", "Nothing."],
  ["website", W, 189, "2026-11-04", "Sony FX5 launch on the home page", "A spotlight on the FX5, with its specs.", "Send clients asking about the FX5 to the home page."],
  ["website", W, 185, "2026-11-03", "Product photo galleries", "Put photos in a \"Website\" folder on the item in Rentman and they show on the website.", "Add photos there when new kit arrives."],
];

export const BACKFILL: Note[] = ITEMS.map(([app, repo, pr, mergedAt, headline, changed, todo], i) => ({
  app,
  headline,
  changed,
  todo,
  pr: `backfill#${i + 1}`,
  prUrl: gh(repo, pr),
  mergedAt: `${mergedAt}T12:00:00Z`,
}));
