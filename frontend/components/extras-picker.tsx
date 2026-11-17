import { pricingLabel, type Extra } from "@/lib/extras";
/** Quantity inputs named "extra:<id>", read back with extrasFromForm. */
export function ExtrasPicker({ extras }: { extras: Extra[] }) {
  if (!extras.length) return null;
  return (
    <fieldset className="full">
      <legend>Extras and packages (optional)</legend>
      <div className="form-grid">
        {extras.map((e) => (
          <label key={e.id}>
            {e.name} · ₱{Number(e.price).toLocaleString("en-PH")}{" "}
            {pricingLabel(e.pricing)}
            {e.description && <small>{e.description}</small>}
            <input
              type="number"
              name={"extra:" + e.id}
              min={0}
              max={e.max_quantity}
              defaultValue={0}
              aria-describedby={"extra-max-" + e.id}
            />
            <small id={"extra-max-" + e.id}>Up to {e.max_quantity}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
