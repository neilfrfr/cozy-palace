"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/authorize";
import { isPhotoKey, textChanges } from "@/lib/site-content";
import { photoBucket as bucket, readPhoto, storePhoto } from "@/lib/site-photos";

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
  const photo = isPhotoKey(key) ? await readPhoto(form.get("file")) : null;
  if (!photo) redirect(returnTo + "?error=INVALID_PHOTO");
  const error = await storePhoto(db, key, photo);
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
