"use client";
import type { ComponentProps } from "react";
import { problemFor, useFieldProblem } from "@/components/field-problem";
/** Email field that spells out the browser's rejection under the input, not only in its brief tooltip. */
export function EmailInput(props: Omit<ComponentProps<"input">, "type">) {
  const { field, message } = useFieldProblem((el) =>
    el.validity.valueMissing
      ? "Enter your email address."
      : problemFor(el, "Enter a valid email address, like name@example.com."),
  );
  return (
    <>
      <input
        {...props}
        type="email"
        // The browser alone accepts "a@b"; require a dotted domain like the server's zod check.
        pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}"
        {...field}
      />
      {message}
    </>
  );
}
