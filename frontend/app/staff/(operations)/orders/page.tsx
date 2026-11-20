import { randomUUID } from "node:crypto";
import { requireStaff } from "@/lib/auth/authorize";
import { createOrderAction } from "@/app/actions/orders";
import { getMenu, getOrders, menuSections, orderMessages } from "@/lib/orders";
import { OrderList } from "@/components/order-list";
import { OrderPos } from "@/components/order-pos";
export const dynamic = "force-dynamic";
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireStaff();
  const [{ notice, error }, menu, orders] = await Promise.all([
    searchParams,
    getMenu(),
    getOrders(),
  ]);
  const message = orderMessages[error ?? notice ?? ""];
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>Orders</h1>
          <p>
            Record food and drink orders. Prices come from the menu. Add a
            booking reference to save the order to that guest&apos;s account, or
            a room number to charge it to the room bill of the guest checked in
            there. Leave both blank for walk-ins.
          </p>
        </div>
      </header>
      {message && (
        <p
          className={"notice" + (error ? " error" : "")}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <h2 className="hidden-label">New order</h2>
      <form action={createOrderAction}>
        {/* A fresh key per page load makes a double-submitted form save one order. */}
        <input type="hidden" name="key" value={randomUUID()} />
        <OrderPos
          sections={menuSections
            .map((name) => ({
              name,
              items: menu
                .filter((m) => m.section === name && m.available)
                .map(({ id, name, price }) => ({
                  id,
                  name,
                  price: Number(price),
                })),
            }))
            .filter((s) => s.items.length)}
        />
      </form>
      <section className="operations-section">
        <h2>Recent orders</h2>
        <OrderList rows={orders} staff />
      </section>
    </>
  );
}
