import { inventoryMessages } from "@/lib/inventory/forms";

/** The ?notice= or ?error= outcome of an inventory form post. */
export function InventoryNotice({
  notice,
  error,
}: {
  notice?: string;
  error?: string;
}) {
  const message =
    inventoryMessages[error ?? notice ?? ""] ??
    (error ? inventoryMessages.REQUEST_FAILED : null);
  if (!message) return null;
  return (
    <p
      className={"notice" + (error ? " error" : "")}
      role={error ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
