import { beforeEach, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({
  auth: { signUp: vi.fn(), resetPasswordForEmail: vi.fn(), resend: vi.fn() },
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db }));
vi.mock("@/lib/supabase/config", () => ({ isConfigured: () => true }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error("REDIRECT:" + url);
  },
}));
import { registerAction, emailAction } from "@/app/register/actions";
import { siteOrigin } from "@/lib/accounts/site-url";
const initial = { message: "", success: false };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SITE_URL", "https://cozy.example");
  db.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  db.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  db.auth.resend.mockResolvedValue({ error: null });
});
it("signup sends only validated customer metadata and a same-site callback", async () => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    fullName: "Guest",
    email: " GUEST@example.test ",
    password: "A-long-password-123",
    confirmPassword: "A-long-password-123",
    role: "admin",
    next: "https://evil.test",
  }))
    f.set(k, v);
  const state = await registerAction(initial, f);
  expect(state.success).toBe(true);
  const input = db.auth.signUp.mock.calls[0][0];
  expect(input.options.data).toEqual({ full_name: "Guest" });
  expect(input.email).toBe("guest@example.test");
  expect(input.options.emailRedirectTo).toBe(
    "https://cozy.example/auth/confirm?next=%2Freservations",
  );
  expect(db.rpc).not.toHaveBeenCalled();
});
it("recovery uses the configured origin and the password page", async () => {
  const f = new FormData();
  f.set("email", "guest@example.test");
  f.set("mode", "recover");
  await emailAction(initial, f);
  expect(db.auth.resetPasswordForEmail).toHaveBeenCalledWith(
    "guest@example.test",
    {
      redirectTo:
        "https://cozy.example/auth/confirm?next=%2Faccount%2Fpassword",
    },
  );
});
it("invalid form input never reaches authentication", async () => {
  const state = await registerAction(initial, new FormData());
  expect(state.success).toBe(false);
  expect(db.auth.signUp).not.toHaveBeenCalled();
});
it("rejects unsafe email-link origins", () => {
  vi.stubEnv("SITE_URL", "https://user:password@evil.test");
  expect(siteOrigin()).toBeNull();
  vi.stubEnv("SITE_URL", "http://public.example");
  expect(siteOrigin()).toBeNull();
});
