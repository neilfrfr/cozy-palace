"use server";
import { revalidatePath } from "next/cache";
import { requireIdentity } from "@/lib/auth/authorize";
import { profileSchema } from "@/lib/accounts/schema";
import type { AccountState } from "@/app/register/actions";
export async function profileAction(
  _state: AccountState,
  form: FormData,
): Promise<AccountState> {
  const { db } = await requireIdentity("/account");
  const p = profileSchema.safeParse({
    fullName: form.get("fullName"),
    phone: form.get("phone"),
  });
  if (!p.success)
    return {
      message:
        "Enter a name of 1–100 characters and a valid phone number of up to 30 characters.",
      success: false,
    };
  const { error } = await db.rpc("update_profile", {
    p_name: p.data.fullName,
    p_phone: p.data.phone,
  });
  if (error)
    return {
      message: "We could not update your profile. Please try again.",
      success: false,
    };
  revalidatePath("/account");
  return { message: "Your profile has been updated.", success: true };
}
