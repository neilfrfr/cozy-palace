"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
export function MenuPhotoField() {
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : "");
  }
  function clear() {
    if (input.current) input.current.value = "";
    setPreview("");
  }
  return <div className="menu-photo-field"><span>Dish photo (optional)</span><button type="button" className="menu-photo-preview" aria-label="Choose a menu item photo" onClick={() => input.current?.click()}>{preview ? <Image src={preview} alt="Selected dish preview" width={220} height={165} unoptimized /> : <span>Click to add photo</span>}</button><input ref={input} className="visually-hidden-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" onChange={select} />{preview && <button className="plain menu-photo-clear" type="button" onClick={clear}>Remove selected photo</button>}</div>;
}
