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
  // These tests submit many holds as one customer; the 3-request cap has its own test (customer-limits).
  await db.exec("drop trigger reservations_pending_limit on public.reservations");
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
it("staff confirm an online stay only once it is paid; review money does not count", async () => {
  const r = await pendingStay(45);
  const confirm = async () => {
    const v = ((await db.query("select version from reservations where id=$1", [r.id])).rows[0] as { version: number }).version;
    return as("authenticated", staff, "select transition_reservation($1,$2,'confirmed')", [r.id, v]);
  };
  await expect(confirm()).rejects.toThrow("PAYMENT_REQUIRED");
  expect(await record((await open(r.id)).id, "pay_confirm_review", 1)).toBe("review");
  await expect(confirm()).rejects.toThrow("PAYMENT_REQUIRED");
  expect(await status(r.id)).toBe("pending");
  expect(await record((await open(r.id)).id, "pay_confirm", Number(r.total))).toBe("paid");
  await confirm();
  expect(await status(r.id)).toBe("confirmed");
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
const refund = (user: string, p: string, ref = "Xendit dashboard refund") =>
  as("authenticated", user, "select mark_payment_refunded($1,$2) as p", [p, ref]);
it("staff mark a paid payment on a cancelled stay refunded, and it is logged", async () => {
  const r = await pendingStay(60);
  const p = await open(r.id);
  expect(await record(p.id, "pay_refund", Number(r.total))).toBe("paid");
  // A stay still going ahead keeps its money.
  await expect(refund(staff, p.id)).rejects.toThrow("INVALID_TRANSITION");
  await db.query("update reservations set status='cancelled',hold_expires_at=null where id=$1", [r.id]);
  await expect(refund(owner, p.id)).rejects.toThrow("FORBIDDEN");
  await expect(refund(staff, p.id, "  ")).rejects.toThrow("INVALID_INPUT");
  await refund(staff, p.id, " RF-123 ");
  const row = (await db.query("select status,refunded_by,refund_reference from payments where id=$1", [p.id])).rows[0];
  expect(row).toEqual({ status: "refunded", refunded_by: staff, refund_reference: "RF-123" });
  const log = (await db.query("select actor_role,action,before_values->>'status' b from audit_logs where record_id=$1 order by occurred_at desc limit 1", [r.id])).rows[0];
  expect(log).toEqual({ actor_role: "staff", action: "payment_refunded", b: "paid" });
  const notices = (await db.query("select recipient_id,delivery from notifications where reservation_id=$1 and event='refunded'", [r.id])).rows;
  expect(notices).toEqual([{ recipient_id: owner, delivery: expect.any(String) }]);
  // Twice is refused, and a replayed webhook leaves it refunded.
  await expect(refund(staff, p.id)).rejects.toThrow("INVALID_TRANSITION");
  expect(await record(p.id, "pay_refund", Number(r.total))).toBe("refunded");
});
it("review money can be refunded even while the stay goes ahead", async () => {
  const r = await pendingStay(70);
  const p = await open(r.id);
  expect(await record(p.id, "pay_review_refund", 1)).toBe("review");
  await refund(staff, p.id);
  expect(await status(r.id)).toBe("pending");
});
const requestRefund = async (user: string, p: string, amount: number) =>
  ((await as("authenticated", user, "select request_refund($1,$2) as f", [p, amount])).rows[0] as { f: { id: string; invoice_id: string } }).f;
const settle = async (f: string, s: string) =>
  ((await as("service_role", null, "select settle_refund($1,$2,'rfd-1',null) as s", [f, s])).rows[0] as { s: string }).s;
it("staff refund through Xendit in parts, one pending at a time, and replays are no-ops", async () => {
  const r = await pendingStay(90);
  const p = await open(r.id);
  const total = Number(r.total);
  expect(await record(p.id, "inv_xendit_refund", total)).toBe("paid");
  await expect(requestRefund(staff, p.id, 1)).rejects.toThrow("INVALID_TRANSITION");
  await db.query("update reservations set status='cancelled',hold_expires_at=null where id=$1", [r.id]);
  await expect(requestRefund(owner, p.id, 1)).rejects.toThrow("FORBIDDEN");
  await expect(requestRefund(staff, p.id, total + 1)).rejects.toThrow("INVALID_INPUT");
  await expect(requestRefund(staff, p.id, 0.001)).rejects.toThrow("INVALID_INPUT");
  const first = await requestRefund(staff, p.id, 100);
  expect(first.invoice_id).toBe("inv_xendit_refund");
  // A double click while the first is in flight is refused.
  await expect(requestRefund(staff, p.id, 100)).rejects.toThrow("REFUND_PENDING");
  await expect(as("authenticated", staff, "select settle_refund($1,'succeeded',null,null)", [first.id])).rejects.toThrow();
  expect(await settle(first.id, "succeeded")).toBe("succeeded");
  expect(await settle(first.id, "failed")).toBe("succeeded");
  expect((await db.query("select status from payments where id=$1", [p.id])).rows[0]).toEqual({ status: "paid" });
  await expect(requestRefund(staff, p.id, total - 99)).rejects.toThrow("INVALID_INPUT");
  const failed = await requestRefund(staff, p.id, total - 100);
  expect(await settle(failed.id, "failed")).toBe("failed");
  const rest = await requestRefund(staff, p.id, total - 100);
  expect(await settle(rest.id, "succeeded")).toBe("succeeded");
  const row = (await db.query("select status,refunded_by,refund_reference from payments where id=$1", [p.id])).rows[0];
  expect(row).toEqual({ status: "refunded", refunded_by: staff, refund_reference: "rfd-1" });
  await expect(requestRefund(staff, p.id, 1)).rejects.toThrow("INVALID_TRANSITION");
});
const desk = async (user: string, id: string, amount: number, method = "cash", ref: string | null = null) =>
  ((await as("authenticated", user, "select record_desk_payment($1,$2,$3,$4) as p", [id, amount, method, ref])).rows[0] as { p: { id: string; status: string } }).p;
const balance = async (id: string) =>
  Number(((await db.query("select private.booking_balance(r) as b from reservations r where id=$1", [id])).rows[0] as { b: string }).b);
it("staff take a deposit then the balance at the desk, never more than is owed", async () => {
  const r = await pendingStay(100);
  const total = Number(r.total);
  await expect(desk(owner, r.id, 100)).rejects.toThrow("FORBIDDEN");
  await expect(desk(staff, r.id, 0)).rejects.toThrow("INVALID_INPUT");
  await expect(desk(staff, r.id, 100, "bitcoin")).rejects.toThrow("INVALID_INPUT");
  await expect(desk(staff, r.id, total + 1)).rejects.toThrow("INVALID_AMOUNT");
  const deposit = await desk(staff, r.id, 1000, "gcash", " GC-77 ");
  expect(deposit.status).toBe("paid");
  expect(await balance(r.id)).toBe(total - 1000);
  const row = (await db.query("select method,payment_reference,recorded_by from payments where id=$1", [deposit.id])).rows[0];
  expect(row).toEqual({ method: "gcash", payment_reference: "GC-77", recorded_by: staff });
  // A deposit is a payment, so staff can confirm the stay; the guest gets the payment email.
  const n = (await db.query("select count(*)::int as n from notifications where event_key=$1", [deposit.id + ":paid"])).rows[0];
  expect(n).toEqual({ n: 1 });
  const v = ((await db.query("select version from reservations where id=$1", [r.id])).rows[0] as { version: number }).version;
  await as("authenticated", staff, "select transition_reservation($1,$2,'confirmed')", [r.id, v]);
  await expect(desk(staff, r.id, total)).rejects.toThrow("INVALID_AMOUNT");
  await desk(staff, r.id, total - 1000, "cash");
  expect(await balance(r.id)).toBe(0);
  await expect(desk(staff, r.id, 1)).rejects.toThrow("INVALID_AMOUNT");
  const log = (await db.query("select count(*)::int as n from audit_logs where record_id=$1 and action='payment_recorded'", [r.id])).rows[0];
  expect(log).toEqual({ n: 2 });
});
it("staff accept a short review payment, but not one that overpays or sits on a cancelled stay", async () => {
  const verify = (user: string, id: string) => as("authenticated", user, "select verify_payment($1)", [id]);
  const r = await pendingStay(104);
  const total = Number(r.total);
  const short = await open(r.id);
  expect(await record(short.id, "inv_short", total - 500)).toBe("review");
  await expect(verify(owner, short.id)).rejects.toThrow("FORBIDDEN");
  await verify(staff, short.id);
  expect((await db.query("select status,verified_by from payments where id=$1", [short.id])).rows[0]).toEqual({ status: "paid", verified_by: staff });
  expect(await balance(r.id)).toBe(500);
  await expect(verify(staff, short.id)).rejects.toThrow("INVALID_TRANSITION");
  // A second online payment of the full total would overpay.
  await db.query("insert into payments(reservation_id,amount,status,amount_paid,provider_payment_id,paid_at) values($1,$2,'review',$2,'inv_over',now())", [r.id, total]);
  const over = (await db.query("select id from payments where provider_payment_id='inv_over'")).rows[0] as { id: string };
  await expect(verify(staff, over.id)).rejects.toThrow("INVALID_AMOUNT");
  const c = await pendingStay(108);
  const late = await open(c.id);
  expect(await record(late.id, "inv_late", Number(c.total) - 1)).toBe("review");
  await db.query("update reservations set status='cancelled',hold_expires_at=null where id=$1", [c.id]);
  await expect(verify(staff, late.id)).rejects.toThrow("INVALID_TRANSITION");
});
