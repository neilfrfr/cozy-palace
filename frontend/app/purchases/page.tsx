import { requireIdentity } from "@/lib/auth/authorize";
import { getOrders } from "@/lib/orders";
import { WorkspaceNav } from "@/components/workspace-nav";
import { OrderList } from "@/components/order-list";
export const dynamic = "force-dynamic";
export default async function Purchases() {
  const { userId } = await requireIdentity("/purchases");
  const orders = await getOrders(userId);
  return (
    <section className="section">
      <WorkspaceNav />
      <h1>My Purchases</h1>
      <p className="intro">
        Food and drink orders the staff saved to your bookings. Your latest 50
        orders are shown.
      </p>
      <OrderList rows={orders} />
    </section>
  );
}
