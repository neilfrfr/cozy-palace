import { test, expect, type Page } from "@playwright/test";
const adminEmail = process.env.TEST_ADMIN_EMAIL,
  adminPassword = process.env.TEST_ADMIN_PASSWORD;

const dish = "E2E Test Dish";
const row = (p: Page) => p.locator(`.admin-menu-item:has(input[name="name"][value="${dish}"])`);
const confirm = (p: Page, label: string) =>
  p.getByRole("alertdialog").getByRole("button", { name: label, exact: true }).click();
const names = (p: Page, section: string) =>
  p
    .locator("section.section-card", { has: p.getByRole("heading", { name: section }) })
    .locator('input[name="name"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));

// Tall enough that a drag never needs to scroll: Playwright can't scroll mid-drag the way browsers auto-scroll.
test.use({ viewport: { width: 1440, height: 2400 } });

test("admin adds (with a photo), drags to reorder, archives, restores and deletes menu items and sections", async ({ page: p }) => {
  test.skip(!adminEmail || !adminPassword, "Requires a disposable administrator.");
  await p.goto("/staff/login");
  await p.getByLabel("Email address").fill(adminEmail!);
  await p.getByLabel("Password", { exact: true }).fill(adminPassword!);
  await p.getByRole("button", { name: "Log in", exact: true }).click();
  await p.waitForURL((u) => !u.pathname.endsWith("/login"));

  // Add an item.
  await p.goto("/admin/menu?tab=Dessert");
  await p.getByText("+ Add a menu item").click();
  const add = p.locator(".menu-add-form");
  await add.getByLabel("Name").fill(dish);
  await add.getByLabel("Section").selectOption("Dessert");
  await add.getByLabel("Price (₱)").fill("99");
  await add.locator('input[name="photo"]').setInputFiles("public/design/dining.jpg");
  // The crop step opens first; zoom in a little, then keep the crop.
  const crop = p.getByRole("dialog", { name: "Position your photo" });
  await expect(crop.getByRole("img", { name: "Photo being cropped" })).toBeVisible();
  await crop.getByRole("slider", { name: "Zoom" }).fill("1.4");
  await crop.getByRole("button", { name: "Use photo" }).click();
  await expect(add.getByRole("img", { name: "Chosen photo" })).toBeVisible();
  await add.getByRole("button", { name: "Add item" }).click();
  await expect(p.getByText("Saved.")).toBeVisible();
  expect((await names(p, "Dessert")).at(-1)).toBe(dish);
  // The photo was stored with the new item, so it can be removed.
  await expect(row(p).getByRole("button", { name: "Remove photo" })).toBeEnabled();

  // Reorder: drag to the top, then one place down with the keyboard.
  const before = await names(p, "Dessert");
  await row(p)
    .getByRole("button", { name: `Reorder ${dish}` })
    .dragTo(p.locator(`.admin-menu-item:has(input[name="name"][value="${before[0]}"])`));
  await expect(p.getByText("Order saved.")).toBeVisible();
  await expect.poll(async () => (await names(p, "Dessert"))[0]).toBe(dish);
  await row(p).getByRole("button", { name: `Reorder ${dish}` }).press("ArrowDown");
  await expect.poll(async () => (await names(p, "Dessert"))[1]).toBe(dish);
  // The keyboard move saves in the background, so reload until the saved order shows.
  await expect
    .poll(async () => {
      await p.reload();
      return (await names(p, "Dessert"))[1];
    })
    .toBe(dish);

  await p.goto("/dining/menu");
  await expect(p.getByText(dish)).toBeVisible();
  await p.goto("/staff/orders");
  await expect(p.getByText(dish).first()).toBeVisible();

  // Archive, restore, archive again, then delete for good.
  await p.goto("/admin/menu?tab=Dessert");
  await row(p).getByRole("button", { name: "Archive" }).click();
  await confirm(p, "Archive");
  await expect(p.getByText("Menu item archived.")).toBeVisible();
  await expect(row(p)).toHaveCount(0);
  await p.getByRole("link", { name: /Archived/ }).click();
  const archived = p.locator("form.edit-row", { hasText: dish });
  await archived.getByRole("button", { name: "Restore" }).click();
  await expect(p.getByText("Menu item restored to the menu.")).toBeVisible();
  await p.goto("/admin/menu?tab=Dessert");
  await row(p).getByRole("button", { name: "Archive" }).click();
  await confirm(p, "Archive");
  await p.goto("/admin/menu?tab=archived");
  await archived.getByRole("button", { name: "Delete forever" }).click();
  await confirm(p, "Delete forever");
  await expect(p.getByText("Deleted.")).toBeVisible();
  await expect(archived).toHaveCount(0);

  // Sections: add, rename, delete.
  await p.getByText("+ Edit sections").click();
  const create = p.locator("form.edit-row", { has: p.getByRole("button", { name: "Add section" }) });
  await create.getByLabel("Name").fill("E2E Section");
  await create.getByRole("button", { name: "Add section" }).click();
  await expect(p.getByRole("link", { name: /E2E Section/ })).toBeVisible();
  await p.getByText("+ Edit sections").click();
  const section = p.locator(`form.edit-row:has(input[name="name"][value="E2E Section"])`);
  await section.locator('input[name="name"]').fill("E2E Renamed");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(p.getByRole("link", { name: /E2E Renamed/ })).toBeVisible();
  await p.getByText("+ Edit sections").click();
  await p
    .locator(`form.edit-row:has(input[name="name"][value="E2E Renamed"])`)
    .getByRole("button", { name: "Delete" })
    .click();
  await confirm(p, "Delete");
  await expect(p.getByRole("link", { name: /E2E Renamed/ })).toHaveCount(0);
});
