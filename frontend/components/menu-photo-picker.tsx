"use client";
import { useEffect, useRef, useState } from "react";

const maxBytes = 5 * 1024 * 1024; // matches maxPhotoBytes on the server, which checks again
const types = ["image/jpeg", "image/png", "image/webp"];

/** An optional photo for a new menu item; it uploads with the rest of the form. */
export function MenuPhotoPicker() {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
        id="menu-add-photo"
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
          setPreview(URL.createObjectURL(file));
        }}
      />
      <label htmlFor="menu-add-photo" className="menu-photo-drop">
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
    </div>
  );
}
