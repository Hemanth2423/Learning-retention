"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Saves the latest value a moment after the reader stops typing, and once more when the editor goes away.
export function useAutosave<T>(save: (value: T) => Promise<unknown>, delay = 800) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    setStatus("saving");
    try {
      await saveRef.current(job.value);
      setStatus("saved");
    } catch {
      pending.current ??= job; // keep it so the next change (or leaving) tries again
      setStatus("error");
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      setStatus("saving");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [flush, delay]
  );

  useEffect(() => () => void flush(), [flush]);

  return { status, schedule, flush };
}
