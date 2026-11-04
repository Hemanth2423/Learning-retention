import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

// Given User A has a course with a topic, a quiz attempt, and a star,
// when User B logs in and lists, opens, searches, or edits,
// then User B sees nothing of User A's and can't change it.
describe("data isolation", () => {
  test("User B cannot see or change User A's data", async () => {
    const t = convexTest(schema, modules);

    // Two real accounts (rows in the users table)
    const { userA, userB, courseId, topicId } = await t.run(async (ctx) => {
      const userA = await ctx.db.insert("users", { email: "a@test.com" });
      const userB = await ctx.db.insert("users", { email: "b@test.com" });
      const fileId = await ctx.storage.store(new Blob(["pdf"]));
      const courseId = await ctx.db.insert("courses", {
        userId: userA,
        title: "User A's secret course",
        subject: "Biology",
        fileId,
        status: "ready",
      });
      const topicId = await ctx.db.insert("topics", {
        courseId,
        userId: userA,
        order: 0,
        title: "Photosynthesis",
        summary: "Plants turn light into sugar.",
        keyPoints: ["Chlorophyll absorbs light"],
        examples: [],
        quiz: [],
      });
      await ctx.db.insert("quizAttempts", { userId: userA, topicId, courseId, score: 4, total: 5 });
      await ctx.db.insert("stars", { userId: userA, topicId });
      return { userA, userB, courseId, topicId };
    });

    // Convex Auth puts "<userId>|<sessionId>" in the token subject
    const asA = t.withIdentity({ subject: `${userA}|session-a` });
    const asB = t.withIdentity({ subject: `${userB}|session-b` });

    // Sanity check: User A sees their own data
    expect(await asA.query(api.courses.list, {})).toHaveLength(1);

    // User B sees none of it
    expect(await asB.query(api.courses.list, {})).toEqual([]);
    expect(await asB.query(api.courses.get, { courseId })).toBeNull();
    expect(await asB.query(api.topics.listByCourse, { courseId })).toEqual([]);
    expect(await asB.query(api.topics.get, { topicId })).toBeNull();
    expect((await asB.query(api.topics.find, { text: "photo", mastery: "all", sort: "newest" })).rows).toEqual([]);
    expect(await asB.query(api.stars.listMine, {})).toEqual([]);
    expect((await asB.query(api.dashboard.stats, {})).quizzesTaken).toBe(0);

    // ...and can't change or delete it
    await expect(
      asB.mutation(api.courses.update, { courseId, title: "hacked", subject: "x" })
    ).rejects.toThrow();
    await expect(asB.mutation(api.courses.remove, { courseId })).rejects.toThrow();
    await expect(asB.mutation(api.stars.toggle, { topicId })).rejects.toThrow();
    const course = await t.run((ctx) => ctx.db.get(courseId));
    expect(course?.title).toBe("User A's secret course");
  });
});
