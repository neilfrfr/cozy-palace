import { test, expect } from "@playwright/test";
test("public home and unconfigured booking state", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: ".superpowers/desktop.png", fullPage: true });
  await expect(
    page.getByRole("heading", {
      name: "Cozy Palace Hotel and Restaurant",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore rooms", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Find your place to unwind" }),
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
  await page.screenshot({ path: ".superpowers/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "My reservations", exact: true }),
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
