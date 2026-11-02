import { afterEach, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isPwned } from "@/lib/accounts/pwned";
// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
const reply = (body: string, ok = true) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, text: async () => body })),
  );
afterEach(() => vi.unstubAllGlobals());
it("sends only the hash prefix and matches a breached suffix", async () => {
  reply(`0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${suffix}:42\r\n`);
  expect(await isPwned("password")).toBe(true);
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
    "https://api.pwnedpasswords.com/range/5BAA6",
  );
});
it("ignores padding rows and fails open", async () => {
  reply(`${suffix}:0`);
  expect(await isPwned("password")).toBe(false);
  reply("", false);
  expect(await isPwned("password")).toBe(false);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  expect(await isPwned("password")).toBe(false);
});
