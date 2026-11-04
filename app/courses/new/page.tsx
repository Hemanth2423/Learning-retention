"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FieldError, errorMessage } from "@/components/FieldError";
import { PdfDropzone } from "@/components/PdfDropzone";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FieldErrors, MAX_PDF_MB, validateCourse, validatePdf } from "@/convex/validation";

function NewCourseForm() {
  const router = useRouter();
  const generateUploadUrl = useMutation(api.courses.generateUploadUrl);
  const createCourse = useMutation(api.courses.create);
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
    const file = form.get("file") as File | null;
    const found: FieldErrors = { ...validateCourse(fields), file: validatePdf(file) };
    if (!found.file) delete found.file;
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file!,
      });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const courseId = await createCourse({ ...fields, fileId: storageId });
      router.push(`/courses/${courseId}`);
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card max-w-xl space-y-4">
      <div>
        <PdfDropzone invalid={!!errors.file} describedBy="file-error" />
        <p className="mt-2 text-xs text-muted">Up to {MAX_PDF_MB} MB. Works best with one chapter or deck (under ~100 pages).</p>
        <FieldError id="file-error" message={errors.file} />
      </div>
      <div>
        <label className="label" htmlFor="title">Title <span className="text-bad">*</span></label>
        <input id="title" name="title" className="input" aria-invalid={!!errors.title}
          aria-describedby="title-error" placeholder="e.g. Thinking, Fast and Slow — Ch. 1" />
        <FieldError id="title-error" message={errors.title} />
      </div>
      <div>
        <label className="label" htmlFor="subject">Subject (optional)</label>
        <input id="subject" name="subject" className="input" aria-invalid={!!errors.subject}
          aria-describedby="subject-error" placeholder="e.g. Psychology" />
        <FieldError id="subject-error" message={errors.subject} />
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" rows={3} className="input" placeholder="Why are you learning this?" />
        <FieldError id="notes-error" message={errors.notes} />
      </div>
      {formError && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{formError}</p>}
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
