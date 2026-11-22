import { test, expect, type Browser, type BrowserContext } from "@playwright/test";
const adminEmail = process.env.TEST_ADMIN_EMAIL,
  adminPassword = process.env.TEST_ADMIN_PASSWORD;

/** A separate browser (own cookies), signed in as the admin. */
async function signedIn(browser: Browser) {
  const context = await browser.newContext();
  const p = await context.newPage();
  await p.goto("/staff/login");
  await p.getByLabel("Email address").fill(adminEmail!);
  await p.getByLabel("Password", { exact: true }).fill(adminPassword!);
  await p.getByRole("button", { name: "Log in", exact: true }).click();
  await p.waitForURL((u) => !u.pathname.endsWith("/login"));
  return { context, p };
}

const isAuth = (name: string) => name.startsWith("sb-") && name.includes("-auth-token");

/** Marks the stored access token as expired, so the next request must renew it with the refresh token (normally up to an hour later). */
async function expireAccessToken(context: BrowserContext) {
  const parts = (await context.cookies()).filter((c) => isAuth(c.name));
  const base = parts[0].name.replace(/\.\d+$/, "");
  const raw = parts
    .sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))
    .map((c) => c.value)
    .join("");
  const session = JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString());
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await context.clearCookies({ name: new RegExp("^" + base) });
  const size = 3180; // @supabase/ssr's cookie chunk size
  const chunks = value.match(new RegExp(`.{1,${size}}`, "g"))!;
  await context.addCookies(
    chunks.map((v, i) => ({ ...parts[0], name: chunks.length > 1 ? `${base}.${i}` : base, value: v })),
  );
}

test("signing out on one device keeps the account's other sessions, and an ended session says why", async ({ browser }) => {
  test.skip(!adminEmail || !adminPassword, "Requires a disposable administrator.");
  const a = await signedIn(browser);
  const b = await signedIn(browser);

  // Device A signs out; device B must stay signed in.
  await a.p.getByRole("button", { name: "Sign out" }).click();
  await a.p.waitForURL(/\/staff\/login/);
  await b.p.goto("/admin/rooms");
  await expect(b.p).toHaveURL(/\/admin\/rooms/);
  // A global sign-out only bit when B next renewed its token, which is why it felt random.
  await expireAccessToken(b.context);
  await b.p.goto("/admin/rooms");
  await expect(b.p).toHaveURL(/\/admin\/rooms/);

  // B's session becomes invalid: the login page explains it instead of appearing silently.
  const auth = (await b.context.cookies()).filter((c) => isAuth(c.name));
  expect(auth.length).toBeGreaterThan(0);
  await b.context.addCookies(auth.map((c) => ({ ...c, value: "base64-eyJpbnZhbGlkIjp0cnVlfQ" })));
  await b.p.goto("/admin/rooms");
  await expect(b.p).toHaveURL(/\/staff\/login\?.*notice=expired/);
  await expect(b.p.getByText("Your session ended, so you were signed out.")).toBeVisible();

  await a.context.close();
  await b.context.close();
});
