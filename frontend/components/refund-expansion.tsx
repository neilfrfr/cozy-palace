import { markRefundedAction } from "@/app/actions/payments";
export function RefundExpansion({ id, reference, enabled }: { id: string; reference: string; enabled: boolean }) {
  if (!enabled) return null;
  return <details className="manual-refund"><summary>Refunded in Xendit dashboard?</summary><form action={markRefundedAction} className="manual-refund-panel"><p className="subtle">Record a refund you already sent from Xendit.</p><input type="hidden" name="id" value={id} /><label><span className="hidden-label">Xendit refund ID or note for {reference}</span><input name="reference" required maxLength={200} placeholder="Xendit refund ID" /></label><button className="button secondary">Mark refunded</button></form></details>;
}
