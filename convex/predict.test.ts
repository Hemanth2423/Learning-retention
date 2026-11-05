import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { cleanPredict } from "./questionRules";
import schema from "./schema";
import { modules } from "./test.setup";

const raw = { prompt: "What do you think happens if you test yourself instead of re-reading?", options: ["You remember more", "Nothing", "You forget faster", "It only feels better"], answerIndex: 0, explanation: "Recall strengthens memory." };

describe("predict-first", () => {
  test("keeps the right answer after shuffling and hides the key from the browser", async () => {
    const q = cleanPredict(raw)!;
    expect(q.type === "choice" && q.options[q.answerIndex]).toBe("You remember more");

    const t = convexTest(schema, modules);
    const { user, topicId } = await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", { email: "a@test.com" });
      const fileId = await ctx.storage.store(new Blob(["pdf"]));
      const courseId = await ctx.db.insert("courses", { userId: user, title: "C", subject: "", fileId, status: "ready" });
      const topicId = await ctx.db.insert("topics", {
        courseId, userId: user, order: 0, title: "Retrieval", summary: "s", subIdeas: [], insights: [],
        misconceptions: [], searchQuery: "q", lessonStatus: "ready", examples: [], checks: [], predict: q,
      });
      return { user, topicId };
    });
    const as = t.withIdentity({ subject: `${user}|s` });

    const seen = await as.query(api.topics.get, { topicId });
    expect(JSON.stringify(seen?.predict)).not.toMatch(/answerIndex|explanation/);

    // A guess is graded, so we can reveal the answer, but never recorded: it can't hurt accuracy or mastery.
    const shown = seen!.predict!;
    const right = shown.type === "choice" ? shown.options.indexOf("You remember more") : -1;
    expect((await as.mutation(api.checks.answerPredict, { topicId, choice: right })).correct).toBe(true);
    expect((await as.query(api.dashboard.stats, {})).checksAnswered).toBe(0);
  });

  test("drops a prediction that asks about the source", () => {
    expect(cleanPredict({ ...raw, prompt: "According to the chapter, what happens?" })).toBeNull();
  });
});
