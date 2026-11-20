import { requireStaff } from "@/lib/auth/authorize";
import { saveExtraAction } from "@/app/actions/inventory";
import { getExtras } from "@/lib/inventory/service";
import { inventoryMessages } from "@/lib/inventory/forms";
import { extraPricing, pricingLabel, type Extra } from "@/lib/extras";
import {
  AddCard,
  colLabel,
  FilterTabs,
  SectionCard,
} from "@/components/admin-ui";
export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  ...inventoryMessages,
  INVALID_INPUT:
    "Check the values: a unique name, price ₱0–100,000 and a maximum of 1–20 per booking.",
};

function ExtraForm({ item }: { item?: Extra }) {
  const compact = !!item;
  return (
    <form action={saveExtraAction} className="edit-row">
      {item && <input type="hidden" name="id" value={item.id} />}
      <label>
        {colLabel("Name", compact)}
        <input name="name" required maxLength={80} defaultValue={item?.name} />
      </label>
      <label className="edit-line">
        {colLabel("Description", compact)}
        <input
          name="description"
          placeholder={compact ? "Description (optional)" : undefined}
          maxLength={300}
          defaultValue={item?.description}
        />
      </label>
      <label>
        {colLabel("Type", compact)}
        <select name="kind" defaultValue={item?.kind ?? "extra"}>
          <option value="extra">Extra</option>
          <option value="package">Package</option>
        </select>
      </label>
      <label>
        {colLabel("Price (₱)", compact)}
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
        {colLabel("Charged", compact)}
        <select name="pricing" defaultValue={item?.pricing ?? "per_stay"}>
          {extraPricing.map((p) => (
            <option key={p} value={p}>
              {pricingLabel(p)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {colLabel("Max per booking", compact)}
        <input
          name="maxQuantity"
          type="number"
          required
          min={1}
          max={20}
          defaultValue={item?.max_quantity ?? 1}
        />
      </label>
      <label className="edit-check">
        <input
          name="active"
          type="checkbox"
          defaultChecked={item?.active ?? true}
        />
        {colLabel("Active", compact)}
      </label>
      <button className="button">{item ? "Save" : "Add item"}</button>
    </form>
  );
}

export default async function Extras({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; kind?: string }>;
}) {
  await requireStaff(true);
  const [{ notice, error, kind }, extras] = await Promise.all([
    searchParams,
    getExtras(false),
  ]);
  const message = messages[error ?? notice ?? ""];
  const groups = [
    ["extra", "Extras"],
    ["package", "Packages"],
  ] as const;
  const shown = groups.find(([k]) => k === kind)?.[0];
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
      <AddCard title="Add an extra or package">
        <ExtraForm />
      </AddCard>
      <FilterTabs
        label="Extras and packages"
        tabs={[
          {
            label: "All",
            count: extras.length,
            href: "/admin/extras",
            active: !shown,
          },
          ...groups.map(([k, label]) => ({
            label,
            count: extras.filter((e) => e.kind === k).length,
            href: "/admin/extras?kind=" + k,
            active: shown === k,
          })),
        ]}
      />
      {groups
        .filter(([k]) => !shown || k === shown)
        .map(([k, label]) => {
          const items = extras.filter((e) => e.kind === k);
          return (
            <SectionCard
              key={k}
              title={label}
              count={items.length}
              head={[
                "Name",
                "Type",
                "Price (₱)",
                "Charged",
                "Max",
                "Active",
                "",
              ]}
              cols="minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 1.2fr) minmax(0, 0.7fr) auto auto"
            >
              {items.map((e) => (
                <ExtraForm key={e.id} item={e} />
              ))}
            </SectionCard>
          );
        })}
    </>
  );
}
