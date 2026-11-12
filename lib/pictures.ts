/**
 * Fixes made to a note after its change was merged, keyed by draft key ("repo#number"):
 * a picture (a file in this repo's public/ folder) and, where later work changed the feature, new wording.
 * The tick applies them to the draft, and to the #whats-new post if the note has already gone out.
 */
export type LaterFix = { image?: string; changed?: string; todo?: string };

export const PICTURES: Record<string, LaterFix> = {
  "fomo-bookings-board-v2#91": { image: "/whats-new/notes/bookings-91-kit-status.png" },
  "fomo-bookings-board-v2#92": { image: "/whats-new/notes/bookings-92-company-column.png" },
  // #94 and #96 (same morning) replaced the long red lines with a small red ⚡ time chip before the status.
  "fomo-bookings-board-v2#93": {
    image: "/whats-new/notes/bookings-93-quick-turnarounds.png",
    changed:
      "If kit waiting for check-in is needed for a job going out today or tomorrow, it gets a red ⚡ chip with the time (⚡ 15:00, or ⚡ Tmrw 09:00) and goes to the top. Hover the chip to see the job and items. Kit Prep shows the same flag on both jobs. Check-ins now say how many items are left, and turn red if nothing has been scanned for 2 days.",
  },
};
