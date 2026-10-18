export type ReservationStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "expired";
export type Room = {
  id: string;
  room_number: string;
  room_types: {
    id?: string;
    code?: string;
    name: string;
    description: string;
    capacity: number;
    nightly_rate: number;
  };
};
export type Reservation = {
  id: string;
  reference: string;
  customer_id: string | null;
  booking_source?: "customer_online" | "staff_guest";
  created_by?: string;
  guest_full_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  hold_expires_at?: string | null;
  status: ReservationStatus;
  guests: number;
  total: number;
  currency: string;
  version: number;
  created_at: string;
  room_bookings: {
    room_id: string;
    check_in: string;
    check_out: string;
    rate_at_booking: number;
  }[];
};
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; fieldErrors?: Record<string, string[]> };
