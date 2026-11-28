"use client";
import { useId, useState, type ComponentProps, type FormEvent } from "react";
import { CircleAlert } from "lucide-react";
/** Plain words for why the browser rejected a field; `typo` covers a wrong email format. */
export function problemFor(el: HTMLInputElement, typo = "Check this entry.") {
  const v = el.validity;
  if (v.valueMissing) return "Fill in this field.";
  if (v.typeMismatch || v.patternMismatch) return typo;
  if (v.tooShort) return `Use at least ${el.minLength} characters.`;
  if (v.tooLong) return `Use at most ${el.maxLength} characters.`;
  if (v.customError) return el.validationMessage;
  return typo;
}
/**
 * Shows the browser's rejection under the field instead of its tooltip, which covers the page.
 * Spread `field` on the input and render `message` after it.
 */
export function useFieldProblem(
  explain: (el: HTMLInputElement) => string = (el) => problemFor(el),
) {
  const id = useId();
  const [problem, setProblem] = useState("");
  return {
    field: {
      "aria-invalid": problem ? true : undefined,
      "aria-describedby": problem ? id : undefined,
      onInvalid: (event: FormEvent<HTMLInputElement>) => {
        const el = event.currentTarget;
        event.preventDefault();
        // Keep the browser's jump to the first rejected field.
        if (el.form?.querySelector(":invalid") === el) el.focus();
        setProblem(explain(el));
      },
      onInput: () => setProblem(""),
    },
    message: problem ? (
      <span id={id} role="alert" className="field-hint error field-problem">
        <CircleAlert size={15} aria-hidden="true" />
        {problem}
      </span>
    ) : null,
  };
}
/** A text input that explains its own rejection. */
export function FieldInput(props: ComponentProps<"input">) {
  const { field, message } = useFieldProblem();
  return (
    <>
      <input {...props} {...field} />
      {message}
    </>
  );
}
