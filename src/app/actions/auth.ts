"use server";

import { redirect } from "next/navigation";
import { sendAuthLink } from "@/lib/auth-links";
import { emailConfigured } from "@/lib/email";
import { syncHolidays } from "@/lib/scheduler";
import { createAuthClient, db } from "@/lib/supabase/server";
import type { ActionState } from "./state";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function login(_: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(f, "email").toLowerCase(), password: str(f, "password") });
  if (error) return { error: "Wrong email or password." };
  redirect("/");
}

export async function logout() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setPassword(_: ActionState, f: FormData): Promise<ActionState> {
  const password = str(f, "password");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== str(f, "confirm")) return { error: "The two passwords don't match." };
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function forgotPassword(_: ActionState, f: FormData): Promise<ActionState> {
  const email = str(f, "email").toLowerCase();
  const { data: p } = await db().from("profiles").select("id, active").eq("email", email).maybeSingle();
  if (p?.active && emailConfigured()) {
    try {
      await sendAuthLink(email, "recovery");
    } catch (e) {
      console.error(e);
    }
  }
  return {
    ok: emailConfigured()
      ? "If that email has an account, a reset link is on its way."
      : "Email is not set up yet. Ask your admin to send you a reset link.",
  };
}

/** One-time setup: create the first admin when nobody exists yet. */
export async function setupFirstAdmin(_: ActionState, f: FormData): Promise<ActionState> {
  const { count } = await db().from("profiles").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { error: "Setup is already done. Please log in." };
  const email = str(f, "email").toLowerCase();
  const fullName = str(f, "full_name");
  const password = str(f, "password");
  if (!email || !fullName) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };
  const { data, error } = await db().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) return { error: error?.message ?? "Could not create user" };
  const { data: team } = await db().from("teams").select("id").limit(1).maybeSingle();
  const { error: pe } = await db()
    .from("profiles")
    .insert({ id: data.user.id, email, full_name: fullName, role: "admin", team_id: team?.id ?? null });
  if (pe) return { error: pe.message };
  // load the Bangladesh holiday calendar straight away (the weekly job keeps it fresh)
  await syncHolidays().catch((e) => console.error("holiday sync failed", e));
  const supabase = await createAuthClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/");
}
