"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { XpStats } from "./XpStats";

const LINKS = [
  { href: "/read", label: "Library", icon: "📚" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

// The main pages' top bar: brand, Library · Dashboard · Settings, an optional slot (the library's search) and XP.
export function TopNav({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
        <Link href="/read" className="font-serif text-h2 font-bold" aria-label="Ingrain home">
          Ingrain<span className="text-accent">.</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1 rounded-xl bg-panel p-1">
          {LINKS.map((l) => {
            const on = pathname === l.href || (l.href !== "/read" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-meta font-semibold ${on ? "bg-card text-accent-dark shadow-[0_1px_2px_rgba(42,34,27,.08)]" : "text-muted hover:text-ink"}`}
              >
                <span aria-hidden="true">{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>
        {children}
        <div className="ml-auto">
          <XpStats />
        </div>
      </div>
    </header>
  );
}
