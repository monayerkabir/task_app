"use client";

import { useState, useTransition } from "react";
import { runHolidaySync, toggleHoliday } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/state";
import type { Holiday } from "@/lib/types";
import { ActionForm, Message, Submit } from "./forms";

export function SyncButton() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>();
  return (
    <div>
      <button className="btn-primary" disabled={pending} onClick={() => start(async () => setState(await runHolidaySync()))}>
        {pending ? "Syncing…" : "↻ Sync now"}
      </button>
      <Message state={state} />
    </div>
  );
}

export function HolidayRow({ h }: { h: Holiday & { label: string } }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${h.is_active ? "" : "opacity-50"}`}>
      <span className="w-28 shrink-0 text-sm font-medium tabular-nums">{h.label}</span>
      <span className="min-w-0 flex-1 text-sm">
        {h.name}
        {!h.is_active && <span className="ml-2 chip bg-slate-100 text-slate-500">not a day off</span>}
        {h.source === "manual" && <span className="ml-2 chip bg-violet-100 text-violet-700">added manually</span>}
      </span>
      <ActionForm action={toggleHoliday} className="flex gap-1">
        <input type="hidden" name="id" value={h.id} />
        <Submit name="op" value={h.is_active ? "off" : "on"} className="btn-secondary px-2 py-1 text-xs">
          {h.is_active ? "Working day" : "Day off"}
        </Submit>
        {h.source === "manual" && (
          <Submit name="op" value="delete" className="btn-danger px-2 py-1 text-xs">
            Delete
          </Submit>
        )}
      </ActionForm>
    </div>
  );
}
