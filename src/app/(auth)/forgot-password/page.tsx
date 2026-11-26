import Link from "next/link";
import { forgotPassword } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/forms";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <ActionForm action={forgotPassword} className="card space-y-4">
      <p className="text-sm text-slate-600">Enter your work email and we&apos;ll send you a link to choose a new password.</p>
      <input name="email" type="email" className="input" placeholder="you@bank.com" required />
      <Submit className="btn-primary w-full">Send reset link</Submit>
      <p className="text-center text-sm">
        <Link href="/login" className="text-brand-700 underline">
          Back to sign in
        </Link>
      </p>
    </ActionForm>
  );
}
