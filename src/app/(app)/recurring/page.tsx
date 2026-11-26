import Link from "next/link";
import { requireLeader, teamMembers } from "@/lib/auth";
import { addDays, formatShort, todayInDhaka } from "@/lib/dates";
import { describeRecurrence, occurrencesBetween } from "@/lib/recurrence";
import { loadCalendar } from "@/lib/scheduler";
import { db } from "@/lib/supabase/server";
import { RecurringTask } from "@/lib/types";
import { RecurringControls } from "@/components/recurring-controls";
import { EmptyState } from "@/components/task-card";

export const metadata = { title: "Recurring tasks" };

export default async function RecurringPage() {
  const user = await requireLeader();
  const team = await teamMembers(user);
  const { data } = await db().from("recurring_tasks").select("*").order("created_at", { ascending: false });
  const defs = (data ?? []) as RecurringTask[];
  const cal = await loadCalendar();
  const today = todayInDhaka();
  const names = new Map(team.map((p) => [p.id, p.full_name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h1">Recurring tasks</h1>
          <p className="muted">Posted once, they appear on the assignee&apos;s dashboard automatically before each due date.</p>
        </div>
        <Link href="/tasks/new" className="btn-primary shrink-0">
          + New
        </Link>
      </div>
      {defs.length === 0 && <EmptyState>No recurring tasks yet.</EmptyState>}
      <div className="grid gap-3 md:grid-cols-2">
        {defs.map((d) => {
          const next = occurrencesBetween(d, cal, today, addDays(today, 200)).slice(0, 3);
          return (
            <div key={d.id} className={`card space-y-2 ${d.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{d.title}</p>
                  <p className="muted">{describeRecurrence(d)}</p>
                </div>
                {!d.active && <span className="chip bg-slate-200 text-slate-600">Paused</span>}
              </div>
              <p className="text-sm">
                <span className="text-slate-500">Assigned to</span> <b>{names.get(d.assignee_id) ?? "—"}</b> ·{" "}
                <span className="text-slate-500">shows {d.lead_days} working days early</span>
              </p>
              {d.active && next.length > 0 && (
                <p className="text-sm text-slate-600">Next due: {next.map((o) => formatShort(o.dueDate)).join(", ")}</p>
              )}
              <RecurringControls id={d.id} active={d.active} assigneeId={d.assignee_id} people={team.map((p) => ({ id: p.id, full_name: p.full_name }))} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
