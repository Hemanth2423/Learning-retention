"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { Logo } from "./Logo";

// Minimal frame for the reading experience: logo and sign-out only. Visitors who aren't signed in go to the login page.
export function ReadingShell({ children, chrome = true }: { children: ReactNode; chrome?: boolean }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex flex-1 items-center justify-center text-muted">Loading…</div>;
  }

  return (
    <div className="flex flex-1 flex-col">
      {chrome && (
        <header className="flex items-center justify-between px-6 py-4">
          <Link href="/read" aria-label="Ingrain home">
            <Logo />
          </Link>
          <button onClick={() => void signOut().then(() => router.replace("/"))} className="text-sm text-muted hover:text-ink">
            Sign out
          </button>
        </header>
      )}
      {children}
    </div>
  );
}
