'use client';
import { useState } from 'react';
import { pricingLabel, type Extra } from '@/lib/extras';
/** Keeps the established extra:<id> form contract while presenting bounded steppers. */
export function ExtrasPicker({ extras }: { extras: Extra[] }) {
  if (!extras.length) return null;
  return (
    <fieldset className="full extras-fieldset">
      <legend>Extras and packages (optional)</legend>
      <div className="extras-grid">
        {extras.map((extra) => <ExtraCard key={extra.id} extra={extra} />)}
      </div>
    </fieldset>
  );
}
function ExtraCard({ extra }: { extra: Extra }) {
  const [quantity, setQuantity] = useState(0);
  return (
    <article className={`extra-card${quantity > 0 ? ' is-selected' : ''}`}>
      <div className="extra-card-copy">
        <div className="extra-card-heading">
          <strong>{extra.name}</strong>
          <span className="extra-price">₱{Number(extra.price).toLocaleString('en-PH')} / {pricingLabel(extra.pricing)}</span>
        </div>
        {extra.description && <p>{extra.description}</p>}
      </div>
      <span className="extra-limit">Up to {extra.max_quantity}</span>
      <div className="quantity-stepper" aria-label={`${extra.name} quantity`}>
        <button type="button" aria-label={`Remove one ${extra.name}`} disabled={quantity === 0} onClick={() => setQuantity((n) => Math.max(0, n - 1))}>−</button>
        <output aria-live="polite">{quantity}</output>
        <button type="button" aria-label={`Add one ${extra.name}`} disabled={quantity >= extra.max_quantity} onClick={() => setQuantity((n) => Math.min(extra.max_quantity, n + 1))}>+</button>
      </div>
      <input type="hidden" name={`extra:${extra.id}`} value={quantity} readOnly />
    </article>
  );
}
