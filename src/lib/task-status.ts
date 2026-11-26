import type { Task } from "./types";

export type Urgency = "done" | "cancelled" | "overdue" | "today" | "soon" | "later";

export function urgency(t: Pick<Task, "status" | "due_date">, today: string): Urgency {
  if (t.status === "completed") return "done";
  if (t.status === "cancelled") return "cancelled";
  if (t.due_date < today) return "overdue";
  if (t.due_date === today) return "today";
  return "soon";
}

export const URGENCY_STYLE: Record<Urgency, { label: string; cls: string }> = {
  done: { label: "Done", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-600" },
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-800" },
  today: { label: "Due today", cls: "bg-amber-100 text-amber-800" },
  soon: { label: "Upcoming", cls: "bg-sky-100 text-sky-800" },
  later: { label: "Later", cls: "bg-slate-100 text-slate-600" },
};

export function onTime(t: Pick<Task, "completed_on" | "original_due_date" | "due_date">) {
  // on time = finished by the deadline that was set originally (an approved extension still counts as late)
  return !!t.completed_on && t.completed_on <= t.original_due_date;
}
