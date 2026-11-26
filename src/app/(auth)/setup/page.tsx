import { redirect } from "next/navigation";
import { connection } from "next/server";
import { setupFirstAdmin } from "@/app/actions/auth";
import { db } from "@/lib/supabase/server";
import { ActionForm, Submit } from "@/components/forms";

export const metadata = { title: "First-time setup" };

export default async function SetupPage() {
  await connection();
  const { count, error } = await db().from("profiles").select("id", { count: "exact", head: true });
  if (error)
    return (
      <div className="card space-y-2 text-sm">
        <p className="font-semibold text-red-700">Can&apos;t reach the database.</p>
        <p>Check the Supabase environment variables in Vercel and that you ran supabase/schema.sql. ({error.message})</p>
      </div>
    );
  if ((count ?? 0) > 0) redirect("/login");
  return (
    <ActionForm action={setupFirstAdmin} className="card space-y-4">
      <p className="text-sm text-slate-600">
        Welcome! Create the first <b>admin</b> account. After this, invite your team from <i>Admin › Team members</i>.
      </p>
      <input name="full_name" className="input" placeholder="Your full name" required />
      <input name="email" type="email" className="input" placeholder="Work email" required />
      <input name="password" type="password" minLength={8} className="input" placeholder="Password (8+ characters)" required />
      <Submit className="btn-primary w-full">Create admin account</Submit>
    </ActionForm>
  );
}
