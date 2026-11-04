"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/Logo";

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/courses");
  }, [isAuthenticated, router]);

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-16 md:grid-cols-[1.1fr_1fr]">
      <section className="space-y-6">
        <Logo size={36} />
        <h1 className="font-serif text-4xl leading-tight md:text-6xl">
          Read once.
          <br />
          <span className="text-accent">Know it for good.</span>
        </h1>
        <p className="text-lg">
          Ingrain turns a book chapter or slide deck into a map of its core ideas, short visual lessons,
          and quick checks, so you understand what it teaches without reading every page.
        </p>
        <div className="border-l-4 border-accent pl-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Why</p>
          <p className="mt-1 text-muted">
            We forget most of what we read within days. Re-reading and highlighting feel productive but
            don&apos;t stick. What sticks is seeing how ideas connect, meeting them in the real world, and
            recalling them yourself. Ingrain is built around exactly that.
          </p>
        </div>
      </section>
      <div className="flex justify-center">
        {isLoading ? <p className="text-muted">Loading…</p> : !isAuthenticated && <AuthForm />}
      </div>
    </main>
  );
}
