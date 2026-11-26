import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthClient, db } from "./supabase/server";
import { isLeader, Profile } from "./types";

/** The signed-in user's profile, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await db().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile || !profile.active) return null;
  return profile as Profile;
});

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireLeader(): Promise<Profile> {
  const user = await requireUser();
  if (!isLeader(user)) redirect("/");
  return user;
}

export async function requireAdmin(): Promise<Profile> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Active people in the same team (everyone, for an admin without a team). */
export async function teamMembers(user: Profile): Promise<Profile[]> {
  let q = db().from("profiles").select("*").eq("active", true).order("full_name");
  if (user.team_id) q = q.eq("team_id", user.team_id);
  const { data } = await q;
  return (data ?? []) as Profile[];
}

/** Leaders/admins who should hear about something a member did. */
export async function leadersFor(teamId: string | null): Promise<Profile[]> {
  let q = db().from("profiles").select("*").eq("active", true).in("role", ["leader", "admin"]);
  if (teamId) q = q.or(`team_id.eq.${teamId},role.eq.admin`);
  const { data } = await q;
  return (data ?? []) as Profile[];
}
