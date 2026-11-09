import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.LINK_SECRET?.trim();
  if (!s) throw new Error("LINK_SECRET is not set");
  return s;
}

/** Short signature for links the app hands out (history page, screenshots). */
export function sign(value: string, key = secret()): string {
  return createHmac("sha256", key).update(value).digest("base64url").slice(0, 32);
}

export function verify(value: string, sig: string | null | undefined, key = secret()): boolean {
  if (!sig) return false;
  const a = Buffer.from(sign(value, key));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
