import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const customer = "e0000000-0000-4000-8000-000000000001",
  staff = "e0000000-0000-4000-8000-000000000002",
  admin = "e0000000-0000-4000-8000-000000000003";
const room = "10000000-0000-4000-8000-000000000001";
let n = 0;
const key = () => `e1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const day = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
let table: string;
async function as(user: string, sql: string, args: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
type Row = { id: string; version: number; status: string };
const draft = async (from: number, to: number) =>
  (
    (await as(customer, "select create_reservation($1,$2::date,$3::date,2,$4) as r", [room, day(from), day(to), key()]))
      .rows[0] as { r: Row }
  ).r;
const submit = (r: Row) => as(customer, "select submit_reservation($1,$2)", [r.id, r.version]);
const close = (user: string, from: number, to: number, roomId: string | null = room, tableId: string | null = null) =>
  as(user, "select add_block($1,$2,$3::date,$4::date,'Repainting') as k", [roomId, tableId, day(from), day(to)]);
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role service_role nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query(
    "insert into auth.users(id,email) values ($1,'c@example.test'),($2,'desk@example.test'),($3,'boss@example.test')",
    [customer, staff, admin],
  );
  await db.query("insert into staff_roles(user_id,role) values($1,'staff'),($2,'admin')", [staff, admin]);
  table = ((await db.query("select id from restaurant_tables order by table_number limit 1")).rows[0] as { id: string }).id;
}, 60000);
afterAll(async () => {
  await db?.close();
});

it("a closed room cannot be booked, searched or picked, and reopening frees it", async () => {
  await expect(close(staff, 50, 53)).rejects.toThrow("FORBIDDEN");
  const { k } = (await close(admin, 50, 53)).rows[0] as { k: { id: string } };
  const d = await draft(51, 52);
  await expect(submit(d)).rejects.toThrow("AVAILABILITY_CONFLICT");
  const found = await as(customer, "select id from search_availability($1::date,$2::date,1) where id=$3", [day(51), day(52), room]);
  expect(found.rows).toHaveLength(0);
  const ranges = await as(customer, "select check_in::text,check_out::text from room_booked_ranges($1::date,$2::date) where room_id=$3", [
    day(45),
    day(60),
    room,
  ]);
  expect(ranges.rows).toEqual([{ check_in: day(50), check_out: day(53) }]);
  // Nights either side of the closure stay bookable: closures are half-open like stays.
  await submit(await draft(49, 50));
  await submit(await draft(53, 54));
  await as(admin, "select remove_block($1)", [k.id]);
  const again = (await as(customer, "select * from reservations where id=$1", [d.id])).rows[0] as Row;
  await submit(again);
  const log = await db.query("select action from audit_logs where record_id=$1 order by occurred_at", [room]);
  expect(log.rows).toEqual([{ action: "inventory_closed" }, { action: "inventory_reopened" }]);
});

it("a closure over live bookings is refused until staff move them (BR12)", async () => {
  await submit(await draft(70, 72));
  await expect(close(admin, 71, 75)).rejects.toThrow("RESOURCE_HAS_BOOKINGS");
  await close(admin, 72, 75);
  await expect(close(admin, 80, 79)).rejects.toThrow("INVALID_INPUT");
  await expect(close(admin, 80, 81, room, table)).rejects.toThrow("INVALID_INPUT");
});

it("a closed table is hidden and refuses bookings for those days", async () => {
  await close(admin, 20, 21, null, table);
  const start = `${day(20)}T19:00:00+08:00`;
  expect((await as(customer, "select table_id from booked_tables($1::timestamptz)", [start])).rows).toContainEqual({ table_id: table });
  await expect(
    as(customer, "select book_table($1,$2::timestamptz,2,$3)", [table, start, key()]),
  ).rejects.toThrow("AVAILABILITY_CONFLICT");
  await as(customer, "select book_table($1,$2::timestamptz,2,$3)", [table, `${day(21)}T19:00:00+08:00`, key()]);
});

it("admins change rates and capacity; existing bookings keep their rate", async () => {
  const d = await draft(90, 92);
  const type = ((await db.query("select room_type_id as t from rooms where id=$1", [room])).rows[0] as { t: string }).t;
  await expect(as(staff, "select save_room_type($1,1,2)", [type])).rejects.toThrow("FORBIDDEN");
  await expect(as(admin, "select save_room_type($1,-1,2)", [type])).rejects.toThrow("INVALID_INPUT");
  await as(admin, "select save_room_type($1,9999.50,3)", [type]);
  const before = (await db.query("select total::numeric as t from reservations where id=$1", [d.id])).rows[0] as { t: string };
  expect(Number(before.t)).not.toBe(9999.5 * 2);
  const fresh = await draft(95, 96);
  expect(Number((fresh as unknown as { total: string }).total)).toBe(9999.5);
  await as(admin, "select save_table($1,6)", [table]);
  await expect(as(admin, "select save_table($1,0)", [table])).rejects.toThrow("INVALID_INPUT");
  const log = await db.query("select action from audit_logs where record_id in($1,$2) and action like '%updated' order by occurred_at", [type, table]);
  expect(log.rows.map((r) => (r as { action: string }).action)).toEqual(["room_type_updated", "table_updated"]);
});

it("staff mark an order paid once; a paid order cannot be cancelled", async () => {
  const item = ((await db.query("select id from menu_items limit 1")).rows[0] as { id: string }).id;
  const { o } = (
    await as(staff, "select create_order($1,null,null,$2) as o", [JSON.stringify([{ item, quantity: 1 }]), key()])
  ).rows[0] as { o: Row };
  await expect(as(customer, "select mark_order_paid($1,$2,'cash',null)", [o.id, o.version])).rejects.toThrow("FORBIDDEN");
  await expect(as(staff, "select mark_order_paid($1,$2,'barter',null)", [o.id, o.version])).rejects.toThrow("INVALID_INPUT");
  const { p } = (await as(staff, "select mark_order_paid($1,$2,'gcash',' 1234 ') as p", [o.id, o.version])).rows[0] as {
    p: Row & { payment_reference: string; paid_by: string };
  };
  expect(p.payment_reference).toBe("1234");
  expect(p.paid_by).toBe(staff);
  await expect(as(staff, "select mark_order_paid($1,$2,'cash',null)", [o.id, p.version])).rejects.toThrow("INVALID_TRANSITION");
  await expect(as(staff, "select transition_order($1,$2,'cancelled')", [o.id, p.version])).rejects.toThrow("INVALID_TRANSITION");
  await as(staff, "select transition_order($1,$2,'completed')", [o.id, p.version]);
});
