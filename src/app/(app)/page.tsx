import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate, formatShort, todayInDhaka } from "@/lib/dates";
import { pendingDeadlineRequests, pendingTransfersTo, peopleById } from "@/lib/queries";
import { db } from "@/lib/supabase/server";
import { isLeader, Task } from "@/lib/types";
import { EmptyState, TaskCard } from "@/components/task-card";
import { TransferResponse } from "@/components/task-actions";
import { loadCalendar } from "@/lib/scheduler";
import { Stat } from "@/components/stat";

export const metadata = { title: "My day" };

export default async function MyDay() {
  const user = await requireUser();
  const today = todayInDhaka();
  const [{ data: openData }, { data: doneData }, transfers, people, cal] = await Promise.all([
    db().from("tasks").select("*").eq("assignee_id", user.id).eq("status", "open").lte("visible_from", today).order("due_date"),
    db().from("tasks").select("*").eq("assignee_id", user.id).eq("status", "completed").eq("completed_on", today),
    pendingTransfersTo(user.id),
    peopleById(),
    loadCalendar(),
  ]);
  const open = (openData ?? []) as Task[];
  const doneToday = (doneData ?? []) as Task[];
  const { data: myReqs } = await db().from("deadline_requests").select("task_id").eq("requested_by", user.id).eq("status", "pending");
  const { data: myOutgoing } = await db().from("transfers").select("task_id").eq("from_user", user.id).eq("status", "pending");
  const pendingReq = new Set((myReqs ?? []).map((r: { task_id: string }) => r.task_id));
  const pendingOut = new Set((myOutgoing ?? []).map((r: { task_id: string }) => r.task_id));
  const badge = (t: Task) => (pendingReq.has(t.id) ? "New date requested" : pendingOut.has(t.id) ? "Transfer pending" : undefined);

  const overdue = open.filter((t) => t.due_date < today);
  const dueToday = open.filter((t) => t.due_date === today);
  const upcoming = open.filter((t) => t.due_date > today);
  const approvals = isLeader(user) ? await pendingDeadlineRequests() : [];
  const holidayName = cal.isHoliday(today) ? "Holiday" : !cal.isWorkingDay(today) ? "Weekend" : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Good {greeting()}, {user.full_name.split(" ")[0]}</h1>
        <p className="muted">
          {formatDate(today)}
          {holidayName && <span className="ml-2 chip bg-slate-100 text-slate-600">{holidayName}</span>}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Overdue" value={overdue.length} tone="red" />
        <Stat label="Due today" value={dueToday.length} tone="amber" />
        <Stat label="Done today" value={doneToday.length} tone="green" />
      </div>

      {(transfers.length > 0 || approvals.length > 0) && (
        <section className="space-y-3">
          <h2 className="h2">Waiting for you</h2>
          {transfers.map((tr) => (
            <div key={tr.id} className="card border-orange-200 bg-orange-50/50">
              <p className="text-sm text-slate-700">
                <b>{people.get(tr.from_user)?.full_name}</b> wants to hand you{" "}
                <Link href={`/tasks/${tr.task_id}`} className="font-semibold text-brand-700 underline">
                  {tr.tasks.title}
                </Link>{" "}
                (due {formatShort(tr.tasks.due_date)})
              </p>
              {tr.note && <p className="mt-1 text-sm text-slate-600 italic">“{tr.note}”</p>}
              <TransferResponse transferId={tr.id} />
            </div>
          ))}
          {approvals.length > 0 && (
            <Link href="/team#approvals" className="card flex items-center justify-between border-amber-200 bg-amber-50/50">
              <span className="text-sm font-medium">
                {approvals.length} deadline change request{approvals.length > 1 ? "s" : ""} to approve
              </span>
              <span className="text-slate-400">›</span>
            </Link>
          )}
        </section>
      )}

      <Section title="Overdue" tasks={overdue} today={today} badge={badge} />
      <Section title="Due today" tasks={dueToday} today={today} badge={badge} empty={overdue.length ? undefined : "Nothing due today. 🎉"} />
      <Section title="Coming up" tasks={upcoming} today={today} badge={badge} />

      {doneToday.length > 0 && <Section title="Completed today" tasks={doneToday} today={today} />}

      {open.length === 0 && transfers.length === 0 && (
        <EmptyState>
          You&apos;re all caught up. Recurring tasks appear here automatically a few working days before they are due.
        </EmptyState>
      )}
    </div>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function Section({
  title,
  tasks,
  today,
  badge,
  empty,
}: {
  title: string;
  tasks: Task[];
  today: string;
  badge?: (t: Task) => string | undefined;
  empty?: string;
}) {
  if (!tasks.length && !empty) return null;
  return (
    <section className="space-y-2">
      <h2 className="h2">
        {title} <span className="font-normal text-slate-400">{tasks.length || ""}</span>
      </h2>
      {tasks.length ? (
        <div className="grid gap-2 md:grid-cols-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} today={today} badge={badge?.(t)} />
          ))}
        </div>
      ) : (
        <EmptyState>{empty}</EmptyState>
      )}
    </section>
  );
}
