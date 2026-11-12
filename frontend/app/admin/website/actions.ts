"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/authorize";
import {
  isPhotoKey,
  maxPhotoBytes,
  sniffImage,
  textChanges,
} from "@/lib/site-content";

const bucket = "site-images";

// Every public page reads site content; /about and /contact are static, so they need this to update.
function done(error: { message?: string } | null, ok: string): never {
  for (const p of ["/", "/rooms", "/dining", "/about", "/contact"])
    revalidatePath(p);
  revalidatePath("/rooms/[id]", "page");
  redirect(
    "/admin/website?" + (error ? "error=REQUEST_FAILED" : "notice=" + ok),
  );
}

export async function saveSiteTextAction(form: FormData) {
  const { db } = await requireStaff(true);
  const changes = textChanges(form);
  if (!changes) redirect("/admin/website?error=INVALID_INPUT");
  const now = new Date().toISOString();
  const [saved, cleared] = await Promise.all([
    changes.upserts.length
      ? db
          .from("site_content")
          .upsert(changes.upserts.map((r) => ({ ...r, updated_at: now })))
      : { error: null },
    changes.deletes.length
      ? db.from("site_content").delete().in("key", changes.deletes)
      : { error: null },
  ]);
  done(saved.error ?? cleared.error, "saved");
}

export async function uploadSitePhotoAction(form: FormData) {
  const { db } = await requireStaff(true);
  const key = String(form.get("key") ?? "");
  const file = form.get("file");
  if (
    !isPhotoKey(key) ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > maxPhotoBytes
  )
    redirect("/admin/website?error=INVALID_PHOTO");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  if (!image) redirect("/admin/website?error=INVALID_PHOTO");
  // A fresh path per upload, so CDN and browser caches never serve the old photo.
  // shortcut: replaced files stay in the bucket; add cleanup if storage use matters.
  const path = `${key}/${crypto.randomUUID()}.${image.ext}`;
  const storage = db.storage.from(bucket);
  const uploaded = await storage.upload(path, bytes, {
    contentType: image.type,
    cacheControl: "31536000",
  });
  if (uploaded.error) done(uploaded.error, "uploaded");
  const { error } = await db.from("site_content").upsert({
    key,
    value: storage.getPublicUrl(path).data.publicUrl,
    updated_at: new Date().toISOString(),
  });
  done(error, "uploaded");
}
