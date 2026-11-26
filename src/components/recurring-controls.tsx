"use client";

import { updateRecurring } from "@/app/actions/tasks";
import { ActionForm, Submit } from "./forms";

export function RecurringControls({
  id,
  active,
  assigneeId,
  people,
}: {
  id: string;
  active: boolean;
  assigneeId: string;
  people: { id: string; full_name: string }[];
}) {
  return (
    <div className="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
      <ActionForm action={updateRecurring} className="flex gap-2">
        <input type="hidden" name="recurring_id" value={id} />
        <input type="hidden" name="op" value="assignee" />
        <select name="assignee_id" defaultValue={assigneeId} className="input py-1.5 text-sm">
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        <Submit className="btn-secondary">Change</Submit>
      </ActionForm>
      <ActionForm action={updateRecurring}>
        <input type="hidden" name="recurring_id" value={id} />
        <input type="hidden" name="op" value={active ? "pause" : "resume"} />
        <Submit className="btn-secondary">{active ? "Pause" : "Resume"}</Submit>
      </ActionForm>
      <ActionForm action={updateRecurring} confirm="Delete this recurring task? Tasks already posted stay.">
        <input type="hidden" name="recurring_id" value={id} />
        <input type="hidden" name="op" value="delete" />
        <Submit className="btn-danger">Delete</Submit>
      </ActionForm>
    </div>
  );
}
