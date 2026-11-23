import { expect, test } from "vitest";
import { planSpot } from "@/lib/floor-plan";

test("tables on the drawing have a spot; new ones are listed under the plan", () => {
  expect(planSpot("T1")).toMatchObject({ area: "Booth" });
  expect(planSpot("T11")).toBeUndefined();
  // Built-in object names are not tables on the plan.
  expect(planSpot("constructor")).toBeUndefined();
});
