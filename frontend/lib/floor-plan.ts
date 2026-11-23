// Table centres on /design/dining/floor-plan.jpg, as % of width and height.
const LAYOUT: Record<string, { x: number; y: number; area: string }> = {
  T1: { x: 37.2, y: 48, area: "Booth" },
  T2: { x: 37.2, y: 60.5, area: "Booth" },
  T3: { x: 49.3, y: 48, area: "Booth" },
  T4: { x: 49.3, y: 60.5, area: "Booth" },
  T5: { x: 61.2, y: 43.6, area: "Indoor" },
  T6: { x: 61.2, y: 56.4, area: "Indoor" },
  T7: { x: 61.2, y: 69.1, area: "Indoor" },
  T8: { x: 37.6, y: 78.6, area: "Window" },
  T9: { x: 45.5, y: 78.6, area: "Window" },
  T10: { x: 53.8, y: 78.6, area: "Window" },
  P1: { x: 76.4, y: 22.5, area: "Patio" },
  P2: { x: 77, y: 35.3, area: "Patio" },
  P3: { x: 76.7, y: 48.3, area: "Patio" },
  P4: { x: 86.4, y: 68.5, area: "Patio" },
  P5: { x: 86.7, y: 25.2, area: "Patio umbrella" },
  P6: { x: 87.6, y: 48, area: "Patio umbrella" },
};

/** Where a table sits on the drawing; undefined means it is listed under the plan instead. */
export const planSpot = (tableNumber: string) =>
  Object.hasOwn(LAYOUT, tableNumber) ? LAYOUT[tableNumber] : undefined;
