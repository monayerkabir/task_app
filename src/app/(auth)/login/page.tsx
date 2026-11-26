import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { db } from "@/lib/supabase/server";
import { ActionForm, Submit } from "@/components/forms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const { count } = await db().from("profiles").select("id", { count: "exact", head: true });
  if (count === 0) redirect("/setup");
  return (
    <ActionForm action={login} className="card space-y-4">
      {sp.error === "link" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">That link has expired or was already used. Ask your admin for a new one.</p>
      )}
      <div>
        <label className="label">Email</label>
        <input name="email" type="email" autoComplete="email" className="input" required />
      </div>
      <div>
        <label className="label">Password</label>
        <input name="password" type="password" autoComplete="current-password" className="input" required />
      </div>
      <Submit className="btn-primary w-full">Sign in</Submit>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-brand-700 underline">
          Forgot password?
        </Link>
      </p>
    </ActionForm>
  );
}
