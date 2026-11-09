/**
 * The FOMO apps whose changes are announced, keyed by GitHub repo name (owner FOMORentals).
 * A repo not listed here is never checked. Names are what the team calls the app.
 */
export type App = { key: string; repo: string; name: string; emoji: string; url?: string };

export const OWNER = "FOMORentals";

export const APPS: App[] = [
  { key: "bookings", repo: "fomo-bookings-board-v2", name: "Bookings board", emoji: "📋" },
  { key: "portal", repo: "fomo-client-portal", name: "Client portal", emoji: "🧾" },
  { key: "inventory", repo: "fomo-inventory-dashboard", name: "Inventory dashboard", emoji: "📦" },
  { key: "status", repo: "fomo-status-dashboard", name: "Status dashboard", emoji: "🚦" },
  { key: "website", repo: "fomo-rentals-website-rebuild", name: "Website", emoji: "🌐", url: "https://www.fomorentals.co.uk" },
  { key: "kit", repo: "fomo-kit-onboarding", name: "Kit onboarding", emoji: "🎥" },
  { key: "overtime", repo: "fomo-overtime", name: "Overtime", emoji: "🕐" },
  { key: "whatsnew", repo: "fomo-whats-new", name: "What's new", emoji: "📣" },
];

export function appByRepo(repo: string): App | undefined {
  return APPS.find((a) => a.repo.toLowerCase() === repo.toLowerCase());
}

export function appByKey(key: string): App | undefined {
  const k = key.trim().toLowerCase();
  return APPS.find((a) => a.key === k || a.name.toLowerCase() === k || a.repo === k);
}
