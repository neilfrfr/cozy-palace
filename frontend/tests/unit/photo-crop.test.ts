import { describe, expect, it } from "vitest";
import { clampOffset, cropAspect, cropRect } from "@/lib/photo-crop";

const img = { w: 4000, h: 3000 };
const frame = { w: 400, h: 225 }; // 16:9

describe("photo crop", () => {
  it("crops the centred full-width band at zoom 1", () => {
    const r = cropRect(img, frame, 1, { x: 0, y: 0 });
    expect(r.sw).toBeCloseTo(4000);
    expect(r.sh).toBeCloseTo(2250);
    expect(r.sx).toBeCloseTo(0);
    expect(r.sy).toBeCloseTo(375);
  });

  it("zooming in takes a smaller centre area", () => {
    const r = cropRect(img, frame, 2, { x: 0, y: 0 });
    expect(r).toMatchObject({ sw: 2000, sh: 1125 });
    expect(r.sx).toBeCloseTo(1000);
  });

  it("moving the photo down shows more of its top, never past the edge", () => {
    const o = clampOffset(img, frame, 1, { x: 50, y: 9999 });
    expect(o.x).toBeCloseTo(0); // no sideways overhang at zoom 1
    expect(cropRect(img, frame, 1, o).sy).toBeCloseTo(0);
  });

  it("uses wide frames for banners and 4:3 for cards", () => {
    expect(cropAspect("photo.hero")).toBeCloseTo(16 / 9);
    expect(cropAspect("photo.about.rest")).toBeCloseTo(4 / 3);
    expect(cropAspect("room:abc")).toBeCloseTo(4 / 3);
  });
});
