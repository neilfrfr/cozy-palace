"use server";
import { z } from "zod";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/client-ip";
import { publicError } from "@/lib/reservations/errors";
import { lookupSchema } from "@/lib/operations/schema";

export type FoundBooking = {
  reference: string;
  kind: "hotel" | "dining";
  status: string;
  guests: number;
  total: number;
  created_at: string;
  payable: boolean;
  stay: { room: string; check_in: string; check_out: string } | null;
  table: { table: string; start_at: string } | null;
  history: { action: string; at: string }[];
};
export type FindState = {
  found?: FoundBooking;
  /** What the visitor typed, so the result can offer to pay for it. */
  lookup?: { first: string; last: string; reference: string };
  message?: string;
};

// One message for every miss, so the form never reveals which of the three fields was wrong.
const notFound =
  "We couldn't find a booking with those details. Check the spelling and the booking number in your email.";

/** Guest lookup for bookings made without an account (PRD FR05): all three fields must match. */
export async function findReservationAction(
  _state: FindState,
  form: FormData,
): Promise<FindState> {
  const p = lookupSchema.safeParse({
    first: form.get("first"),
    last: form.get("last"),
    reference: form.get("reference"),
  });
  if (!p.success)
    return {
      message: "Enter your first name, last name and booking number.",
    };
  if (!adminConfigured())
    return {
      message:
        "Booking lookup is not available right now. Please contact the hotel.",
    };
  const { data, error } = await createAdminClient().rpc("find_guest_booking", {
    p_first_name: p.data.first,
    p_last_name: p.data.last,
    p_reference: p.data.reference,
    p_client_ip: await clientIp(),
  });
  if (error)
    return {
      message:
        publicError(error) === "RATE_LIMITED"
          ? "Too many lookups from this connection. Please wait an hour or contact the hotel."
          : notFound,
    };
  return data
    ? { found: data as FoundBooking, lookup: p.data }
    : { message: notFound };
}
