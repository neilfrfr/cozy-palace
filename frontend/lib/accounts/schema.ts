import { z } from "zod";
const fullName = z.string().trim().min(1).max(100);
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));
export const passwordSchema = z
  .object({
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .strict()
  .refine((p) => p.password === p.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });
export const signupSchema = z
  .object({
    fullName,
    email: emailSchema,
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .strict()
  .refine((p) => p.password === p.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });
export const staffSchema = z
  .object({
    fullName,
    email: emailSchema,
    jobTitle: z.string().trim().min(1).max(100),
  })
  .strict();
export const profileSchema = z
  .object({
    fullName,
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[0-9+() .-]*$/),
  })
  .strict();
