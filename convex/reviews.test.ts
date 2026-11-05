import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { DAY_MS } from "./spacing";
import { modules } from "./test.setup";

const q = (id: string, level: "easier" | "apply" | "stretch") => ({
  id, type: "choice" as const, style: "apply" as const, level, prompt: `${id}?`, options: ["right", "w1", "w2", "w3"], answerIndex: 0, explanation: "e",
});
const bank = [q("apply-0", "apply"), q("easier-1", "easier"), q("stretch-2", "stretch")];

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userA = await ctx.db.insert("users", { email: "a@test.com" });
    const userB = await ctx.db.insert("users", { email: "b@test.com" });
    const fileId = await ctx.storage.store(new Blob(["pdf"]));
    const courseId = await ctx.db.insert("courses", { userId: userA, title: "C", subject: "", fileId, status: "ready" });
    const topicId = await ctx.db.insert("topics", {
      courseId, userId: userA, order: 0, title: "Spacing", summary: "s", subIdeas: [], insights: [], misconceptions: [],
      searchQuery: "q", lessonStatus: "ready", examples: [], checks: [], questions: bank,
    });
    return { userA, userB, topicId };
  });
  return { t, ...ids, asA: t.withIdentity({ subject: `${ids.userA}|a` }), asB: t.withIdentity({ subject: `${ids.userB}|b` }) };
}

beforeEach(() => vi.useFakeTimers({ now: Date.UTC(2026, 10, 4, 18), toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

describe("spaced review", () => {
  test("mastering schedules a review for tomorrow; a miss brings it back the next day", async () => {
    const { asA, topicId } = await setup();
    // A warm-up right isn't mastery: no review yet.
    await asA.mutation(api.checks.answerQuestion, { topicId, questionId: "easier-1", answer: 0 });
    expect((await asA.query(api.reviews.today, { tzOffsetMinutes: 0 })).scheduledCount).toBe(0);

    await asA.mutation(api.checks.answerQuestion, { topicId, questionId: "apply-0", answer: 0 });
    const now = await asA.query(api.reviews.today, { tzOffsetMinutes: 0 });
    expect(now).toMatchObject({ scheduledCount: 1, dueCount: 0, tomorrowCount: 1 });

    vi.setSystemTime(Date.now() + DAY_MS);
    const due = await asA.query(api.reviews.today, { tzOffsetMinutes: 0 });
    expect(due.dueCount).toBe(1);
    expect(due.items[0].question.level).not.toBe("easier"); // reviews ask a scenario, not the warm-up
    expect(JSON.stringify(due.items)).not.toMatch(/answerIndex|explanation/);

    const missed = await asA.mutation(api.reviews.answer, {
      topicId, questionId: due.items[0].question.id, answer: 1, tzOffsetMinutes: 0,
    });
    expect(missed.correct).toBe(false);
    expect(missed.nextDueAt).toBe(Date.now() + DAY_MS);
  });

  test("another user can't see or answer my reviews", async () => {
    const { t, asA, asB, topicId } = await setup();
    await asA.mutation(api.checks.answerQuestion, { topicId, questionId: "apply-0", answer: 0 });
    vi.setSystemTime(Date.now() + DAY_MS);
    expect((await asB.query(api.reviews.today, { tzOffsetMinutes: 0 })).scheduledCount).toBe(0);
    expect(await asB.query(api.reviews.dueCount, { tzOffsetMinutes: 0 })).toBe(0);
    await expect(
      asB.mutation(api.reviews.answer, { topicId, questionId: "apply-0", answer: 0, tzOffsetMinutes: 0 })
    ).rejects.toThrow();
    // Backfill doesn't duplicate an existing schedule.
    expect(await t.mutation(internal.reviews.backfill, {})).toBe(0);
  });
});
