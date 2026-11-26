import "server-only";
import { emailLayout, sendEmail } from "./email";
import { siteUrl } from "./env";
import { sendPush } from "./push";
import { db } from "./supabase/server";
import { Profile } from "./types";

export interface NotifyInput {
  title: string;
  body: string;
  link: string;
  /** also send an email right away (in-app and push are always sent) */
  email?: boolean;
}

/** In-app notification + phone push + (optionally) email. Never throws. */
export async function notify(users: (Profile | null | undefined)[], input: NotifyInput) {
  const seen = new Set<string>();
  const targets = users.filter((u): u is Profile => !!u && u.active && !seen.has(u.id) && !!seen.add(u.id));
  if (targets.length === 0) return;
  try {
    await db()
      .from("notifications")
      .insert(targets.map((u) => ({ user_id: u.id, title: input.title, body: input.body, link: input.link })));
  } catch (e) {
    console.error("notification insert failed", e);
  }
  const url = siteUrl() + input.link;
  await Promise.allSettled(
    targets.flatMap((u) => [
      sendPush(u.id, { title: input.title, body: input.body, url: input.link }),
      input.email && u.email_notifications
        ? sendEmail(u.email, input.title, emailLayout(input.title, [input.body], { label: "Open task", href: url }))
        : Promise.resolve(),
    ]),
  );
}
