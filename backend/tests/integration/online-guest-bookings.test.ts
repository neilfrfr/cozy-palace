import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const customer = "d0000000-0000-4000-8000-000000000001";
const room = "10000000-0000-4000-8000-000000000001";
let n = 0;
const key = () => `d1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const day = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
async function as(role: string, sql: string, args: unknown[] = [], user = "") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
const server = (sql: string, args: unknown[] = []) => as("service_role", sql, args);
type Booked = { id: string; reference: string };
async function book(offset: number, o: { email?: string; ip?: string; k?: string; name?: string } = {}) {
  return (
    (
      await server("select book_as_guest($1,$2::date,$3::date,2,$4,$5,'+639171234567',$6,$7) as b", [
        room,
        day(offset),
        day(offset + 2),
        o.name ?? "Walk In",
        o.email ?? `guest${offset}@example.test`,
        o.k ?? key(),
        o.ip ?? `10.0.0.${offset}`,
      ])
    ).rows[0] as { b: Booked }
  ).b;
}
const seating = (offset: number) => `${day(offset)}T19:00:00+08:00`;
const tableId = async (number: string) =>
  ((await db.query("select id from restaurant_tables where table_number=$1", [number])).rows[0] as { id: string }).id;
async function bookTable(table: string, offset: number, o: { email?: string; k?: string; start?: string } = {}) {
  return (
    (
      await server(
        "select book_table_as_guest($1,$2::timestamptz,2,'Table Guest',$3,'+639171234567',$4,'10.1.0.1') as b",
        [await tableId(table), o.start ?? seating(offset), o.email ?? `table${offset}@example.test`, o.k ?? key()],
      )
    ).rows[0] as { b: Booked }
  ).b;
}
const row = async (id: string) =>
  (await db.query("select * from reservations where id=$1", [id])).rows[0] as Record<string, unknown>;
async function addStaff(id: string) {
  await db.query("insert into auth.users(id,email) values ($1,$2)", [id, id + "@example.test"]);
  await db.query("insert into staff_roles(user_id,role) values($1,'staff')", [id]);
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role service_role nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query("insert into auth.users(id,email) values ($1,'member@example.test')", [customer]);
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("a visitor books a room without an account and the hold blocks those nights", async () => {
  const b = await book(10);
  expect(Object.keys(b).sort()).toEqual(["id", "reference"]);
  expect(await row(b.id)).toMatchObject({ status: "pending", booking_source: "guest_online", customer_id: null, created_by: null });
  await expect(
    as("authenticated", "select create_reservation($1,$2::date,$3::date,2,$4)", [room, day(10), day(12), key()], customer).then(
      () => as("authenticated", "select submit_reservation(id,version) from reservations where customer_id=$1", [customer], customer),
    ),
  ).rejects.toThrow();
});
it("only the app server can call visitor functions, and the private-link functions are gone", async () => {
  for (const role of ["anon", "authenticated"]) {
    await expect(
      as(role, "select book_as_guest($1,$2::date,$3::date,2,'X','x@example.test','+639171234567',$4,'1.1.1.1')", [room, day(20), day(21), key()], customer),
    ).rejects.toThrow();
    await expect(
      as(role, "select book_table_as_guest($1,$2::timestamptz,2,'X','x@example.test','+639171234567',$3,'1.1.1.1')", [await tableId("T4"), seating(20), key()], customer),
    ).rejects.toThrow();
  }
  for (const fn of ["guest_reservation", "cancel_guest_booking", "open_guest_payment"])
    await expect(server(`select ${fn}($1)`, ["0".repeat(64)])).rejects.toThrow("does not exist");
});
it("requires a name, email and phone, and a future check-in", async () => {
  await expect(
    server("select book_as_guest($1,$2::date,$3::date,2,'Walk In','not-an-email','+639171234567',$4,'1.1.1.2')", [room, day(30), day(31), key()]),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(
    server("select book_as_guest($1,$2::date,$3::date,2,'Walk In','a@example.test',null,$4,'1.1.1.2')", [room, day(30), day(31), key()]),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(
    server("select book_as_guest($1,$2::date,$3::date,2,'Walk In','a@example.test','+639171234567',$4,'1.1.1.2')", [room, day(0), day(1), key()]),
  ).rejects.toThrow("INVALID_INPUT");
});
it("a replayed request returns the same booking; changed details are refused", async () => {
  const k = key();
  const first = await book(40, { k });
  expect(await book(40, { k })).toEqual(first);
  await expect(book(40, { k, name: "Someone Else" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
});
it("limits bookings per IP and pending holds per email, rooms and tables together", async () => {
  for (let i = 0; i < 5; i++) await book(100 + i * 3, { ip: "203.0.113.9" });
  await expect(book(120, { ip: "203.0.113.9" })).rejects.toThrow("RATE_LIMITED");
  await book(130, { email: "busy@example.test" });
  await bookTable("T1", 5, { email: "busy@example.test" });
  await expect(book(136, { email: "busy@example.test" })).rejects.toThrow("RATE_LIMITED");
});
it("a visitor requests a table; it is held until the seating and staff confirm it", async () => {
  const b = await bookTable("T2", 6);
  expect(await row(b.id)).toMatchObject({ kind: "dining", status: "pending", booking_source: "guest_online" });
  await expect(bookTable("T2", 6)).rejects.toThrow("AVAILABILITY_CONFLICT");
  // 15:00 is between lunch and dinner seatings.
  await expect(bookTable("T3", 6, { start: `${day(6)}T15:00:00+08:00` })).rejects.toThrow("INVALID_INPUT");
  const staff = "d0000000-0000-4000-8000-000000000008";
  await addStaff(staff);
  const { version } = await row(b.id);
  const done = (
    (await as("authenticated", "select set_table_booking_status($1,$2,'confirmed') as r", [b.id, version], staff)).rows[0] as {
      r: { status: string };
    }
  ).r;
  expect(done.status).toBe("confirmed");
});
it("staff find visitor bookings and correct their contact details, but cannot remove the email", async () => {
  const staff = "d0000000-0000-4000-8000-000000000009";
  await addStaff(staff);
  const b = await book(70);
  const q = (
    (await as("authenticated", "select operational_queue($1,null,null,'guest_online',1,false) as q", [b.reference], staff)).rows[0] as {
      q: { rows: { booking_source: string }[] };
    }
  ).q;
  expect(q.rows.map((x) => x.booking_source)).toEqual(["guest_online"]);
  const { version } = await row(b.id);
  const update = "select update_guest_reservation($1,$2,$3,$4::date,$5::date,2,'Corrected Name',$6,'+639181234567')";
  await expect(as("authenticated", update, [b.id, version, room, day(70), day(72), null], staff)).rejects.toThrow("INVALID_INPUT");
  await as("authenticated", update, [b.id, version, room, day(70), day(72), "fixed@example.test"], staff);
  expect(await row(b.id)).toMatchObject({ guest_full_name: "Corrected Name", guest_email: "fixed@example.test", booking_source: "guest_online" });
});
