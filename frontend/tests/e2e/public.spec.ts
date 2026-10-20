import { test, expect } from "@playwright/test";
test("public home and unconfigured booking state", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({
    caret: "initial",
    path: ".superpowers/desktop.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", {
      name: "Stay a little. Savour a lot.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Book a Stay", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Find Your Place to Unwind" }),
  ).toBeVisible();
  await expect(page.getByText("Booking is not connected yet.")).toBeVisible();
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
});
test("mobile navigation stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const brand = await page.locator(".site-header .brand").boundingBox();
  const account = await page.locator(".site-header .nav-account").boundingBox();
  expect(Math.abs(brand!.y - account!.y)).toBeLessThan(10);
  await page.screenshot({
    caret: "initial",
    path: ".superpowers/mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "My Reservations", exact: true }),
  ).toBeVisible();
});

test("registration and recovery have clear accessible fields", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create your account", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Confirm password", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Sign in", exact: true }).last().click();
  await page
    .getByRole("link", { name: "Forgot password?", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reset your password", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/register");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    caret: "initial",
    path: ".superpowers/registration-mobile.png",
    fullPage: true,
  });
});

test("password fields accept eight characters and toggle visibility independently", async ({
  page,
}) => {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  const password = page.getByLabel("Password", { exact: true });
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await password.fill("1234567");
  expect(
    await password.evaluate(
      (input: HTMLInputElement) => input.validity.tooShort,
    ),
  ).toBe(true);
  await password.fill("12345678");
  expect(
    await password.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(true);
  await expect(confirmation).toHaveAttribute("minlength", "8");
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("12345678");
  await expect(confirmation).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Show confirm password", exact: true })
    .click();
  await expect(confirmation).toHaveAttribute("type", "text");
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
});

for (const width of [360, 390, 1366, 1440]) {
  test(`public Figma routes work without invented content at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/rooms",
      "/dining",
      "/about",
      "/contact",
      "/register",
    ]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("body")).not.toContainText("Application error");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page
          .getByRole("navigation", { name: "Main navigation" })
          .getByRole("link", { name: "Contact", exact: true }),
      ).toBeVisible();
    }
    await page.goto("/contact");
    await expect(
      page.getByText("Contact details are not available yet.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send message/i }),
    ).toHaveCount(0);
    await page.goto(
      "/reservations/10000000-0000-4000-8000-000000000001/checkout",
    );
    await expect(page).toHaveURL(/\/setup|\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/setup|\/login/);
  });
}

test("database headings and dashboard cards fit at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/rooms");
  await page.evaluate(() => {
    const main = document.querySelector("main")!;
    main.innerHTML =
      "<h1>" +
      "R".repeat(120) +
      '</h1><article class="room"><h2>' +
      "R".repeat(120) +
      '</h2></article><div class="dashboard-grid"><section class="panel"><h2>Restaurant tables</h2></section><section class="panel"><h2>Reservations</h2></section></div>';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("staff onboarding has a discoverable registration portal", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("link", { name: "Staff registration", exact: true })
    .click();
  await expect(page).toHaveURL(/\/staff\/register$/);
  await expect(
    page.getByRole("heading", {
      name: "Create your staff account",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/exact email approved by your administrator/),
  ).toBeVisible();
  await expect(
    page.getByText(/Registration alone does not grant staff access/),
  ).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "minlength",
    "8",
  );
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("select[name=role], input[name=role]")).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Sign in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/login\?next=%2Fstaff$/);
  await page.goto("/register");
  await page
    .getByRole("link", { name: "Staff registration", exact: true })
    .click();
  await expect(page).toHaveURL(/\/staff\/register$/);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("operational tables scroll locally without widening mobile pages", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.locator("main").evaluate((main) => {
    main.innerHTML = '<div class="staff-layout"><aside></aside><div class="admin-content operations-content"><div class="table-wrap operations-table"><table><caption class="hidden-label">Test queue</caption><tbody><tr><td>Guest test fixture</td><td>2027-06-01</td><td>Room 101</td><td>Staff-entered guest</td><td>Confirmed</td><td><a href="#">Open<span class="hidden-label"> CP-TEST-FIXTURE</span></a></td></tr></tbody></table></div></div></div>';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator(".operations-table").evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});
