import Link from "next/link";
import { markNotificationsRead } from "@/app/actions/tasks";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { Notification } from "@/lib/types";
import { EmptyState } from "@/components/task-card";

export const metadata = { title: "Alerts" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const { data } = await db().from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const list = (data ?? []) as Notification[];
  const unread = list.some((n) => !n.read_at);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Alerts</h1>
        {unread && (
          <form action={markNotificationsRead}>
            <button className="btn-secondary">Mark all read</button>
          </form>
        )}
      </div>
      {list.length === 0 && <EmptyState>No alerts yet.</EmptyState>}
      <ul className="space-y-2">
        {list.map((n) => (
          <li key={n.id}>
            <Link href={n.link} className={`card block ${n.read_at ? "" : "border-brand-600 bg-brand-50/40"}`}>
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
              <p className="mt-1 text-xs text-slate-400">
                {new Date(n.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
