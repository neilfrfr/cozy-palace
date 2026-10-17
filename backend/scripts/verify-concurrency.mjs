import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "TEST_DATABASE_URL must point to a fresh, disposable PostgreSQL database. See README.",
  );
const pool = new pg.Pool({ connectionString: url, max: 4 });
const setup = await pool.connect();
const a = "a0000000-0000-4000-8000-000000000001",
  b = "a0000000-0000-4000-8000-000000000002";
try {
  const existing = await setup.query(
    "select to_regclass('public.reservations') as name",
  );
  if (existing.rows[0].name)
    throw new Error(
      "Refusing to modify a database containing reservations. Use a fresh disposable database.",
    );
  await setup.query(
    "create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await setup.query(readFileSync("supabase/migrations/" + f, "utf8"));
  await setup.query(readFileSync("supabase/seed.sql", "utf8"));
  await setup.query(
    "insert into auth.users(id,email) values($1,'alice@example.test'),($2,'bob@example.test')",
    [a, b],
  );
  async function actor(user, fn) {
    const c = await pool.connect();
    try {
      await c.query("set role authenticated");
      await c.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
      return await fn(c);
    } finally {
      await c.query("reset role");
      c.release();
    }
  }
  const draft = async (user, k) =>
    actor(
      user,
      async (c) =>
        (
          await c.query(
            "select create_reservation('10000000-0000-4000-8000-000000000001','2027-12-01','2027-12-03',2,$1) as r",
            [k],
          )
        ).rows[0].r,
    );
  const x = await draft(a, "b0000000-0000-4000-8000-000000000001"),
    y = await draft(b, "b0000000-0000-4000-8000-000000000002");
  const results = await Promise.allSettled([
    actor(a, (c) => c.query("select submit_reservation($1,1)", [x.id])),
    actor(b, (c) => c.query("select submit_reservation($1,1)", [y.id])),
  ]);
  assert.equal(
    results.filter((r) => r.status === "fulfilled").length,
    1,
    "Exactly one concurrent submission must succeed",
  );
  assert.equal(
    results.filter((r) => r.status === "rejected" && r.reason.code === "23P01")
      .length,
    1,
    "Losing request must be an availability conflict",
  );
  const rows = await setup.query(
    "select * from room_bookings where blocks_inventory",
  );
  assert.equal(rows.rowCount, 1);

  // Regression: resource locks must precede reservation locks during hold cleanup.
  await setup.query(
    "insert into staff_roles(user_id,role) values($1,'admin')",
    [a],
  );
  const expired = await actor(
    b,
    async (c) =>
      (
        await c.query(
          "select create_reservation('10000000-0000-4000-8000-000000000001','2028-12-01','2028-12-03',2,'b0000000-0000-4000-8000-000000000003') as r",
        )
      ).rows[0].r,
  );
  await actor(b, (c) =>
    c.query("select submit_reservation($1,1)", [expired.id]),
  );
  await setup.query(
    "update reservations set hold_expires_at=now()-interval '1 minute' where id=$1",
    [expired.id],
  );
  const cleaner = await pool.connect(),
    transition = await pool.connect();
  try {
    await cleaner.query("begin");
    await cleaner.query(
      "select id from rooms where id='10000000-0000-4000-8000-000000000001' for update",
    );
    await cleaner.query("set local role authenticated");
    await cleaner.query("select set_config('request.jwt.claim.sub',$1,true)", [
      b,
    ]);
    await transition.query("set application_name='cozy-expiry-regression'");
    await transition.query("set role authenticated");
    await transition.query(
      "select set_config('request.jwt.claim.sub',$1,false)",
      [a],
    );
    const waiting = transition
      .query("select transition_reservation($1,2,'expired')", [expired.id])
      .then(
        () => ({ ok: true, code: "" }),
        (e) => ({ ok: false, code: e.message }),
      );
    let blocked = false;
    for (let i = 0; i < 50; i++) {
      const activity = await setup.query(
        "select 1 from pg_stat_activity where application_name='cozy-expiry-regression' and wait_event_type='Lock'",
      );
      if (activity.rowCount) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(blocked, true, "Transition should wait for the room lock");
    await cleaner.query("set local statement_timeout='3s'");
    await cleaner.query(
      "select create_reservation('10000000-0000-4000-8000-000000000001','2028-12-01','2028-12-03',2,'b0000000-0000-4000-8000-000000000004')",
    );
    await cleaner.query("commit");
    const waited = await waiting;
    assert.equal(
      waited.code,
      "VERSION_CONFLICT",
      "Cleanup changes version; waiting mutation must reject stale state without deadlock",
    );
    assert.equal(
      (
        await setup.query("select status from reservations where id=$1", [
          expired.id,
        ])
      ).rows[0].status,
      "expired",
    );
  } finally {
    await cleaner.query("rollback");
    cleaner.release();
    await transition.query("reset role");
    transition.release();
  }
  console.log(
    "PASS: two independent PostgreSQL sessions, exactly one active booking; other request rejected with AVAILABILITY_CONFLICT.",
  );
} finally {
  setup.release();
  await pool.end();
}
