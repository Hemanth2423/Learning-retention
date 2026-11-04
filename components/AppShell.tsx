"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { api } from "@/convex/_generated/api";

const NAV = [
  { href: "/courses", label: "Courses" },
];

// Wraps every logged-in page: redirects visitors to the login page and shows the top nav.
export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex flex-1 items-center justify-center text-muted">Loading…</div>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/courses" className="font-serif text-xl font-semibold">
            Recall<span className="text-accent">.</span>
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  pathname.startsWith(n.href) ? "bg-accent-soft font-medium" : "text-muted hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <span className="hidden text-sm text-muted sm:inline">{me?.email}</span>
          <button
            className="btn-ghost"
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
