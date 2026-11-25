"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { XP_PER_LEVEL } from "@/convex/xpRules";

// Streak, XP and level as small game counters. Also tells the server the reader's time zone once,
// so a streak day ends at their own midnight.
export function XpStats({ level = true }: { level?: boolean }) {
  const stats = useQuery(api.xp.stats, {});
  const setTimeZone = useMutation(api.xp.setTimeZone);
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) void setTimeZone({ timeZone: zone }).catch(() => {});
  }, [setTimeZone]);

  if (!stats) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="stat" title={stats.streak ? `${stats.streak} day${stats.streak === 1 ? "" : "s"} in a row` : "Earn XP today to start a streak"}>
        🔥 {stats.streak}
      </span>
      <span className="stat" title="Experience: 10 for reading a chapter, 20 for a note, 10 per right answer">
        XP {stats.xp}
      </span>
      {level && (
        <span className="stat" title={`Level ${stats.level}: ${XP_PER_LEVEL - stats.intoLevel} XP to the next level`}>
          LV {stats.level}
        </span>
      )}
    </div>
  );
}

// The level with a progress bar to the next one (the path's side card).
export function LevelBar() {
  const stats = useQuery(api.xp.stats, {});
  if (!stats) return null;
  return (
    <div className="mt-4">
      <div className="flex justify-between text-meta">
        <span className="font-game text-label">LEVEL {stats.level}</span>
        <span className="text-muted">
          {stats.intoLevel}/{XP_PER_LEVEL} XP
        </span>
      </div>
      <div className="mt-1.5 h-3.5 overflow-hidden rounded border-2 border-ink bg-panel" role="progressbar" aria-label={`Level ${stats.level} progress`} aria-valuenow={stats.intoLevel} aria-valuemax={XP_PER_LEVEL}>
        <i className="block h-full" style={{ width: `${stats.intoLevel}%`, background: "repeating-linear-gradient(90deg, var(--accent) 0 8px, var(--accent-dark) 8px 16px)" }} />
      </div>
    </div>
  );
}
