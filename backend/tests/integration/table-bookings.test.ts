import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
let n = 0;
const customer = "f0000000-0000-4000-8000-000000000001",
  other = "f0000000-0000-4000-8000-000000000002",
  staff = "f0000000-0000-4000-8000-000000000003";
const key = () => `f1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
// A week out keeps every slot in the future and inside the 180-day window.
const day = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
const at = (time: string, d = day) => `${d}T${time}:00+08:00`;
const tables: Record<string, string> = {};
type Row = { id: string; version: number; status: string; booking_source: string; kind: string };
async function as(user: string | null, sql: string, args: unknown[] = []) {
  await db.exec(user ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
async function book(user: string, table: string, start: string, guests = 2, k = key(), name: string | null = null) {
  return (
    await as(user, "select book_table($1,$2::timestamptz,$3,$4,$5) as r", [tables[table], start, guests, k, name])
  ).rows[0] as { r: Row };
}
const booked = async (start: string) =>
  ((await as(null, "select table_id from booked_tables($1::timestamptz)", [start])).rows as { table_id: string }[]).map(
    (r) => r.table_id,
  );
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create role anon nologin;create role service_role nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query(
    "insert into auth.users(id,email) values($1,'diner@example.test'),($2,'other@example.test'),($3,'host@example.test')",
    [customer, other, staff],
  );
  await db.query("insert into staff_roles(user_id,role) values($1,'staff')", [staff]);
  for (const r of (await db.query("select id,table_number from restaurant_tables")).rows as {
    id: string;
    table_number: string;
  }[])
    tables[r.table_number] = r.id;
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("a guest request holds the table and blocks overlapping seatings", async () => {
  const { r } = await book(customer, "T1", at("19:00"));
  expect(r).toMatchObject({ status: "pending", kind: "dining", booking_source: "customer_online" });
  expect(await booked(at("19:00"))).toContain(tables.T1);
  expect(await booked(at("20:30"))).toContain(tables.T1);
  expect(await booked(at("21:00"))).not.toContain(tables.T1);
  await expect(book(other, "T1", at("20:00"))).rejects.toThrow("AVAILABILITY_CONFLICT");
  expect((await book(other, "T1", at("21:00"))).r.status).toBe("pending");
});
it("rejects bad slots, oversized parties and guest contact fields from customers", async () => {
  await expect(book(customer, "T2", at("19:15"))).rejects.toThrow("INVALID_INPUT");
  await expect(book(customer, "T2", at("15:00"))).rejects.toThrow("INVALID_INPUT");
  await expect(book(customer, "T2", at("19:00", "2020-01-01"))).rejects.toThrow("INVALID_INPUT");
  await expect(book(customer, "P4", at("19:00"), 3)).rejects.toThrow("CAPACITY_EXCEEDED");
  await expect(book(customer, "T2", at("19:00"), 2, key(), "Someone")).rejects.toThrow("INVALID_INPUT");
});
it("replays the same request and rejects a reused key with new details", async () => {
  const k = key();
  const first = await book(customer, "T3", at("12:00"), 2, k);
  expect((await book(customer, "T3", at("12:00"), 2, k)).r.id).toBe(first.r.id);
  await expect(book(customer, "T3", at("12:00"), 3, k)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
});
it("only the owner cancels, which frees the table", async () => {
  const { r } = await book(customer, "T4", at("18:00"));
  await expect(as(other, "select cancel_table_booking($1,$2)", [r.id, r.version])).rejects.toThrow("FORBIDDEN");
  await expect(as(staff, "select cancel_table_booking($1,$2)", [r.id, r.version])).rejects.toThrow("FORBIDDEN");
  const done = (await as(customer, "select cancel_table_booking($1,$2) as r", [r.id, r.version])).rows[0] as { r: Row };
  expect(done.r.status).toBe("cancelled");
  expect(await booked(at("18:00"))).not.toContain(tables.T4);
});
it("staff book walk-ins confirmed and move statuses at their discretion", async () => {
  const { r } = await book(staff, "T5", at("19:00"), 4, key(), "Walk-in Party");
  expect(r).toMatchObject({ status: "confirmed", booking_source: "staff_guest" });
  await expect(book(staff, "T6", at("19:00"))).rejects.toThrow("INVALID_INPUT");
  await expect(
    as(customer, "select set_table_booking_status($1,$2,'confirmed')", [r.id, r.version]),
  ).rejects.toThrow("FORBIDDEN");
  // Seating is only for the booking's own day.
  await expect(as(staff, "select set_table_booking_status($1,$2,'seated')", [r.id, r.version])).rejects.toThrow(
    "POLICY_RESTRICTED",
  );
  const set = async (status: string, version: number) =>
    ((await as(staff, "select set_table_booking_status($1,$2,$3) as r", [r.id, version, status])).rows[0] as { r: Row })
      .r;
  const cancelled = await set("cancelled", r.version);
  expect(await booked(at("19:00"))).not.toContain(tables.T5);
  const reopened = await set("confirmed", cancelled.version);
  expect(await booked(at("19:00"))).toContain(tables.T5);
  await db.query(
    "update table_bookings set start_at=now()-interval '30 minutes',end_at=now()+interval '90 minutes' where reservation_id=$1",
    [r.id],
  );
  const seated = await set("seated", reopened.version);
  expect((await set("completed", seated.version)).status).toBe("completed");
  await expect(set("confirmed", seated.version)).rejects.toThrow("VERSION_CONFLICT");
});
it("a lapsed hold no longer blocks the table", async () => {
  const { r } = await book(customer, "T7", at("13:00"));
  await db.query("update reservations set hold_expires_at=now()-interval '1 minute' where id=$1", [r.id]);
  expect(await booked(at("13:00"))).not.toContain(tables.T7);
  expect((await book(other, "T7", at("13:00"))).r.status).toBe("pending");
  expect((await db.query("select status from reservations where id=$1", [r.id])).rows[0]).toEqual({ status: "expired" });
});
it("room operations refuse dining reservations", async () => {
  const { r } = await book(customer, "T8", at("19:00"));
  await expect(
    as(customer, "select update_reservation($1,$2,$3,$4::date,$5::date,2)", [
      r.id,
      r.version,
      "10000000-0000-4000-8000-000000000001",
      day,
      day,
    ]),
  ).rejects.toThrow("NOT_FOUND");
  await expect(as(staff, "select transition_reservation($1,$2,'confirmed')", [r.id, r.version])).rejects.toThrow(
    "NOT_FOUND",
  );
});
