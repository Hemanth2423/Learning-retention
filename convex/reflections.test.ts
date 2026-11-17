import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const note = (text: string) => ({
  content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }),
  plainText: text,
});
const at = (key: string, title: string, page: number, level = 1) => ({ key, title, level, locator: { kind: "pdf" as const, page } });

async function setup() {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  const documentId = await t.run(async (ctx) => {
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    return await ctx.db.insert("documents", {
      userId: userA,
      title: "Book",
      sourceType: "pdf",
      fileId,
      status: "ready",
      pageCount: 30,
      sections: [at("s0", "One", 1), at("s1", "One.1", 3, 2), at("s2", "Two", 10), at("s3", "Three", 20)],
    });
  });
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), documentId };
}

describe("reflections", () => {
  test("one reflection per chapter: saving again updates it", async () => {
    const { asA, documentId } = await setup();
    await asA.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("first") });
    await asA.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("second") });
    const list = await asA.query(api.reflections.list, { documentId });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ sectionKey: "s0", plainText: "second", dismissed: false });
  });

  test("saving an empty note deletes the reflection", async () => {
    const { asA, documentId } = await setup();
    await asA.mutation(api.reflections.save, { documentId, sectionKey: "s2", ...note("keep me") });
    await asA.mutation(api.reflections.save, { documentId, sectionKey: "s2", content: note("").content, plainText: "  " });
    expect(await asA.query(api.reflections.list, { documentId })).toHaveLength(0);
  });

  test("only chapters can be reflected on, and bad notes are rejected", async () => {
    const { asA, documentId } = await setup();
    await expect(asA.mutation(api.reflections.save, { documentId, sectionKey: "s1", ...note("a section, not a chapter") })).rejects.toThrow(/doesn't exist/);
    await expect(asA.mutation(api.reflections.save, { documentId, sectionKey: "nope", ...note("x") })).rejects.toThrow();
    await expect(asA.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("x".repeat(10001)) })).rejects.toThrow(/under 10,000/);
    await expect(asA.mutation(api.reflections.save, { documentId, sectionKey: "s0", content: "junk", plainText: "x" })).rejects.toThrow();
  });

  test("'Not now' is remembered, and writing later replaces it", async () => {
    const { asA, documentId } = await setup();
    await asA.mutation(api.reflections.dismiss, { documentId, sectionKey: "s3" });
    await asA.mutation(api.reflections.dismiss, { documentId, sectionKey: "s3" });
    let list = await asA.query(api.reflections.list, { documentId });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ sectionKey: "s3", dismissed: true });
    await asA.mutation(api.reflections.save, { documentId, sectionKey: "s3", ...note("now I wrote it") });
    list = await asA.query(api.reflections.list, { documentId });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ plainText: "now I wrote it", dismissed: false });
  });

  test("another user can't read, write or dismiss", async () => {
    const { asA, asB, documentId } = await setup();
    await asA.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("private") });
    expect(await asB.query(api.reflections.list, { documentId })).toEqual([]);
    await expect(asB.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("hijack") })).rejects.toThrow();
    await asB.mutation(api.reflections.dismiss, { documentId, sectionKey: "s2" });
    const list = await asA.query(api.reflections.list, { documentId });
    expect(list).toHaveLength(1);
    expect(list[0].plainText).toBe("private");
  });

  test("logged-out visitors are rejected", async () => {
    const { t, documentId } = await setup();
    await expect(t.query(api.reflections.list, { documentId })).rejects.toThrow();
  });

  test("images in notes: owner only, images only, and the file is deleted when refused", async () => {
    const { t, asA, asB, documentId } = await setup();
    const png = await t.run((ctx) => ctx.storage.store(new Blob(["png"], { type: "image/png" })));
    const res = await asA.mutation(api.reflections.attachImage, { documentId, storageId: png });
    expect(res).toMatchObject({ ok: true, url: expect.stringContaining("http") });
    expect(await t.run((ctx) => ctx.db.query("noteImages").collect())).toHaveLength(1);

    const pdf = await t.run((ctx) => ctx.storage.store(new Blob(["%PDF-"], { type: "application/pdf" })));
    expect(await asA.mutation(api.reflections.attachImage, { documentId, storageId: pdf })).toMatchObject({ ok: false });
    expect(await t.run((ctx) => ctx.db.system.get(pdf))).toBeNull();

    const other = await t.run((ctx) => ctx.storage.store(new Blob(["png"], { type: "image/png" })));
    expect(await asB.mutation(api.reflections.attachImage, { documentId, storageId: other })).toMatchObject({ ok: false });
    expect(await t.run((ctx) => ctx.db.query("noteImages").collect())).toHaveLength(1);
  });
});
