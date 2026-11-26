import "server-only";
import { addDays, ISODate, todayInDhaka, WorkCalendar } from "./dates";
import { emailLayout, sendEmail } from "./email";
import { optionalEnv, siteUrl } from "./env";
import { parseIcsHolidays } from "./ics";
import { notify } from "./notify";
import { dueDateForPeriodKey, occurrencesBetween } from "./recurrence";
import { db } from "./supabase/server";
import { Profile, RecurringTask, Task } from "./types";

export const DEFAULT_HOLIDAY_ICS =
  "https://calendar.google.com/calendar/ical/en.bd%23holiday%40group.v.calendar.google.com/public/basic.ics";

export async function loadCalendar(): Promise<WorkCalendar> {
  const { data } = await db().from("holidays").select("holiday_date").eq("is_active", true);
  return new WorkCalendar((data ?? []).map((h: { holiday_date: string }) => h.holiday_date));
}

/**
 * Post recurring tasks whose "show from" date has arrived. Each period is
 * posted once (unique recurring_id + period_key), so this is safe to run
 * any number of times.
 */
export async function generateRecurring(opts: { recurringId?: string; today?: ISODate } = {}) {
  const today = opts.today ?? todayInDhaka();
  const cal = await loadCalendar();
  let q = db().from("recurring_tasks").select("*").eq("active", true);
  if (opts.recurringId) q = q.eq("id", opts.recurringId);
  const { data: defs } = await q;
  const created: Task[] = [];

  for (const def of (defs ?? []) as RecurringTask[]) {
    // look back a little in case the daily job missed a day; look ahead far enough for the lead time
    const from = def.start_date > addDays(today, -10) ? def.start_date : addDays(today, -10);
    const occ = occurrencesBetween(def, cal, from, addDays(today, 62));
    const rows = occ
      .map((o) => ({ ...o, visibleFrom: cal.subtractWorkingDays(o.dueDate, def.lead_days) }))
      .filter((o) => o.visibleFrom <= today)
      .map((o) => ({
        recurring_id: def.id,
        period_key: o.periodKey,
        title: def.title,
        description: def.description,
        category: def.category,
        assignee_id: def.assignee_id,
        created_by: def.created_by,
        due_date: o.dueDate,
        original_due_date: o.dueDate,
        visible_from: o.visibleFrom,
      }));
    if (rows.length === 0) continue;
    const { data: inserted, error } = await db()
      .from("tasks")
      .upsert(rows, { onConflict: "recurring_id,period_key", ignoreDuplicates: true })
      .select("*");
    if (error) {
      console.error("generate failed", def.id, error);
      continue;
    }
    for (const t of (inserted ?? []) as Task[]) {
      created.push(t);
      await db().from("task_events").insert({ task_id: t.id, actor_id: null, kind: "created", body: "Posted automatically" });
    }
  }

  // tell each assignee once
  const byUser = new Map<string, Task[]>();
  for (const t of created) byUser.set(t.assignee_id, [...(byUser.get(t.assignee_id) ?? []), t]);
  if (byUser.size) {
    const { data: people } = await db().from("profiles").select("*").in("id", [...byUser.keys()]);
    for (const p of (people ?? []) as Profile[]) {
      const tasks = byUser.get(p.id)!;
      await notify([p], {
        title: tasks.length === 1 ? `New task: ${tasks[0].title}` : `${tasks.length} recurring tasks posted`,
        body: tasks.map((t) => `${t.title} (due ${t.due_date})`).join(", "),
        link: tasks.length === 1 ? `/tasks/${tasks[0].id}` : "/",
      });
    }
  }
  return created.length;
}

