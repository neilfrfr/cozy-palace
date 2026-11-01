import { requireStaff } from "@/lib/auth/authorize";
import { saveMenuItemAction } from "@/app/actions/orders";
import {
  getMenu,
  menuSections,
  orderMessages,
  type MenuRow,
} from "@/lib/orders";
export const dynamic = "force-dynamic";

function ItemForm({ item }: { item?: MenuRow }) {
  return (
    <form action={saveMenuItemAction} className="operations-filters">
      {item && <input type="hidden" name="id" value={item.id} />}
      <label>
        Name
        <input name="name" required maxLength={80} defaultValue={item?.name} />
      </label>
      <label>
        Section
        <select name="section" defaultValue={item?.section ?? menuSections[0]}>
          {menuSections.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Price (₱)
        <input
          name="price"
          type="number"
          required
          min={0}
          max={100000}
          step="0.01"
          defaultValue={item?.price}
        />
      </label>
      <label>
        <input
          name="available"
          type="checkbox"
          defaultChecked={item?.available ?? true}
        />{" "}
        Available
      </label>
      <button className="button">{item ? "Save" : "Add item"}</button>
    </form>
  );
}

export default async function Menu({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireStaff(true);
  const [{ notice, error }, menu] = await Promise.all([
    searchParams,
    getMenu(),
  ]);
  const message = orderMessages[error ?? notice ?? ""];
  return (
    <>
      <p className="eyebrow">RESTAURANT</p>
      <h1>Menu</h1>
      <p className="intro">
        Prices and availability used for staff orders. Changing a price never
        alters orders already saved, and every change is recorded in the
        activity log.
      </p>
      {message && (
        <p
          className={"notice" + (error ? " error" : "")}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {menuSections.map((section) => (
        <section key={section}>
          <h2>{section}</h2>
          {menu
            .filter((m) => m.section === section)
            .map((m) => (
              <ItemForm key={m.id} item={m} />
            ))}
        </section>
      ))}
      <h2>Add a menu item</h2>
      <ItemForm />
    </>
  );
}
