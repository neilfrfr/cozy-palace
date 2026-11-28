import { expect, it } from "vitest";
import { problemFor } from "@/components/field-problem";
const field = (validity: Partial<ValidityState>, extra = {}) =>
  ({ validity, minLength: 8, maxLength: 25, validationMessage: "", ...extra }) as unknown as HTMLInputElement;
it("explains each kind of browser rejection in plain words", () => {
  expect(problemFor(field({ valueMissing: true }))).toBe("Fill in this field.");
  expect(problemFor(field({ typeMismatch: true }), "Bad email")).toBe("Bad email");
  expect(problemFor(field({ patternMismatch: true }), "Bad email")).toBe("Bad email");
  expect(problemFor(field({ tooShort: true }))).toBe("Use at least 8 characters.");
  expect(problemFor(field({ tooLong: true }))).toBe("Use at most 25 characters.");
  expect(
    problemFor(field({ customError: true }, { validationMessage: "Passwords don't match." })),
  ).toBe("Passwords don't match.");
});
