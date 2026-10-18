import { notFound } from "next/navigation";
import { z } from "zod";
import { requireIdentity } from "@/lib/auth/authorize";
import { getReservation } from "@/lib/reservations/service";
import { getRoom } from "@/lib/inventory/service";
import { CheckoutSummary } from "@/components/checkout-summary";
export const dynamic = "force-dynamic";
export default async function Checkout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireIdentity(`/reservations/${id}/checkout`);
  const reservation = await getReservation(id);
  if (!reservation) notFound();
  const allocation = reservation.room_bookings[0];
  const room = allocation ? await getRoom(allocation.room_id) : null;
  return <CheckoutSummary reservation={reservation} room={room} />;
}
