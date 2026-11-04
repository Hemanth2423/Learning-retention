"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/courses");
  }, [isAuthenticated, router]);

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-4 py-16 md:grid-cols-2">
      <section className="space-y-5">
        <p className="font-serif text-2xl font-semibold">
          Recall<span className="text-accent">.</span>
        </p>
        <h1 className="font-serif text-4xl leading-tight md:text-5xl">Learn it. Don&apos;t just read it.</h1>
        <p className="text-lg text-muted">
          Upload a chapter or slide deck. Recall builds a mind map, breaks it into visual topics with
          real-world examples, quizzes you on each one, and tells you honestly what you&apos;ve learned
          and what to study next.
        </p>
      </section>
      <div className="flex justify-center">
        {isLoading ? <p className="text-muted">Loading…</p> : !isAuthenticated && <AuthForm />}
      </div>
    </main>
  );
}
