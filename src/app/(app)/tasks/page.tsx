import Link from "next/link";
import { requireUser, teamMembers } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { db } from "@/lib/supabase/server";
import { isLeader, Task } from "@/lib/types";
import { EmptyState, TaskCard } from "@/components/task-card";

export const metadata = { title: "All tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const sp = await searchParams;
  const user = await requireUser();
  const leader = isLeader(user);
  const team = await teamMembers(user);
  const status = (sp.status as string) || "open";
  const who = (sp.who as string) || (leader ? "team" : "me");
  const q = ((sp.q as string) || "").trim();
  const today = todayInDhaka();

  let query = db().from("tasks").select("*").order("due_date", { ascending: status !== "completed" }).limit(200);
  if (status !== "all") query = query.eq("status", status);
  if (status === "open") query = query.lte("visible_from", today);
  if (who === "me") query = query.eq("assignee_id", user.id);
  else if (who === "team") query = query.in("assignee_id", team.map((p) => p.id));
  else query = query.eq("assignee_id", who);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const tasks = (data ?? []) as Task[];
  const names = new Map(team.map((p) => [p.id, p.full_name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Tasks</h1>
        {leader && (
          <Link href="/tasks/new" className="btn-primary">
            + Assign task
          </Link>
        )}
      </div>
      <form className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <input name="q" defaultValue={q} placeholder="Search title" className="input col-span-2 md:col-span-1" />
        <select name="status" defaultValue={status} className="input">
          <option value="open">Open</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
        <select name="who" defaultValue={who} className="input">
          <option value="me">Mine</option>
          <option value="team">Whole team</option>
          {team.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        <button className="btn-secondary col-span-2 md:col-span-1">Filter</button>
      </form>
      {tasks.length ? (
        <div className="grid gap-2 md:grid-cols-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} today={today} who={who === "me" ? undefined : names.get(t.assignee_id)} />
          ))}
        </div>
      ) : (
        <EmptyState>No tasks match.</EmptyState>
      )}
    </div>
  );
}
