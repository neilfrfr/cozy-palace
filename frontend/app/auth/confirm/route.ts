import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
import type { EmailOtpType } from "@supabase/supabase-js";
export async function GET(request: NextRequest) {
  const p = new URL(request.url).searchParams;
  const type = p.get("type");
  if (isConfigured()) {
    const db = await createClient();
    let verified = false;
    if (
      p.get("token_hash") &&
      ["email", "signup", "recovery", "invite"].includes(type || "")
    ) {
      const { error } = await db.auth.verifyOtp({
        token_hash: p.get("token_hash")!,
        type: type as EmailOtpType,
      });
      verified = !error;
    } else if (p.get("code")) {
      const { error } = await db.auth.exchangeCodeForSession(p.get("code")!);
      verified = !error;
    }
    if (verified) {
      await db.rpc("accept_staff_invitation");
      const next = safeRedirect(
        p.get("next") ||
          (type === "recovery" ? "/account/password" : "/reservations"),
      );
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(
    new URL("/login?notice=invalid-link", request.url),
  );
}
