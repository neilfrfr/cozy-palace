"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/authorize";
import { publicError } from "@/lib/reservations/errors";
import { menuItemSchema, orderLines, orderSchema } from "@/lib/orders";

// Plain form posts; the outcome comes back as ?notice= or ?error= so the pages need no client code.
function done(
  path: string,
  error?: { message?: string } | null,
  ok = "saved",
): never {
  for (const p of [
    "/staff/orders",
    "/admin/menu",
    "/purchases",
    "/admin/activity",
  ])
    revalidatePath(p);
  redirect(path + (error ? "?error=" + publicError(error) : "?notice=" + ok));
}

export async function createOrderAction(form: FormData) {
  const { db } = await requireStaff();
  const p = orderSchema.safeParse({
    items: orderLines(form),
    reservation: form.get("reservation") ?? "",
    note: form.get("note") ?? "",
    key: form.get("key"),
  });
  if (!p.success) redirect("/staff/orders?error=INVALID_INPUT");
  const { error } = await db.rpc("create_order", {
    p_items: p.data.items,
    p_reservation_reference: p.data.reservation || null,
    p_note: p.data.note || null,
    p_idempotency_key: p.data.key,
  });
  done("/staff/orders", error, "created");
}

export async function transitionOrderAction(form: FormData) {
  const { db } = await requireStaff();
  const status = form.get("status");
  if (status !== "completed" && status !== "cancelled")
    redirect("/staff/orders?error=INVALID_INPUT");
  const { error } = await db.rpc("transition_order", {
    p_id: form.get("id"),
    p_version: Number(form.get("version")),
    p_status: status,
  });
  done("/staff/orders", error);
}

export async function saveMenuItemAction(form: FormData) {
  const { db } = await requireStaff(true);
  const p = menuItemSchema.safeParse({
    id: form.get("id") || null,
    name: form.get("name"),
    section: form.get("section"),
    price: form.get("price"),
    available: form.get("available") === "on",
  });
  if (!p.success) redirect("/admin/menu?error=INVALID_INPUT");
  const { error } = await db.rpc("save_menu_item", {
    p_id: p.data.id,
    p_name: p.data.name,
    p_section: p.data.section,
    p_price: p.data.price,
    p_available: p.data.available,
  });
  done("/admin/menu", error);
}
