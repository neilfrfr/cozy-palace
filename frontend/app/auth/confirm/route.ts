import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
import type { EmailOtpType } from "@supabase/supabase-js";
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token_hash"),
    type = searchParams.get("type");
  if (isConfigured() && token && type === "email") {
    const db = await createClient();
    const { error } = await db.auth.verifyOtp({
      token_hash: token,
      type: type as EmailOtpType,
    });
    if (!error)
      return NextResponse.redirect(
        new URL(safeRedirect(searchParams.get("next")), request.url),
      );
  }
  return NextResponse.redirect(
    new URL("/login?notice=invalid-link", request.url),
  );
}
