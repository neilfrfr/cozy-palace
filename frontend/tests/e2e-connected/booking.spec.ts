import { test, expect } from "@playwright/test";
const email = process.env.TEST_CUSTOMER_EMAIL,
  password = process.env.TEST_CUSTOMER_PASSWORD;
if (!email || !password || !process.env.NEXT_PUBLIC_SUPABASE_URL)
  throw new Error(
    "Connected browser tests require isolated Supabase configuration and TEST_CUSTOMER_EMAIL / TEST_CUSTOMER_PASSWORD.",
  );
test("real account saves, reloads, edits and deletes its draft", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByLabel("I agree to the Terms and Conditions").check();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  await page.goto("/reservations/new");
  await page.getByLabel("Check-in", { exact: true }).fill("2027-06-01");
  await page.getByLabel("Check-out", { exact: true }).fill("2027-06-03");
  await page.getByLabel("Guests", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save reservation draft" }).click();
  await expect(
    page.getByRole("heading", { name: /Reservation CP-/ }),
  ).toBeVisible();
  const reservationUrl = page.url();
  const reference = await page.getByRole("heading", { name: /Reservation CP-/ }).innerText();
  await page.goto(`${reservationUrl}/checkout`);
  await expect(page.getByText(reference.replace("Reservation ", ""), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Payment unavailable" })).toBeDisabled();
  await expect(page.locator("input")).toHaveCount(0);
  for (const id of ["invalid-id", "ffffffff-ffff-4fff-8fff-ffffffffffff", process.env.TEST_FOREIGN_RESERVATION_ID].filter(Boolean)) {
    const response = await page.goto(`/reservations/${id}/checkout`);
    expect(response?.status()).toBe(404);
  }
  await page.goto(reservationUrl);
  await page.reload();
  await expect(page.getByLabel("Guests", { exact: true })).toHaveValue("2");
  await page.getByLabel("Guests", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(page.getByLabel("Guests", { exact: true })).toHaveValue("1");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await expect(page).toHaveURL(/\/reservations$/);
});
