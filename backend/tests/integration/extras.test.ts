import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const owner = "e0000000-0000-4000-8000-000000000001",
  staff = "e0000000-0000-4000-8000-000000000002",
  admin = "e0000000-0000-4000-8000-000000000003";
// Room 101 is a Garden Deluxe at 3200 a night in the seed.
const room = "10000000-0000-4000-8000-000000000001";
let n = 0;
const key = () => `e1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
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
type Booking = { id: string; version: number; total: string };
let extra: Record<string, string>;
const pick = (lines: [string, number][]) => JSON.stringify(lines.map(([name, quantity]) => ({ id: extra[name], quantity })));
const book = async (offset: number, lines: [string, number][], nights = 2, k = key()) =>
  (
    (
      await as("authenticated", owner, "select create_reservation($1,$2::date,$3::date,2,$4,$5::jsonb) as r", [
        room,
        day(offset),
        day(offset + nights),
        k,
        pick(lines),
      ])
    ).rows[0] as { r: Booking }
  ).r;
const snapshot = async (id: string) =>
  (
    await db.query<{ name: string; unit_price: string; pricing: string; quantity: number; line_total: string }>(
      "select name,unit_price,pricing,quantity,line_total from reservation_extras where reservation_id=$1 order by name",
      [id],
    )
  ).rows;
const save = (user: string, args: unknown[]) =>
  as("authenticated", user, "select save_extra($1,$2,$3,$4,$5,$6,$7,$8) as e", args);
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role service_role nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
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
  extra = Object.fromEntries(
    (await db.query<{ name: string; id: string }>("select name,id from extras")).rows.map((e) => [e.name, e.id]),
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});

it("adds per-night extras for every night and per-stay extras once, priced by the database", async () => {
  // 2 nights: room 6400 + mattress 800×1×2 + bedding 300×2 = 8600.
  const r = await book(10, [
    ["Extra mattress", 1],
    ["Extra bedding", 2],
  ]);
  expect(Number(r.total)).toBe(8600);
  expect(await snapshot(r.id)).toEqual([
    { name: "Extra bedding", unit_price: "300.00", pricing: "per_stay", quantity: 2, line_total: "600.00" },
    { name: "Extra mattress", unit_price: "800.00", pricing: "per_night", quantity: 1, line_total: "1600.00" },
  ]);
  // A booking without extras costs the room alone.
  expect(Number((await book(14, [])).total)).toBe(6400);
});

it("the checkout invoice charges the total with extras", async () => {
  const r = await book(20, [["Amenity kit", 2]]);
  const { s } = (
    await as("authenticated", owner, "select submit_reservation($1,$2) as s", [r.id, r.version])
  ).rows[0] as { s: Booking };
  const { p } = (await as("authenticated", owner, "select open_payment($1) as p", [s.id])).rows[0] as {
    p: { amount: string };
  };
  expect(Number(p.amount)).toBe(6400 + 500);
});

it("rejects inactive items, unknown ids, repeats and quantities outside 1..max", async () => {
  await db.query("update extras set active=false where name='Amenity kit'");
  try {
    for (const lines of [
      JSON.stringify([{ id: extra["Amenity kit"], quantity: 1 }]),
      JSON.stringify([{ id: extra["Extra mattress"], quantity: 3 }]),
      JSON.stringify([{ id: extra["Extra mattress"], quantity: 0 }]),
      JSON.stringify([{ id: extra["Extra mattress"], quantity: "x" }]),
      JSON.stringify([{ id: "e9000000-0000-4000-8000-000000000000", quantity: 1 }]),
      JSON.stringify([
        { id: extra["Extra bedding"], quantity: 1 },
        { id: extra["Extra bedding"], quantity: 1 },
      ]),
      '{"id":1}',
    ])
      await expect(
        as("authenticated", owner, "select create_reservation($1,$2::date,$3::date,2,$4,$5::jsonb)", [
          room,
          day(30),
          day(32),
          key(),
          lines,
        ]),
      ).rejects.toThrow("INVALID_INPUT");
    expect((await db.query("select 1 from room_bookings where check_in=$1", [day(30)])).rows).toHaveLength(0);
  } finally {
    await db.query("update extras set active=true where name='Amenity kit'");
  }
});

it("a replay returns the same booking; different extras are refused", async () => {
  const k = key();
  const first = await book(40, [["Extra bedding", 1]], 2, k);
  expect(await book(40, [["Extra bedding", 1]], 2, k)).toEqual(first);
  await expect(book(40, [["Extra bedding", 2]], 2, k)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  expect(await snapshot(first.id)).toHaveLength(1);
});

it("bookings keep their extras' prices; changing the dates reprices per-night ones", async () => {
  const r = await book(50, [
    ["Extra mattress", 1],
    ["Extra bedding", 1],
  ]);
  await db.query("update extras set price=price*10");
  try {
    const { u } = (
      await as("authenticated", owner, "select update_reservation($1,$2,$3,$4::date,$5::date,2) as u", [
        r.id,
        r.version,
        room,
        day(50),
        day(53),
      ])
    ).rows[0] as { u: Booking };
    // 3 nights: room 9600 + mattress 800×3 + bedding 300 at the old prices.
    expect(Number(u.total)).toBe(9600 + 2400 + 300);
  } finally {
    await db.query("update extras set price=price/10");
  }
});

it("visitors' bookings include their extras", async () => {
  const { b } = (
    await as(
      "service_role",
      null,
      "select book_as_guest($1,$2::date,$3::date,2,'Walk In','walkin@example.test','+639171234567',$4,'10.9.9.9',$5::jsonb) as b",
      [room, day(60), day(62), key(), pick([["Breakfast package", 1]])],
    )
  ).rows[0] as { b: { id: string } };
  const { total } = (await db.query<{ total: string }>("select total from reservations where id=$1", [b.id])).rows[0];
  expect(Number(total)).toBe(6400 + 1800);
});

it("only admins manage extras, and every change is logged", async () => {
  const fields = ["Late checkout", "Until 2 PM", "extra", 500, "per_stay", 1, true];
  await expect(save(staff, [null, ...fields])).rejects.toThrow("FORBIDDEN");
  await expect(
    as("authenticated", owner, "insert into extras(name,price,pricing,max_quantity) values('x',0,'per_stay',1)"),
  ).rejects.toThrow();
  const { e } = (await save(admin, [null, ...fields])).rows[0] as { e: { id: string } };
  await save(admin, [e.id, "Late checkout", "Until 2 PM", "extra", 600, "per_stay", 1, true]);
  await save(admin, [e.id, "Late checkout", "Until 2 PM", "extra", 600, "per_stay", 1, false]);
  await expect(save(admin, [null, "Bad", "", "extra", 10, "per_hour", 1, true])).rejects.toThrow("INVALID_INPUT");
  await expect(save(admin, [null, "Bad", "", "extra", 10, "per_stay", 21, true])).rejects.toThrow("INVALID_INPUT");
  expect(
    (
      await db.query<{ action: string }>("select action from audit_logs where record_id=$1 order by occurred_at,id", [e.id])
    ).rows.map((r) => r.action),
  ).toEqual(expect.arrayContaining(["extra_created", "extra_updated", "extra_deactivated"]));
});
