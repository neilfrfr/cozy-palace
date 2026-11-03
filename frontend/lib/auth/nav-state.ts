import "server-only";
import { cache } from "react";
import { readRole, roleHome } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";

/**
 * Who is viewing, for the public header and footer. Cached per request so
 * both read the session once. My Reservations is only offered to signed-in
 * customers; visitors who aren't signed in see Sign in instead.
 */
export const readNavState = cache(async () => {
  let signedIn = false;
  let home = "/reservations";
  let employee = false;
  if (isConfigured()) {
    try {
      const db = await createClient();
      // getClaims verifies the JWT locally (proxy.ts already refreshed it); display-only, so no Auth round trip.
      const { data, error } = await db.auth.getClaims();
      const userId = !error && data?.claims.sub;
      signedIn = !!userId;
      if (userId) {
        const role = await readRole(db, userId);
        home = roleHome(role);
        employee = role !== "customer";
      }
    } catch {
      /* Public navigation remains usable during an Auth outage. */
    }
  }
  return { signedIn, home, employee };
});
