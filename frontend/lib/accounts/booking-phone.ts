import "server-only";
import { isValidPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

const profileOf = async (db: Db, userId: string) =>
  (
    await db
      .from("profiles")
      .select("full_name,phone")
      .eq("id", userId)
      .maybeSingle()
  ).data as { full_name: string; phone: string | null } | null;

/** True when the signed-in customer has no phone on file, so booking forms ask for one. */
export async function viewerMissingPhone() {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return false;
  return !(await profileOf(db, data.user.id))?.phone?.trim();
}

/**
 * A customer books only once their account has a phone the hotel can call.
 * A phone sent with the booking is saved to the account. Returns an error code, or null.
 */
export async function ensureBookingPhone(
  db: Db,
  userId: string,
  given: unknown,
): Promise<string | null> {
  const profile = await profileOf(db, userId);
  if (!profile) return "REQUEST_FAILED";
  if (profile.phone?.trim()) return null;
  const phone = typeof given === "string" ? given.trim() : "";
  if (!isValidPhone(phone)) return "PHONE_REQUIRED";
  const { error } = await db.rpc("update_profile", {
    p_name: profile.full_name,
    p_phone: phone,
  });
  return error ? "REQUEST_FAILED" : null;
}

/** Splits the optional phone off a booking request, so the strict booking schemas still apply. */
export function takePhone(input: unknown): [unknown, unknown] {
  if (!input || typeof input !== "object") return [input, undefined];
  const { guestPhone, ...rest } = input as Record<string, unknown>;
  return [rest, guestPhone];
}
