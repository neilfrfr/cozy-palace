"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Sign-up popup shown over the current page when a link to /register is clicked. */
export function SignupModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const close = () => router.back();
  return (
    <dialog
      ref={ref}
      className="signup-modal"
      aria-labelledby="signup-title"
      // Esc fires cancel; route back instead of only hiding the dialog.
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <button
        type="button"
        className="signup-close"
        aria-label="Close"
        onClick={close}
      >
        <X size={22} aria-hidden="true" />
      </button>
      {children}
    </dialog>
  );
}
