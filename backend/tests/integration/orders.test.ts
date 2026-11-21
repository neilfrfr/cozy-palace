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
  await as(admin, "select save_menu_item($1,'Halo-halo','Shaved ice','Dessert',999,true,true)", [menu["Halo-halo"].id]);
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
  await expect(as(staff, "select save_menu_item(null,'Free Food','','Dessert',0,true,true)")).rejects.toThrow("FORBIDDEN");
  await expect(order(staff, [["Fruit Smoothie", 1]], "CP-NOPE")).rejects.toThrow("NOT_FOUND");
});
it("rejects bad items and enforces order status rules", async () => {
  await expect(order(staff, [["Fruit Smoothie", 0]])).rejects.toThrow("INVALID_INPUT");
  await expect(order(staff, [["Fruit Smoothie", 1], ["Fruit Smoothie", 2]])).rejects.toThrow("INVALID_INPUT");
  await as(admin, "select save_menu_item($1,'Assorted Kakanin','','Dessert',160,false,true)", [menu["Assorted Kakanin"].id]);
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
it("admins archive, restore and delete menu items", async () => {
  expect((await db.query("select description from menu_items where name='Malunggay Niçoise Salad'")).rows).toEqual([
    { description: "A fresh Niçoise inspired salad with a local malunggay touch." },
  ]);
  const id = menu["Halo-halo"].id;
  const row = async () => (await db.query("select archived,available from menu_items where id=$1", [id])).rows[0];
  await expect(as(staff, "select delete_menu_item($1)", [id])).rejects.toThrow("FORBIDDEN");
  // First delete archives; a new item may then reuse the name, which blocks restoring until it is renamed.
  await as(admin, "select delete_menu_item($1)", [id]);
  expect(await row()).toEqual({ archived: true, available: false });
  const { m: twin } = (await as(admin, "select save_menu_item(null,'Halo-halo','','Dessert',100,true,true) as m")).rows[0] as {
    m: { id: string };
  };
  await expect(as(admin, "select restore_menu_item($1)", [id])).rejects.toThrow("DUPLICATE_NAME");
  await as(admin, "select save_menu_item($1,'Halo-halo Special','','Dessert',100,true,true)", [twin.id]);
  await as(admin, "select restore_menu_item($1)", [id]);
  expect(await row()).toEqual({ archived: false, available: true });
  // An archived item that is on an order can't be deleted for good.
  await as(admin, "select delete_menu_item($1)", [id]);
  await expect(as(admin, "select delete_menu_item($1)", [id])).rejects.toThrow("MENU_ITEM_IN_USE");
  // One that was never ordered can.
  const { m } = (await as(admin, "select save_menu_item(null,'Test Soup','Warm','Main Course',100,true,false) as m")).rows[0] as {
    m: { id: string; description: string; on_website: boolean };
  };
  expect(m).toMatchObject({ description: "Warm", on_website: false });
  await as(admin, "select delete_menu_item($1)", [m.id]);
  await as(admin, "select delete_menu_item($1)", [m.id]);
  expect((await db.query("select count(*)::int as c from menu_items where id=$1", [m.id])).rows).toEqual([{ c: 0 }]);
  await expect(as(admin, "select delete_menu_item($1)", [m.id])).rejects.toThrow("NOT_FOUND");
});
it("admins tailor sections and item order", async () => {
  const order = async (section: string) =>
    (await db.query("select name from menu_items where section=$1 and not archived order by position,name", [section])).rows.map(
      (r) => (r as { name: string }).name,
    );
  const before = await order("Drinks");
  await as(admin, "select move_menu_item($1,false)", [menu[before[0]].id]);
  expect(await order("Drinks")).toEqual([before[1], before[0], ...before.slice(2)]);
  // Moving past the end is a no-op.
  await as(admin, "select move_menu_item($1,false)", [menu[before.at(-1)!].id]);
  await expect(as(staff, "select move_menu_item($1,true)", [menu[before[0]].id])).rejects.toThrow("FORBIDDEN");

  const sections = async () =>
    (await db.query("select name from menu_sections order by position,name")).rows.map((r) => (r as { name: string }).name);
  const { s } = (await as(admin, "select save_menu_section(null,'Specials','Chef picks') as s")).rows[0] as { s: { id: string } };
  expect((await sections()).at(-1)).toBe("Specials");
  await as(admin, "select move_menu_section($1,true)", [s.id]);
  expect((await sections()).at(-2)).toBe("Specials");
  await expect(as(admin, "select save_menu_section(null,'Drinks','')")).rejects.toThrow("DUPLICATE_NAME");
  // Renaming a section carries its items along.
  const drinks = (await db.query("select id from menu_sections where name='Drinks'")).rows[0] as { id: string };
  await as(admin, "select save_menu_section($1,'Beverages','')", [drinks.id]);
  expect((await order("Beverages")).length).toBe(before.length);
  await expect(as(admin, "select delete_menu_section($1)", [drinks.id])).rejects.toThrow("SECTION_IN_USE");
  await as(admin, "select delete_menu_section($1)", [s.id]);
  expect(await sections()).not.toContain("Specials");
  // The section gets its old name back for any test that runs after this one.
  await as(admin, "select save_menu_section($1,'Drinks','')", [drinks.id]);
});
