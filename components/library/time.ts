// "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", or a date.
export function timeAgo(then: number, now: number): string {
  const min = Math.floor((now - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(then).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}
