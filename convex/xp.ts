import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { requireUser } from "./helpers";
import { Award, dayKey, levelOf, newAwards, nextStreak, shownStreak } from "./xpRules";

const MAX_TIME_ZONE = 64;

function statsRow(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db.query("learnerStats").withIndex("by_user", (q) => q.eq("userId", userId)).first();
}

// Pays the awards not paid before and updates the streak. Returns the XP gained. Called only from server mutations.
export async function awardXp(ctx: MutationCtx, userId: Id<"users">, awards: Award[]): Promise<number> {
  if (awards.length === 0) return 0;
  const row = await statsRow(ctx, userId);
  const fresh = newAwards(row?.awarded ?? [], awards);
  if (fresh.length === 0) return 0;
  const gained = fresh.reduce((sum, a) => sum + a.xp, 0);
  const today = dayKey(Date.now(), row?.timeZone);
  const update = {
    xp: (row?.xp ?? 0) + gained,
    streak: nextStreak(row?.lastActiveDay, row?.streak ?? 0, today),
    lastActiveDay: today,
    awarded: [...(row?.awarded ?? []), ...fresh.map((a) => a.key)],
  };
  if (row) await ctx.db.patch(row._id, update);
  else await ctx.db.insert("learnerStats", { userId, ...update });
  return gained;
}

// XP, level and streak for Home, the path and the test.
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await statsRow(ctx, userId);
    const xp = row?.xp ?? 0;
    return { xp, ...levelOf(xp), streak: shownStreak(row?.lastActiveDay, row?.streak ?? 0, dayKey(Date.now(), row?.timeZone)) };
  },
});

// The browser tells us the reader's time zone, so a streak day ends at their midnight.
export const setTimeZone = mutation({
  args: { timeZone: v.string() },
  handler: async (ctx, { timeZone }) => {
    const userId = await requireUser(ctx);
    if (!timeZone || timeZone.length > MAX_TIME_ZONE) return;
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone });
    } catch {
      return; // not a real time zone
    }
    const row = await statsRow(ctx, userId);
    if (row?.timeZone === timeZone) return;
    if (row) await ctx.db.patch(row._id, { timeZone });
    else await ctx.db.insert("learnerStats", { userId, xp: 0, streak: 0, timeZone, awarded: [] });
  },
});
