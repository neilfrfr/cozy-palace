"use client";
import Image from "next/image";
import { useRef, type ChangeEvent } from "react";
import { removeSitePhotoAction, uploadSitePhotoAction } from "@/app/admin/website/actions";
export function PhotoThumbnailUpload({ name, photoKey, src, returnTo = "/admin/website", canRemove = false }: { name: string; photoKey: string; src: string; returnTo?: "/admin/website" | "/admin/menu"; canRemove?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  function submitSelected(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files?.length) event.currentTarget.form?.requestSubmit();
  }
  return <div className="thumbnail-upload-control">
    <form action={uploadSitePhotoAction} className="thumbnail-upload-form"><input type="hidden" name="key" value={photoKey} /><input type="hidden" name="returnTo" value={returnTo} /><input ref={input} className="visually-hidden-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" onChange={submitSelected} aria-label={`Choose a photo for ${name}`} />
      <button type="button" className="photo-thumbnail-trigger" onClick={() => input.current?.click()} aria-label={`Change photo for ${name}`}><Image src={src} alt={name} fill sizes="(max-width: 760px) 100vw, 240px" /><span>Change photo</span></button>
    </form>
    {canRemove ? <form action={removeSitePhotoAction}><input type="hidden" name="key" value={photoKey} /><input type="hidden" name="returnTo" value={returnTo} /><button className="button secondary remove-photo-button">Remove photo</button></form> : <button className="button secondary remove-photo-button" type="button" disabled title="There is no custom photo to remove">Remove photo</button>}
  </div>;
}
