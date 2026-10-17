import { test, expect } from "@playwright/test";
const adminEmail = process.env.TEST_ADMIN_EMAIL,
  adminPassword = process.env.TEST_ADMIN_PASSWORD;
const workerEmail = process.env.TEST_ONBOARD_EMAIL,
  workerPassword = process.env.TEST_ONBOARD_PASSWORD;
test("admin staff CRUD grants verified access and revokes a live staff session", async ({
  browser,
}) => {
  test.skip(
    !adminEmail || !adminPassword || !workerEmail || !workerPassword,
    "Requires a disposable administrator and a verified non-staff onboarding account.",
  );
  const admin = await browser.newContext(),
    worker = await browser.newContext();
  const a = await admin.newPage(),
    w = await worker.newPage();
  try {
    await a.goto("/login");
    await a.getByLabel("Email address").fill(adminEmail!);
    await a.getByLabel("Password", { exact: true }).fill(adminPassword!);
    await a.getByRole("button", { name: "Sign in", exact: true }).click();
    await a.goto("/admin/staff");
    const create = a
      .locator("form.staff-editor")
      .filter({
        has: a.getByRole("button", { name: "Add staff member", exact: true }),
      });
    await create
      .getByLabel("Full name", { exact: true })
      .fill("Onboarding Test");
    await create.getByLabel("Job title", { exact: true }).fill("Front desk");
    await create
      .getByLabel("Employee email", { exact: true })
      .fill(workerEmail!);
    await create
      .getByRole("button", { name: "Add staff member", exact: true })
      .click();
    await expect(
      a.getByText("Staff record created.", { exact: false }),
    ).toBeVisible();
    let row = a.locator("form.staff-editor").filter({ hasText: workerEmail! });
    await row.getByLabel("Job title", { exact: true }).fill("Reservations");
    await row
      .getByRole("button", { name: "Save staff details", exact: true })
      .click();
    await a.reload();
    row = a.locator("form.staff-editor").filter({ hasText: workerEmail! });
    await expect(row.getByLabel("Job title", { exact: true })).toHaveValue(
      "Reservations",
    );
    await w.goto("/login");
    await w.getByLabel("Email address").fill(workerEmail!);
    await w.getByLabel("Password", { exact: true }).fill(workerPassword!);
    await w.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(w).toHaveURL(/\/staff\/reservations$/);
    await a.reload();
    row = a.locator("form.staff-editor").filter({ hasText: workerEmail! });
    await expect(row.getByText("Active staff", { exact: true })).toBeVisible();
    await row
      .getByLabel("Confirm removal and revoke employee access", { exact: true })
      .check();
    await row
      .getByRole("button", { name: "Remove staff member", exact: true })
      .click();
    await a.reload();
    await expect(
      a.locator("form.staff-editor").filter({ hasText: workerEmail! }),
    ).toHaveCount(0);
    await w.goto("/staff/reservations");
    await expect(w).toHaveURL(/\/reservations\?notice=forbidden$/);
  } finally {
    await admin.close();
    await worker.close();
  }
});
