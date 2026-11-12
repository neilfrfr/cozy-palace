import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const owner = "f0000000-0000-4000-8000-000000000001",
  staff = "f0000000-0000-4000-8000-000000000002",
  admin = "f0000000-0000-4000-8000-000000000003";
// Room 101 (Garden Deluxe) and room 201 in the seed.
const room = "10000000-0000-4000-8000-000000000001",
  room201 = "10000000-0000-4000-8000-000000000002";
let n = 0;
const key = () => `f1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const day = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
async function as(role: string, user: string | null, sql: string, args: unknown[] = []) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
type Order = { id: string; total: string; version: number; room_id: string | null; reservation_id: string | null; staff_id: string; paid_at: string | null };
let menu: Record<string, string>;
const items = (lines: [string, number][]) => JSON.stringify(lines.map(([name, quantity]) => ({ item: menu[name], quantity })));
const charge = async (roomNumber: string, lines: [string, number][], user = staff) =>
  ((await as("authenticated", user, "select create_order($1,null,null,$2,$3) as o", [items(lines), key(), roomNumber])).rows[0] as { o: Order }).o;
const stay = async (roomId: string, offset: number) => {
  const { r } = (
    await as("authenticated", owner, "select create_reservation($1,$2::date,$3::date,2,$4) as r", [roomId, day(offset), day(offset + 2), key()])
  ).rows[0] as { r: { id: string; reference: string } };
  return r;
};
const checkIn = (id: string) => db.query("update reservations set status='checked_in' where id=$1", [id]);
const notes = async (reservation: string) =>
  (
    await db.query<{ event: string; email: string | null; order_id: string | null; amount: string | null }>(
      "select event,email,order_id,amount from notifications where reservation_id=$1 order by created_at,event",
      [reservation],
    )
  ).rows;
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role service_role nologin bypassrls;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec("drop trigger reservations_pending_limit on public.reservations");
  await db.query(
    "insert into auth.users(id,email) values ($1,'guest@example.test'),($2,'desk@example.test'),($3,'boss@example.test')",
    [owner, staff, admin],
  );
  await db.query("insert into staff_roles(user_id,role) values($1,'staff'),($2,'admin')", [staff, admin]);
  menu = Object.fromEntries((await db.query<{ name: string; id: string }>("select name,id from menu_items")).rows.map((m) => [m.name, m.id]));
}, 60000);
afterAll(async () => {
  await db?.close();
});

it("a room number resolves to the stay checked in to that room, and the charge waits on its bill", async () => {
  await expect(charge("101", [["Halo-halo", 1]])).rejects.toThrow("NO_CURRENT_STAY");
  await expect(charge("999", [["Halo-halo", 1]])).rejects.toThrow("NO_CURRENT_STAY");
  const r = await stay(room, 10);
  // Booked but not checked in yet: still no current stay.
  await expect(charge("101", [["Halo-halo", 1]])).rejects.toThrow("NO_CURRENT_STAY");
  await checkIn(r.id);
  const o = await charge(" 101 ", [["Halo-halo", 2]]);
  expect(o).toMatchObject({ room_id: room, reservation_id: r.id, staff_id: staff, paid_at: null });
  expect(Number(o.total)).toBeGreaterThan(0);
  // Either a booking number or a room number, not both; customers can't charge rooms.
  await expect(
    as("authenticated", staff, "select create_order($1,$2,null,$3,'101')", [items([["Halo-halo", 1]]), r.reference, key()]),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(charge("101", [["Halo-halo", 1]], owner)).rejects.toThrow("FORBIDDEN");
  // Room charges are paid only by settling the bill.
  await expect(as("authenticated", staff, "select mark_order_paid($1,$2,'cash',null)", [o.id, o.version])).rejects.toThrow(
    "INVALID_TRANSITION",
  );
  expect((await notes(r.id)).filter((x) => x.order_id)).toEqual([
    { event: "room_charge", email: "guest@example.test", order_id: o.id, amount: null },
  ]);
});

it("settling the room bill pays every open charge once, records who, logs it and emails the guest", async () => {
  const r = await stay(room201, 20);
  await checkIn(r.id);
  const a = await charge("201", [["Premium Wine", 1]]);
  const b = await charge("201", [["Halo-halo", 1]]);
  const c = await charge("201", [["Fruit Smoothie", 1]]);
  await as("authenticated", staff, "select transition_order($1,$2,'cancelled')", [c.id, c.version]);
  await expect(as("authenticated", owner, "select settle_room_bill($1,'cash',null)", [r.id])).rejects.toThrow("FORBIDDEN");
  await expect(as("authenticated", staff, "select settle_room_bill($1,'barter',null)", [r.id])).rejects.toThrow("INVALID_INPUT");
  const { s } = (await as("authenticated", staff, "select settle_room_bill($1,'card',' 7788 ') as s", [r.id])).rows[0] as {
    s: { orders: number; amount: string };
  };
  expect(s.orders).toBe(2);
  expect(Number(s.amount)).toBe(Number(a.total) + Number(b.total));
  const rows = (
    await db.query("select paid_by,payment_method,payment_reference,paid_at is not null as paid from orders where reservation_id=$1 order by paid", [r.id])
  ).rows;
  expect(rows).toEqual([
    { paid_by: null, payment_method: null, payment_reference: null, paid: false },
    { paid_by: staff, payment_method: "card", payment_reference: "7788", paid: true },
    { paid_by: staff, payment_method: "card", payment_reference: "7788", paid: true },
  ]);
  expect((await db.query("select actor_id,action from audit_logs where record_id=$1 and action='room_bill_settled'", [r.id])).rows).toEqual([
    { actor_id: staff, action: "room_bill_settled" },
  ]);
  const events = (await notes(r.id)).filter((x) => x.order_id || x.amount).map((x) => [x.event, x.amount && Number(x.amount)]);
  expect(events).toEqual([
    ["room_charge", null],
    ["room_charge", null],
    ["room_charge", null],
    ["order_updated", null],
    ["bill_settled", Number(s.amount)],
  ]);
  // Nothing left to settle.
  await expect(as("authenticated", staff, "select settle_room_bill($1,'cash',null)", [r.id])).rejects.toThrow("INVALID_TRANSITION");
  // A booking that is not in-house has no bill to settle.
  const later = await stay(room201, 40);
  await expect(as("authenticated", staff, "select settle_room_bill($1,'cash',null)", [later.id])).rejects.toThrow("INVALID_TRANSITION");
});

it("orders by booking number, counter payments, online payments and partial refunds each email the guest", async () => {
  const r = await stay(room, 60);
  const o = ((await as("authenticated", staff, "select create_order($1,$2,null,$3) as o", [items([["Halo-halo", 1]]), r.reference, key()])).rows[0] as { o: Order }).o;
  await as("authenticated", staff, "select mark_order_paid($1,$2,'cash',null)", [o.id, o.version]);
  // Walk-in orders have no guest to tell.
  const before = Number((await db.query("select count(*) as c from notifications")).rows[0].c);
  await as("authenticated", staff, "select create_order($1,null,null,$2)", [items([["Halo-halo", 1]]), key()]);
  expect(Number((await db.query("select count(*) as c from notifications")).rows[0].c)).toBe(before);

  const { p } = (
    await db.query("insert into payments(reservation_id,amount,provider_payment_id) values($1,1000,'inv_b6') returning id as p", [r.id])
  ).rows[0] as { p: string };
  await db.query("update payments set status='paid',amount_paid=1000,paid_at=now() where id=$1", [p]);
  await db.query("update reservations set status='cancelled' where id=$1", [r.id]);
  const refund = async (amount: number) => {
    const { f } = (await as("authenticated", staff, "select request_refund($1,$2) as f", [p, amount])).rows[0] as { f: { id: string } };
    await as("service_role", null, "select settle_refund($1,'succeeded','rfd',null)", [f.id]);
  };
  await refund(300);
  await refund(700);
  expect((await notes(r.id)).filter((x) => x.order_id || x.amount).map((x) => [x.event, x.amount && Number(x.amount)])).toEqual([
    ["order_placed", null],
    ["order_updated", null],
    ["paid", 1000],
    ["partially_refunded", 300],
  ]);
  expect((await notes(r.id)).map((x) => x.event)).toContain("refunded");
});

it("admins can read what the revenue report sums: payments, extras, refunds and room charges by room type", async () => {
  const pay = await as(
    "authenticated",
    admin,
    "select p.amount_paid,t.name from payments p join room_bookings b on b.reservation_id=p.reservation_id join rooms rm on rm.id=b.room_id join room_types t on t.id=rm.room_type_id where p.paid_at is not null",
  );
  expect(pay.rows.length).toBeGreaterThan(0);
  expect((await as("authenticated", admin, "select count(*)::int as c from refunds where status='succeeded'")).rows).toEqual([{ c: 2 }]);
  const charges = await as(
    "authenticated",
    admin,
    "select sum(o.total)::numeric as total from orders o join rooms rm on rm.id=o.room_id where o.paid_at is not null",
  );
  expect(Number((charges.rows[0] as { total: string }).total)).toBeGreaterThan(0);
  await as("authenticated", admin, "select count(*) from reservation_extras");
});
