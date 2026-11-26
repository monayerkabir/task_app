"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, leadersFor, teamMembers } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { generateRecurring, loadCalendar } from "@/lib/scheduler";
import { db } from "@/lib/supabase/server";
import { isLeader, Profile, Task } from "@/lib/types";
import type { ActionState } from "./state";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

async function me(): Promise<Profile> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

async function profile(id: string): Promise<Profile | null> {
  const { data } = await db().from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Profile) ?? null;
}

async function loadTask(id: string): Promise<Task> {
  const { data } = await db().from("tasks").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("Task not found");
  return data as Task;
}

async function event(taskId: string, actorId: string | null, kind: string, body = "") {
  await db().from("task_events").insert({ task_id: taskId, actor_id: actorId, kind, body });
}

function done(taskId: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/tasks/${taskId}`);
}

// ------------------------------------------------------------------ create

export async function createTask(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  if (!isLeader(user)) return { error: "Only team leaders can assign tasks." };

  const title = str(f, "title");
  const assigneeId = str(f, "assignee_id");
  const kind = str(f, "kind");
  if (!title) return { error: "Please enter a title." };
  const team = await teamMembers(user);
  const assignee = team.find((p) => p.id === assigneeId);
  if (!assignee) return { error: "Please choose who the task is for." };
  const base = {
    title,
    description: str(f, "description"),
    category: str(f, "category") || "General",
    assignee_id: assignee.id,
    created_by: user.id,
  };

  if (kind === "recurring") {
    const frequency = str(f, "frequency");
    const rule = str(f, "rule");
    if (!["weekly", "monthly", "quarterly", "half_yearly"].includes(frequency)) return { error: "Choose how often it repeats." };
    if (!["working_day", "calendar_day", "last_working_day"].includes(rule)) return { error: "Choose when it is due." };
    const ruleValue = Number(frequency === "weekly" && rule === "calendar_day" ? str(f, "weekday") : str(f, "rule_value") || 1);
    const startDate = str(f, "start_date") || todayInDhaka();
    const endDate = str(f, "end_date") || null;
    if (!isDate(startDate) || (endDate && !isDate(endDate))) return { error: "Dates are not valid." };
    const { data, error } = await db()
      .from("recurring_tasks")
      .insert({
        ...base,
        frequency,
        rule,
        rule_value: Number.isFinite(ruleValue) ? ruleValue : 1,
        period_month: Number(str(f, "period_month") || 1),
        lead_days: Math.max(0, Math.min(20, Number(str(f, "lead_days") || 3))),
        start_date: startDate,
        end_date: endDate,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    const posted = await generateRecurring({ recurringId: data.id });
    revalidatePath("/", "layout");
    return {
      ok: posted
        ? `Recurring task saved. ${posted} occurrence(s) posted now; the rest will appear automatically.`
        : "Recurring task saved. It will appear automatically before each due date.",
      link: "/recurring",
    };
  }

  const due = str(f, "due_date");
  if (!isDate(due)) return { error: "Please choose a due date." };
  const today = todayInDhaka();
  const { data: task, error } = await db()
    .from("tasks")
    .insert({ ...base, due_date: due, original_due_date: due, visible_from: today })
    .select("*")
    .single();
  if (error) return { error: error.message };
  await event(task.id, user.id, "created", "Ad hoc task");
  await notify([assignee.id === user.id ? null : assignee], {
    title: `New task from ${user.full_name}: ${title}`,
    body: `Due ${due}`,
    link: `/tasks/${task.id}`,
    email: true,
  });
  revalidatePath("/", "layout");
  return { ok: "Task assigned.", link: `/tasks/${task.id}` };
}

// ------------------------------------------------------------------ assignee actions

function canWork(user: Profile, task: Task) {
  return task.assignee_id === user.id || isLeader(user);
}

export async function completeTask(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  const task = await loadTask(str(f, "task_id"));
  if (!canWork(user, task)) return { error: "This task is not assigned to you." };
  if (task.status !== "open") return { error: "This task is already closed." };
  const remark = str(f, "remark");
  await db()
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString(), completed_on: todayInDhaka() })
    .eq("id", task.id);
  await event(task.id, user.id, "completed", remark);
  // a pending transfer or deadline request no longer makes sense
  await db().from("transfers").update({ status: "cancelled" }).eq("task_id", task.id).eq("status", "pending");
  await db().from("deadline_requests").update({ status: "cancelled" }).eq("task_id", task.id).eq("status", "pending");
  if (!isLeader(user)) {
    await notify(await leadersFor(user.team_id), {
      title: `${user.full_name} completed: ${task.title}`,
      body: remark || `Due ${task.due_date}`,
      link: `/tasks/${task.id}`,
    });
  }
  done(task.id);
  return { ok: "Marked as complete." };
}

export async function reopenTask(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  const task = await loadTask(str(f, "task_id"));
  if (!canWork(user, task)) return { error: "Not allowed." };
  await db().from("tasks").update({ status: "open", completed_at: null, completed_on: null }).eq("id", task.id);
  await event(task.id, user.id, "reopened", str(f, "remark"));
  done(task.id);
  return { ok: "Task reopened." };
}

export async function addRemark(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  const task = await loadTask(str(f, "task_id"));
  if (!canWork(user, task)) return { error: "Not allowed." };
  const body = str(f, "remark");
  if (!body) return { error: "Write a remark first." };
  await event(task.id, user.id, "remark", body);
  const others = isLeader(user) ? [await profile(task.assignee_id)] : await leadersFor(user.team_id);
  await notify(others.filter((p) => p?.id !== user.id), {
    title: `Remark on ${task.title}`,
    body: `${user.full_name}: ${body}`,
    link: `/tasks/${task.id}`,
  });
  done(task.id);
  return { ok: "Remark added." };
}

export async function requestDeadline(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  const task = await loadTask(str(f, "task_id"));
  if (task.assignee_id !== user.id && !isLeader(user)) return { error: "This task is not assigned to you." };
  if (task.status !== "open") return { error: "This task is closed." };
  const proposed = str(f, "proposed_due");
  const reason = str(f, "reason");
  if (!isDate(proposed)) return { error: "Choose the new date." };
  if (proposed === task.due_date) return { error: "That is the current deadline." };
  if (!reason) return { error: "Please give a reason." };
  const cal = await loadCalendar();
  const warn = cal.isWorkingDay(proposed) ? "" : " (note: that date is a weekend or holiday)";

  // a leader changing their own team's deadline doesn't need approval
  if (isLeader(user)) {
    await db().from("tasks").update({ due_date: proposed }).eq("id", task.id);
    await event(task.id, user.id, "deadline_approved", `Deadline changed ${task.due_date} → ${proposed}. ${reason}`);
    if (task.assignee_id !== user.id)
      await notify([await profile(task.assignee_id)], {
        title: `Deadline changed: ${task.title}`,
        body: `New due date ${proposed}. ${reason}`,
        link: `/tasks/${task.id}`,
        email: true,
      });
    done(task.id);
    return { ok: "Deadline changed" + warn + "." };
  }

  const { error } = await db().from("deadline_requests").insert({
    task_id: task.id,
    requested_by: user.id,
    current_due: task.due_date,
    proposed_due: proposed,
    reason,
  });
  if (error) return { error: error.code === "23505" ? "There is already a pending request for this task." : error.message };
  await event(task.id, user.id, "deadline_requested", `Asked to move ${task.due_date} → ${proposed}. ${reason}`);
  await notify(await leadersFor(user.team_id), {
    title: `Deadline change requested: ${task.title}`,
    body: `${user.full_name} asks to move it to ${proposed}. Reason: ${reason}`,
    link: `/tasks/${task.id}`,
    email: true,
  });
  done(task.id);
  return { ok: "Request sent to your team leader" + warn + "." };
}

export async function decideDeadline(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  if (!isLeader(user)) return { error: "Only team leaders can approve deadline changes." };
  const approve = str(f, "decision") === "approve";
  const { data: req } = await db().from("deadline_requests").select("*").eq("id", str(f, "request_id")).maybeSingle();
  if (!req || req.status !== "pending") return { error: "This request was already handled." };
  const note = str(f, "note");
  await db()
    .from("deadline_requests")
    .update({ status: approve ? "approved" : "rejected", decided_by: user.id, decided_at: new Date().toISOString() })
    .eq("id", req.id);
  if (approve) await db().from("tasks").update({ due_date: req.proposed_due }).eq("id", req.task_id);
  const task = await loadTask(req.task_id);
  await event(
    task.id,
    user.id,
    approve ? "deadline_approved" : "deadline_rejected",
    `${approve ? "Approved" : "Rejected"} new deadline ${req.proposed_due}${note ? ". " + note : ""}`,
  );
  await notify([await profile(req.requested_by)], {
    title: `Deadline ${approve ? "approved" : "not approved"}: ${task.title}`,
    body: approve ? `New due date ${req.proposed_due}. ${note}` : `Due date stays ${req.current_due}. ${note}`,
    link: `/tasks/${task.id}`,
    email: true,
  });
  done(task.id);
  return { ok: approve ? "Approved." : "Rejected." };
}

export async function requestTransfer(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  const task = await loadTask(str(f, "task_id"));
  if (!canWork(user, task)) return { error: "This task is not assigned to you." };
  if (task.status !== "open") return { error: "This task is closed." };
  const to = await profile(str(f, "to_user"));
  if (!to || !to.active || to.id === task.assignee_id) return { error: "Choose a team member." };
  if (user.team_id && to.team_id !== user.team_id && user.role !== "admin") return { error: "Choose someone in your team." };
  const note = str(f, "note");
  const { data: tr, error } = await db()
    .from("transfers")
    .insert({ task_id: task.id, from_user: task.assignee_id, to_user: to.id, note })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "A transfer is already waiting for an answer." : error.message };
  await event(task.id, user.id, "transfer_requested", `Transfer to ${to.full_name} requested. ${note}`);
  await notify([to], {
    title: `${user.full_name} wants to hand you a task`,
    body: `${task.title} (due ${task.due_date}). ${note}`.trim(),
    link: `/tasks/${task.id}?transfer=${tr.id}`,
    email: true,
  });
  done(task.id);
  return { ok: `Sent to ${to.full_name}. It stays with you until they accept.` };
}

export async function respondTransfer(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  const accept = str(f, "decision") === "accept";
  const { data: tr } = await db().from("transfers").select("*").eq("id", str(f, "transfer_id")).maybeSingle();
  if (!tr || tr.status !== "pending") return { error: "This transfer was already handled." };
  if (tr.to_user !== user.id) return { error: "This transfer is not for you." };
  const task = await loadTask(tr.task_id);
  const note = str(f, "note");
  await db()
    .from("transfers")
    .update({ status: accept ? "approved" : "rejected", responded_at: new Date().toISOString() })
    .eq("id", tr.id);
  if (accept) await db().from("tasks").update({ assignee_id: user.id }).eq("id", task.id);
  await event(
    task.id,
    user.id,
    accept ? "transfer_accepted" : "transfer_declined",
    `${user.full_name} ${accept ? "accepted" : "declined"} the transfer${note ? ". " + note : ""}`,
  );
  const from = await profile(tr.from_user);
  await notify([from], {
    title: `${user.full_name} ${accept ? "accepted" : "declined"}: ${task.title}`,
    body: accept ? "The task is now theirs." : `The task stays with you. ${note}`,
    link: `/tasks/${task.id}`,
    email: true,
  });
  if (accept)
    await notify(
      (await leadersFor(user.team_id)).filter((l) => l.id !== from?.id),
      { title: `Task transferred: ${task.title}`, body: `${from?.full_name ?? "Someone"} → ${user.full_name}`, link: `/tasks/${task.id}` },
    );
  done(task.id);
  return { ok: accept ? "Accepted. The task is now on your list." : "Declined." };
}

export async function cancelTransfer(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  const { data: tr } = await db().from("transfers").select("*").eq("id", str(f, "transfer_id")).maybeSingle();
  if (!tr || tr.status !== "pending") return { error: "Already handled." };
  if (tr.from_user !== user.id && !isLeader(user)) return { error: "Not allowed." };
  await db().from("transfers").update({ status: "cancelled" }).eq("id", tr.id);
  await event(tr.task_id, user.id, "transfer_declined", "Transfer request withdrawn");
  done(tr.task_id);
  return { ok: "Transfer withdrawn." };
}

// ------------------------------------------------------------------ leader actions

export async function leaderUpdateTask(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  if (!isLeader(user)) return { error: "Only team leaders can do this." };
  const task = await loadTask(str(f, "task_id"));
  const op = str(f, "op");
  if (op === "cancel") {
    await db().from("tasks").update({ status: "cancelled" }).eq("id", task.id);
    await event(task.id, user.id, "cancelled", str(f, "remark"));
    done(task.id);
    return { ok: "Task cancelled." };
  }
  if (op === "reassign") {
    const to = await profile(str(f, "assignee_id"));
    if (!to || !to.active) return { error: "Choose a team member." };
    if (to.id === task.assignee_id) return { error: "Already assigned to them." };
    await db().from("tasks").update({ assignee_id: to.id }).eq("id", task.id);
    await db().from("transfers").update({ status: "cancelled" }).eq("task_id", task.id).eq("status", "pending");
    await event(task.id, user.id, "reassigned", `Reassigned to ${to.full_name}`);
    await notify([to], { title: `Task assigned to you: ${task.title}`, body: `Due ${task.due_date}`, link: `/tasks/${task.id}`, email: true });
    done(task.id);
    return { ok: `Reassigned to ${to.full_name}.` };
  }
  return { error: "Unknown action." };
}

export async function updateRecurring(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await me();
  if (!isLeader(user)) return { error: "Only team leaders can do this." };
  const id = str(f, "recurring_id");
  const op = str(f, "op");
  if (op === "pause" || op === "resume") {
    await db().from("recurring_tasks").update({ active: op === "resume" }).eq("id", id);
    if (op === "resume") await generateRecurring({ recurringId: id });
  } else if (op === "assignee") {
    const to = await profile(str(f, "assignee_id"));
    if (!to) return { error: "Choose a team member." };
    await db().from("recurring_tasks").update({ assignee_id: to.id }).eq("id", id);
  } else if (op === "delete") {
    await db().from("recurring_tasks").delete().eq("id", id);
  }
  revalidatePath("/recurring");
  return { ok: "Saved." };
}

export async function markNotificationsRead() {
  const user = await me();
  await db().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/", "layout");
}
