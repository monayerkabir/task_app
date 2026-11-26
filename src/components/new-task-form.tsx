"use client";

import { useState } from "react";
import { createTask } from "@/app/actions/tasks";
import { ActionForm, Submit } from "./forms";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

export function NewTaskForm({
  people,
  categories,
  today,
}: {
  people: { id: string; full_name: string }[];
  categories: string[];
  today: string;
}) {
  const [kind, setKind] = useState<"adhoc" | "recurring">("adhoc");
  const [frequency, setFrequency] = useState("monthly");
  const [rule, setRule] = useState("working_day");
  const unit = frequency === "weekly" ? "week" : "month";

  return (
    <ActionForm action={createTask} className="card space-y-4" resetOnSuccess>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {(["adhoc", "recurring"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-md py-2 text-sm font-semibold ${kind === k ? "bg-white text-brand-800 shadow" : "text-slate-500"}`}
          >
            {k === "adhoc" ? "One-off (ad hoc)" : "↻ Recurring"}
          </button>
        ))}
      </div>

      <div>
        <label className="label">Title</label>
        <input name="title" className="input" required placeholder="e.g. Monthly NPL report" />
      </div>
      <div>
        <label className="label">Details</label>
        <textarea name="description" rows={3} className="input" placeholder="Instructions, links, reference numbers" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Assign to</label>
          <select name="assignee_id" className="input" required defaultValue="">
            <option value="" disabled>
              Choose a team member
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type of work</label>
          <input name="category" className="input" list="categories" defaultValue="General" />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      {kind === "adhoc" ? (
        <div>
          <label className="label">Due date</label>
          <input type="date" name="due_date" className="input" min={today} required />
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Repeats</label>
              <select name="frequency" className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly (Jan, Apr, Jul, Oct)</option>
                <option value="half_yearly">Half-yearly (Jan, Jul)</option>
              </select>
            </div>
            {(frequency === "quarterly" || frequency === "half_yearly") && (
              <div>
                <label className="label">Which month of the {frequency === "quarterly" ? "quarter" : "half-year"}</label>
                <select name="period_month" className="input" defaultValue="1">
                  {Array.from({ length: frequency === "quarterly" ? 3 : 6 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {ordinal(i + 1)} month
                      {frequency === "quarterly"
                        ? ` (${["Jan/Apr/Jul/Oct", "Feb/May/Aug/Nov", "Mar/Jun/Sep/Dec"][i]})`
                        : ` (${["Jan/Jul", "Feb/Aug", "Mar/Sep", "Apr/Oct", "May/Nov", "Jun/Dec"][i]})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="label">Due on</label>
            <select name="rule" className="input" value={rule} onChange={(e) => setRule(e.target.value)}>
              <option value="working_day">Nth working day of the {unit}</option>
              <option value="calendar_day">{frequency === "weekly" ? "A fixed weekday" : "A fixed date of the month"}</option>
              <option value="last_working_day">Last working day of the {unit}</option>
            </select>
          </div>
          {rule === "working_day" && (
            <div>
              <label className="label">Working day number</label>
              <input type="number" name="rule_value" min={1} max={frequency === "weekly" ? 5 : 23} defaultValue={frequency === "weekly" ? 1 : 5} className="input" />
              <p className="muted mt-1">Counts Sunday to Thursday, skipping government holidays.</p>
            </div>
          )}
          {rule === "calendar_day" &&
            (frequency === "weekly" ? (
              <div>
                <label className="label">Weekday</label>
                <select name="weekday" className="input" defaultValue="0">
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Date of the month</label>
                <input type="number" name="rule_value" min={1} max={31} defaultValue={10} className="input" />
                <p className="muted mt-1">If it falls on a weekend or holiday, it moves to the working day before.</p>
              </div>
            ))}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Show on dashboard</label>
              <div className="flex items-center gap-2">
                <input type="number" name="lead_days" min={0} max={20} defaultValue={3} className="input w-20" />
                <span className="muted">working days before</span>
              </div>
            </div>
            <div>
              <label className="label">Starts</label>
              <input type="date" name="start_date" className="input" defaultValue={today} />
            </div>
            <div>
              <label className="label">Ends (optional)</label>
              <input type="date" name="end_date" className="input" />
            </div>
          </div>
        </div>
      )}

      <Submit>{kind === "adhoc" ? "Assign task" : "Save recurring task"}</Submit>
    </ActionForm>
  );
}

function ordinal(n: number) {
  return n + (["th", "st", "nd", "rd"][n] ?? "th");
}
