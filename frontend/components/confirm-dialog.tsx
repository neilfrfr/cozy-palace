"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, and focus starts on Cancel. */
  danger?: boolean;
};
type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Site-styled replacement for window.confirm(). Render `dialog` once in the
 * component, then `if (!(await ask({ title: "…" }))) return;`.
 */
export function useConfirm() {
  const [request, setRequest] = useState<Request | null>(null);
  const ask = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    [],
  );
  const dialog = request && (
    <ConfirmDialog
      {...request}
      onClose={(ok) => {
        request.resolve(ok);
        setRequest(null);
      }}
    />
  );
  return [ask, dialog] as const;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={message ? "confirm-dialog-message" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
    >
      <h2 id="confirm-dialog-title">{title}</h2>
      {message && <p id="confirm-dialog-message">{message}</p>}
      <div className="confirm-dialog-actions">
        <button
          type="button"
          className="button secondary"
          autoFocus={danger}
          onClick={() => onClose(false)}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? "primary danger" : "primary"}
          autoFocus={!danger}
          onClick={() => onClose(true)}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
