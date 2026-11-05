import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DONT_KNOW } from "./placement";
import { nodeState, pathMinutes } from "./progress";
import schema from "./schema";
import { modules } from "./test.setup";

const choice = (id: string) => ({
  id, type: "choice" as const, style: "core" as const, level: "easier" as const, prompt: "Q?", options: ["right", "w1", "w2", "w3"], answerIndex: 0, explanation: "e",
});

describe("pillar states and path time", () => {
  test("known ideas are skipped in the time estimate; shaky ones get a shorter lesson", () => {
    const untested = { state: "untested" as const };
    expect(nodeState(untested, false, "known")).toBe("known");
    expect(nodeState({ state: "mastered" }, false, "known")).toBe("learned");
    expect(nodeState({ state: "mastered" }, true)).toBe("ingrained");
    expect(pathMinutes([{ node: "known" }, { node: "new", placement: "shaky" }, { node: "new" }, { node: "learned" }])).toBe(10);
  });
});

describe("placement check", () => {
  test("right → Known (and a review is scheduled), wrong → Shaky, don't know → New; nothing is scored", async () => {
    const t = convexTest(schema, modules);
    const { user, other, courseId, topics } = await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", { email: "a@test.com" });
      const other = await ctx.db.insert("users", { email: "b@test.com" });
      const fileId = await ctx.storage.store(new Blob(["pdf"]));
      const courseId = await ctx.db.insert("courses", { userId: user, title: "C", subject: "", fileId, status: "ready" });
      const topics = [];
      for (let i = 0; i < 3; i++)
        topics.push(await ctx.db.insert("topics", {
          courseId, userId: user, order: i, title: `P${i}`, summary: "s", subIdeas: [], insights: [], misconceptions: [],
          searchQuery: "q", lessonStatus: "pending", examples: [], checks: [],
        }));
      await ctx.db.patch(courseId, {
        placement: { status: "ready", questions: topics.map((topicId, i) => ({ topicId, question: choice(`placement-${i}`) })) },
      });
      return { user, other, courseId, topics };
    });
    const as = t.withIdentity({ subject: `${user}|a` });
    const asOther = t.withIdentity({ subject: `${other}|b` });

    // The browser copy has no answer key.
    const course = await as.query(api.courses.get, { courseId });
    expect(JSON.stringify(course?.placement)).not.toMatch(/answerIndex|explanation/);
    const rightIndex = (i: number) => {
      const q = course!.placement!.questions[i].question;
      return q.type === "choice" ? q.options.indexOf("right") : -1;
    };

    await expect(asOther.mutation(api.placement.answer, { courseId, topicId: topics[0], choice: 0 })).rejects.toThrow();
    expect((await as.mutation(api.placement.answer, { courseId, topicId: topics[0], choice: rightIndex(0) })).result).toBe("known");
    expect((await as.mutation(api.placement.answer, { courseId, topicId: topics[1], choice: (rightIndex(1) + 1) % 4 })).result).toBe("shaky");
    expect((await as.mutation(api.placement.answer, { courseId, topicId: topics[2], choice: DONT_KNOW })).result).toBe("new");

    const path = await as.query(api.topics.listByCourse, { courseId });
    expect(path.map((p) => p.node)).toEqual(["known", "new", "new"]);
    expect((await as.query(api.courses.get, { courseId }))?.placement?.status).toBe("done");
    const today = await as.query(api.reviews.today, { tzOffsetMinutes: 0 });
    expect(today).toMatchObject({ scheduledCount: 1, tomorrowCount: 1 }); // known → confirm it tomorrow
    expect((await as.query(api.dashboard.stats, {})).checksAnswered).toBe(0); // a diagnostic isn't scored
  });
});
