import { requireStaff } from "@/lib/auth/authorize";
import { StaffSidebar } from "@/components/staff-shell";
import { AdminSidebar } from "@/components/admin-shell";
export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = await requireStaff();
  return (
    <div
      className={
        role === "admin"
          ? "admin-layout operations-layout"
          : "staff-layout operations-layout"
      }
    >
      {role === "admin" ? <AdminSidebar /> : <StaffSidebar />}
      <div className="admin-content operations-content">{children}</div>
    </div>
  );
}
