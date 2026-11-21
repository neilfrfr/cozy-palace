import { describe, expect, it } from "vitest";
import { moveTo } from "@/components/sortable-rows";

describe("moveTo", () => {
  it("moves a row up, down, to the ends, and keeps every id once", () => {
    const o = ["a", "b", "c", "d"];
    expect(moveTo(o, "c", 1)).toEqual(["a", "c", "b", "d"]);
    expect(moveTo(o, "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveTo(o, "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveTo(o, "a", 3)).toEqual(["b", "c", "d", "a"]);
    expect(moveTo(o, "b", 1)).toEqual(o);
  });
});
