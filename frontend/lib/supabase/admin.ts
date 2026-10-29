import "server-only";
import { createClient } from "@supabase/supabase-js";
import { config, isConfigured } from "./config";
// Bypasses the signed-in user and RLS. Only for the PayMongo webhook and token-checked visitor bookings.
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SETUP_REQUIRED");
  return createClient(config().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
/** Visitor booking and payments need the server-only key; without it visitors are sent to sign in. */
export const adminConfigured = () =>
  isConfigured() && !!process.env.SUPABASE_SECRET_KEY;
