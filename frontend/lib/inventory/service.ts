import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/authorize";
import type { Room } from "@/lib/reservations/types";
export type DiningTable = {
  id: string;
  table_number: string;
  capacity: number;
  operational_state: "available" | "out_of_service";
};
export type InventoryRoom = Room & {
  operational_state: "available" | "out_of_service";
};
export async function getDiningTables(): Promise<DiningTable[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("restaurant_tables")
    .select("id,table_number,capacity,operational_state")
    .order("table_number");
  if (error)
    throw new Error(
      "Dining information could not be loaded. Please try again.",
    );
  return data ?? [];
}
export async function getRoom(id: string): Promise<InventoryRoom | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("rooms")
    .select(
      "id,room_number,operational_state,room_types(id,code,name,description,capacity,nightly_rate)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new Error("Room details could not be loaded. Please try again.");
  return data as unknown as InventoryRoom | null;
}
export async function getAdminRooms(): Promise<InventoryRoom[]> {
  const { db } = await requireStaff(true);
  const { data, error } = await db
    .from("rooms")
    .select(
      "id,room_number,operational_state,room_types(id,code,name,description,capacity,nightly_rate)",
    )
    .order("room_number");
  if (error)
    throw new Error("Inventory could not be loaded. Please try again.");
  return data as unknown as InventoryRoom[];
}
export async function getAdminCounts() {
  const { db } = await requireStaff(true);
  const names = [
    "rooms",
    "restaurant_tables",
    "staff_members",
    "reservations",
  ] as const;
  const results = await Promise.all(
    names.map((name) =>
      db.from(name).select("id", { count: "exact", head: true }),
    ),
  );
  if (results.some((r) => r.error))
    throw new Error("Dashboard counts could not be loaded. Please try again.");
  return names.map((name, i) => ({ name, count: results[i].count ?? 0 }));
}
