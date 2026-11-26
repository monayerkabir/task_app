"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type L = { href: string; label: string; icon: string; badge?: number };

export function NavLinks({ links, variant }: { links: L[]; variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path === href || (href !== "/tasks" && path.startsWith(href + "/")) || (href === "/tasks" && path === "/tasks"));
  if (variant === "top")
    return (
      <ul className="flex gap-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={`relative rounded-lg px-3 py-1.5 text-sm font-medium ${active(l.href) ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {l.label}
              {!!l.badge && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-xs text-white">{l.badge}</span>}
            </Link>
          </li>
        ))}
      </ul>
    );
  return (
    <ul className="grid" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(l.href) ? "text-brand-700" : "text-slate-500"}`}
          >
            <span className="text-lg leading-none">{l.icon}</span>
            {l.label}
            {!!l.badge && (
              <span className="absolute top-1 right-1/2 translate-x-4 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{l.badge}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
