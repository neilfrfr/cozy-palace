import { beforeEach, it, expect, vi } from "vitest";
const source = vi.hoisted(() => ({ value: "staff_guest" as string | null }));
const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: source.value ? { booking_source: source.value } : null,
        }),
      }),
    }),
  })),
}));
vi.mock("@/lib/auth/authorize", () => ({ requireStaff: async () => ({ db }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/notifications", () => ({ deliverNotifications: () => {} }));
import { updateGuestBookingAction } from "@/app/staff/reservations/actions";

const edit = {
  id: "20000000-0000-4000-8000-000000000001",
  version: 1,
  roomId: "10000000-0000-4000-8000-000000000001",
  checkIn: "2027-05-01",
  checkOut: "2027-05-03",
  guests: 2,
  guestFullName: "Guest",
  guestEmail: "",
  guestPhone: "",
};
beforeEach(() => {
  db.from.mockClear();
  db.rpc.mockReset().mockResolvedValue({ data: { id: edit.id }, error: null });
});

it("refuses to clear a walk-in or visitor booking's email and phone", async () => {
  for (const s of ["staff_guest", "guest_online", null]) {
    source.value = s;
    expect(await updateGuestBookingAction(edit)).toEqual({ ok: false, code: "INVALID_INPUT" });
  }
  expect(db.rpc).not.toHaveBeenCalled();
});

it("lets staff edit a customer's own booking, whose contact lives on the account", async () => {
  source.value = "customer_online";
  expect(await updateGuestBookingAction(edit)).toMatchObject({ ok: true });
  expect(db.rpc).toHaveBeenCalledWith(
    "update_guest_reservation",
    expect.objectContaining({ p_guest_email: null, p_guest_phone: null }),
  );
});

it("saves a walk-in edit that keeps both contact details", async () => {
  source.value = "staff_guest";
  const full = { ...edit, guestEmail: "guest@example.test", guestPhone: "+639171234567" };
  expect(await updateGuestBookingAction(full)).toMatchObject({ ok: true });
  expect(db.from).not.toHaveBeenCalled();
});
