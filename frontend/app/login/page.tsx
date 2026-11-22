import { safeRedirect } from "@/lib/auth/redirect";
import { LoginScreen } from "@/components/login-screen";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const p = await searchParams;
  return (
    <LoginScreen
      eyebrow="Guest login"
      intro="Sign in to view your stays, table bookings and receipts."
      notice={
        p.notice === "invalid-link"
          ? "This link is invalid or expired. Request a fresh confirmation or recovery link."
          : p.notice === "expired"
            ? "Your session ended, so you were signed out. Sign in again to continue."
            : undefined
      }
      next={p.next ? safeRedirect(p.next) : ""}
      portal="guest"
    />
  );
}