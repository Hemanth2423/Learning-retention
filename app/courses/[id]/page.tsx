"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

function EditForm({ course, onDone }: { course: Doc<"courses">; onDone: () => void }) {
  const update = useMutation(api.courses.update);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    await update({
      courseId: course._id,
      title: String(form.get("title")),
      subject: String(form.get("subject")),
      notes: String(form.get("notes") ?? ""),
    });
    setBusy(false);
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={course.title} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" name="subject" defaultValue={course.subject} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={course.notes ?? ""} className="input" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save changes"}</button>
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function CourseDetail({ courseId }: { courseId: string }) {
  const course = useQuery(api.courses.get, { courseId });
  const remove = useMutation(api.courses.remove);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (course === undefined) return <p className="text-muted">Loading…</p>;
  if (course === null) {
    return (
      <div className="card text-center">
        <p className="font-serif text-xl">Course not found</p>
        <Link href="/courses" className="btn-ghost mt-4">Back to courses</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/courses" className="text-sm text-muted hover:text-ink">← All courses</Link>
      {editing ? (
        <EditForm course={course} onDone={() => setEditing(false)} />
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl">{course.title}</h1>
              <StatusBadge status={course.status} />
            </div>
            <p className="mt-1 text-muted">
              {course.subject} · added {new Date(course._creationTime).toLocaleDateString()}
            </p>
            {course.notes && <p className="mt-3 max-w-2xl">{course.notes}</p>}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn-ghost text-bad" onClick={() => setConfirming(true)}>Delete</button>
          </div>
        </header>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this course?"
        message={`"${course.title}" and all its topics, quiz scores, and stars will be permanently deleted. Are you sure?`}
        confirmLabel="Yes, delete it"
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          router.replace("/courses");
          await remove({ courseId: course._id });
        }}
      />
    </div>
  );
}

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AppShell>
      <CourseDetail courseId={id} />
    </AppShell>
  );
}
