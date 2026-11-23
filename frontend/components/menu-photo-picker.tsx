"use client";
import { useEffect, useRef, useState } from "react";
import { PhotoCropDialog } from "@/components/photo-crop-dialog";

const maxBytes = 5 * 1024 * 1024; // matches maxPhotoBytes on the server, which checks again
const types = ["image/jpeg", "image/png", "image/webp"];

/** An optional photo for a new menu item or room type; it is cropped, then uploads with the rest of the form. */
export function MenuPhotoPicker({ id = "menu-add-photo", aspect = 4 / 3 }: { id?: string; aspect?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const clear = () => {
    if (input.current) input.current.value = "";
    setPreview(null);
  };
  return (
    <div className="menu-photo-picker">
      <input
        ref={input}
        id={id}
        className="visually-hidden-file"
        name="photo"
        type="file"
        accept={types.join(",")}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          setProblem("");
          if (!file) return clear();
          if (!types.includes(file.type) || file.size > maxBytes) {
            clear();
            return setProblem("Choose a JPEG, PNG or WebP image under 5 MB.");
          }
          setPending(file);
        }}
      />
      <label htmlFor={id} className="menu-photo-drop">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not an optimisable URL
          <img src={preview} alt="Chosen photo" />
        ) : (
          <span>
            <strong>Add photo</strong>
            <small>JPEG, PNG or WebP, under 5 MB</small>
          </span>
        )}
      </label>
      {preview ? (
        <button type="button" className="button secondary" onClick={clear}>
          Remove photo
        </button>
      ) : (
        <button type="button" className="button secondary" onClick={() => input.current?.click()}>
          Choose photo
        </button>
      )}
      {problem && <p className="field-error" role="alert">{problem}</p>}
      {pending && (
        <PhotoCropDialog
          file={pending}
          aspect={aspect}
          onDone={(cropped) => {
            setPending(null);
            if (!cropped || !input.current) return clear();
            // The form uploads the cropped file in place of the original.
            const files = new DataTransfer();
            files.items.add(cropped);
            input.current.files = files.files;
            setPreview(URL.createObjectURL(cropped));
          }}
        />
      )}
    </div>
  );
}
