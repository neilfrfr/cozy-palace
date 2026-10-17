import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const a = "a0000000-0000-4000-8000-000000000001",
  b = "a0000000-0000-4000-8000-000000000002",
  staff = "a0000000-0000-4000-8000-000000000003";
const room = "10000000-0000-4000-8000-000000000001";
let count = 0;
const key = () =>
  `b0000000-0000-4000-8000-${String(++count).padStart(12, "0")}`;
async function as(user: string, sql: string, params: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function create(
  user = a,
  start = "2026-11-01",
  end = "2026-11-03",
  k = key(),
  guests = 2,
) {
  const r = await as(
    user,
    "select public.create_reservation($1,$2::date,$3::date,$4,$5) as result",
    [room, start, end, guests, k],
  );
  return r.rows[0] as {
    result: {
      id: string;
      reference: string;
      version: number;
      status: string;
      total: string;
    };
  };
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query(
    "insert into auth.users(id,email) values ($1,'alice@example.test'),($2,'bob@example.test'),($3,'staff@example.test')",
    [a, b, staff],
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("installs primary and foreign-key related core tables", async () => {
  expect(
    (await db.query("select to_regclass('public.reservations') as name"))
      .rows[0],
  ).toEqual({ name: "reservations" });
});
it("persists create read update and physical draft delete", async () => {
  const { result: r } = await create();
  expect(r.status).toBe("draft");
  expect(Number(r.total)).toBe(6400);
  const found = await as(a, "select * from reservations where id=$1", [r.id]);
  expect(found.rows).toHaveLength(1);
  const edit = await as(
    a,
    "select update_reservation($1,1,$2,$3::date,$4::date,1) as result",
    [r.id, room, "2026-11-03", "2026-11-04"],
  );
  expect((edit.rows[0] as { result: { version: number } }).result.version).toBe(
    2,
  );
  await as(a, "select delete_draft($1,2)", [r.id]);
  expect(
    (await as(a, "select * from reservations where id=$1", [r.id])).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from audit_logs where record_id=$1", [r.id])).rows
      .length,
  ).toBe(3);
});
it("rejects invalid dates and capacity on the database", async () => {
  await expect(create(a, "2026-11-04", "2026-11-04")).rejects.toThrow(
    "INVALID_INPUT",
  );
  await expect(create(a, "2026-11-04", "2026-11-05", key(), 9)).rejects.toThrow(
    "CAPACITY_EXCEEDED",
  );
});
it("enforces cross-customer isolation for reads and mutations", async () => {
  const { result: r } = await create();
  expect(
    (await as(b, "select * from reservations where id=$1", [r.id])).rows,
  ).toHaveLength(0);
  await expect(as(b, "select delete_draft($1,1)", [r.id])).rejects.toThrow(
    "FORBIDDEN",
  );
});
it("denies direct writes, self promotion and audit tampering", async () => {
  await expect(
    as(a, "insert into staff_roles(user_id,role) values($1,'admin')", [a]),
  ).rejects.toThrow();
  await expect(as(a, "update reservations set total=1")).rejects.toThrow();
  await expect(as(a, "delete from audit_logs")).rejects.toThrow();
  await expect(
    db.exec(
      "set role anon;select create_reservation(null,null,null,null,null)",
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
});
it("rejects missing identity even when function access exists", async () => {
  await expect(create("")).rejects.toThrow("UNAUTHORIZED");
});
it("protects active intervals and allows adjacent bookings", async () => {
  const { result: r } = await create(a, "2026-12-01", "2026-12-03");
  await as(a, "select submit_reservation($1,1)", [r.id]);
  const { result: s } = await create(b, "2026-12-02", "2026-12-04");
  await expect(
    as(b, "select submit_reservation($1,1)", [s.id]),
  ).rejects.toThrow("AVAILABILITY_CONFLICT");
  const { result: t } = await create(b, "2026-12-03", "2026-12-04");
  await as(b, "select submit_reservation($1,1)", [t.id]);
  const state = await db.query("select status from reservations where id=$1", [
    s.id,
  ]);
  expect(state.rows[0]).toEqual({ status: "draft" });
});
it("rechecks conflicts on edit and preserves prior allocation on failure", async () => {
  const { result: r } = await create(a, "2027-01-01", "2027-01-03");
  await as(a, "select submit_reservation($1,1)", [r.id]);
  const { result: s } = await create(b, "2027-01-03", "2027-01-05");
  await as(b, "select submit_reservation($1,1)", [s.id]);
  await expect(
    as(a, "select update_reservation($1,2,$2,$3::date,$4::date,2)", [
      r.id,
      room,
      "2027-01-02",
      "2027-01-04",
    ]),
  ).rejects.toThrow("AVAILABILITY_CONFLICT");
  expect(
    (
      await as(
        a,
        "select check_out::text from room_bookings where reservation_id=$1",
        [r.id],
      )
    ).rows[0],
  ).toEqual({ check_out: "2027-01-03" });
});
it("has idempotent creation and rejects changed payload", async () => {
  const k = key();
  const first = await create(a, "2027-02-01", "2027-02-02", k);
  const repeat = await create(a, "2027-02-01", "2027-02-02", k);
  expect(repeat.result.id).toBe(first.result.id);
  await expect(create(a, "2027-02-01", "2027-02-03", k)).rejects.toThrow(
    "IDEMPOTENCY_CONFLICT",
  );
});
it("rejects stale versions and deleting an active booking", async () => {
  const { result: r } = await create();
  await as(a, "select submit_reservation($1,1)", [r.id]);
  await expect(as(a, "select delete_draft($1,1)", [r.id])).rejects.toThrow(
    "VERSION_CONFLICT",
  );
  await expect(as(a, "select delete_draft($1,2)", [r.id])).rejects.toThrow(
    "INVALID_TRANSITION",
  );
});
it("records trustworthy employee identity and admin-only logs", async () => {
  await db.query("insert into staff_roles(user_id,role) values($1,'admin')", [
    staff,
  ]);
  const { result: r } = await create(a, "2027-03-01", "2027-03-03");
  await as(a, "select submit_reservation($1,1)", [r.id]);
  await as(staff, "select transition_reservation($1,2,'confirmed')", [r.id]);
  expect((await as(a, "select * from audit_logs")).rows).toHaveLength(0);
  const rows = await as(
    staff,
    "select actor_id,action from audit_logs where record_id=$1 order by occurred_at desc",
    [r.id],
  );
  expect(rows.rows[0]).toEqual({ actor_id: staff, action: "confirmed" });
});
it("releases expired pending holds before a new allocation", async () => {
  const { result: r } = await create(a, "2027-04-01", "2027-04-03");
  await as(a, "select submit_reservation($1,1)", [r.id]);
  await db.query(
    "update reservations set hold_expires_at=now()-interval '1 minute' where id=$1",
    [r.id],
  );
  const { result: s } = await create(b, "2027-04-01", "2027-04-03");
  await as(b, "select submit_reservation($1,1)", [s.id]);
  expect(
    (await db.query("select status from reservations where id=$1", [r.id]))
      .rows[0],
  ).toEqual({ status: "expired" });
});
it("shows conflict-free availability to a visitor without disclosing bookings", async () => {
  await db.exec("set role anon");
  try {
    const result = await db.query<{ id: string }>(
      "select * from search_availability('2026-12-01','2026-12-02',2)",
    );
    expect(result.rows.map((r) => r.id)).not.toContain(room);
    await expect(db.query("select * from reservations")).rejects.toThrow();
  } finally {
    await db.exec("reset role");
  }
});
it("allows an admin to explicitly expire or cancel an elapsed hold", async () => {
  for (const status of ["expired", "cancelled"]) {
    const { result: r } = await create(a, "2028-01-01", "2028-01-03");
    await as(a, "select submit_reservation($1,1)", [r.id]);
    await db.query(
      "update reservations set hold_expires_at=now()-interval '1 minute' where id=$1",
      [r.id],
    );
    await as(staff, "select transition_reservation($1,2,$2)", [r.id, status]);
    expect(
      (await db.query("select status from reservations where id=$1", [r.id]))
        .rows[0],
    ).toEqual({ status });
  }
});
it("rejects same-day stays rather than creating an immediately expired pending hold", async () => {
  const date = (
    await db.query<{ date: string }>(
      "select ((now() at time zone 'Asia/Manila')::date)::text as date",
    )
  ).rows[0].date;
  const end = (
    await db.query<{ date: string }>(
      "select (((now() at time zone 'Asia/Manila')::date)+2)::text as date",
    )
  ).rows[0].date;
  await expect(create(a, date, end)).rejects.toThrow("INVALID_INPUT");
});
