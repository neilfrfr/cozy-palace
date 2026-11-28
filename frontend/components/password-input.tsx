"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useFieldProblem } from "@/components/field-problem";

export function PasswordInput({
  visibilityLabel = "password",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { visibilityLabel?: string }) {
  const [visible, setVisible] = useState(false);
  const { field, message } = useFieldProblem();
  return (
    <>
      <span className="password-field">
        <input {...props} {...field} type={visible ? "text" : "password"} />
        <button
          type="button"
          className="password-toggle"
          aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? (
            <EyeOff size={20} aria-hidden="true" />
          ) : (
            <Eye size={20} aria-hidden="true" />
          )}
        </button>
      </span>
      {message}
    </>
  );
}
