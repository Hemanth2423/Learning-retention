// Shared by the forms (instant feedback) and the server (so the rules can't be skipped).

export const MAX_PDF_MB = 20;

export type CourseFields = { title: string; subject: string; notes?: string };
export type FieldErrors = Partial<Record<"title" | "subject" | "notes" | "file", string>>;

export function validateCourse(fields: CourseFields): FieldErrors {
  const errors: FieldErrors = {};
  const title = fields.title.trim();
  const subject = fields.subject.trim();
  if (!title) errors.title = "Give your course a title so you can find it later.";
  else if (title.length > 120) errors.title = "Keep the title under 120 characters.";
  if (!subject) errors.subject = "Add a subject, e.g. “Biology” or “Economics”.";
  else if (subject.length > 60) errors.subject = "Keep the subject under 60 characters.";
  if ((fields.notes ?? "").length > 1000) errors.notes = "Notes can be up to 1,000 characters.";
  return errors;
}

export function validatePdf(file: { name: string; type: string; size: number } | null): string | undefined {
  if (!file || file.size === 0) return "Choose a PDF to upload.";
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
    return "That file isn't a PDF. Export your slides or chapter as a PDF and try again.";
  if (file.size > MAX_PDF_MB * 1024 * 1024)
    return `That PDF is over ${MAX_PDF_MB} MB. Try uploading a single chapter instead.`;
  return undefined;
}
