import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
import { SignupCard } from "@/components/signup-card";
import { SignupModal } from "@/components/signup-modal";
export default async function SignupPopup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const p = await searchParams;
  return (
    <SignupModal>
      <SignupCard next={safeRedirect(p.next)} configured={isConfigured()} />
    </SignupModal>
  );
}
