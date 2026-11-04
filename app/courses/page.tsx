"use client";

import { AppShell } from "@/components/AppShell";

export default function CoursesPage() {
  return (
    <AppShell>
      <h1 className="font-serif text-3xl">Your courses</h1>
      <p className="mt-2 text-muted">No courses yet.</p>
    </AppShell>
  );
}
