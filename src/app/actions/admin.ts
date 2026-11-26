"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rescheduleOpenRecurring, syncHolidays } from "@/lib/scheduler";
import { db } from "@/lib/supabase/server";
import { Profile } from "@/lib/types";
import { sendAuthLink } from "@/lib/auth-links";
import type { ActionState } from "./state";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function admin(): Promise<Profile> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role !== "admin") throw new Error("Admins only");
  return u;
}

export async function inviteUser(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await admin();
  const email = str(f, "email").toLowerCase();
  const fullName = str(f, "full_name");
  const role = str(f, "role") || "member";
  if (!email.includes("@") || !fullName) return { error: "Name and email are required." };
  if (!["admin", "leader", "member"].includes(role)) return { error: "Bad role." };
  const { data: exists } = await db().from("profiles").select("id").eq("email", email).maybeSingle();
  if (exists) return { error: "That person already has an account. Use 'Send login link' instead." };
  try {
    const { userId, link, sent } = await sendAuthLink(email, "invite", fullName);
    const { error } = await db()
      .from("profiles")
      .insert({ id: userId, email, full_name: fullName, role, team_id: me.team_id });
    if (error) return { error: error.message };
    revalidatePath("/admin/users");
    return sent
      ? { ok: `Invitation emailed to ${email}.` }
      : { ok: `Account created. Email isn't set up, so send ${fullName} this one-time link yourself:`, link };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function sendLoginLink(_: ActionState, f: FormData): Promise<ActionState> {
  await admin();
  const { data: p } = await db().from("profiles").select("*").eq("id", str(f, "user_id")).maybeSingle();
  if (!p) return { error: "User not found." };
  try {
    // invite links only work for users who never signed in; recovery works for everyone
    const { link, sent } = await sendAuthLink(p.email, "recovery");
    return sent ? { ok: `Password link emailed to ${p.email}.` } : { ok: `Send this one-time link to ${p.full_name}:`, link };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateUser(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await admin();
  const id = str(f, "user_id");
  const patch: Record<string, unknown> = {};
  const role = str(f, "role");
  if (role) patch.role = role;
  const fullName = str(f, "full_name");
  if (fullName) patch.full_name = fullName;
  if (f.has("active")) patch.active = str(f, "active") === "true";
  if (id === me.id && (patch.role && patch.role !== "admin" || patch.active === false))
    return { error: "You can't remove your own admin access." };
  const { error } = await db().from("profiles").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: "Saved." };
}

export async function runHolidaySync(): Promise<ActionState> {
  await admin();
  try {
    const r = await syncHolidays();
    revalidatePath("/admin/holidays");
    return { ok: `Synced ${r.total} days from the Bangladesh holiday calendar (${r.added} new, ${r.updated} changed).` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveHoliday(_: ActionState, f: FormData): Promise<ActionState> {
  await admin();
  const date = str(f, "holiday_date");
  const name = str(f, "name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) return { error: "Date and name are required." };
  const { error } = await db()
    .from("holidays")
    .upsert(
      { holiday_date: date, name, is_active: true, locked: true, source: "manual", updated_at: new Date().toISOString() },
      { onConflict: "holiday_date" },
    );
  if (error) return { error: error.message };
  await rescheduleOpenRecurring();
  revalidatePath("/admin/holidays");
  return { ok: "Holiday saved." };
}

export async function toggleHoliday(_: ActionState, f: FormData): Promise<ActionState> {
  await admin();
  const id = str(f, "id");
  const op = str(f, "op");
  if (op === "delete") await db().from("holidays").delete().eq("id", id);
  else await db().from("holidays").update({ is_active: op === "on", locked: true }).eq("id", id);
  await rescheduleOpenRecurring();
  revalidatePath("/admin/holidays");
  return { ok: "Updated." };
}
