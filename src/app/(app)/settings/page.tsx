import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PushToggle, EmailToggle } from "@/components/notification-settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="h1">Settings</h1>
      <div className="card space-y-1">
        <p className="font-semibold">{user.full_name}</p>
        <p className="muted">
          {user.email} · {user.role === "admin" ? "Admin" : user.role === "leader" ? "Team leader" : "Team member"}
        </p>
        <Link href="/set-password" className="text-sm font-medium text-brand-700 underline">
          Change password
        </Link>
      </div>
      <div className="card space-y-4">
        <h2 className="h2">Notifications</h2>
        <PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
        <EmailToggle initial={user.email_notifications} />
      </div>
      <div className="card space-y-2 text-sm text-slate-600">
        <h2 className="h2">Install on your phone</h2>
        <p>
          <b>Android (Chrome):</b> open the menu ⋮ and tap <i>Add to Home screen</i> or <i>Install app</i>.
        </p>
        <p>
          <b>iPhone (Safari):</b> tap Share, then <i>Add to Home Screen</i>. Open Tick from the home screen, then turn on phone alerts above.
        </p>
      </div>
      {user.role !== "member" && (
        <div className="card flex flex-wrap gap-3 text-sm sm:hidden">
          <Link href="/recurring" className="font-medium text-brand-700 underline">
            Recurring tasks
          </Link>
          {user.role === "admin" && (
            <>
              <Link href="/admin/users" className="font-medium text-brand-700 underline">
                Team members
              </Link>
              <Link href="/admin/holidays" className="font-medium text-brand-700 underline">
                Holidays
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
