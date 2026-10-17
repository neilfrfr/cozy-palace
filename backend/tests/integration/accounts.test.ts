import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const admin = "c0000000-0000-4000-8000-000000000001",
  customer = "c0000000-0000-4000-8000-000000000002",
  employee = "c0000000-0000-4000-8000-000000000003";
async function as(user: string, sql: string, args: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values ($1,'admin@example.test','{}'),($2,'customer@example.test','{\"role\":\"admin\"}'),($3,'worker@example.test','{}')",
    [admin, customer, employee],
  );
  await db.query(
    "insert into public.staff_roles(user_id,role) values($1,'admin')",
    [admin],
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("public signup metadata never creates employee authority", async () => {
  expect(
    (await as(customer, "select * from public.staff_roles")).rows,
  ).toHaveLength(0);
  await expect(
    as(
      customer,
      "select public.create_staff_member('evil@example.test','Evil','Desk')",
    ),
  ).rejects.toThrow("FORBIDDEN");
});
it("staff creation normalizes email, is admin-only and not publicly readable", async () => {
  await as(
    admin,
    "select public.create_staff_member(' Worker@Example.Test ','Worker','Front desk')",
  );
  expect(
    (await as(customer, "select * from public.staff_members")).rows,
  ).toHaveLength(0);
  const r = (await as(admin, "select * from public.staff_members")).rows[0];
  expect(r.email).toBe("worker@example.test");
  expect(r.state).toBe("pending");
  await expect(
    as(
      customer,
      "insert into public.staff_members(email,full_name,job_title) values('bad@example.test','Bad','Desk')",
    ),
  ).rejects.toThrow();
  await expect(
    as(
      admin,
      "select public.create_staff_member('worker@example.test','Again','Desk')",
    ),
  ).rejects.toThrow("DUPLICATE_EMAIL");
});
it("only an email-verified matching user can accept an invitation", async () => {
  expect(
    (await as(customer, "select public.accept_staff_invitation() as accepted"))
      .rows[0].accepted,
  ).toBe(false);
  await expect(
    as(employee, "select public.accept_staff_invitation()"),
  ).rejects.toThrow("EMAIL_NOT_VERIFIED");
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    employee,
  ]);
  expect(
    (await as(employee, "select public.accept_staff_invitation() as accepted"))
      .rows[0].accepted,
  ).toBe(true);
  expect(
    (await as(employee, "select role from public.staff_roles")).rows[0].role,
  ).toBe("staff");
  await expect(
    as(
      employee,
      "select public.create_staff_member('bad@example.test','Bad','Desk')",
    ),
  ).rejects.toThrow("FORBIDDEN");
});
it("staff edit enforces versions and deletes revoke access immediately with audit history", async () => {
  const r = (await as(admin, "select * from public.staff_members")).rows[0];
  await as(admin, "select public.update_staff_member($1,$2,$3,$4)", [
    r.id,
    r.version,
    "Worker Updated",
    "Reservations",
  ]);
  await expect(
    as(admin, "select public.update_staff_member($1,$2,$3,$4)", [
      r.id,
      r.version,
      "Stale",
      "Desk",
    ]),
  ).rejects.toThrow("VERSION_CONFLICT");
  await as(admin, "select public.delete_staff_member($1,$2)", [
    r.id,
    Number(r.version) + 1,
  ]);
  expect(
    (await as(employee, "select private.is_staff() as allowed")).rows[0]
      .allowed,
  ).toBe(false);
  expect(
    (await as(admin, "select * from public.staff_members")).rows,
  ).toHaveLength(0);
  expect(
    (
      await as(
        admin,
        "select * from public.audit_logs where action='staff_deleted'",
      )
    ).rows,
  ).toHaveLength(1);
});
it("profile changes apply only to the validated caller", async () => {
  await as(
    customer,
    "select public.update_profile('Customer Updated','+639171234567')",
  );
  expect(
    (await as(customer, "select full_name,phone from public.profiles")).rows,
  ).toEqual([{ full_name: "Customer Updated", phone: "+639171234567" }]);
  await expect(
    as(customer, "update public.profiles set full_name='Stolen' where id=$1", [
      admin,
    ]),
  ).rejects.toThrow();
  await expect(
    as(customer, "select public.update_profile('',null)"),
  ).rejects.toThrow("INVALID_INPUT");
});
it("administrators cannot be demoted through staff CRUD", async () => {
  await expect(
    as(
      admin,
      "select public.create_staff_member('admin@example.test','Admin','Manager')",
    ),
  ).rejects.toThrow("PROTECTED_ADMIN");
  await db.query(
    "insert into public.staff_members(email,full_name,job_title,user_id,state) values('admin@example.test','Admin','Manager',$1,'active')",
    [admin],
  );
  const r = (await as(admin, "select * from public.staff_members")).rows[0];
  await expect(
    as(admin, "select public.delete_staff_member($1,$2)", [r.id, r.version]),
  ).rejects.toThrow("PROTECTED_ADMIN");
});
