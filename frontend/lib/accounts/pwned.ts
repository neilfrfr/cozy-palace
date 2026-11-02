import "server-only";
import { createHash } from "node:crypto";

/**
 * True when the password is in Have I Been Pwned's breach list (stands in for Supabase's Pro-only check).
 * Only the first 5 characters of its SHA-1 hash leave the server. Fails open: a lookup problem never blocks anyone.
 */
export async function isPwned(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  try {
    const res = await fetch(
      "https://api.pwnedpasswords.com/range/" + hash.slice(0, 5),
      {
        headers: { "Add-Padding": "true" },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) return false;
    // Lines are "SUFFIX:COUNT"; padding lines have a count of 0.
    return (await res.text()).split("\n").some((line) => {
      const [suffix, count] = line.trim().split(":");
      return suffix === hash.slice(5) && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export const pwnedMessage =
  "This password has appeared in a data breach elsewhere. Choose a different one.";
