"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

function NewCourseForm() {
  const router = useRouter();
  const generateUploadUrl = useMutation(api.courses.generateUploadUrl);
  const createCourse = useMutation(api.courses.create);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file") as File;
    setBusy(true);
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    const courseId = await createCourse({
      title: String(form.get("title")),
      subject: String(form.get("subject")),
      notes: String(form.get("notes") ?? ""),
      fileId: storageId,
    });
    router.push(`/courses/${courseId}`);
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-xl space-y-4">
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" className="input" placeholder="e.g. Thinking, Fast and Slow — Ch. 1" />
      </div>
      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" name="subject" className="input" placeholder="e.g. Psychology" />
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" rows={3} className="input" placeholder="Why are you learning this?" />
      </div>
      <div>
        <label className="label" htmlFor="file">PDF (chapter or slides)</label>
        <input id="file" name="file" type="file" accept="application/pdf" className="input" />
      </div>
      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Uploading…" : "Upload and break it down"}
      </button>
    </form>
  );
}

export default function NewCoursePage() {
  return (
    <AppShell>
      <h1 className="mb-6 font-serif text-3xl">New course</h1>
      <NewCourseForm />
    </AppShell>
  );
}
