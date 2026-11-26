import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";
import { isLeader } from "@/lib/types";
import { NavLinks } from "@/components/nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const unread = await unreadCount(user.id);
  const leader = isLeader(user);
  const links = [
    { href: "/", label: "My day", icon: "☀" },
    ...(leader ? [{ href: "/team", label: "Team", icon: "▦" }] : []),
    ...(leader ? [{ href: "/tasks/new", label: "Assign", icon: "+" }] : []),
    { href: "/tasks", label: "All tasks", icon: "☰" },
    { href: "/notifications", label: "Alerts", icon: "🔔", badge: unread },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-700 text-white">✓</span>
            <span>Tick Analytics</span>
          </Link>
          <nav className="hidden flex-1 md:block">
            <NavLinks links={links} variant="top" />
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {leader && (
              <Link href="/recurring" className="hidden text-slate-600 hover:text-brand-700 sm:inline">
                Recurring
              </Link>
            )}
            {user.role === "admin" && (
              <Link href="/admin/users" className="hidden text-slate-600 hover:text-brand-700 sm:inline">
                Admin
              </Link>
            )}
            <Link href="/settings" className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700" title="Settings">
              {user.full_name.split(" ")[0]}
            </Link>
            <form action={logout}>
              <button className="text-slate-500 hover:text-red-600" title="Sign out">
                ⎋
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-24 md:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <NavLinks links={links} variant="bottom" />
      </nav>
    </div>
  );
}
