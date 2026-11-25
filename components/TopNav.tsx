"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const LINKS = [
  { href: "/read", label: "Library" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
];

// The main pages' top bar: brand, Library · Dashboard · Settings, and an optional slot on the right (the library's search).
export function TopNav({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:gap-x-6 md:px-8">
        <Link href="/read" className="font-serif text-h2 font-bold" aria-label="Ingrain home">
          Ingrain<span className="text-accent">.</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {LINKS.map((l) => {
            const on = pathname === l.href || (l.href !== "/read" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-ui md:px-3.5 md:py-2 font-semibold ${on ? "bg-accent-soft text-accent-dark" : "text-muted hover:bg-panel hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        {children && <div className="flex justify-end max-md:order-last max-md:w-full md:ml-auto md:flex-1">{children}</div>}
      </div>
    </header>
  );
}
