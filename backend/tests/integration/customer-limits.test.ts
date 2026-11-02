import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const owner = "b0000000-0000-4000-8000-000000000001",
  staff = "b0000000-0000-4000-8000-000000000002";
const rooms = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
let n = 0;
const key = () => `b1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const day = (d: number) =>
  new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
async function as(
  role: string,
  user: string | null,
  sql: string,
  args: unknown[] = [],
) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user ?? "",
  ]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
type Row = { id: string; version: number };
const draft = async (room: string, from: number) =>
  (
    (
      await as(
        "authenticated",
        owner,
        "select create_reservation($1,$2::date,$3::date,1,$4) as r",
        [room, day(from), day(from + 1), key()],
      )
    ).rows[0] as { r: Row }
  ).r;
const submit = (r: Row) =>
  as("authenticated", owner, "select submit_reservation($1,$2) as r", [
    r.id,
    r.version,
  ]);
type Opened = { id: string; checkout_url: string | null };
const open = async (id: string) =>
  (
    (await as("authenticated", owner, "select open_payment($1) as p", [id]))
      .rows[0] as { p: Opened }
  ).p;
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role service_role nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query(
    "insert into auth.users(id,email) values ($1,'many@example.test'),($2,'desk@example.test')",
    [owner, staff],
  );
  await db.query("insert into staff_roles(user_id,role) values($1,'staff')", [
    staff,
  ]);
}, 60000);
afterAll(async () => {
  await db?.close();
});

it("a customer can have only 3 requests waiting for staff; confirming one frees a place", async () => {
  const held = [];
  for (const [i, room] of rooms.entries()) {
    const r = await draft(room, 10 + i);
    held.push(((await submit(r)).rows[0] as { r: Row }).r);
  }
  const fourth = await draft(rooms[0], 30);
  await expect(submit(fourth)).rejects.toThrow("TOO_MANY_PENDING");
  // A table request counts toward the same limit.
  const table = (
    (await db.query("select id from restaurant_tables limit 1")).rows[0] as {
      id: string;
    }
  ).id;
  await expect(
    as("authenticated", owner, "select book_table($1,$2::timestamptz,2,$3)", [
      table,
      `${day(5)}T19:00:00+08:00`,
      key(),
    ]),
  ).rejects.toThrow("TOO_MANY_PENDING");
  // Editing a waiting request is still allowed.
  await as(
    "authenticated",
    owner,
    "select update_reservation($1,$2,$3,$4::date,$5::date,1)",
    [held[0].id, held[0].version, rooms[0], day(40), day(41)],
  );
  await as(
    "authenticated",
    staff,
    "select transition_reservation($1,$2,'confirmed')",
    [held[1].id, held[1].version],
  );
  await submit(fourth);
});

it("repeat Pay clicks reuse the live invoice; an expired or stale one gets a new payment", async () => {
  const r = (
    await db.query(
      "select id from reservations where customer_id=$1 and status='confirmed'",
      [owner],
    )
  ).rows[0] as { id: string };
  const first = await open(r.id);
  expect(first.checkout_url).toBeNull();
  // Customers can't store a link; only the server can.
  await expect(
    as(
      "authenticated",
      owner,
      "select save_checkout($1,'https://evil.test',now()+interval '1 day')",
      [first.id],
    ),
  ).rejects.toThrow();
  await as(
    "service_role",
    null,
    "select save_checkout($1,'https://checkout.xendit.co/web/inv_1',now()+interval '1 day')",
    [first.id],
  );
  const again = await open(r.id);
  expect(again).toMatchObject({
    id: first.id,
    checkout_url: "https://checkout.xendit.co/web/inv_1",
  });
  await db.query(
    "update payments set checkout_expires_at=now()+interval '5 minutes' where id=$1",
    [first.id],
  );
  const fresh = await open(r.id);
  expect(fresh.id).not.toBe(first.id);
  expect(fresh.checkout_url).toBeNull();
});

it("the daily job prunes rate-limit records older than a day; customers can't call it", async () => {
  await db.exec(
    `insert into private.guest_booking_attempts(ip,at) values('1.1.1.1',now()-interval '2 days'),('1.1.1.1',now());
     insert into private.guest_lookup_attempts(ip,at) values('2.2.2.2',now()-interval '2 days'),('2.2.2.2',now());`,
  );
  await expect(
    as("authenticated", owner, "select prune_rate_limits()"),
  ).rejects.toThrow();
  const r = await as("service_role", null, "select prune_rate_limits() as n");
  expect((r.rows[0] as { n: number }).n).toBe(2);
  const left = await db.query(
    "select (select count(*) from private.guest_booking_attempts)::int+(select count(*) from private.guest_lookup_attempts)::int as n",
  );
  expect((left.rows[0] as { n: number }).n).toBe(2);
});
