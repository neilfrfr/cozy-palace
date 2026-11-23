"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { clampOffset, coverScale, cropRect, type Offset, type Size } from "@/lib/photo-crop";

const maxSide = 2000; // output pixels on the long side; keeps the JPEG well under the 5 MB upload limit
const step = 10; // arrow-key move in display pixels (Shift moves 4×)

/** Crop and zoom a chosen photo to the frame it shows in. Calls onDone with the cropped JPEG, or null on cancel. */
export function PhotoCropDialog({
  file,
  aspect,
  onDone,
}: {
  file: File;
  aspect: number;
  onDone: (cropped: File | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; start: Offset } | null>(null);
  const [src, setSrc] = useState("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Size>({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [problem, setProblem] = useState("");

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.onerror = () => setProblem("This file couldn't be opened as a photo.");
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const natural = img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
  const shown = natural ? clampOffset(natural, box, zoom, offset) : offset;
  const k = natural ? coverScale(natural, box, zoom) : 0;
  const move = (next: Offset) => setOffset(natural ? clampOffset(natural, box, zoom, next) : next);
  const rezoom = (z: number) => {
    const next = Math.min(3, Math.max(1, z));
    setZoom(next);
    if (natural) setOffset((o) => clampOffset(natural, box, next, o));
  };

  async function save() {
    if (!img || !natural) return;
    const r = cropRect(natural, box, zoom, shown);
    const scale = Math.min(1, maxSide / Math.max(r.sw, r.sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(r.sw * scale);
    canvas.height = Math.round(r.sh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return setProblem("We couldn't crop this photo. Try another one.");
    ctx.fillStyle = "#fff"; // transparent PNG areas turn white in the JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.9));
    if (!blob) return setProblem("We couldn't crop this photo. Try another one.");
    onDone(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
  }

  return (
    <dialog
      ref={dialog}
      className="confirm-dialog photo-crop-dialog"
      aria-labelledby="photo-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        onDone(null);
      }}
    >
      <h2 id="photo-crop-title">Position your photo</h2>
      <p>Drag to move it, and zoom to crop tighter. The frame shows what guests will see.</p>
      <div
        ref={frame}
        className="photo-crop-frame"
        style={{ "--aspect": aspect } as CSSProperties}
        tabIndex={0}
        role="group"
        aria-label="Photo position. Use the arrow keys to move it, and + or − to zoom."
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, start: shown };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) move({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const by = e.shiftKey ? step * 4 : step;
          const keys: Record<string, Offset> = {
            ArrowLeft: { x: -by, y: 0 },
            ArrowRight: { x: by, y: 0 },
            ArrowUp: { x: 0, y: -by },
            ArrowDown: { x: 0, y: by },
          };
          if (keys[e.key]) move({ x: shown.x + keys[e.key].x, y: shown.y + keys[e.key].y });
          else if (e.key === "+" || e.key === "=") rezoom(zoom + 0.1);
          else if (e.key === "-") rezoom(zoom - 0.1);
          else return;
          e.preventDefault();
        }}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob being cropped, not an optimisable URL
          <img
            src={src}
            alt="Photo being cropped"
            draggable={false}
            onLoad={(e) => setImg(e.currentTarget)}
            onError={() => setProblem("This file couldn't be opened as a photo.")}
            style={
              natural
                ? {
                    width: natural.w * k,
                    height: natural.h * k,
                    transform: `translate(calc(-50% + ${shown.x}px), calc(-50% + ${shown.y}px))`,
                  }
                : { visibility: "hidden" }
            }
          />
        )}
      </div>
      <label className="photo-crop-zoom">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => rezoom(Number(e.currentTarget.value))}
        />
      </label>
      {problem && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
      <div className="confirm-dialog-actions">
        <button type="button" className="button secondary" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button type="button" className="primary" disabled={!img} onClick={save}>
          Use photo
        </button>
      </div>
    </dialog>
  );
}
