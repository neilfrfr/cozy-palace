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

// The site footer and every public page read site content, so refresh every cached page.
function done(error: { message?: string } | null, ok: string, path = "/admin/website"): never {
  revalidatePath("/", "layout");
  redirect(
    path + "?" + (error ? "error=REQUEST_FAILED" : "notice=" + ok),
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
  const returnTo = form.get("returnTo") === "/admin/menu" ? "/admin/menu" : "/admin/website";
  const file = form.get("file");
  if (
    !isPhotoKey(key) ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > maxPhotoBytes
  )
    redirect(returnTo + "?error=INVALID_PHOTO");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  if (!image) redirect(returnTo + "?error=INVALID_PHOTO");
  // A fresh path per upload, so CDN and browser caches never serve the old photo.
  // shortcut: replaced files stay in the bucket; add cleanup if storage use matters.
  const path = `${key}/${crypto.randomUUID()}.${image.ext}`;
  const storage = db.storage.from(bucket);
  const uploaded = await storage.upload(path, bytes, {
    contentType: image.type,
    cacheControl: "31536000",
  });
  if (uploaded.error) done(uploaded.error, "uploaded", returnTo);
  const { error } = await db.from("site_content").upsert({
    key,
    value: storage.getPublicUrl(path).data.publicUrl,
    updated_at: new Date().toISOString(),
  });
  done(error, "uploaded", returnTo);
}

export async function removeSitePhotoAction(form: FormData) {
  const { db } = await requireStaff(true);
  const key = String(form.get("key") ?? "");
  const returnTo = form.get("returnTo") === "/admin/menu" ? "/admin/menu" : "/admin/website";
  if (!isPhotoKey(key)) redirect(returnTo + "?error=INVALID_PHOTO");
  const { data } = await db.from("site_content").select("value").eq("key", key).maybeSingle();
  if (data?.value) {
    const url = new URL(data.value);
    const marker = "/storage/v1/object/public/" + bucket + "/";
    const index = url.pathname.indexOf(marker);
    if (index >= 0) {
      const path = decodeURIComponent(url.pathname.slice(index + marker.length));
      await db.storage.from(bucket).remove([path]);
    }
  }
  const { error } = await db.from("site_content").delete().eq("key", key);
  done(error, "restored", returnTo);
}
