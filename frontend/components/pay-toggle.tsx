"use client";
import { useState } from "react";

/** Shows or hides an order's Mark paid row, which sits under the order so the Actions column stays narrow. */
export function PayToggle({ target }: { target: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className="button secondary"
      aria-expanded={open}
      aria-controls={target}
      onClick={() => {
        const row = document.getElementById(target);
        if (!row) return;
        row.hidden = open;
        setOpen(!open);
        if (!open) row.querySelector("select")?.focus();
      }}
    >
      Mark paid
    </button>
  );
}
