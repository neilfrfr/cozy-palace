import { requireStaff } from "@/lib/auth/authorize";
import { saveExtraAction } from "@/app/actions/inventory";
import { getExtras } from "@/lib/inventory/service";
import { inventoryMessages } from "@/lib/inventory/forms";
import { extraPricing, pricingLabel, type Extra } from "@/lib/extras";
export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  ...inventoryMessages,
  INVALID_INPUT:
    "Check the values: a unique name, price ₱0–100,000 and a maximum of 1–20 per booking.",
};

function ExtraForm({ item }: { item?: Extra }) {
  return (
    <form action={saveExtraAction} className="operations-filters">
      {item && <input type="hidden" name="id" value={item.id} />}
      <label>
        Name
        <input name="name" required maxLength={80} defaultValue={item?.name} />
      </label>
      <label>
        Description
        <input
          name="description"
          maxLength={300}
          defaultValue={item?.description}
        />
      </label>
      <label>
        Type
        <select name="kind" defaultValue={item?.kind ?? "extra"}>
          <option value="extra">Extra</option>
          <option value="package">Package</option>
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
        Charged
        <select name="pricing" defaultValue={item?.pricing ?? "per_stay"}>
          {extraPricing.map((p) => (
            <option key={p} value={p}>
              {pricingLabel(p)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Max per booking
        <input
          name="maxQuantity"
          type="number"
          required
          min={1}
          max={20}
          defaultValue={item?.max_quantity ?? 1}
        />
      </label>
      <label>
        <input
          name="active"
          type="checkbox"
          defaultChecked={item?.active ?? true}
        />{" "}
        Active
      </label>
      <button className="button">{item ? "Save" : "Add item"}</button>
    </form>
  );
}

export default async function Extras({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireStaff(true);
  const [{ notice, error }, extras] = await Promise.all([
    searchParams,
    getExtras(false),
  ]);
  const message = messages[error ?? notice ?? ""];
  return (
    <>
      <p className="eyebrow">ROOMS</p>
      <h1>Extras and Packages</h1>
      <p className="intro">
        Paid add-ons guests can choose when booking a room. Changing a price
        never alters bookings already made. Untick Active to stop offering an
        item, and every change is recorded in the activity log.
      </p>
      {message && (
        <p
          className={"notice" + (error ? " error" : "")}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {extras.map((e) => (
        <ExtraForm key={e.id} item={e} />
      ))}
      <h2>Add an extra or package</h2>
      <ExtraForm />
    </>
  );
}
