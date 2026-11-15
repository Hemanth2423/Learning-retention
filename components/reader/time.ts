// "at 3:40 PM" for today, "tomorrow at 3:40 PM" otherwise. Used to say when the next daily question frees up.
export function whenOf(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? `at ${time}` : `tomorrow at ${time}`;
}
