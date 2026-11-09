/** London-time helpers. Pure, no I/O. */
export const TZ = "Europe/London";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
});
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function londonParts(ms: number): { date: string; time: string; weekday: number; hour: number } {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: WEEKDAYS[p.weekday], hour: Number(p.hour) };
}

/** "14:05" in London. */
export function clock(ms: number): string {
  return londonParts(ms).time;
}

/** "Fri 6 Nov" in London. */
export function dayLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(ms));
}

/** Weekly round-up goes out in the cron run that lands in Friday 16:00–16:14 London. */
export function isWeeklySlot(ms: number): boolean {
  const p = londonParts(ms);
  return p.weekday === 5 && p.time >= "16:00" && p.time < "16:15";
}

/** A proposal's reply-by date (YYYY-MM-DD) closes at 17:00 London that day. */
export function proposalClosed(due: string, ms: number): boolean {
  const p = londonParts(ms);
  return p.date > due || (p.date === due && p.time >= "17:00");
}
