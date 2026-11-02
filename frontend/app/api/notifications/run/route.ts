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
  const db = createAdminClient();
  const { data: reminders, error } = await db.rpc("enqueue_reminders");
  if (error) console.error("Queueing reminders failed", error);
  const { data: pruned, error: pruneError } = await db.rpc("prune_rate_limits");
  if (pruneError) console.error("Pruning rate limits failed", pruneError);
  return Response.json({
    reminders,
    pruned,
    sent: await deliverNotifications(50),
  });
}
