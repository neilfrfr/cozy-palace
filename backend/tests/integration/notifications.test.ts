import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const owner = "e0000000-0000-4000-8000-000000000001",
  other = "e0000000-0000-4000-8000-000000000002",
  staff = "e0000000-0000-4000-8000-000000000003";
const room = "10000000-0000-4000-8000-000000000001";
let n = 0;
const key = () => `e1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
// Manila calendar date (UTC+8, no DST), matching the database's "check-in must be after today" rule.
const day = (d: number) => new Date(Date.now() + 8 * 36e5 + d * 864e5).toISOString().slice(0, 10);
async function as(role: string, user: string | null, sql: string, args: unknown[] = []) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
const worker = (sql: string, args: unknown[] = []) => as("service_role", null, sql, args);
type Note = { id: string; event: string; email: string | null; delivery: string; recipient_id: string | null };
const notes = async (reservation: string) =>
  (
    await db.query<Note>(
      "select id,event,email,delivery,recipient_id from notifications where reservation_id=$1 order by created_at,event",
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
  await db.query(
    "insert into auth.users(id,email) values ($1,'owner@example.test'),($2,'other@example.test'),($3,'desk@example.test')",
    [owner, other, staff],
  );
  await db.query("insert into staff_roles(user_id,role) values($1,'staff')", [staff]);
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("records a notice with each booking step in the same transaction, privately", async () => {
  const { r } = (
    await as("authenticated", owner, "select create_reservation($1,$2::date,$3::date,2,$4) as r", [
      room,
      day(1),
      day(3),
      key(),
    ])
  ).rows[0] as { r: { id: string; version: number } };
  expect(await notes(r.id)).toEqual([]);
  const s = (await as("authenticated", owner, "select submit_reservation($1,$2) as s", [r.id, r.version])).rows[0] as {
    s: { version: number };
  };
  const c = (
    await as("authenticated", staff, "select transition_reservation($1,$2,'confirmed') as c", [r.id, s.s.version])
  ).rows[0] as { c: { version: number } };
  expect((await notes(r.id)).map((x) => [x.event, x.email, x.delivery, x.recipient_id])).toEqual([
    ["received", "owner@example.test", "pending", owner],
    ["confirmed", "owner@example.test", "pending", owner],
  ]);
  expect((await as("authenticated", owner, "select count(*)::int as c from notifications")).rows).toEqual([{ c: 2 }]);
  expect((await as("authenticated", other, "select count(*)::int as c from notifications")).rows).toEqual([{ c: 0 }]);
  await as("authenticated", owner, "select mark_notifications_read()");
  expect(
    (await db.query("select count(*)::int as c from notifications where read_at is null and reservation_id=$1", [r.id]))
      .rows,
  ).toEqual([{ c: 0 }]);
  // Check-in is tomorrow, so the reminder job picks it up once.
  expect((await worker("select enqueue_reminders() as n")).rows).toEqual([{ n: 1 }]);
  await worker("select enqueue_reminders()");
  expect((await notes(r.id)).filter((x) => x.event === "reminder")).toHaveLength(1);
  await as("authenticated", staff, "select transition_reservation($1,$2,'cancelled')", [r.id, c.c.version]);
  expect((await notes(r.id)).map((x) => x.event)).toContain("cancelled");
});
it("guest bookings email the guest but have no in-app recipient", async () => {
  const { b } = (
    await worker("select book_as_guest($1,$2::date,$3::date,2,'Walk Up','walk@example.test','+639171234567',$4,'1.1.1.9') as b", [
      room,
      day(60),
      day(61),
      key(),
    ])
  ).rows[0] as { b: { id: string } };
  expect((await notes(b.id)).map((x) => [x.event, x.email, x.recipient_id])).toEqual([
    ["received", "walk@example.test", null],
  ]);
});
it("a failed email is retried, then marked sent once; the booking is untouched", async () => {
  await db.query("update notifications set delivery='sent' where delivery='pending'");
  const { b } = (
    await worker("select book_as_guest($1,$2::date,$3::date,2,'Retry','retry@example.test','+639171234567',$4,'1.1.1.8') as b", [
      room,
      day(70),
      day(71),
      key(),
    ])
  ).rows[0] as { b: { id: string } };
  const claim = async () => (await worker("select id,attempts from claim_notifications(10)")).rows as { id: string; attempts: number }[];
  const [first] = await claim();
  expect(first.attempts).toBe(1);
  expect(await claim()).toEqual([]);
  // The sender (frontend/lib/notifications.ts) reads the booking as service_role to write the email.
  const booking = await worker(
    "select r.reference,r.kind,r.guests,r.guest_full_name,p.full_name,b.check_in,t.start_at from reservations r left join profiles p on p.id=r.customer_id left join room_bookings b on b.reservation_id=r.id left join table_bookings t on t.reservation_id=r.id where r.id=$1",
    [b.id],
  );
  expect(booking.rows).toHaveLength(1);
  await worker("select finish_notification($1,'smtp down')", [first.id]);
  expect(await claim()).toEqual([]);
  await db.query("update notifications set next_attempt_at=now() where id=$1", [first.id]);
  const [again] = await claim();
  expect(again).toEqual({ id: first.id, attempts: 2 });
  await worker("select finish_notification($1,null)", [first.id]);
  expect((await notes(b.id)).map((x) => x.delivery)).toEqual(["sent"]);
  expect((await db.query("select status from reservations where id=$1", [b.id])).rows).toEqual([{ status: "pending" }]);
  await expect(as("authenticated", owner, "select claim_notifications(10)")).rejects.toThrow();
});
