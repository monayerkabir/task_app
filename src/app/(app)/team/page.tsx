import Link from "next/link";
import { requireLeader, teamMembers } from "@/lib/auth";
import { addDays, daysInMonth, formatDate, formatShort, parse, todayInDhaka, weekday, ymd } from "@/lib/dates";
import { pendingDeadlineRequests } from "@/lib/queries";
import { db } from "@/lib/supabase/server";
import { onTime } from "@/lib/task-status";
import { Task } from "@/lib/types";
import { Stat } from "@/components/stat";
import { DeadlineDecision } from "@/components/task-actions";

export const metadata = { title: "Team dashboard" };

type PeriodKey = "week" | "month" | "quarter";

function range(p: PeriodKey, today: string): [string, string, string] {
  const d = parse(today);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (p === "week") {
    const start = addDays(today, -weekday(today));
    return [start, addDays(start, 6), `Week of ${formatShort(start)}`];
  }
  if (p === "month") return [ymd(y, m, 1), ymd(y, m, daysInMonth(y, m)), d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })];
  const qs = Math.floor((m - 1) / 3) * 3 + 1;
  return [ymd(y, qs, 1), ymd(y, qs + 2, daysInMonth(y, qs + 2)), `Q${(qs - 1) / 3 + 1} ${y}`];
}

