import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
import { SignupCard } from "@/components/signup-card";
// Opened directly (or on refresh); in-app links show the same card as a popup.
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const p = await searchParams;
  return (
    <div className="signup-page">
      <SignupCard next={safeRedirect(p.next)} configured={isConfigured()} />
    </div>
  );
}
