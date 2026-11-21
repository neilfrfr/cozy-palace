"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/authorize";
import { deliverNotifications } from "@/lib/notifications";
import { publicError } from "@/lib/reservations/errors";
import {
  menuItemSchema,
  menuSectionSchema,
  orderLines,
  orderPaymentSchema,
  orderSchema,
  roomBillSchema,
} from "@/lib/orders";

// Plain form posts; the outcome comes back as ?notice= or ?error= so the pages need no client code.
function done(
  path: string,
  error?: { message?: string } | null,
  ok = "saved",
): never {
  for (const p of [
    "/staff/orders",
    "/admin/menu",
    "/admin/website",
    "/dining",
    "/dining/menu",
    "/purchases",
    "/admin/activity",
  ])
    revalidatePath(p);
  // Order and room bill changes email the guest (FR09); sending never blocks the page.
  if (!error) after(() => deliverNotifications());
  const sep = path.endsWith("?") || path.endsWith("&") ? "" : "?";
  redirect(path + sep + (error ? "error=" + publicError(error) : "notice=" + ok));
}

export async function createOrderAction(form: FormData) {
  const { db } = await requireStaff();
  const p = orderSchema.safeParse({
    items: orderLines(form),
    reservation: form.get("reservation") ?? "",
    room: form.get("room") ?? "",
    note: form.get("note") ?? "",
    key: form.get("key"),
  });
  if (!p.success) redirect("/staff/orders?error=INVALID_INPUT");
  const { error } = await db.rpc("create_order", {
    p_items: p.data.items,
    p_reservation_reference: p.data.reservation || null,
    p_note: p.data.note || null,
    p_idempotency_key: p.data.key,
    p_room_number: p.data.room || null,
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

export async function markOrderPaidAction(form: FormData) {
  const { db } = await requireStaff();
  const p = orderPaymentSchema.safeParse({
    id: form.get("id"),
    version: form.get("version"),
    method: form.get("method"),
    reference: form.get("reference") ?? "",
  });
  if (!p.success) redirect("/staff/orders?error=INVALID_INPUT");
  const { error } = await db.rpc("mark_order_paid", {
    p_id: p.data.id,
    p_version: p.data.version,
    p_method: p.data.method,
    p_reference: p.data.reference || null,
  });
  done("/staff/orders", error, "paid");
}

/** Front desk takes payment for all of a stay's open room charges at check-out. */
export async function settleRoomBillAction(form: FormData) {
  const { db } = await requireStaff();
  const p = roomBillSchema.safeParse({
    id: form.get("id"),
    method: form.get("method"),
    reference: form.get("reference") ?? "",
  });
  if (!p.success) redirect("/staff/reservations?error=INVALID_INPUT");
  const { error } = await db.rpc("settle_room_bill", {
    p_reservation_id: p.data.id,
    p_method: p.data.method,
    p_reference: p.data.reference || null,
  });
  done("/staff/reservations/" + p.data.id, error, "settled");
}

export async function saveMenuItemAction(form: FormData) {
  const { db } = await requireStaff(true);
  const p = menuItemSchema.safeParse({
    id: form.get("id") || null,
    name: form.get("name"),
    description: form.get("description") ?? "",
    section: form.get("section"),
    price: form.get("price"),
    available: form.get("available") === "on",
    on_website: form.get("on_website") === "on",
  });
  if (!p.success) redirect(menuPage(form) + "error=INVALID_INPUT");
  const { error } = await db.rpc("save_menu_item", {
    p_id: p.data.id,
    p_name: p.data.name,
    p_description: p.data.description,
    p_section: p.data.section,
    p_price: p.data.price,
    p_available: p.data.available,
    p_on_website: p.data.on_website,
  });
  done(menuPage(form), error);
}

// Keeps the admin on the tab they were working in.
function menuPage(form: FormData) {
  const tab = String(form.get("tab") ?? "");
  return "/admin/menu" + (tab ? "?tab=" + encodeURIComponent(tab) + "&" : "?");
}

/** First press archives the item; on an archived item it deletes it for good. */
export async function deleteMenuItemAction(form: FormData) {
  const { db } = await requireStaff(true);
  const { error } = await db.rpc("delete_menu_item", { p_id: String(form.get("id") ?? "") });
  done(menuPage(form), error, form.get("archived") ? "deleted" : "archived");
}

export async function restoreMenuItemAction(form: FormData) {
  const { db } = await requireStaff(true);
  const { error } = await db.rpc("restore_menu_item", { p_id: String(form.get("id") ?? "") });
  done(menuPage(form), error, "unarchived");
}

// Two actions, because React drops name/value on a button whose formAction is a function.
async function moveMenu(form: FormData, up: boolean) {
  const { db } = await requireStaff(true);
  const fn = form.get("kind") === "section" ? "move_menu_section" : "move_menu_item";
  const { error } = await db.rpc(fn, { p_id: String(form.get("id") ?? ""), p_up: up });
  done(menuPage(form), error);
}
export async function moveMenuUpAction(form: FormData) {
  await moveMenu(form, true);
}
export async function moveMenuDownAction(form: FormData) {
  await moveMenu(form, false);
}

export async function saveMenuSectionAction(form: FormData) {
  const { db } = await requireStaff(true);
  const p = menuSectionSchema.safeParse({
    id: form.get("id") || null,
    name: form.get("name"),
    description: form.get("description") ?? "",
  });
  if (!p.success) redirect(menuPage(form) + "error=INVALID_INPUT");
  const { error } = await db.rpc("save_menu_section", {
    p_id: p.data.id,
    p_name: p.data.name,
    p_description: p.data.description,
  });
  done(menuPage(form), error);
}

export async function deleteMenuSectionAction(form: FormData) {
  const { db } = await requireStaff(true);
  const { error } = await db.rpc("delete_menu_section", { p_id: String(form.get("id") ?? "") });
  done(menuPage(form), error, "deleted");
}
