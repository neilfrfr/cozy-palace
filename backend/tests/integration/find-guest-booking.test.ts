import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const customer = "f0000000-0000-4000-8000-000000000001";
const room = "10000000-0000-4000-8000-000000000001";
let n = 0;
const key = () => `f1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
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
type Found = {
  reference: string;
  status: string;
  stay: { room: string; check_in: string };
  history: { action: string }[];
} | null;
const find = async (first: string, last: string, reference: string, ip = "198.51.100.1") =>
  (
    (await as("service_role", null, "select find_guest_booking($1,$2,$3,$4) as f", [first, last, reference, ip]))
      .rows[0] as { f: Found }
  ).f;
let reference: string;
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role service_role nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query("insert into auth.users(id,email) values ($1,'member@example.test')", [customer]);
  const { b } = (
    await as(
      "service_role",
      null,
      "select book_as_guest($1,$2::date,$3::date,2,'Juan  Santos Dela Cruz','juan@example.test','+639171234567',$4,'203.0.113.5') as b",
      [room, day(50), day(52), key()],
    )
  ).rows[0] as { b: { reference: string } };
  reference = b.reference;
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("finds a guest booking only when first name, last name and reference all match", async () => {
  const found = await find(" juan ", "dela cruz", reference.toLowerCase());
  expect(found).toMatchObject({ reference, status: "pending", stay: { check_in: day(50) } });
  expect(found!.stay.room).toMatch(/Room/);
  expect(found!.history.length).toBeGreaterThan(0);
  expect(JSON.stringify(found)).not.toMatch(/juan@example|\+63917/);
  expect(await find("Juan", "Santos Dela Cruz", reference)).not.toBeNull();
  expect(await find("Juan", "Cruz", reference)).not.toBeNull();
  expect(await find("Pedro", "Dela Cruz", reference)).toBeNull();
  expect(await find("Juan", "Reyes", reference)).toBeNull();
  expect(await find("Ju", "Cruz", reference)).toBeNull();
  expect(await find("Juan", "Dela Cruz", "CP-000000000000")).toBeNull();
});
it("never finds account holders' bookings, and only the server may call it", async () => {
  const { r } = (
    await as("authenticated", customer, "select create_reservation($1,$2::date,$3::date,2,$4) as r", [
      room,
      day(80),
      day(81),
      key(),
    ])
  ).rows[0] as { r: { reference: string } };
  expect(await find("Guest", "Guest", r.reference)).toBeNull();
  await expect(
    as("authenticated", customer, "select find_guest_booking('Juan','Dela Cruz',$1,'1.1.1.1')", [reference]),
  ).rejects.toThrow();
  await expect(as("anon", null, "select find_guest_booking('Juan','Dela Cruz',$1,'1.1.1.1')", [reference])).rejects.toThrow();
});
it("limits each IP address to 10 lookups an hour", async () => {
  for (let i = 0; i < 10; i++) await find("Juan", "Wrong", reference, "192.0.2.77");
  await expect(find("Juan", "Dela Cruz", reference, "192.0.2.77")).rejects.toThrow("RATE_LIMITED");
  expect(await find("Juan", "Dela Cruz", reference, "192.0.2.78")).not.toBeNull();
  await expect(find("", "Dela Cruz", reference)).rejects.toThrow("INVALID_INPUT");
});
