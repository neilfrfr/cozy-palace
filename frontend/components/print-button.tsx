"use client";
/** Opens the browser print dialog, where "Save as PDF" makes the PDF. */
export function PrintButton() {
  return (
    <button
      type="button"
      className="button secondary"
      onClick={() => window.print()}
    >
      Print or save as PDF
    </button>
  );
}
