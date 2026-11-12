import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config, isConfigured } from "@/lib/supabase/config";

/** Editable text blocks: key -> [admin label, built-in default]. */
export const siteText = {
  "home.hero.title": ["Home: headline", "Stay a little.\nSavour a lot."],
  "home.hero.lede": [
    "Home: headline subtitle",
    "Beautiful stays. Memorable tables. Your next escape starts here.",
  ],
  "home.intro.title": [
    "Home: intro heading",
    "Rooms to rest in. Tables to linger at.",
  ],
  "home.intro.body": [
    "Home: intro text",
    "Choose your dates, send a reservation request, and follow it from request to arrival. Then see where you can eat while you are here.",
  ],
  "home.rooms.title": ["Home: rooms heading", "A room to make your own."],
  "home.dining.title": ["Home: dining heading", "Good food.\nGreat company."],
  "home.dining.body": [
    "Home: dining text",
    "See the restaurant seating before you arrive. Online table reservations are coming later.",
  ],
  "rooms.title": ["Rooms: banner heading", "Find Your Place to Unwind"],
  "rooms.intro": [
    "Rooms: banner text",
    "Choose your dates and who is joining you. We’ll check availability again when you submit your reservation request.",
  ],
  "dining.title": ["Dining: banner heading", "A Place to Gather."],
  "dining.intro": [
    "Dining: banner text",
    "Explore our menu and restaurant seating.",
  ],
  "about.title": ["About: banner heading", "Your Stay, in One Place."],
  "about.intro": [
    "About: banner text",
    "Manage your hotel reservations and find information about dining at Cozy Palace Hotel and Restaurant.",
  ],
  "contact.title": ["Contact: banner heading", "Get in touch."],
  "contact.intro": [
    "Contact: banner text",
    "Questions about your reservation?",
  ],
  "contact.phone": ["Contact: phone", "+63 2 8123 4567"],
  "contact.email": ["Contact: email", "hello@cozypalace.example"],
  "contact.address": [
    "Contact: address",
    "123 Placeholder Street, Makati City, Metro Manila, Philippines",
  ],
  "contact.hours": [
    "Contact: opening hours",
    "Front desk: open 24 hours\nRestaurant: 11:00–14:00 and 17:00–21:00",
  ],
} as const;
export type TextKey = keyof typeof siteText;

/** Site-wide photos: key -> [admin label, bundled default]. */
export const sitePhotos = {
  "photo.hero": ["Home: headline photo", "/design/hotel-hero.jpg"],
  "photo.dining": [
    "Dining photo (home and dining banner)",
    "/design/dining.jpg",
  ],
  "photo.rooms": ["Rooms banner", "/design/hotel-hero.jpg"],
  "photo.about": ["About banner", "/design/hotel-hero.jpg"],
  "photo.contact": ["Contact banner", "/design/hotel-hero.jpg"],
} as const;
export type PhotoKey = keyof typeof sitePhotos;

export type SiteContent = Record<string, string>;

/**
 * Every saved row, read without the visitor's cookies so /about and /contact stay static;
 * admin saves revalidate the public paths. Empty on any failure, so pages fall back to defaults.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  if (!isConfigured()) return {};
  try {
    const { url, key } = config();
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.from("site_content").select("key,value");
    if (error) return {};
    return Object.fromEntries(data.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
});

export const text = (c: SiteContent, key: TextKey) =>
  c[key] || siteText[key][1];
export const photo = (c: SiteContent, key: PhotoKey) =>
  c[key] || sitePhotos[key][1];
/** Uploaded photo for a room type or menu item; undefined means use the bundled one. */
export const itemPhotoKey = (kind: "room" | "menu", id: string) =>
  `photo.${kind}.${id}`;
export const itemPhoto = (c: SiteContent, kind: "room" | "menu", id?: string) =>
  (id && c[itemPhotoKey(kind, id)]) || undefined;

const textValue = z.string().max(2000);
/** Rows to save and keys to clear (a blank field or the default text clears the row); null if any field is too long. */
export function textChanges(form: FormData) {
  const upserts: { key: string; value: string }[] = [];
  const deletes: string[] = [];
  for (const key of Object.keys(siteText) as TextKey[]) {
    const p = textValue.safeParse(
      String(form.get(key) ?? "")
        .replaceAll("\r\n", "\n")
        .trim(),
    );
    if (!p.success) return null;
    const value = p.data;
    if (!value || value === siteText[key][1]) deletes.push(key);
    else upserts.push({ key, value });
  }
  return { upserts, deletes };
}

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const itemKey = new RegExp(`^photo\\.(room|menu)\\.${uuid}$`);
export const isPhotoKey = (key: string) =>
  key in sitePhotos || itemKey.test(key);

export const maxPhotoBytes = 5 * 1024 * 1024;
/** Type from the file's own bytes, never the browser's claim; null for anything but JPEG, PNG or WebP. */
export function sniffImage(b: Uint8Array) {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n")
    return { type: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return { type: "image/webp", ext: "webp" };
  return null;
}

export const siteMessages: Record<string, string> = {
  saved: "Saved. The public website now shows your changes.",
  uploaded: "Photo replaced.",
  INVALID_INPUT: "Keep each text block under 2,000 characters.",
  INVALID_PHOTO: "Choose a JPEG, PNG or WebP photo of 5 MB or less.",
  FORBIDDEN: "Only administrators can edit the website.",
  REQUEST_FAILED: "We could not save your changes. Please try again.",
};
