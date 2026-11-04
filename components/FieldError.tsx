export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-bad">
      {message}
    </p>
  );
}

// Turns a thrown server error into a message a person can read.
export function errorMessage(err: unknown): string {
  const data = (err as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  return "Something went wrong. Please try again.";
}
