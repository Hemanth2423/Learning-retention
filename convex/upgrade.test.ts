import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const pillar = { order: 0, title: "T", summary: "s", subIdeas: [], insights: [], misconceptions: [], searchQuery: "q", examples: [] };
const oldCheck = { id: "apply", level: "apply" as const, question: "Q?", options: ["a", "b", "c", "d"], answerIndex: 0, explanation: "e" };
const newQ = { id: "choice-0", type: "choice" as const, style: "apply" as const, level: "apply" as const, prompt: "Q?", options: ["a", "b", "c", "d"], answerIndex: 0, explanation: "e" };

describe("upgrading old lessons", () => {
  test("opening an old lesson rebuilds it once; a new lesson is left alone", async () => {
    const t = convexTest(schema, modules);
    const { user, oldId, newId } = await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", { email: "a@test.com" });
      const fileId = await ctx.storage.store(new Blob(["pdf"]));
      const courseId = await ctx.db.insert("courses", { userId: user, title: "C", subject: "", fileId, status: "ready" });
      const oldId = await ctx.db.insert("topics", { ...pillar, courseId, userId: user, lessonStatus: "ready", checks: [oldCheck] });
      const newId = await ctx.db.insert("topics", { ...pillar, order: 5, courseId, userId: user, lessonStatus: "ready", checks: [], questions: [newQ] });
      return { user, oldId, newId };
    });
    const as = t.withIdentity({ subject: `${user}|s` });

    await as.mutation(api.lessons.ensure, { topicId: oldId });
    await as.mutation(api.lessons.ensure, { topicId: newId });
    const [o, n] = await t.run(async (ctx) => [await ctx.db.get(oldId), await ctx.db.get(newId)]);
    expect(o?.lessonStatus).toBe("generating");
    expect(n?.lessonStatus).toBe("ready");
  });
});
