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
