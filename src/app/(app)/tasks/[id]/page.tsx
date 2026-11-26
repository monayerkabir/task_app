import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, teamMembers } from "@/lib/auth";
import { formatDate, todayInDhaka } from "@/lib/dates";
import { peopleById } from "@/lib/queries";
import { describeRecurrence } from "@/lib/recurrence";
import { db } from "@/lib/supabase/server";
import { URGENCY_STYLE, onTime, urgency } from "@/lib/task-status";
import { DeadlineRequest, isLeader, RecurringTask, Task, TaskEvent, Transfer } from "@/lib/types";
import { CancelTransfer, DeadlineDecision, TaskActions, TransferResponse } from "@/components/task-actions";

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const { data } = await db().from("tasks").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const task = data as Task;
  const people = await peopleById();
  const assignee = people.get(task.assignee_id);
  const leader = isLeader(user);
  if (!leader && task.assignee_id !== user.id && assignee?.team_id !== user.team_id) notFound();

  const [{ data: ev }, { data: reqs }, { data: trs }, rec, team] = await Promise.all([
    db().from("task_events").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    db().from("deadline_requests").select("*").eq("task_id", id).eq("status", "pending"),
    db().from("transfers").select("*").eq("task_id", id).eq("status", "pending"),
    task.recurring_id
      ? db().from("recurring_tasks").select("*").eq("id", task.recurring_id).maybeSingle()
      : Promise.resolve({ data: null }),
    teamMembers(user),
  ]);
  const events = (ev ?? []) as TaskEvent[];
  const pendingReq = (reqs ?? [])[0] as DeadlineRequest | undefined;
  const pendingTr = (trs ?? [])[0] as Transfer | undefined;
  const recurring = rec.data as RecurringTask | null;
  const today = todayInDhaka();
  const u = urgency(task, today);
  const canWork = task.assignee_id === user.id || leader;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/" className="muted hover:text-brand-700">
        ‹ Back
      </Link>
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className={`chip ${URGENCY_STYLE[u].cls}`}>{URGENCY_STYLE[u].label}</span>
          {recurring && <span className="chip bg-violet-100 text-violet-800">↻ {describeRecurrence(recurring)}</span>}
          <span className="chip bg-slate-100 text-slate-600">{task.category}</span>
        </div>
        <h1 className="h1">{task.title}</h1>
        {task.description && <p className="whitespace-pre-wrap text-slate-700">{task.description}</p>}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Item k="Assigned to" v={assignee?.full_name ?? "—"} />
          <Item k="Assigned by" v={people.get(task.created_by)?.full_name ?? "—"} />
          <Item k="Due" v={formatDate(task.due_date) + (task.due_date !== task.original_due_date ? ` (was ${formatDate(task.original_due_date)})` : "")} />
          {task.status === "completed" ? (
            <Item k="Completed" v={`${formatDate(task.completed_on)}${onTime(task) ? " · on time" : " · late"}`} />
          ) : (
            <Item k="Visible from" v={formatDate(task.visible_from)} />
          )}
        </dl>
      </div>

      {pendingTr && (
        <div className="card border-orange-200 bg-orange-50/50">
          <p className="text-sm">
            Transfer from <b>{people.get(pendingTr.from_user)?.full_name}</b> to <b>{people.get(pendingTr.to_user)?.full_name}</b> is waiting
            for acceptance.
          </p>
          {pendingTr.note && <p className="mt-1 text-sm italic text-slate-600">“{pendingTr.note}”</p>}
          {pendingTr.to_user === user.id && <TransferResponse transferId={pendingTr.id} />}
          {(pendingTr.from_user === user.id || leader) && pendingTr.to_user !== user.id && <CancelTransfer transferId={pendingTr.id} />}
        </div>
      )}

      {pendingReq && (
        <div className="card border-amber-200 bg-amber-50/50">
          <p className="text-sm">
            <b>{people.get(pendingReq.requested_by)?.full_name}</b> asked to move the deadline from {formatDate(pendingReq.current_due)} to{" "}
            <b>{formatDate(pendingReq.proposed_due)}</b>.
          </p>
          <p className="mt-1 text-sm italic text-slate-600">“{pendingReq.reason}”</p>
          {leader ? <DeadlineDecision requestId={pendingReq.id} /> : <p className="muted mt-1">Waiting for team leader approval.</p>}
        </div>
      )}

      <TaskActions
        taskId={task.id}
        open={task.status === "open"}
        dueDate={task.due_date}
        teammates={team.filter((p) => p.id !== task.assignee_id).map((p) => ({ id: p.id, full_name: p.full_name }))}
        canWork={canWork}
        leader={leader}
        hasPendingRequest={!!pendingReq}
        hasPendingTransfer={!!pendingTr}
      />

      <section className="card">
        <h2 className="h2 mb-3">History and remarks</h2>
        <ol className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-0.5 text-base">{ICON[e.kind] ?? "•"}</span>
              <div>
                <p>
                  <b>{e.actor_id ? (people.get(e.actor_id)?.full_name ?? "Someone") : "System"}</b>{" "}
                  <span className="text-slate-500">{LABEL[e.kind] ?? e.kind}</span>
                </p>
                {e.body && <p className="whitespace-pre-wrap text-slate-700">{e.body}</p>}
                <p className="text-xs text-slate-400">
                  {new Date(e.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  );
}

const ICON: Record<string, string> = {
  created: "✦",
  remark: "💬",
  completed: "✅",
  reopened: "↺",
  deadline_requested: "📅",
  deadline_approved: "✔",
  deadline_rejected: "✖",
  transfer_requested: "⇄",
  transfer_accepted: "🤝",
  transfer_declined: "✖",
  reassigned: "⇄",
  rescheduled: "📅",
  cancelled: "⊘",
};
const LABEL: Record<string, string> = {
  created: "created the task",
  remark: "added a remark",
  completed: "marked it complete",
  reopened: "reopened it",
  deadline_requested: "asked for a new deadline",
  deadline_approved: "changed the deadline",
  deadline_rejected: "rejected the new deadline",
  transfer_requested: "requested a transfer",
  transfer_accepted: "accepted the transfer",
  transfer_declined: "transfer not accepted",
  reassigned: "reassigned it",
  rescheduled: "rescheduled it",
  cancelled: "cancelled it",
};
