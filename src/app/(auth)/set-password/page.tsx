import { setPassword } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/forms";

export const metadata = { title: "Choose a password" };

export default async function SetPasswordPage() {
  const user = await requireUser();
  return (
    <ActionForm action={setPassword} className="card space-y-4">
      <p className="text-sm text-slate-600">
        Hi {user.full_name.split(" ")[0]}, choose a password for <b>{user.email}</b>.
      </p>
      <input name="password" type="password" autoComplete="new-password" minLength={8} className="input" placeholder="New password (8+ characters)" required />
      <input name="confirm" type="password" autoComplete="new-password" minLength={8} className="input" placeholder="Type it again" required />
      <Submit className="btn-primary w-full">Save password</Submit>
    </ActionForm>
  );
}
