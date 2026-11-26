import Link from "next/link";
import { formatShort } from "@/lib/dates";
import { URGENCY_STYLE, urgency } from "@/lib/task-status";
import type { Task } from "@/lib/types";

export function TaskCard({ task, today, who, badge }: { task: Task; today: string; who?: string; badge?: string }) {
  const u = urgency(task, today);
  const s = URGENCY_STYLE[u];
  return (
    <Link
      href={`/tasks/${task.id}`}
      className={`card flex items-start gap-3 transition hover:border-brand-600 ${u === "overdue" ? "border-l-4 border-l-red-500" : u === "today" ? "border-l-4 border-l-amber-500" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${s.cls}`}>{s.label}</span>
          {task.recurring_id && <span className="chip bg-violet-100 text-violet-800">↻ Recurring</span>}
          {badge && <span className="chip bg-orange-100 text-orange-800">{badge}</span>}
          <span className="chip bg-slate-100 text-slate-600">{task.category}</span>
        </div>
        <p className="mt-1.5 font-semibold text-slate-900">{task.title}</p>
        <p className="muted mt-0.5">
          Due {formatShort(task.due_date)}
          {task.due_date !== task.original_due_date && " (extended)"}
          {who && ` · ${who}`}
        </p>
      </div>
      <span className="text-slate-400" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}
