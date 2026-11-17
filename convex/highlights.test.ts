import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const rect = { x: 0.1, y: 0.2, w: 0.3, h: 0.02 };

async function setup(hasText = true) {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  const documentId = await t.run(async (ctx) => {
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    return await ctx.db.insert("documents", { userId: userA, title: "Book", sourceType: "pdf", fileId, status: "ready", pageCount: 10, hasText });
  });
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), documentId };
}

describe("highlights", () => {
  test("an owner can add, comment, list and delete; the first page comes from the boxes", async () => {
    const { asA, documentId } = await setup();
    const id = await asA.mutation(api.highlights.add, {
      documentId,
      text: "  Habits   form\n with repetition ",
      segments: [{ page: 5, rects: [rect] }, { page: 4, rects: [rect] }],
    });
    let list = await asA.query(api.highlights.list, { documentId });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ text: "Habits form with repetition", locator: { kind: "pdf", page: 4 } });
    await asA.mutation(api.highlights.setComment, { highlightId: id, comment: "  Key idea  " });
    list = await asA.query(api.highlights.list, { documentId });
    expect(list[0].comment).toBe("Key idea");
    await asA.mutation(api.highlights.setComment, { highlightId: id, comment: "" });
    expect((await asA.query(api.highlights.list, { documentId }))[0].comment).toBeUndefined();
    await asA.mutation(api.highlights.remove, { highlightId: id });
    expect(await asA.query(api.highlights.list, { documentId })).toHaveLength(0);
  });

  test("another user can't see, add to, change or delete them", async () => {
    const { asA, asB, documentId } = await setup();
    const id = await asA.mutation(api.highlights.add, { documentId, text: "secret", segments: [{ page: 1, rects: [rect] }] });
    expect(await asB.query(api.highlights.list, { documentId })).toEqual([]);
    await expect(asB.mutation(api.highlights.add, { documentId, text: "x", segments: [{ page: 1, rects: [rect] }] })).rejects.toThrow();
    await asB.mutation(api.highlights.setComment, { highlightId: id, comment: "hijack" });
    await asB.mutation(api.highlights.remove, { highlightId: id });
    const list = await asA.query(api.highlights.list, { documentId });
    expect(list).toHaveLength(1);
    expect(list[0].comment).toBeUndefined();
  });

  test("bad input is rejected, and scanned PDFs can't be highlighted", async () => {
    const { asA, documentId } = await setup();
    await expect(asA.mutation(api.highlights.add, { documentId, text: "x", segments: [{ page: 99, rects: [rect] }] })).rejects.toThrow();
    await expect(
      asA.mutation(api.highlights.add, { documentId, text: "x", segments: [{ page: 1, rects: [rect] }], comment: "c".repeat(2001) })
    ).rejects.toThrow();
    const scanned = await setup(false);
    await expect(
      scanned.asA.mutation(api.highlights.add, { documentId: scanned.documentId, text: "x", segments: [{ page: 1, rects: [rect] }] })
    ).rejects.toThrow(/scanned/);
  });

  test("logged-out visitors are rejected", async () => {
    const { t, documentId } = await setup();
    await expect(t.query(api.highlights.list, { documentId })).rejects.toThrow();
  });
});
