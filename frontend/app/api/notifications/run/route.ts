import { createHash, timingSafeEqual } from "node:crypto";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { deliverNotifications } from "@/lib/notifications";
export const dynamic = "force-dynamic";
const digest = (s: string) => createHash("sha256").update(s).digest();
/** Daily Vercel cron: queue tomorrow's reminders, then send or retry due emails. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(digest(given), digest(`Bearer ${secret}`)))
    return new Response("Unauthorized", { status: 401 });
  if (!adminConfigured())
    return new Response("Not configured", { status: 503 });
  const { data: reminders, error } =
    await createAdminClient().rpc("enqueue_reminders");
  if (error) console.error("Queueing reminders failed", error);
  return Response.json({ reminders, sent: await deliverNotifications(50) });
}
