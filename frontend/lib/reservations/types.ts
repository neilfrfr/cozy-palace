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
  customer_id: string;
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
