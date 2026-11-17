// XP, levels and streaks (ADR 009). Pure rules so they can be tested; awards happen only on the server.

export const XP = { read: 10, note: 20, answer: 10 } as const;
export const XP_PER_LEVEL = 100;

// Each award has a key, so the same action on the same chapter (or question) only ever pays once.
export const awardKey = {
  read: (documentId: string, chapterKey: string) => `${documentId}:${chapterKey}:read`,
  note: (documentId: string, chapterKey: string) => `${documentId}:${chapterKey}:note`,
  answer: (documentId: string, chapterKey: string, question: number) => `${documentId}:${chapterKey}:q${question}`,
};

export type Award = { key: string; xp: number };

// The awards not paid yet (and each key once, even if asked twice in one go).
export function newAwards(already: string[], awards: Award[]): Award[] {
  const seen = new Set(already);
  return awards.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true)));
}

export function levelOf(xp: number) {
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, intoLevel: xp % XP_PER_LEVEL };
}

// The calendar day ("2026-11-17") in the reader's time zone, so a streak follows their own midnight.
export function dayKey(now: number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return new Date(now).toISOString().slice(0, 10); // unknown time zone: fall back to UTC
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// Earning XP today: same day keeps the streak, the next day adds one, a gap starts over at 1.
export function nextStreak(lastDay: string | undefined, streak: number, today: string): number {
  if (!lastDay) return 1;
  const gap = daysBetween(lastDay, today);
  if (gap <= 0) return Math.max(streak, 1);
  return gap === 1 ? streak + 1 : 1;
}

// The streak to show: it still counts until the end of the day after the last active day.
export function shownStreak(lastDay: string | undefined, streak: number, today: string): number {
  if (!lastDay) return 0;
  return daysBetween(lastDay, today) <= 1 ? streak : 0;
}
