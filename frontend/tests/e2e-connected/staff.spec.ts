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
    await a.getByLabel("I agree to the Terms and Conditions").check();
    await a.getByRole("button", { name: "Sign in", exact: true }).click();
    await a.goto("/admin/staff");
    const create = a.locator("form.staff-editor").filter({
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
    await w.getByLabel("I agree to the Terms and Conditions").check();
    await w.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(w).toHaveURL(/\/staff$/);
    await a.reload();
    row = a.locator("form.staff-editor").filter({ hasText: workerEmail! });
    await expect(row.getByText("Active staff", { exact: true })).toBeVisible();
    // Staff books for a guest, not for their own customer account.
    await w.goto("/staff/reservations/new");
    const guestName = `Guest lifecycle ${Date.now()}`;
    await w.getByLabel("Guest full name", { exact: true }).fill(guestName);
    await w.getByLabel("Check-in", { exact: true }).fill("2029-06-15");
    await w.getByLabel("Check-out", { exact: true }).fill("2029-06-17");
    await w.getByLabel("Guests", { exact: true }).fill("2");
    await w
      .getByRole("button", { name: "Review booking", exact: true })
      .click();
    await w
      .getByRole("button", { name: "Confirm guest booking", exact: true })
      .click();
    await expect(w).toHaveURL(/\/staff\/reservations\/[0-9a-f-]+$/);
    const guestUrl = w.url();
    await w.reload();
    await expect(w.getByText(guestName, { exact: true })).toBeVisible();
    await expect(
      w.getByRole("link", { name: "My reservations", exact: true }),
    ).toHaveCount(0);
    await w.getByLabel("Guests", { exact: true }).fill("1");
    await w
      .getByRole("button", { name: "Review booking", exact: true })
      .click();
    await w
      .getByRole("button", { name: "Save booking changes", exact: true })
      .click();
    await w.reload();
    await expect(w.getByLabel("Guests", { exact: true })).toHaveValue("1");
    if (process.env.TEST_CUSTOMER_EMAIL && process.env.TEST_CUSTOMER_PASSWORD) {
      const customer = await browser.newContext();
      try {
        const c = await customer.newPage();
        await c.goto("/login");
        await c
          .getByLabel("Email address")
          .fill(process.env.TEST_CUSTOMER_EMAIL);
        await c
          .getByLabel("Password", { exact: true })
          .fill(process.env.TEST_CUSTOMER_PASSWORD);
        await c.getByLabel("I agree to the Terms and Conditions").check();
        await c.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(c).toHaveURL(/^https?:\/\/[^/]+\/$/);
        await c.goto(guestUrl);
        await expect(c).toHaveURL(/\/reservations\?notice=forbidden$/);
        await expect(c.getByText(guestName, { exact: true })).toHaveCount(0);
      } finally {
        await customer.close();
      }
    }
    await w
      .getByRole("button", { name: "Cancel booking", exact: true })
      .click();
    await expect(w.locator(".status")).toHaveText("cancelled");
    await a.goto(guestUrl);
    await expect(a.getByText(guestName, { exact: true })).toBeVisible();
    await a.goto("/admin/staff");
    row = a.locator("form.staff-editor").filter({ hasText: workerEmail! });
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
