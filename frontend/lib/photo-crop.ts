export type Size = { w: number; h: number };
/** Where the image centre sits relative to the frame centre, in display pixels. */
export type Offset = { x: number; y: number };

// Site photos shown as wide banners (keys from sitePhotos in site-content.ts); every other photo is a card.
const wideKeys = new Set(["photo.hero", "photo.dining", "photo.rooms", "photo.about", "photo.contact"]);
export const cropAspect = (photoKey: string) => (wideKeys.has(photoKey) ? 16 / 9 : 4 / 3);

/** Display pixels per image pixel: just covering the frame at zoom 1. */
export const coverScale = (img: Size, frame: Size, zoom: number) =>
  Math.max(frame.w / img.w, frame.h / img.h) * zoom;

/** Keeps the frame covered: the image may move at most its overhang on each side. */
export function clampOffset(img: Size, frame: Size, zoom: number, o: Offset): Offset {
  const k = coverScale(img, frame, zoom);
  const mx = (img.w * k - frame.w) / 2;
  const my = (img.h * k - frame.h) / 2;
  return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
}

/** The part of the image inside the frame, in image pixels. */
export function cropRect(img: Size, frame: Size, zoom: number, o: Offset) {
  const k = coverScale(img, frame, zoom);
  return {
    sx: img.w / 2 - (frame.w / 2 + o.x) / k,
    sy: img.h / 2 - (frame.h / 2 + o.y) / k,
    sw: frame.w / k,
    sh: frame.h / k,
  };
}
