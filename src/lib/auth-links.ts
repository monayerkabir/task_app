import "server-only";
import { emailLayout, sendEmail } from "./email";
import { APP_NAME, siteUrl } from "./env";
import { db } from "./supabase/server";

/** Emails a one-time link (type invite or recovery) built from Supabase's hashed token. */
export async function sendAuthLink(email: string, type: "invite" | "recovery", fullName?: string) {
  const { data, error } = await db().auth.admin.generateLink(
    type === "invite"
      ? { type: "invite", email, options: { data: { full_name: fullName } } }
      : { type: "recovery", email },
  );
  if (error || !data?.properties?.hashed_token) throw new Error(error?.message ?? "Could not create link");
  const link = `${siteUrl()}/auth/confirm?token_hash=${data.properties.hashed_token}&type=${type}`;
  const sent = await sendEmail(
    email,
    type === "invite" ? `You're invited to ${APP_NAME}` : `Reset your ${APP_NAME} password`,
    emailLayout(
      type === "invite" ? `Welcome${fullName ? ", " + fullName : ""}` : "Reset your password",
      [
        type === "invite"
          ? `You have been added to ${APP_NAME}, the Credit Analytics task tracker. Click below to choose your password.`
          : "Click below to choose a new password. If you didn't ask for this, ignore this email.",
        "The link works once and expires in 24 hours.",
      ],
      { label: type === "invite" ? "Set my password" : "Choose new password", href: link },
    ),
  );
  return { userId: data.user.id, link, sent };
}

