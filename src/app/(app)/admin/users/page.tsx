import { inviteUser } from "@/app/actions/admin";
import { db } from "@/lib/supabase/server";
import { emailConfigured } from "@/lib/email";
import { Profile } from "@/lib/types";
import { ActionForm, Submit } from "@/components/forms";
import { UserRow } from "@/components/user-row";

export const metadata = { title: "Team members" };

export default async function UsersPage() {
  const { data } = await db().from("profiles").select("*").order("active", { ascending: false }).order("full_name");
  const users = (data ?? []) as Profile[];
  return (
    <div className="space-y-4">
      <h1 className="h1">Team members</h1>
      <ActionForm action={inviteUser} className="card space-y-3" resetOnSuccess>
        <h2 className="h2">Invite someone</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input name="full_name" className="input" placeholder="Full name" required />
          <input name="email" type="email" className="input" placeholder="Email" required />
          <select name="role" className="input" defaultValue="member">
            <option value="member">Team member</option>
            <option value="leader">Team leader</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <p className="muted">
          {emailConfigured()
            ? "They get an email with a link to choose their password."
            : "Email isn't set up yet, so you'll get a one-time link to send them on WhatsApp or Teams."}
        </p>
        <Submit>Send invite</Submit>
      </ActionForm>
      <div className="space-y-2">
        {users.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}
      </div>
    </div>
  );
}
