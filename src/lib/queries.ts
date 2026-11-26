import "server-only";
import { db } from "./supabase/server";
import { DeadlineRequest, Profile, Task, Transfer } from "./types";

export async function peopleById(): Promise<Map<string, Profile>> {
  const { data } = await db().from("profiles").select("*");
  return new Map(((data ?? []) as Profile[]).map((p) => [p.id, p]));
}

export async function unreadCount(userId: string): Promise<number> {
  const { count } = await db()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function pendingTransfersTo(userId: string) {
  const { data } = await db().from("transfers").select("*, tasks(*)").eq("to_user", userId).eq("status", "pending");
  return (data ?? []) as (Transfer & { tasks: Task })[];
}

export async function pendingDeadlineRequests(teamUserIds?: string[]) {
  let q = db().from("deadline_requests").select("*, tasks(*)").eq("status", "pending").order("created_at");
  if (teamUserIds) q = q.in("requested_by", teamUserIds);
  const { data } = await q;
  return (data ?? []) as (DeadlineRequest & { tasks: Task })[];
}
