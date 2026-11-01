import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const owner = "d0000000-0000-4000-8000-000000000001",
  other = "d0000000-0000-4000-8000-000000000002",
  staff = "d0000000-0000-4000-8000-000000000003",
  admin = "d0000000-0000-4000-8000-000000000004";
const room = "10000000-0000-4000-8000-000000000001";
let n = 0;
const key = () => `d1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const day = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
async function as(user: string, sql: string, args: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
type Order = { id: string; reference: string; total: string; customer_id: string | null; version: number; status: string };
let menu: Record<string, { id: string; price: string }>;
const order = async (user: string, items: [string, number][], reference: string | null = null, k = key()) =>
  (
    (
      await as(user, "select create_order($1,$2,null,$3) as o", [
        JSON.stringify(items.map(([name, quantity]) => ({ item: menu[name].id, quantity }))),
        reference,
        k,
      ])
    ).rows[0] as { o: Order }
  ).o;
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon nologin;create role service_role nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query(
    "insert into auth.users(id,email) values ($1,'a@example.test'),($2,'b@example.test'),($3,'desk@example.test'),($4,'boss@example.test')",
    [owner, other, staff, admin],
  );
  await db.query("insert into staff_roles(user_id,role) values($1,'staff'),($2,'admin')", [staff, admin]);
  menu = Object.fromEntries(
    (await db.query<{ name: string; id: string; price: string }>("select name,id,price from menu_items")).rows.map(
      (m) => [m.name, m],
    ),
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("staff orders use server prices, save to the guest's account and stay private", async () => {
  const { r } = (
    await as(owner, "select create_reservation($1,$2::date,$3::date,2,$4) as r", [room, day(40), day(41), key()])
  ).rows[0] as { r: { id: string; reference: string } };
  const k = key();
  const o = await order(staff, [["Halo-halo", 2], ["Premium Wine", 1]], r.reference.toLowerCase(), k);
  expect(Number(o.total)).toBe(2 * Number(menu["Halo-halo"].price) + Number(menu["Premium Wine"].price));
  expect(o.customer_id).toBe(owner);
  expect((await order(staff, [["Halo-halo", 2], ["Premium Wine", 1]], r.reference, k)).id).toBe(o.id);
  expect((await as(owner, "select reference from orders")).rows).toEqual([{ reference: o.reference }]);
  expect((await as(owner, "select count(*)::int as c from order_items")).rows).toEqual([{ c: 2 }]);
  expect((await as(other, "select count(*)::int as c from orders")).rows).toEqual([{ c: 0 }]);
  expect((await as(other, "select count(*)::int as c from order_items")).rows).toEqual([{ c: 0 }]);
  // Later price changes leave the receipt alone.
  await as(admin, "select save_menu_item($1,'Halo-halo','Dessert',999,true)", [menu["Halo-halo"].id]);
  expect(
    (await db.query("select unit_price::int as p from order_items where order_id=$1 and name='Halo-halo'", [o.id])).rows,
  ).toEqual([{ p: Number(menu["Halo-halo"].price) }]);
  const log = await db.query("select action from audit_logs where record_id in($1,$2) order by occurred_at", [
    o.id,
    menu["Halo-halo"].id,
  ]);
  expect(log.rows).toEqual([{ action: "order_created" }, { action: "menu_item_updated" }]);
});
it("walk-in orders have no owner; customers cannot create orders or edit the menu", async () => {
  const o = await order(staff, [["Fruit Smoothie", 3]]);
  expect(o.customer_id).toBeNull();
  await expect(order(owner, [["Fruit Smoothie", 1]])).rejects.toThrow("FORBIDDEN");
  await expect(as(owner, "insert into orders(staff_id,total,idempotency_key) values($1,0,$2)", [owner, key()])).rejects.toThrow();
  await expect(as(staff, "select save_menu_item(null,'Free Food','Dessert',0,true)")).rejects.toThrow("FORBIDDEN");
  await expect(order(staff, [["Fruit Smoothie", 1]], "CP-NOPE")).rejects.toThrow("NOT_FOUND");
});
it("rejects bad items and enforces order status rules", async () => {
  await expect(order(staff, [["Fruit Smoothie", 0]])).rejects.toThrow("INVALID_INPUT");
  await expect(order(staff, [["Fruit Smoothie", 1], ["Fruit Smoothie", 2]])).rejects.toThrow("INVALID_INPUT");
  await as(admin, "select save_menu_item($1,'Assorted Kakanin','Dessert',160,false)", [menu["Assorted Kakanin"].id]);
  await expect(order(staff, [["Assorted Kakanin", 1]])).rejects.toThrow("INVALID_INPUT");
  const o = await order(staff, [["Halo-halo", 1]]);
  await expect(as(staff, "select transition_order($1,$2,'completed')", [o.id, o.version + 1])).rejects.toThrow(
    "VERSION_CONFLICT",
  );
  await as(staff, "select transition_order($1,$2,'completed')", [o.id, o.version]);
  await expect(as(staff, "select transition_order($1,$2,'cancelled')", [o.id, o.version + 1])).rejects.toThrow(
    "INVALID_TRANSITION",
  );
});
