"use client";
import { useConfirm } from "@/components/confirm-dialog";

type DeleteAction = (formData: FormData) => void | Promise<void>;

export function ConfirmDeleteButton({
  action,
  title,
  message,
  label = "Delete",
}: {
  action: DeleteAction;
  title: string;
  message: string;
  label?: string;
}) {
  const [ask, dialog] = useConfirm();
  return (
    <>
      <button
        className="button secondary"
        formAction={action}
        formNoValidate
        onClick={async (event) => {
          event.preventDefault();
          const button = event.currentTarget;
          if (
            await ask({ title, message, confirmLabel: label, danger: true })
          )
            button.form?.requestSubmit(button);
        }}
      >
        {label}
      </button>
      {dialog}
    </>
  );
}
