import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { DAY_MS } from "./spacing";
import { modules } from "./test.setup";

const q = (id: string, level: "easier" | "apply" | "stretch") => ({
  id, type: "choice" as const, style: "apply" as const, level, prompt: `${id}?`, options: ["right", "w1", "w2", "w3"], answerIndex: 0, explanation: "e",
});

async function setup(pillars = 1) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", { email: "a@test.com" });
    const other = await ctx.db.insert("users", { email: "b@test.com" });
    const fileId = await ctx.storage.store(new Blob(["pdf"]));
    const courseId = await ctx.db.insert("courses", { userId: user, title: "Memory", subject: "", fileId, status: "ready" });
    const topics = [];
    for (let i = 0; i < pillars; i++)
      topics.push(await ctx.db.insert("topics", {
        courseId, userId: user, order: i, title: `Pillar ${i}`, summary: "s", subIdeas: [], insights: [], misconceptions: [],
        searchQuery: "q", lessonStatus: "ready", examples: [], checks: [], questions: [q("a", "apply"), q("e", "easier"), q("s", "stretch")],
      }));
    return { user, other, topics };
  });
  return { t, ...ids, as: t.withIdentity({ subject: `${ids.user}|a` }), asOther: t.withIdentity({ subject: `${ids.other}|b` }) };
}
const answer = (topicId: never, questionId: string, right: boolean) => ({ topicId, questionId, answer: right ? 0 : 1, tzOffsetMinutes: 0 });

beforeEach(() => vi.useFakeTimers({ now: Date.UTC(2026, 10, 4, 18), toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

describe("rewards", () => {
  test("an achievement is awarded only once, however many times you earn it", async () => {
    const { as, topics } = await setup(2);
    const first = await as.mutation(api.checks.answerQuestion, answer(topics[0] as never, "a", true));
    expect(first.reward.achievements).toEqual(["First Step: Answered your first question", "Pillar Mastered: Pillar 0"]);
    const again = await as.mutation(api.checks.answerQuestion, answer(topics[0] as never, "s", true));
    expect(again.reward.achievements).toEqual([]);
    const kinds = (await as.query(api.rewards.me, { tzOffsetMinutes: 0 })).achievements.map((a) => a.kind);
    expect(kinds.filter((k) => k === "pillar-mastered")).toHaveLength(1);
    // Mastering the last pillar completes the course, once.
    const last = await as.mutation(api.checks.answerQuestion, answer(topics[1] as never, "a", true));
    expect(last.reward.achievements).toEqual(["Pillar Mastered: Pillar 1", "Course Completed: Memory"]);
  });

  test("XP adds up, a comeback earns a bonus, and the streak grows across days", async () => {
    const { as, asOther, topics } = await setup();
    const t = topics[0] as never;
    expect((await as.mutation(api.checks.answerQuestion, answer(t, "a", false))).reward.xp).toBe(2);
    expect((await as.mutation(api.checks.answerQuestion, answer(t, "e", false))).reward.xp).toBe(2);
    const comeback = await as.mutation(api.checks.answerQuestion, answer(t, "s", true));
    expect(comeback.reward.xp).toBe(2 + 15 + 5);
    expect(comeback.reward.achievements).toContain("Comeback: Pillar 0");

    vi.setSystemTime(Date.now() + DAY_MS);
    expect((await as.mutation(api.checks.answerQuestion, answer(t, "e", true))).reward.streak).toBe(2);
    const me = await as.query(api.rewards.me, { tzOffsetMinutes: 0 });
    expect(me).toMatchObject({ xp: 2 + 2 + 22 + 7, streak: 2, activeToday: true });

    // Two days of nothing, with the freeze used up... the shown streak drops to 0. Others see nothing of mine.
    vi.setSystemTime(Date.now() + 3 * DAY_MS);
    expect((await as.query(api.rewards.me, { tzOffsetMinutes: 0 })).streak).toBe(0);
    expect(await asOther.query(api.rewards.me, { tzOffsetMinutes: 0 })).toMatchObject({ xp: 0, achievements: [] });
  });
});
