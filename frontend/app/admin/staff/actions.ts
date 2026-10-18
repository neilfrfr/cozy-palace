"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/authorize";
import { staffSchema } from "@/lib/accounts/schema";
import type { AccountState } from "@/app/register/actions";
export async function staffAction(
  _state: AccountState,
  form: FormData,
): Promise<AccountState> {
  const { db } = await requireStaff(true);
  const operation = String(form.get("operation") || "");
  let name: string;
  let args: Record<string, unknown>;
  const mutation = z.object({
    id: z.uuid(),
    version: z.coerce.number().int().positive(),
  });
  if (operation === "create") {
    const p = staffSchema.safeParse({
      fullName: form.get("fullName"),
      email: form.get("email"),
      jobTitle: form.get("jobTitle"),
    });
    if (!p.success)
      return {
        message:
          "Enter a valid name, email, and job title (up to 100 characters).",
        success: false,
      };
    name = "create_staff_member";
    args = {
      p_email: p.data.email,
      p_name: p.data.fullName,
      p_title: p.data.jobTitle,
    };
  } else {
    const p = mutation.safeParse({
      id: form.get("id"),
      version: form.get("version"),
    });
    if (!p.success)
      return {
        message: "Refresh the staff directory and try again.",
        success: false,
      };
    args = { p_id: p.data.id, p_version: p.data.version };
    if (operation === "delete") {
      if (form.get("confirmDeletion") !== "on")
        return {
          message: "Confirm removal before revoking employee access.",
          success: false,
        };
      name = "delete_staff_member";
    } else if (operation === "update") {
      const fields = z
        .object({
          fullName: z.string().trim().min(1).max(100),
          jobTitle: z.string().trim().min(1).max(100),
        })
        .safeParse({
          fullName: form.get("fullName"),
          jobTitle: form.get("jobTitle"),
        });
      if (!fields.success)
        return {
          message: "Enter a name and job title of 1–100 characters.",
          success: false,
        };
      name = "update_staff_member";
      args = {
        ...args,
        p_name: fields.data.fullName,
        p_title: fields.data.jobTitle,
      };
    } else
      return { message: "This operation is not supported.", success: false };
  }
  const { error } = await db.rpc(name, args);
  if (error) {
    const messages: Record<string, string> = {
      VERSION_CONFLICT: "This record changed. Refresh before trying again.",
      DUPLICATE_EMAIL: "This email already has a staff onboarding record.",
      PROTECTED_ADMIN:
        "Administrator accounts cannot be changed through staff management.",
      NOT_FOUND: "This staff record no longer exists.",
    };
    return {
      message:
        messages[error.message] ||
        "We could not save this staff change. Please try again.",
      success: false,
    };
  }
  for (const path of ["/admin/staff", "/admin/activity", "/staff/reservations"])
    revalidatePath(path);
  return {
    message:
      operation === "create"
        ? "Staff record created. Share /staff/register with the employee. They must use this approved email, verify it, and sign in."
        : operation === "delete"
          ? "Staff record removed and employee access revoked."
          : "Staff details updated.",
    success: true,
  };
}
