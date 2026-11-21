"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/authorize";
import { deliverNotifications } from "@/lib/notifications";
import { publicError } from "@/lib/reservations/errors";
import { maxPhotoBytes, sniffImage, itemPhotoKey } from "@/lib/site-content";
import {
  menuItemSchema,
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
    "/purchases",
    "/admin/activity",
    "/dining",
    "/dining/menu",
    "/admin/website",
  ])
    revalidatePath(p);
  // Order and room bill changes email the guest (FR09); sending never blocks the page.
  if (!error) after(() => deliverNotifications());
  redirect(path + (error ? "?error=" + publicError(error) : "?notice=" + ok));
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
    section: form.get("section"),
    price: form.get("price"),
    available: form.get("available") === "on",
    description: form.get("description") ?? "",
  });
  if (!p.success) redirect("/admin/menu?error=INVALID_INPUT");
  let save = await db.rpc("save_menu_item", {
    p_id: p.data.id,
    p_name: p.data.name,
    p_section: p.data.section,
    p_price: p.data.price,
    p_available: p.data.available,
    p_description: p.data.description,
  });
  let descriptionMigrationMissing = false;
  if (save.error?.message.includes("save_menu_item")) {
    const legacySave = await db.rpc("save_menu_item", {
      p_id: p.data.id,
      p_name: p.data.name,
      p_section: p.data.section,
      p_price: p.data.price,
      p_available: p.data.available,
    });
    if (!legacySave.error) {
      save = legacySave;
      descriptionMigrationMissing = true;
    }
  }
  const { data, error } = save;
  if (error) done("/admin/menu", error);
  const file = form.get("file");
  if (file instanceof File && file.size) {
    if (file.size > maxPhotoBytes) redirect("/admin/menu?error=INVALID_PHOTO");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = sniffImage(bytes);
    if (!image) redirect("/admin/menu?error=INVALID_PHOTO");
    const row = data as { id?: string } | null;
    if (row?.id) {
      const key = itemPhotoKey("menu", row.id);
      const storage = db.storage.from("site-images");
      const path = `${key}/${crypto.randomUUID()}.${image.ext}`;
      const uploaded = await storage.upload(path, bytes, { contentType: image.type, cacheControl: "31536000" });
      if (uploaded.error) redirect("/admin/menu?error=PHOTO_UPLOAD_FAILED");
      const savedPhoto = await db.from("site_content").upsert({ key, value: storage.getPublicUrl(path).data.publicUrl, updated_at: new Date().toISOString() });
      if (savedPhoto.error) redirect("/admin/menu?error=PHOTO_UPLOAD_FAILED");
    }
  }
  done(
    "/admin/menu",
    null,
    descriptionMigrationMissing ? "DESCRIPTION_MIGRATION_REQUIRED" : "saved",
  );
}

export async function deleteMenuItemAction(form: FormData) {
  const { db } = await requireStaff(true);
  const id = String(form.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) redirect("/admin/menu?error=INVALID_INPUT");
  const key = itemPhotoKey("menu", id);
  const { data: storedPhoto } = await db.from("site_content").select("value").eq("key", key).maybeSingle();
  const { error } = await db.rpc("delete_menu_item", { p_id: id });
  if (error) {
    const code = error.message.includes("ITEM_HAS_ORDERS") ? "ITEM_HAS_ORDERS" : publicError(error);
    redirect("/admin/menu?error=" + code);
  }
  await db.from("site_content").delete().eq("key", key);
  if (storedPhoto?.value) {
    const url = new URL(storedPhoto.value);
    const marker = "/storage/v1/object/public/site-images/";
    const index = url.pathname.indexOf(marker);
    if (index >= 0) await db.storage.from("site-images").remove([decodeURIComponent(url.pathname.slice(index + marker.length))]);
  }
  revalidatePath("/admin/menu");
  revalidatePath("/dining");
  revalidatePath("/dining/menu");
  redirect("/admin/menu?notice=deleted");
}
