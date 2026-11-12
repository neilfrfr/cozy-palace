"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/authorize";
import { publicError } from "@/lib/reservations/errors";
import {
  closureSchema,
  roomTypeSchema,
  tableSchema,
} from "@/lib/inventory/forms";
import { extraSchema } from "@/lib/extras";

type Page = "/admin/rooms" | "/admin/tables" | "/admin/extras";
const page = (form: FormData): Page =>
  form.get("page") === "/admin/tables" ? "/admin/tables" : "/admin/rooms";

function done(
  path: Page,
  error: { message?: string } | null,
  ok: string,
): never {
  for (const p of [path, "/admin/activity", "/rooms", "/dining"])
    revalidatePath(p);
  redirect(path + (error ? "?error=" + publicError(error) : "?notice=" + ok));
}

export async function saveRoomTypeAction(form: FormData) {
  const { db } = await requireStaff(true);
  const p = roomTypeSchema.safeParse({
    id: form.get("id"),
    rate: form.get("rate"),
    capacity: form.get("capacity"),
  });
  if (!p.success) redirect("/admin/rooms?error=INVALID_INPUT");
  const { error } = await db.rpc("save_room_type", {
    p_id: p.data.id,
    p_nightly_rate: p.data.rate,
    p_capacity: p.data.capacity,
  });
  done("/admin/rooms", error, "saved");
}

export async function saveTableAction(form: FormData) {
  const { db } = await requireStaff(true);
  const p = tableSchema.safeParse({
    id: form.get("id"),
    capacity: form.get("capacity"),
  });
  if (!p.success) redirect("/admin/tables?error=INVALID_INPUT");
  const { error } = await db.rpc("save_table", {
    p_id: p.data.id,
    p_capacity: p.data.capacity,
  });
  done("/admin/tables", error, "saved");
}

export async function addClosureAction(form: FormData) {
  const { db } = await requireStaff(true);
  const path = page(form);
  const p = closureSchema.safeParse({
    resource: form.get("resource"),
    from: form.get("from"),
    to: form.get("to"),
    reason: form.get("reason"),
  });
  if (!p.success) redirect(path + "?error=INVALID_INPUT");
  const room = path === "/admin/rooms";
  const { error } = await db.rpc("add_block", {
    p_room_id: room ? p.data.resource : null,
    p_table_id: room ? null : p.data.resource,
    p_from: p.data.from,
    p_to: p.data.to,
    p_reason: p.data.reason,
  });
  done(path, error, "closed");
}

export async function removeClosureAction(form: FormData) {
  const { db } = await requireStaff(true);
  const path = page(form);
  const id = String(form.get("id") ?? "");
  const { error } = await db.rpc("remove_block", { p_id: id });
  done(path, error, "reopened");
}

export async function saveExtraAction(form: FormData) {
  const { db } = await requireStaff(true);
  const p = extraSchema.safeParse({
    id: form.get("id") || null,
    name: form.get("name"),
    description: form.get("description") ?? "",
    kind: form.get("kind"),
    price: form.get("price"),
    pricing: form.get("pricing"),
    maxQuantity: form.get("maxQuantity"),
    active: form.get("active") === "on",
  });
  if (!p.success) redirect("/admin/extras?error=INVALID_INPUT");
  const { error } = await db.rpc("save_extra", {
    p_id: p.data.id,
    p_name: p.data.name,
    p_description: p.data.description,
    p_kind: p.data.kind,
    p_price: p.data.price,
    p_pricing: p.data.pricing,
    p_max_quantity: p.data.maxQuantity,
    p_active: p.data.active,
  });
  done("/admin/extras", error, "saved");
}
