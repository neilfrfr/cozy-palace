import { it, expect } from "vitest";
import {
  signupSchema,
  staffSchema,
  profileSchema,
  passwordSchema,
} from "@/lib/accounts/schema";
it("validates customer signup and never accepts a requested role", () => {
  const input = {
    fullName: " Neil ",
    email: " NEIL@example.test ",
    password: "LongPassword123!",
    confirmPassword: "LongPassword123!",
  };
  expect(signupSchema.parse(input).email).toBe("neil@example.test");
  expect(signupSchema.safeParse({ ...input, role: "admin" }).success).toBe(
    false,
  );
  expect(
    signupSchema.safeParse({ ...input, confirmPassword: "different" }).success,
  ).toBe(false);
});
it("rejects weak or mismatched password submissions", () => {
  expect(
    passwordSchema.safeParse({ password: "short", confirmPassword: "short" })
      .success,
  ).toBe(false);
  expect(
    passwordSchema.safeParse({
      password: "LongPassword123!",
      confirmPassword: "LongPassword123!",
    }).success,
  ).toBe(true);
});
it("staff and profile inputs reject blank names and overlong fields", () => {
  expect(
    staffSchema.safeParse({
      fullName: "",
      email: "staff@example.test",
      jobTitle: "Desk",
    }).success,
  ).toBe(false);
  expect(
    profileSchema.safeParse({ fullName: "Guest", phone: "x".repeat(31) })
      .success,
  ).toBe(false);
});
