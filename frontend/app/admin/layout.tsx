import { requireStaff } from "@/lib/auth/authorize";
import { AdminSidebar } from "@/components/admin-shell";
import { IdleLogout } from "@/components/idle-logout";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff(true);
  return (
    <div className="admin-layout">
      <IdleLogout />
      <AdminSidebar />
      <div className="admin-content">{children}</div>
    </div>
  );
}
