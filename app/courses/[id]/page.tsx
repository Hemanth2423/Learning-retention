"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FieldError, errorMessage } from "@/components/FieldError";
import { MindMap } from "@/components/MindMap";
import { ProgressReport } from "@/components/ProgressReport";
import { StatusBadge } from "@/components/StatusBadge";
import { TopicList } from "@/components/TopicList";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { FieldErrors, validateCourse } from "@/convex/validation";

function EditForm({ course, onDone }: { course: Doc<"courses">; onDone: () => void }) {
  const update = useMutation(api.courses.update);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fields = {
      title: String(form.get("title") ?? ""),
      subject: String(form.get("subject") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };
    const found = validateCourse(fields);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await update({ courseId: course._id, ...fields });
      onDone();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-4">
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={course.title} className="input" aria-invalid={!!errors.title} aria-describedby="title-error" />
        <FieldError id="title-error" message={errors.title} />
      </div>
      <div>
        <label className="label" htmlFor="subject">Subject (optional)</label>
        <input id="subject" name="subject" defaultValue={course.subject} className="input" aria-invalid={!!errors.subject} aria-describedby="subject-error" />
        <FieldError id="subject-error" message={errors.subject} />
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={course.notes ?? ""} className="input" />
        <FieldError id="notes-error" message={errors.notes} />
      </div>
      {formError && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{formError}</p>}
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
  const reprocess = useMutation(api.courses.reprocess);
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
              {course.subject && `${course.subject} · `}added {new Date(course._creationTime).toLocaleDateString()}
            </p>
            {course.notes && <p className="mt-3 max-w-2xl">{course.notes}</p>}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn-ghost text-bad" onClick={() => setConfirming(true)}>Delete</button>
          </div>
        </header>
      )}

      {course.status === "processing" && (
        <div className="card flex items-center gap-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-accent" />
          <p>{course.statusMessage ?? "Working on it…"} <span className="text-muted">This usually takes 1–2 minutes. You can leave this page.</span></p>
        </div>
      )}
      {course.status === "failed" && (
        <div className="card border-bad/40">
          <p className="font-medium text-bad">We couldn&apos;t break this document down.</p>
          <p className="mt-1 text-sm text-muted">{course.statusMessage}</p>
          <button className="btn-ghost mt-3" onClick={() => reprocess({ courseId: course._id })}>Try again</button>
        </div>
      )}
      {course.status === "ready" && <MindMap courseId={course._id} title={course.title} />}
      {course.status === "ready" && <TopicList courseId={course._id} thesis={course.thesis} />}
      {course.status === "ready" && <ProgressReport course={course} />}

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
