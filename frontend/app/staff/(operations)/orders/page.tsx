import { randomUUID } from "node:crypto";
import { requireStaff } from "@/lib/auth/authorize";
import { createOrderAction } from "@/app/actions/orders";
import {
  getMenu,
  getOrders,
  menuSections,
  orderMessages,
  peso,
} from "@/lib/orders";
import { OrderList } from "@/components/order-list";
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
      <h2>New order</h2>
      <form action={createOrderAction} className="form-panel">
        {/* A fresh key per page load makes a double-submitted form save one order. */}
        <input type="hidden" name="key" value={randomUUID()} />
        <div className="form-grid">
          {menuSections.map((section) => {
            const items = menu.filter(
              (m) => m.section === section && m.available,
            );
            return (
              items.length > 0 && (
                <fieldset key={section} className="full">
                  <legend>{section}</legend>
                  {items.map((m) => (
                    <label key={m.id}>
                      {m.name} · {peso(m.price)}
                      <input
                        name={"qty:" + m.id}
                        type="number"
                        min={0}
                        max={50}
                        defaultValue={0}
                      />
                    </label>
                  ))}
                </fieldset>
              )
            );
          })}
          <label>
            Booking number (optional)
            <input name="reservation" maxLength={20} placeholder="e.g. 1042" />
          </label>
          <label>
            Charge to room (optional)
            <input name="room" maxLength={10} placeholder="e.g. 101" />
          </label>
          <label>
            Note (optional)
            <input name="note" maxLength={200} placeholder="Table 4, no ice" />
          </label>
        </div>
        <button className="button">Save order</button>
      </form>
      <h2>Recent orders</h2>
      <OrderList rows={orders} staff />
    </>
  );
}
