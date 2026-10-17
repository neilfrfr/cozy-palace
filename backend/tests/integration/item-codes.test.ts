import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
  );
  const migrations = readdirSync("supabase/migrations").sort();
  for (const f of migrations.filter((f) => !f.includes("readable_item_codes")))
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(
    "insert into public.staff_members(email,full_name,job_title) values('existing@example.test','Existing','Desk')",
  );
  for (const f of migrations.filter((f) => f.includes("readable_item_codes")))
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("backfills readable codes while preserving UUIDs and inventory", async () => {
  const rows = (
    await db.query("select id,name,code from public.room_types order by id")
  ).rows;
  expect(rows.map((r) => r.code)).toEqual(["RT-001", "RT-002", "RT-003"]);
  expect(rows[0].id).toBe("00000000-0000-4000-8000-000000000001");
  expect(
    (await db.query("select employee_code from public.staff_members")).rows[0]
      .employee_code,
  ).toBe("EMP-0001");
  expect(
    (
      await db.query(
        "select room_number from public.rooms order by room_number",
      )
    ).rows.map((r) => r.room_number),
  ).toEqual(["101", "102", "201"]);
});
it("generates unique codes without reusing deleted employees or truncating larger numbers", async () => {
  await db.exec(
    "delete from public.staff_members; insert into public.staff_members(email,full_name,job_title) values('next@example.test','Next','Desk')",
  );
  expect(
    (await db.query("select employee_code from public.staff_members")).rows[0]
      .employee_code,
  ).toBe("EMP-0002");
  await db.exec("select setval('private.room_type_code_seq',999,true)");
  const r = await db.query(
    "insert into public.room_types(name,description,capacity,nightly_rate) values('New','Test',2,100) returning code",
  );
  expect(r.rows[0].code).toBe("RT-1000");
  await expect(
    db.exec(
      "insert into public.room_types(name,description,capacity,nightly_rate,code) values('Duplicate','Test',2,100,'RT-001')",
    ),
  ).rejects.toThrow();
});
it("keeps codes stable on edits and denies clients access to the generators", async () => {
  await db.exec(
    "update public.staff_members set full_name='Updated' where email='next@example.test'",
  );
  expect(
    (await db.query("select employee_code from public.staff_members")).rows[0]
      .employee_code,
  ).toBe("EMP-0002");
  await db.exec("set role authenticated");
  try {
    await expect(
      db.exec("select nextval('private.staff_member_code_seq')"),
    ).rejects.toThrow();
    await expect(
      db.exec(
        "select private.next_display_code('EMP-', 'private.staff_member_code_seq'::regclass,4)",
      ),
    ).rejects.toThrow();
  } finally {
    await db.exec("reset role");
  }
});
