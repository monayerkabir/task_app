import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        <Link href="/admin/users" className="btn-secondary">
          Team members
        </Link>
        <Link href="/admin/holidays" className="btn-secondary">
          Holidays
        </Link>
      </div>
      {children}
    </div>
  );
}
