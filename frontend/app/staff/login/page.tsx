import { safeRedirect } from "@/lib/auth/redirect";
import { LoginScreen } from "@/components/login-screen";
export const metadata = { title: "Staff Login | Cozy Palace" };
export default async function StaffLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const p = await searchParams;
  return (
    <LoginScreen
      eyebrow="Staff and admin login"
      intro="Sign in to the staff workspace. Your administrator creates your account and emails you an invitation."
      notice={
        p.notice === "timeout"
          ? "You were signed out after 5 minutes of inactivity. Sign in again to continue."
          : undefined
      }
      next={p.next ? safeRedirect(p.next) : ""}
      portal="staff"
    />
  );
}