/** Pull the Bangladesh public holiday calendar and store it. Admin edits are kept. */
export async function syncHolidays(): Promise<{ added: number; updated: number; total: number }> {
  const url = optionalEnv("HOLIDAY_ICS_URL") ?? DEFAULT_HOLIDAY_ICS;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Holiday calendar returned ${res.status}`);
  const events = parseIcsHolidays(await res.text());

  // expand multi-day events into single days
  const days = new Map<string, { name: string; isPublic: boolean }>();
  for (const e of events) {
    let d = e.date;
    const end = e.endExclusive && e.endExclusive > e.date ? e.endExclusive : addDays(e.date, 1);
    for (let i = 0; d < end && i < 15; i++, d = addDays(d, 1)) {
      const prev = days.get(d);
      // a public holiday wins over an observance on the same day
      if (!prev || (!prev.isPublic && e.isPublic)) days.set(d, { name: e.name, isPublic: e.isPublic });
      else if (prev.isPublic === e.isPublic && !prev.name.includes(e.name)) prev.name += ` / ${e.name}`;
    }
  }

  const { data: existing } = await db().from("holidays").select("*");
  const byDate = new Map((existing ?? []).map((h: { holiday_date: string }) => [h.holiday_date, h]));
  let added = 0;
  let updated = 0;
  const rows = [];
  for (const [date, v] of days) {
    const cur = byDate.get(date) as { locked: boolean; name: string; is_active: boolean } | undefined;
    if (cur?.locked) continue;
    if (cur && cur.name === v.name && cur.is_active === v.isPublic) continue;
    if (cur) updated++;
    else added++;
    rows.push({ holiday_date: date, name: v.name, source: "google", is_active: v.isPublic, updated_at: new Date().toISOString() });
  }
  if (rows.length) {
    const { error } = await db().from("holidays").upsert(rows, { onConflict: "holiday_date" });
    if (error) throw new Error(error.message);
    await rescheduleOpenRecurring();
  }
  return { added, updated, total: days.size };
}

/**
 * After holidays change, move open recurring tasks that still have their
 * original date (nobody approved a new deadline) to the right working day.
 */
export async function rescheduleOpenRecurring() {
  const today = todayInDhaka();
  const cal = await loadCalendar();
  const { data: tasks } = await db()
    .from("tasks")
    .select("*, recurring_tasks(*)")
    .eq("status", "open")
    .not("recurring_id", "is", null)
    .gte("due_date", today);
  for (const t of (tasks ?? []) as (Task & { recurring_tasks: RecurringTask | null })[]) {
    if (!t.recurring_tasks || !t.period_key || t.due_date !== t.original_due_date) continue;
    const due = dueDateForPeriodKey(t.recurring_tasks, t.period_key, cal);
    if (!due || due === t.due_date) continue;
    await db().from("tasks").update({ due_date: due, original_due_date: due }).eq("id", t.id);
    await db()
      .from("task_events")
      .insert({ task_id: t.id, actor_id: null, kind: "rescheduled", body: `Holiday calendar changed: due ${t.due_date} → ${due}` });
  }
}

/** Morning email: what is due today, what is overdue, what waits for you. */
export async function sendDailyDigest() {
  const today = todayInDhaka();
  const cal = await loadCalendar();
  if (!cal.isWorkingDay(today)) return 0;
  const { data: people } = await db().from("profiles").select("*").eq("active", true).eq("email_notifications", true);
  const { data: open } = await db()
    .from("tasks")
    .select("id, title, due_date, assignee_id")
    .eq("status", "open")
    .lte("visible_from", today)
    .order("due_date");
  const { data: transfers } = await db().from("transfers").select("to_user").eq("status", "pending");
  const { data: deadlineReqs } = await db().from("deadline_requests").select("id").eq("status", "pending");
  let sent = 0;
  for (const p of (people ?? []) as Profile[]) {
    const mine = ((open ?? []) as Task[]).filter((t) => t.assignee_id === p.id);
    const overdue = mine.filter((t) => t.due_date < today);
    const dueToday = mine.filter((t) => t.due_date === today);
    const upcoming = mine.filter((t) => t.due_date > today);
    const incoming = (transfers ?? []).filter((t: { to_user: string }) => t.to_user === p.id).length;
    const approvals = p.role !== "member" ? (deadlineReqs ?? []).length : 0;
    if (!mine.length && !incoming && !approvals) continue;
    const lines = [
      overdue.length ? `Overdue (${overdue.length}): ${overdue.map((t) => t.title).join(", ")}` : "",
      dueToday.length ? `Due today (${dueToday.length}): ${dueToday.map((t) => t.title).join(", ")}` : "",
      upcoming.length ? `Coming up (${upcoming.length}): ${upcoming.map((t) => `${t.title} (${t.due_date})`).join(", ")}` : "",
      incoming ? `${incoming} task transfer(s) waiting for you to accept.` : "",
      approvals ? `${approvals} deadline change request(s) waiting for approval.` : "",
    ].filter(Boolean);
    const ok = await sendEmail(
      p.email,
      `Your tasks for today: ${dueToday.length} due, ${overdue.length} overdue`,
      emailLayout(`Good morning, ${p.full_name.split(" ")[0]}`, lines, { label: "Open my tasks", href: siteUrl() + "/" }),
    );
    if (ok) sent++;
  }
  return sent;
}
