import { OperationsSidebar } from "@/components/operations-sidebar";
export function AdminSidebar() {
  return (
    <OperationsSidebar
      subtitle="Management"
      home="/admin"
      groups={[
        { name: "Today", links: [["/admin", "Overview"]] },
        {
          name: "Bookings",
          links: [
            ["/staff/reservations", "Reservations"],
            ["/staff/payments", "Payments"],
          ],
        },
        {
          name: "Restaurant",
          links: [
            ["/staff/tables", "Table service"],
            ["/staff/orders", "Orders"],
            ["/admin/menu", "Menu"],
            ["/admin/tables", "Restaurant tables"],
          ],
        },
        {
          name: "Hotel",
          links: [
            ["/admin/rooms", "Rooms"],
            ["/admin/extras", "Extras and packages"],
            ["/admin/website", "Website"],
          ],
        },
        {
          name: "People and records",
          links: [
            ["/admin/staff", "Staff directory"],
            ["/admin/reports", "Reports"],
            ["/admin/activity", "Activity log"],
          ],
        },
      ]}
      footer={[["/", "Public website"]]}
    />
  );
}
