import { dayIndex } from "@/convex/spacing";

// "today" / "tomorrow" / "in 6 days", by the learner's local calendar days.
export function whenLabel(t: number) {
  const tz = new Date().getTimezoneOffset();
  const d = dayIndex(t, tz) - dayIndex(Date.now(), tz);
  return d <= 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
}
