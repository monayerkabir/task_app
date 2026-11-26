"use client";

import { useState } from "react";
import {
  addRemark,
  cancelTransfer,
  completeTask,
  decideDeadline,
  leaderUpdateTask,
  reopenTask,
  requestDeadline,
  requestTransfer,
  respondTransfer,
} from "@/app/actions/tasks";
import { ActionForm, Submit } from "./forms";

type Person = { id: string; full_name: string };

export function TransferResponse({ transferId }: { transferId: string }) {
  return (
    <ActionForm action={respondTransfer} className="mt-3 space-y-2">
      <input type="hidden" name="transfer_id" value={transferId} />
      <input name="note" className="input" placeholder="Note (optional)" />
      <div className="flex gap-2">
        <Submit name="decision" value="accept">
          Accept task
        </Submit>
        <Submit name="decision" value="decline" className="btn-secondary">
          Decline
        </Submit>
      </div>
    </ActionForm>
  );
}

export function DeadlineDecision({ requestId }: { requestId: string }) {
  return (
    <ActionForm action={decideDeadline} className="mt-3 space-y-2">
      <input type="hidden" name="request_id" value={requestId} />
      <input name="note" className="input" placeholder="Note to the team member (optional)" />
      <div className="flex gap-2">
        <Submit name="decision" value="approve">
          Approve new date
        </Submit>
        <Submit name="decision" value="reject" className="btn-secondary">
          Reject
        </Submit>
      </div>
    </ActionForm>
  );
}

export function CancelTransfer({ transferId }: { transferId: string }) {
  return (
    <ActionForm action={cancelTransfer} className="mt-2">
      <input type="hidden" name="transfer_id" value={transferId} />
      <Submit className="btn-secondary">Withdraw transfer</Submit>
    </ActionForm>
  );
}

type Tab = "complete" | "deadline" | "transfer" | "remark" | "manage";

export function TaskActions({
  taskId,
  open,
  dueDate,
  teammates,
  canWork,
  leader,
  hasPendingRequest,
  hasPendingTransfer,
}: {
  taskId: string;
  open: boolean;
  dueDate: string;
  teammates: Person[];
  canWork: boolean;
  leader: boolean;
  hasPendingRequest: boolean;
  hasPendingTransfer: boolean;
}) {
  const [tab, setTab] = useState<Tab>("complete");
  if (!canWork) return null;
  if (!open)
    return (
      <div className="card">
        <ActionForm action={reopenTask} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="task_id" value={taskId} />
          <input name="remark" className="input flex-1" placeholder="Why reopen? (optional)" />
          <Submit className="btn-secondary">Reopen task</Submit>
        </ActionForm>
      </div>
    );

  const tabs: [Tab, string][] = [
    ["complete", "✓ Complete"],
    ["deadline", leader ? "Change date" : "New deadline"],
    ["transfer", "Transfer"],
    ["remark", "Remark"],
    ...(leader ? ([["manage", "Manage"]] as [Tab, string][]) : []),
  ];

  return (
    <div className="card p-0">
      <div className="flex overflow-x-auto border-b border-slate-200">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`shrink-0 px-4 py-3 text-sm font-medium ${tab === k ? "border-b-2 border-brand-700 text-brand-800" : "text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "complete" && (
          <ActionForm action={completeTask} className="space-y-3">
            <input type="hidden" name="task_id" value={taskId} />
            <textarea name="remark" rows={2} className="input" placeholder="Remarks (optional), e.g. what was done" />
            <Submit>Mark as complete</Submit>
          </ActionForm>
        )}
        {tab === "deadline" &&
          (hasPendingRequest ? (
            <p className="muted">A new deadline is already waiting for your team leader&apos;s approval.</p>
          ) : (
            <ActionForm action={requestDeadline} className="space-y-3" resetOnSuccess>
              <input type="hidden" name="task_id" value={taskId} />
              <div>
                <label className="label">New due date</label>
                <input type="date" name="proposed_due" className="input" defaultValue={dueDate} required />
              </div>
              <div>
                <label className="label">Reason</label>
                <textarea name="reason" rows={2} className="input" required placeholder="e.g. waiting for financial statements from the client" />
              </div>
              <Submit>{leader ? "Change deadline" : "Send to team leader"}</Submit>
            </ActionForm>
          ))}
        {tab === "transfer" &&
          (hasPendingTransfer ? (
            <p className="muted">A transfer is already waiting for an answer.</p>
          ) : (
            <ActionForm action={requestTransfer} className="space-y-3">
              <input type="hidden" name="task_id" value={taskId} />
              <div>
                <label className="label">Hand over to</label>
                <select name="to_user" className="input" required defaultValue="">
                  <option value="" disabled>
                    Choose a team member
                  </option>
                  {teammates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea name="note" rows={2} className="input" placeholder="Note for them (optional)" />
              <p className="muted">The task stays with you until they accept it.</p>
              <Submit>Request transfer</Submit>
            </ActionForm>
          ))}
        {tab === "remark" && (
          <ActionForm action={addRemark} className="space-y-3" resetOnSuccess>
            <input type="hidden" name="task_id" value={taskId} />
            <textarea name="remark" rows={3} className="input" required placeholder="Add an update or remark" />
            <Submit>Add remark</Submit>
          </ActionForm>
        )}
        {tab === "manage" && (
          <div className="space-y-5">
            <ActionForm action={leaderUpdateTask} className="space-y-2">
              <input type="hidden" name="task_id" value={taskId} />
              <input type="hidden" name="op" value="reassign" />
              <label className="label">Reassign directly (no acceptance needed)</label>
              <div className="flex gap-2">
                <select name="assignee_id" className="input" required defaultValue="">
                  <option value="" disabled>
                    Choose
                  </option>
                  {teammates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
                <Submit className="btn-secondary">Reassign</Submit>
              </div>
            </ActionForm>
            <ActionForm action={leaderUpdateTask} className="space-y-2" confirm="Cancel this task?">
              <input type="hidden" name="task_id" value={taskId} />
              <input type="hidden" name="op" value="cancel" />
              <input name="remark" className="input" placeholder="Reason for cancelling (optional)" />
              <Submit className="btn-danger">Cancel task</Submit>
            </ActionForm>
          </div>
        )}
      </div>
    </div>
  );
}
