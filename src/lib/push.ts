import "server-only";
import * as webpush from "web-push";
import { optionalEnv } from "./env";
import { db } from "./supabase/server";

let ready: boolean | null = null;

export function pushConfigured() {
  if (ready === null) {
    const pub = optionalEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    const priv = optionalEnv("VAPID_PRIVATE_KEY");
    ready = Boolean(pub && priv);
    if (ready) webpush.setVapidDetails(optionalEnv("VAPID_SUBJECT") ?? "mailto:admin@example.com", pub!, priv!);
  }
  return ready;
}

export async function sendPush(userId: string, payload: { title: string; body: string; url: string }) {
  if (!pushConfigured()) return;
  const { data: subs } = await db().from("push_subscriptions").select("*").eq("user_id", userId);
  await Promise.all(
    (subs ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db().from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", e);
      }
    }),
  );
}
