"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions/state";

type Action = (prev: ActionState, f: FormData) => Promise<ActionState>;

/** A form bound to a server action, showing its success or error message. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <Message state={state} />
    </form>
  );
}

export function Message({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.ok)
    return (
      <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
        {state.ok}
        {state.link &&
          (state.link.startsWith("http") ? (
            <CopyLink href={state.link} />
          ) : (
            <>
              {" "}
              <Link href={state.link} className="font-semibold underline">
                Open
              </Link>
            </>
          ))}
      </div>
    );
  return null;
}

function CopyLink({ href }: { href: string }) {
  return (
    <div className="mt-2 flex gap-2">
      <input readOnly value={href} className="input text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn-secondary" onClick={() => navigator.clipboard?.writeText(href)}>
        Copy
      </button>
    </div>
  );
}

export function Submit({ children, className = "btn-primary", name, value }: { children: ReactNode; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending ? "Saving…" : children}
    </button>
  );
}
