import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { MAX_COVER_BYTES, validateCover } from "./documentRules";
import schema from "./schema";
import { modules } from "./test.setup";

describe("validateCover", () => {
  test("accepts a small image", () => {
    expect(validateCover({ contentType: "image/jpeg", size: 40_000 })).toBeUndefined();
    expect(validateCover({ contentType: "image/png", size: MAX_COVER_BYTES })).toBeUndefined();
  });
  test("refuses missing, empty, non-image and oversized files", () => {
    expect(validateCover(null)).toMatch(/No cover/);
    expect(validateCover({ contentType: "image/jpeg", size: 0 })).toMatch(/No cover/);
    expect(validateCover({ contentType: "text/html", size: 10 })).toMatch(/JPEG/);
    expect(validateCover({ contentType: "image/svg+xml", size: 10 })).toMatch(/JPEG/); // SVG can carry scripts
    expect(validateCover({ contentType: "image/jpeg", size: MAX_COVER_BYTES + 1 })).toMatch(/too large/);
  });
});

async function setup() {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  const documentId = await t.run(async (ctx) => {
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    return await ctx.db.insert("documents", { userId: userA, title: "Book", sourceType: "pdf", fileId, status: "ready", pageCount: 3 });
  });
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), documentId };
}
const image = (t: ReturnType<typeof convexTest>, type = "image/jpeg", bytes = 100) =>
  t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));

describe("documents.setCover", () => {
  test("the owner's PDF gets a cover, shown in the library", async () => {
    const { t, asA, documentId } = await setup();
    expect((await asA.query(api.documents.list, {}))[0]).toMatchObject({ coverUrl: null, needsCover: true });
    const coverId = await image(t);
    expect(await asA.mutation(api.documents.setCover, { documentId, coverId })).toEqual({ ok: true });
    const [book] = await asA.query(api.documents.list, {});
    expect(book.coverUrl).toEqual(expect.any(String));
    expect(book.needsCover).toBe(false);
  });

  test("someone else's book is refused and the uploaded image deleted", async () => {
    const { t, asB, documentId } = await setup();
    const coverId = await image(t);
    expect(await asB.mutation(api.documents.setCover, { documentId, coverId })).toMatchObject({ ok: false });
    expect(await t.run((ctx) => ctx.db.system.get(coverId))).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(documentId)))?.coverId).toBeUndefined();
  });

  test("a non-image file is refused and deleted", async () => {
    const { t, asA, documentId } = await setup();
    const coverId = await image(t, "text/html");
    expect(await asA.mutation(api.documents.setCover, { documentId, coverId })).toMatchObject({ ok: false, message: expect.stringMatching(/JPEG/) });
    expect(await t.run((ctx) => ctx.db.system.get(coverId))).toBeNull();
  });

  test("a new cover replaces the old file, and removing the book deletes it", async () => {
    const { t, asA, documentId } = await setup();
    const first = await image(t);
    await asA.mutation(api.documents.setCover, { documentId, coverId: first });
    const second = await image(t);
    await asA.mutation(api.documents.setCover, { documentId, coverId: second });
    expect(await t.run((ctx) => ctx.db.system.get(first))).toBeNull();
    await asA.mutation(api.documents.remove, { documentId });
    await t.finishAllScheduledFunctions(() => {});
    expect(await t.run((ctx) => ctx.db.system.get(second))).toBeNull();
  });
});

describe("covers that aren't covers", () => {
  test("a mostly white first page doesn't count as a cover", async () => {
    const { looksLikeCover } = await import("./documentRules");
    expect(looksLikeCover(0.05)).toBe(false); // a page of text
    expect(looksLikeCover(0.6)).toBe(true); // a picture cover
  });

  test("skipCover stops the library asking for a cover, for the owner only", async () => {
    const { asA, asB, documentId } = await setup();
    await asB.mutation(api.documents.skipCover, { documentId });
    expect((await asA.query(api.documents.list, {}))[0].needsCover).toBe(true);
    await asA.mutation(api.documents.skipCover, { documentId });
    expect((await asA.query(api.documents.list, {}))[0].needsCover).toBe(false);
  });
});
