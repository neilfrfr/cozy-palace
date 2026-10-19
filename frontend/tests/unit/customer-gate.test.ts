import { it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ role: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ isConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.role }) }),
    }),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Error("REDIRECT:" + url);
  },
}));
import { requireCustomer } from "@/lib/auth/authorize";
it("employee accounts cannot enter customer self-service", async () => {
  for (const [role, path] of [
    ["staff", "/staff"],
    ["admin", "/admin"],
  ]) {
    mocks.role.mockResolvedValue({ data: { role }, error: null });
    await expect(requireCustomer()).rejects.toThrow("REDIRECT:" + path);
  }
});
it("customer gate fails closed when role cannot be checked", async () => {
  mocks.role.mockResolvedValue({ data: null, error: null });
  expect((await requireCustomer()).userId).toBe("user");
  mocks.role.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(requireCustomer()).rejects.toThrow();
});
