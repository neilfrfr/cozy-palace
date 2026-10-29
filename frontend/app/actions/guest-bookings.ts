"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";

const lookupSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  reference: z.string().trim().toUpperCase().regex(/^CP-[A-F0-9]{12}$/),
}).strict();

export type GuestBookingSummary = {
  reference: string;
  kind: "hotel" | "dining";
  status: string;
  guestName: string;
  guests: number;
  total: number;
  currency: string;
  details: Record<string, string> | null;
};

export async function findGuestBookingAction(input: unknown): Promise<
  | { ok: true; booking: GuestBookingSummary }
  | { ok: false; message: string }
> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter your first name, last name and confirmation number." };
  if (!isConfigured()) return { ok: false, message: "Booking lookup is not available until the site is configured." };
  const db = await createClient();
  const { data, error } = await db.rpc("find_guest_booking", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_reference: parsed.data.reference,
  });
  if (error || !data) return { ok: false, message: "We couldn't find a booking with those details. Check them and try again." };
  return { ok: true, booking: data as GuestBookingSummary };
}
