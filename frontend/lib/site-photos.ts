import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { maxPhotoBytes, sniffImage } from "@/lib/site-content";

export const photoBucket = "site-images";

/** The upload as checked image bytes, or null unless it is a JPEG, PNG or WebP within the size limit. */
export async function readPhoto(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0 || file.size > maxPhotoBytes)
    return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  return image ? { bytes, ...image } : null;
}

/** Uploads a checked photo and points the site-content key at it. */
export async function storePhoto(
  db: Awaited<ReturnType<typeof createClient>>,
  key: string,
  photo: NonNullable<Awaited<ReturnType<typeof readPhoto>>>,
) {
  // A fresh path per upload, so CDN and browser caches never serve the old photo.
  // shortcut: replaced files stay in the bucket; add cleanup if storage use matters.
  const path = `${key}/${crypto.randomUUID()}.${photo.ext}`;
  const storage = db.storage.from(photoBucket);
  const uploaded = await storage.upload(path, photo.bytes, {
    contentType: photo.type,
    cacheControl: "31536000",
  });
  if (uploaded.error) return uploaded.error;
  const { error } = await db.from("site_content").upsert({
    key,
    value: storage.getPublicUrl(path).data.publicUrl,
    updated_at: new Date().toISOString(),
  });
  return error;
}
