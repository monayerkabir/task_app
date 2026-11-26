"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const u = await getCurrentUser();
  if (!u) return { error: "Not signed in" };
  const { error } = await db()
    .from("push_subscriptions")
    .upsert({ user_id: u.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  return error ? { error: error.message } : { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const u = await getCurrentUser();
  if (!u) return;
  await db().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", u.id);
}

export async function setEmailPref(on: boolean) {
  const u = await getCurrentUser();
  if (!u) return;
  await db().from("profiles").update({ email_notifications: on }).eq("id", u.id);
}
