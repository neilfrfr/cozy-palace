// Synthetic, private visual evidence rendered from the actual production components.
import { it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
const state = vi.hoisted(() => ({ role: "staff", path: "/staff" }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.path,
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/authorize", () => ({
  requireStaff: async () => ({ role: state.role }),
}));
const data = vi.hoisted(() => ({
  reservation: {
    id: "20000000-0000-4000-8000-000000000001",
    reference: "CP-VISUAL-FIXTURE",
    customer_id: null,
    created_by: "staff",
    booking_source: "staff_guest",
    guest_full_name: "Synthetic guest for layout testing",
    guest_email: null,
    guest_phone: null,
    creator_name: "Test employee",
    customer_name: null,
    room_number: "101",
    room_type_name: "Garden Deluxe",
    status: "confirmed",
    guests: 2,
    total: 6400,
    currency: "PHP",
    version: 1,
    created_at: "2026-10-18T00:00:00Z",
    room_bookings: [
      {
        room_id: "10000000-0000-4000-8000-000000000001",
        check_in: "2026-10-19",
        check_out: "2026-10-21",
        rate_at_booking: 3200,
      },
    ],
  },
  rooms: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      room_number: "101",
      room_types: {
        name: "Garden Deluxe",
        description: "Database fixture",
        capacity: 2,
        nightly_rate: 3200,
      },
    },
  ],
}));
vi.mock("@/lib/reservations/service", () => ({
  getRooms: async () => data.rooms,
}));
vi.mock("@/lib/operations/service", () => ({
  getStaffDashboard: async () => ({
    date: "2026-10-19",
    metrics: [
      {
        name: "Pending confirmations",
        count: 4,
        href: "/staff/reservations?status=pending",
      },
      {
        name: "Today's arrivals",
        count: 7,
        href: "/staff/reservations?date=2026-10-19",
      },
      {
        name: "Stays in house",
        count: 3,
        href: "/staff/reservations?status=checked_in",
      },
    ],
  }),
  getManagementDashboard: async () => ({
    counts: [
      { name: "rooms", count: 12 },
      { name: "restaurant_tables", count: 8 },
      { name: "staff_members", count: 6 },
      { name: "reservations", count: 42 },
    ],
    pendingStaff: 2,
    statuses: [
      { status: "pending", count: 4 },
      { status: "confirmed", count: 7 },
      { status: "checked_in", count: 3 },
      { status: "completed", count: 23 },
      { status: "cancelled", count: 5 },
      { status: "expired", count: 0 },
    ],
    recent: [
      {
        id: "fixture",
        actor_name: "Test employee",
        actor_role: "staff",
        action: "guest_booking_created",
        reference: "CP-VISUAL-FIXTURE",
        record_id: "fixture",
        occurred_at: "2026-10-18T12:00:00Z",
      },
    ],
  }),
  getOperationalReservations: async () => ({
    rows: [data.reservation],
    count: 1,
  }),
  getOperationalReservation: async () => data.reservation,
}));
it("renders production staff/admin pages as explicitly synthetic fixtures", async () => {
  const { default: Layout } = await import("@/app/staff/(operations)/layout");
  const { default: Staff } = await import("@/app/staff/(operations)/page");
  const { default: Admin } = await import("@/app/admin/page");
  const { default: Queue } = await import(
    "@/app/staff/(operations)/reservations/page"
  );
  const { default: New } = await import(
    "@/app/staff/(operations)/reservations/new/page"
  );
  const { default: Detail } = await import(
    "@/app/staff/(operations)/reservations/[id]/page"
  );
  const css = readFileSync("app/globals.css", "utf8").replace(
    '@import "tailwindcss";',
    "",
  );
  mkdirSync(".superpowers/visual", { recursive: true });
  for (const [name, path, role, page] of [
    ["staff", "/staff", "staff", () => Staff()],
    ["admin", "/admin", "admin", () => Admin()],
    [
      "queue",
      "/staff/reservations",
      "staff",
      () => Queue({ searchParams: Promise.resolve({}) }),
    ],
    ["guest-form", "/staff/reservations/new", "staff", () => New()],
    [
      "guest-detail",
      "/staff/reservations/id",
      "staff",
      () => Detail({ params: Promise.resolve({ id: data.reservation.id }) }),
    ],
  ] as const) {
    state.role = role;
    state.path = path;
    const layout = await Layout({ children: await page() });
    const html = renderToStaticMarkup(layout);
    writeFileSync(
      ".superpowers/visual/" + name + ".html",
      `<!doctype html><html><head><base href="http://localhost:3000/"><style>${css}</style></head><body><div style="padding:8px 16px;background:#fff;color:#152238;font:12px Inter,sans-serif">Synthetic visual test fixture — not live records</div><main>${html}</main></body></html>`,
    );
  }
});
