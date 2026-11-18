import { OperationsSidebar } from "@/components/operations-sidebar";
export function StaffSidebar() {
  return (
    <OperationsSidebar
      subtitle="Front desk"
      home="/staff"
      groups={[
        {
          name: "Today",
          links: [
            ["/staff", "Overview"],
            ["/staff/activity", "My activity"],
          ],
        },
        {
          name: "Bookings",
          links: [
            ["/staff/reservations", "Reservations"],
            ["/staff/reservations/new", "New guest booking"],
            ["/staff/payments", "Payments"],
          ],
        },
        {
          name: "Restaurant",
          links: [
            ["/staff/tables", "Table service"],
            ["/staff/orders", "Orders"],
          ],
        },
      ]}
    />
  );
}
