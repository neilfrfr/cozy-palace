"use client";
import { useState } from "react";

type Item = { id: string; name: string; price: number };
const peso = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

/** Menu cards with quantity steppers beside a sticky order summary. Field names are what createOrderAction reads. */
export function OrderPos({
  sections,
}: {
  sections: { name: string; items: Item[] }[];
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const set = (id: string, n: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(50, n || 0)) }));
  const chosen = sections
    .flatMap((s) => s.items)
    .filter((i) => (qty[i.id] ?? 0) > 0);
  const total = chosen.reduce((n, i) => n + i.price * qty[i.id], 0);
  return (
    <div className="order-pos">
      <div className="order-menu">
        {sections.map((s) => (
          <fieldset key={s.name}>
            <legend>{s.name}</legend>
            <div className="order-menu-grid">
              {s.items.map((m) => {
                const n = qty[m.id] ?? 0;
                return (
                  <div
                    key={m.id}
                    className={"order-card" + (n ? " chosen" : "")}
                  >
                    <label htmlFor={"qty-" + m.id}>
                      {m.name}
                      <span>{peso(m.price)}</span>
                    </label>
                    <div className="order-stepper">
                      <button
                        type="button"
                        aria-label={"One fewer " + m.name}
                        disabled={!n}
                        onClick={() => set(m.id, n - 1)}
                      >
                        −
                      </button>
                      <input
                        id={"qty-" + m.id}
                        name={"qty:" + m.id}
                        type="number"
                        min={0}
                        max={50}
                        value={n}
                        onChange={(e) => set(m.id, Number(e.target.value))}
                      />
                      <button
                        type="button"
                        aria-label={"One more " + m.name}
                        disabled={n >= 50}
                        onClick={() => set(m.id, n + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <aside className="order-summary" aria-label="Order summary">
        <h2>Order summary</h2>
        {chosen.length ? (
          <ul>
            {chosen.map((i) => (
              <li key={i.id}>
                <span>
                  {qty[i.id]} × {i.name}
                </span>
                <span>{peso(i.price * qty[i.id])}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="subtle">No items yet. Add some from the menu.</p>
        )}
        <p className="order-total" aria-live="polite">
          <span>Total</span>
          <strong>{peso(total)}</strong>
        </p>
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
        <button className="button order-save" disabled={!chosen.length}>
          Save order
        </button>
      </aside>
    </div>
  );
}
