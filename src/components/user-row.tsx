"use client";

import { sendLoginLink, updateUser } from "@/app/actions/admin";
import type { Profile } from "@/lib/types";
import { ActionForm, Submit } from "./forms";

export function UserRow({ user }: { user: Profile }) {
  return (
    <div className={`card space-y-2 ${user.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            {user.full_name} {!user.active && <span className="chip bg-slate-200 text-slate-600">Deactivated</span>}
          </p>
          <p className="muted">{user.email}</p>
        </div>
        <ActionForm action={updateUser} className="flex gap-2">
          <input type="hidden" name="user_id" value={user.id} />
          <select name="role" defaultValue={user.role} className="input py-1.5 text-sm">
            <option value="member">Member</option>
            <option value="leader">Leader</option>
            <option value="admin">Admin</option>
          </select>
          <Submit className="btn-secondary">Save</Submit>
        </ActionForm>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionForm action={sendLoginLink}>
          <input type="hidden" name="user_id" value={user.id} />
          <Submit className="btn-secondary">Send password link</Submit>
        </ActionForm>
        <ActionForm action={updateUser} confirm={user.active ? `Deactivate ${user.full_name}? They won't be able to log in.` : undefined}>
          <input type="hidden" name="user_id" value={user.id} />
          <input type="hidden" name="active" value={user.active ? "false" : "true"} />
          <Submit className={user.active ? "btn-danger" : "btn-secondary"}>{user.active ? "Deactivate" : "Reactivate"}</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