export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const user = await requireLeader();
  const sp = await searchParams;
  const period = (["week", "month", "quarter"].includes(sp.period as string) ? sp.period : "month") as PeriodKey;
  const today = todayInDhaka();
  const [from, to, label] = range(period, today);
  const team = await teamMembers(user);
  const ids = team.map((p) => p.id);

  const [{ data: inPeriod }, { data: openNow }, { data: transfers }, requests] = await Promise.all([
    // everything due in the period (by original schedule or current date)
    db().from("tasks").select("*").in("assignee_id", ids).neq("status", "cancelled").or(`and(due_date.gte.${from},due_date.lte.${to}),and(completed_on.gte.${from},completed_on.lte.${to})`),
    db().from("tasks").select("*").in("assignee_id", ids).eq("status", "open").lte("visible_from", today),
    db().from("transfers").select("to_user, from_user").eq("status", "pending"),
    pendingDeadlineRequests(ids),
  ]);
  const tasks = (inPeriod ?? []) as Task[];
  const open = (openNow ?? []) as Task[];
  const names = new Map(team.map((p) => [p.id, p.full_name]));

  const completed = tasks.filter((t) => t.status === "completed" && t.completed_on! >= from && t.completed_on! <= to);
  const due = tasks.filter((t) => t.due_date >= from && t.due_date <= to);
  const overdue = open.filter((t) => t.due_date < today);
  const onTimeRate = completed.length ? Math.round((completed.filter(onTime).length / completed.length) * 100) : null;

  const rows = team.map((p) => {
    const mineDue = due.filter((t) => t.assignee_id === p.id);
    const mineDone = completed.filter((t) => t.assignee_id === p.id);
    return {
      p,
      due: mineDue.length,
      done: mineDone.length,
      onTime: mineDone.filter(onTime).length,
      open: open.filter((t) => t.assignee_id === p.id).length,
      overdue: overdue.filter((t) => t.assignee_id === p.id).length,
      transfers: (transfers ?? []).filter((t: { to_user: string; from_user: string }) => t.to_user === p.id || t.from_user === p.id).length,
    };
  });

  const cats = new Map<string, { due: number; done: number; overdue: number }>();
  for (const t of due) {
    const c = cats.get(t.category) ?? { due: 0, done: 0, overdue: 0 };
    c.due++;
    if (t.status === "completed") c.done++;
    else if (t.due_date < today) c.overdue++;
    cats.set(t.category, c);
  }
  const recurringDue = due.filter((t) => t.recurring_id);
  const adhocDue = due.filter((t) => !t.recurring_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Team dashboard</h1>
          <p className="muted">
            {label} · {formatDate(from)} to {formatDate(to)}
          </p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
          {(["week", "month", "quarter"] as const).map((k) => (
            <Link
              key={k}
              href={`/team?period=${k}`}
              className={`rounded-md px-3 py-1.5 font-medium capitalize ${period === k ? "bg-white text-brand-800 shadow" : "text-slate-500"}`}
            >
              {k}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Due this period" value={due.length} tone="slate" />
        <Stat label="Completed" value={completed.length} tone="green" />
        <Stat label="On-time rate" value={onTimeRate === null ? "—" : `${onTimeRate}%`} tone="sky" />
        <Stat label="Open now" value={open.length} tone="amber" />
        <Stat label="Overdue now" value={overdue.length} tone="red" />
      </div>

      {requests.length > 0 && (
        <section id="approvals" className="space-y-2">
          <h2 className="h2">Deadline changes to approve</h2>
          {requests.map((r) => (
            <div key={r.id} className="card border-amber-200">
              <p className="text-sm">
                <b>{names.get(r.requested_by)}</b> ·{" "}
                <Link href={`/tasks/${r.task_id}`} className="font-semibold text-brand-700 underline">
                  {r.tasks.title}
                </Link>
              </p>
              <p className="text-sm text-slate-600">
                {formatDate(r.current_due)} → <b>{formatDate(r.proposed_due)}</b> · “{r.reason}”
              </p>
              <DeadlineDecision requestId={r.id} />
            </div>
          ))}
        </section>
      )}

      <section className="card overflow-x-auto p-0">
        <h2 className="h2 px-4 pt-4">By team member</h2>
        <table className="mt-2 w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2">Member</th>
              <th className="px-2 py-2">Progress (done / due)</th>
              <th className="px-2 py-2 text-right">On time</th>
              <th className="px-2 py-2 text-right">Open</th>
              <th className="px-2 py-2 text-right">Overdue</th>
              <th className="px-4 py-2 text-right">Transfers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.due ? Math.min(100, Math.round((r.done / r.due) * 100)) : 0;
              return (
                <tr key={r.p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/tasks?who=${r.p.id}&status=all`} className="hover:text-brand-700">
                      {r.p.full_name}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="tabular-nums text-slate-600">
                        {r.done}/{r.due}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{r.done ? `${Math.round((r.onTime / r.done) * 100)}%` : "—"}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{r.open}</td>
                  <td className={`px-2 py-2.5 text-right tabular-nums ${r.overdue ? "font-semibold text-red-700" : ""}`}>{r.overdue}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.transfers || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-3">By type of work</h2>
          {cats.size === 0 && <p className="muted">Nothing due in this period.</p>}
          <ul className="space-y-3">
            {[...cats.entries()]
              .sort((a, b) => b[1].due - a[1].due)
              .map(([name, c]) => (
                <li key={name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="tabular-nums text-slate-500">
                      {c.done}/{c.due} done{c.overdue ? ` · ${c.overdue} overdue` : ""}
                    </span>
                  </div>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-brand-600" style={{ width: `${(c.done / c.due) * 100}%` }} />
                    <div className="bg-red-400" style={{ width: `${(c.overdue / c.due) * 100}%` }} />
                  </div>
                </li>
              ))}
          </ul>
        </section>
        <section className="card">
          <h2 className="h2 mb-3">Recurring vs ad hoc</h2>
          <Split label="↻ Recurring" all={recurringDue} />
          <Split label="One-off (ad hoc)" all={adhocDue} />
          <h3 className="mt-5 mb-2 text-sm font-semibold">Overdue right now</h3>
          {overdue.length === 0 ? (
            <p className="muted">None. 👍</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {overdue.slice(0, 10).map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="text-red-700 hover:underline">
                    {t.title}
                  </Link>{" "}
                  <span className="text-slate-500">
                    · {names.get(t.assignee_id)} · due {formatShort(t.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Split({ label, all }: { label: string; all: Task[] }) {
  const done = all.filter((t) => t.status === "completed").length;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-slate-500">
          {done}/{all.length} done
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-600" style={{ width: all.length ? `${(done / all.length) * 100}%` : 0 }} />
      </div>
    </div>
  );
}
