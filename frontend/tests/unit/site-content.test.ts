import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  getSiteContent,
  isPhotoKey,
  itemPhoto,
  photo,
  siteText,
  sniffImage,
  text,
  textChanges,
} from "@/lib/site-content";
const id = "20000000-0000-4000-8000-000000000001";

it("uses saved content and falls back to the built-in text and photos", async () => {
  const saved = {
    "home.hero.title": "Welcome",
    "photo.hero":
      "https://x.supabase.co/storage/v1/object/public/site-images/a.jpg",
    ["photo.room." + id]: "https://x.supabase.co/r.jpg",
  };
  expect(text(saved, "home.hero.title")).toBe("Welcome");
  expect(text(saved, "contact.phone")).toBe(siteText["contact.phone"][1]);
  expect(text({ "about.title": "" }, "about.title")).toBe(
    siteText["about.title"][1],
  );
  expect(photo(saved, "photo.hero")).toBe(saved["photo.hero"]);
  expect(photo({}, "photo.dining")).toBe("/design/dining.jpg");
  expect(itemPhoto(saved, "room", id)).toBe("https://x.supabase.co/r.jpg");
  expect(itemPhoto(saved, "menu", id)).toBeUndefined();
  // Not configured in tests: no database, so every page renders its defaults.
  expect(await getSiteContent()).toEqual({});
});

it("saves only text that differs from the default and clears the rest", () => {
  const f = new FormData();
  f.set("home.hero.title", "  New\r\nheadline  ");
  f.set("about.title", siteText["about.title"][1]);
  f.set("contact.phone", "");
  f.set("injected.key", "ignored");
  const changes = textChanges(f)!;
  expect(changes.upserts).toEqual([
    { key: "home.hero.title", value: "New\nheadline" },
  ]);
  expect(changes.deletes).toContain("about.title");
  expect(changes.deletes).toContain("contact.phone");
  expect(changes.deletes).not.toContain("injected.key");
  f.set("contact.email", "x".repeat(2001));
  expect(textChanges(f)).toBeNull();
});

it("accepts only known photo slots and real JPEG, PNG or WebP bytes", () => {
  expect(isPhotoKey("photo.hero")).toBe(true);
  expect(isPhotoKey("photo.room." + id)).toBe(true);
  expect(isPhotoKey("photo.menu." + id)).toBe(true);
  expect(isPhotoKey("photo.room.not-a-uuid")).toBe(false);
  expect(isPhotoKey("home.hero.title")).toBe(false);
  expect(isPhotoKey("photo.room." + id + "/../x")).toBe(false);
  const bytes = (...b: number[]) =>
    new Uint8Array([...b, ...new Array(12).fill(0)]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.type).toBe("image/jpeg");
  expect(sniffImage(bytes(0x89, ...ascii("PNG\r\n\x1a\n")))?.type).toBe(
    "image/png",
  );
  expect(
    sniffImage(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))?.ext,
  ).toBe("webp");
  expect(sniffImage(bytes(...ascii("<svg onload=alert(1)>")))).toBeNull();
  expect(sniffImage(bytes(...ascii("GIF89a")))).toBeNull();
  expect(sniffImage(new Uint8Array())).toBeNull();
});
