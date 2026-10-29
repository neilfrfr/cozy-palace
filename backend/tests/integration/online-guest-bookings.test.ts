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
type Booked = { id: string; reference: string; token: string };
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
const view = async (token: string) =>
  ((await server("select guest_reservation($1) as r", [token])).rows[0] as { r: Record<string, unknown> }).r;
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
it("a visitor books without an account, holds the room and reads it back only by link", async () => {
  const b = await book(10);
  expect(b.token).toMatch(/^[0-9a-f]{64}$/);
  const r = await view(b.token);
  expect(r).toMatchObject({ reference: b.reference, status: "pending", booking_source: "guest_online", customer_id: null });
  expect(r).not.toHaveProperty("guest_token_hash");
  expect((r.room_bookings as unknown[]).length).toBe(1);
  const stored = (await db.query("select guest_token_hash from reservations where id=$1", [b.id])).rows[0] as { guest_token_hash: Uint8Array };
  expect(Buffer.from(stored.guest_token_hash).toString("hex")).not.toContain(b.token);
  await expect(view("0".repeat(64))).rejects.toThrow("NOT_FOUND");
  await expect(view("not-a-token")).rejects.toThrow("NOT_FOUND");
  // The hold blocks a signed-in customer from the same nights.
  await expect(
    as("authenticated", "select create_reservation($1,$2::date,$3::date,2,$4)", [room, day(10), day(12), key()], customer).then(
      () => as("authenticated", "select submit_reservation(id,version) from reservations where customer_id=$1", [customer], customer),
    ),
  ).rejects.toThrow();
});
it("only the app server can call visitor functions", async () => {
  for (const role of ["anon", "authenticated"]) {
    await expect(
      as(role, "select book_as_guest($1,$2::date,$3::date,2,'X','x@example.test','+639171234567',$4,'1.1.1.1')", [room, day(20), day(21), key()], customer),
    ).rejects.toThrow();
    await expect(as(role, "select guest_reservation($1)", ["0".repeat(64)], customer)).rejects.toThrow();
    await expect(as(role, "select cancel_guest_booking($1)", ["0".repeat(64)], customer)).rejects.toThrow();
  }
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
it("a replayed request returns the same booking with a fresh link; changed details are refused", async () => {
  const k = key();
  const first = await book(40, { k });
  const again = await book(40, { k });
  expect(again.id).toBe(first.id);
  expect(again.token).not.toBe(first.token);
  await expect(view(first.token)).rejects.toThrow("NOT_FOUND");
  await expect(book(40, { k, name: "Someone Else" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
});
it("limits bookings per IP and pending holds per email", async () => {
  for (let i = 0; i < 5; i++) await book(100 + i * 3, { ip: "203.0.113.9" });
  await expect(book(120, { ip: "203.0.113.9" })).rejects.toThrow("RATE_LIMITED");
  await book(130, { email: "busy@example.test" });
  await book(133, { email: "busy@example.test" });
  await expect(book(136, { email: "busy@example.test" })).rejects.toThrow("RATE_LIMITED");
});
it("the link cancels an unpaid request and frees the room, but not a paid one", async () => {
  const b = await book(50);
  expect(((await server("select cancel_guest_booking($1) as r", [b.token])).rows[0] as { r: { status: string } }).r.status).toBe("cancelled");
  expect((await book(50, { email: "next@example.test" })).id).not.toBe(b.id);
  await expect(server("select cancel_guest_booking($1)", [b.token])).rejects.toThrow("POLICY_RESTRICTED");
  const paid = await book(60);
  const p = ((await server("select open_guest_payment($1) as p", [paid.token])).rows[0] as { p: { id: string; amount: number } }).p;
  expect(((await server("select record_payment($1,'pay_guest',$2,'PHP') as s", [p.id, p.amount])).rows[0] as { s: string }).s).toBe("paid");
  expect((await view(paid.token)).status).toBe("confirmed");
  await expect(server("select cancel_guest_booking($1)", [paid.token])).rejects.toThrow("POLICY_RESTRICTED");
  await expect(server("select open_guest_payment($1)", [paid.token])).rejects.toThrow("INVALID_TRANSITION");
});
it("staff see visitor bookings in the queue", async () => {
  const staff = "d0000000-0000-4000-8000-000000000009";
  await db.query("insert into auth.users(id,email) values ($1,'desk2@example.test')", [staff]);
  await db.query("insert into staff_roles(user_id,role) values($1,'staff')", [staff]);
  const b = await book(70);
  const q = (
    (await as("authenticated", "select operational_queue($1,null,null,null,1,false) as q", [b.reference], staff)).rows[0] as {
      q: { rows: { booking_source: string }[] };
    }
  ).q;
  expect(q.rows[0].booking_source).toBe("guest_online");
});
