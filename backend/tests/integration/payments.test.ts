import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const owner = "c0000000-0000-4000-8000-000000000001",
  other = "c0000000-0000-4000-8000-000000000002",
  staff = "c0000000-0000-4000-8000-000000000003";
const room = "10000000-0000-4000-8000-000000000001";
let n = 0;
const key = () => `c1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
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
const customer = (user: string, sql: string, args: unknown[] = []) => as("authenticated", user, sql, args);
type Payment = { id: string; amount: number; reference: string };
// Each stay gets its own nights so holds never collide with one another.
async function pendingStay(offset: number, user = owner) {
  const { r } = (
    await customer(user, "select create_reservation($1,$2::date,$3::date,2,$4) as r", [
      room,
      day(offset),
      day(offset + 2),
      key(),
    ])
  ).rows[0] as { r: { id: string; version: number; total: number } };
  await customer(user, "select submit_reservation($1,$2)", [r.id, r.version]);
  return r;
}
const open = async (id: string, user = owner) =>
  ((await customer(user, "select open_payment($1) as p", [id])).rows[0] as { p: Payment }).p;
const record = async (p: string, provider: string, amount: number, currency = "PHP") =>
  ((await as("service_role", null, "select record_payment($1,$2,$3,$4) as s", [p, provider, amount, currency])).rows[0] as { s: string }).s;
const status = async (id: string) =>
  ((await db.query("select status from reservations where id=$1", [id])).rows[0] as { status: string }).status;
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role service_role nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query(
    "insert into auth.users(id,email) values ($1,'payer@example.test'),($2,'other@example.test'),($3,'desk@example.test')",
    [owner, other, staff],
  );
  await db.query("insert into staff_roles(user_id,role) values($1,'staff')", [staff]);
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("records the payment but leaves the stay pending until staff confirm it", async () => {
  const r = await pendingStay(10);
  const hold = (await db.query("select hold_expires_at=($1::date::timestamp at time zone 'Asia/Manila') ok from reservations where id=$2", [day(10), r.id])).rows[0];
  expect(hold).toEqual({ ok: true });
  const p = await open(r.id);
  expect(Number(p.amount)).toBe(Number(r.total));
  expect(await record(p.id, "pay_ok", Number(r.total))).toBe("paid");
  expect(await status(r.id)).toBe("pending");
  const log = (await db.query("select actor_role,action from audit_logs where record_id=$1 order by occurred_at desc limit 1", [r.id])).rows[0];
  expect(log).toEqual({ actor_role: "system", action: "payment_paid" });
});
it("treats a replayed event as a no-op", async () => {
  const r = await pendingStay(20);
  const p = await open(r.id);
  expect(await record(p.id, "pay_twice", Number(r.total))).toBe("paid");
  expect(await record(p.id, "pay_twice", Number(r.total))).toBe("paid");
  const rows = (await db.query("select count(*)::int c from audit_logs where record_id=$1 and action like 'payment_%'", [r.id])).rows[0];
  expect(rows).toEqual({ c: 1 });
});
it("keeps a wrong amount or currency for review instead of confirming", async () => {
  const r = await pendingStay(30);
  expect(await record((await open(r.id)).id, "pay_short", Number(r.total) - 1)).toBe("review");
  expect(await record((await open(r.id)).id, "pay_usd", Number(r.total), "USD")).toBe("review");
  expect(await status(r.id)).toBe("pending");
});
it("a second payment for an already paid stay goes to review", async () => {
  const r = await pendingStay(40);
  const first = await open(r.id),
    second = await open(r.id);
  expect(await record(first.id, "pay_first", Number(r.total))).toBe("paid");
  expect(await record(second.id, "pay_second", Number(r.total))).toBe("review");
  await expect(open(r.id)).rejects.toThrow("INVALID_TRANSITION");
});
it("a stay staff already confirmed can still be paid once", async () => {
  const r = await pendingStay(45);
  await db.query("update reservations set status='confirmed',hold_expires_at=null where id=$1", [r.id]);
  expect(await record((await open(r.id)).id, "pay_after_confirm", Number(r.total))).toBe("paid");
  expect(await status(r.id)).toBe("confirmed");
  await expect(open(r.id)).rejects.toThrow("INVALID_TRANSITION");
});
it("only the owner can open a payment, and only for a live pending hold", async () => {
  const r = await pendingStay(50);
  await expect(open(r.id, other)).rejects.toThrow("NOT_FOUND");
  await expect(open(r.id, staff)).rejects.toThrow("NOT_FOUND");
  await expect(as("anon", null, "select open_payment($1)", [r.id])).rejects.toThrow();
  const { r: draft } = (
    await customer(owner, "select create_reservation($1,$2::date,$3::date,2,$4) as r", [room, day(60), day(62), key()])
  ).rows[0] as { r: { id: string } };
  await expect(open(draft.id)).rejects.toThrow("INVALID_TRANSITION");
  await db.query("update reservations set hold_expires_at=now()-interval '1 minute' where id=$1", [r.id]);
  await expect(open(r.id)).rejects.toThrow("INVALID_TRANSITION");
});
it("money arriving after the hold lapsed is kept for review", async () => {
  const r = await pendingStay(70);
  const p = await open(r.id);
  await db.query("update reservations set hold_expires_at=now()-interval '1 minute' where id=$1", [r.id]);
  expect(await record(p.id, "pay_late", Number(r.total))).toBe("review");
  expect(await status(r.id)).toBe("pending");
});
it("customers can read their own payments but never record one", async () => {
  const r = await pendingStay(80);
  const p = await open(r.id);
  await expect(customer(owner, "select record_payment($1,'pay_forged',$2,'PHP')", [p.id, r.total])).rejects.toThrow();
  await expect(as("anon", null, "select record_payment($1,'pay_forged',$2,'PHP')", [p.id, r.total])).rejects.toThrow();
  await expect(customer(owner, "insert into payments(reservation_id,amount) values($1,1)", [r.id])).rejects.toThrow();
  expect((await customer(owner, "select id from payments where id=$1", [p.id])).rows).toHaveLength(1);
  expect((await customer(other, "select id from payments where id=$1", [p.id])).rows).toHaveLength(0);
  await expect(record(crypto.randomUUID(), "pay_unknown", 1)).rejects.toThrow("NOT_FOUND");
});
