"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/authorize";
import { deliverNotifications } from "@/lib/notifications";
import { publicError } from "@/lib/reservations/errors";
import { itemPhotoKey } from "@/lib/site-content";
import { readPhoto, storePhoto } from "@/lib/site-photos";
import { z } from "zod";
import {
  menuItemSchema,
  menuSectionSchema,
  orderLines,
  orderPaymentSchema,
  orderSchema,
  roomBillSchema,
} from "@/lib/orders";

// Every page that shows menu or order data.
function refresh() {
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
}

// Plain form posts; the outcome comes back as ?notice= or ?error= so the pages need no client code.
function done(
  path: string,
  error?: { message?: string } | null,
  ok = "saved",
): never {
  refresh();
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
  });
  if (!p.success) redirect(menuPage(form) + "error=INVALID_INPUT");
  // The add form may carry a photo; check it before the item exists.
  const file = form.get("photo");
  const photo = file instanceof File && file.size ? await readPhoto(file) : null;
  if (file instanceof File && file.size && !photo) redirect(menuPage(form) + "error=INVALID_PHOTO");
  const { data, error } = await db.rpc("save_menu_item", {
    p_id: p.data.id,
    p_name: p.data.name,
    p_description: p.data.description,
    p_section: p.data.section,
    p_price: p.data.price,
    p_available: p.data.available,
  });
  if (!error && photo) {
    const failed = await storePhoto(db, itemPhotoKey("menu", (data as { id: string }).id), photo);
    if (failed) redirect(menuPage(form) + "error=REQUEST_FAILED");
  }
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

const idOrder = z.array(z.string().uuid()).min(1).max(500);
/**
 * Saves a dragged order and refreshes the page in place, so it keeps its scroll and focus.
 * Returns the error code, or null. `ids` comes from the browser.
 */
export async function reorderMenuAction(kind: "item" | "section", ids: string[]) {
  const { db } = await requireStaff(true);
  const p = idOrder.safeParse(ids);
  if (!p.success) return "INVALID_INPUT";
  const fn = kind === "section" ? "reorder_menu_sections" : "reorder_menu_items";
  const { error } = await db.rpc(fn, { p_ids: p.data });
  refresh();
  return error ? publicError(error) : null;
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
