import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCustomer } from "@/lib/auth/authorize";
import { getReservation } from "@/lib/reservations/service";
import { getRoom } from "@/lib/inventory/service";
import { paymongoKey } from "@/lib/payments/paymongo";
import { CheckoutSummary } from "@/components/checkout-summary";
export const dynamic = "force-dynamic";
export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireCustomer(`/reservations/${id}/checkout`);
  const reservation = await getReservation(id);
  if (!reservation) notFound();
  const allocation = reservation.room_bookings[0];
  const room = allocation ? await getRoom(allocation.room_id) : null;
  // The database re-checks all of this when the payment is opened.
  const payment = !paymongoKey()
    ? "unavailable"
    : reservation.status === "pending" &&
        new Date(reservation.hold_expires_at ?? 0) > new Date()
      ? "open"
      : "closed";
  return (
    <CheckoutSummary
      reservation={reservation}
      room={room}
      payment={payment}
      returned={(await searchParams)?.paid === "1"}
    />
  );
}
