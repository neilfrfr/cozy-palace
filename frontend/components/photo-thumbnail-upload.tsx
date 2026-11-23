"use client";
import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { removeSitePhotoAction, uploadSitePhotoAction } from "@/app/admin/website/actions";
import { PhotoCropDialog } from "@/components/photo-crop-dialog";
import { cropAspect } from "@/lib/photo-crop";
export function PhotoThumbnailUpload({ name, photoKey, src, returnTo = "/admin/website", canRemove = false }: { name: string; photoKey: string; src: string; returnTo?: "/admin/website" | "/admin/menu"; canRemove?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  function cropSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) setPending(file);
  }
  function upload(cropped: File | null) {
    setPending(null);
    const el = input.current;
    if (!el) return;
    if (!cropped) {
      el.value = "";
      return;
    }
    const files = new DataTransfer();
    files.items.add(cropped);
    el.files = files.files;
    el.form?.requestSubmit();
  }
  return <div className="thumbnail-upload-control">
    <form action={uploadSitePhotoAction} className="thumbnail-upload-form"><input type="hidden" name="key" value={photoKey} /><input type="hidden" name="returnTo" value={returnTo} /><input ref={input} className="visually-hidden-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" onChange={cropSelected} aria-label={`Choose a photo for ${name}`} />
      <button type="button" className="photo-thumbnail-trigger" onClick={() => input.current?.click()} aria-label={`Change photo for ${name}`}><Image src={src} alt={name} fill sizes="(max-width: 760px) 100vw, 240px" /><span>Change photo</span></button>
      {pending && <PhotoCropDialog file={pending} aspect={cropAspect(photoKey)} onDone={upload} />}
    </form>
    {canRemove ? <form action={removeSitePhotoAction}><input type="hidden" name="key" value={photoKey} /><input type="hidden" name="returnTo" value={returnTo} /><button className="button secondary remove-photo-button">Remove photo</button></form> : <button className="button secondary remove-photo-button" type="button" disabled title="There is no custom photo to remove">Remove photo</button>}
  </div>;
}
