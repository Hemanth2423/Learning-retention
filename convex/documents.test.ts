import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { MAX_UPLOAD_BYTES } from "./documentRules";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), userA };
}

describe("documents", () => {
  test("a document belongs to its owner only", async () => {
    const { t, asA, asB, userA } = await setup();
    const documentId = await t.run(async (ctx) => {
      const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
      return await ctx.db.insert("documents", { userId: userA, title: "Secret", sourceType: "pdf", fileId, status: "ready" });
    });
    expect((await asA.query(api.documents.get, { documentId }))?.title).toBe("Secret");
    expect(await asB.query(api.documents.get, { documentId })).toBeNull();
    expect(await asB.query(api.documents.latest, {})).toBeNull();
    expect((await asA.query(api.documents.latest, {}))?.title).toBe("Secret");
  });

  test("logged-out visitors are rejected", async () => {
    const { t } = await setup();
    await expect(t.query(api.documents.latest, {})).rejects.toThrow();
    await expect(t.mutation(api.documents.generateUploadUrl, {})).rejects.toThrow();
  });

  test("the server rejects a file over 25 MB and deletes it", async () => {
    const { t, asA } = await setup();
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)])));
    const res = await asA.mutation(api.documents.create, { fileId, fileName: "big.pdf" });
    expect(res).toEqual({ ok: false, message: expect.stringMatching(/over 25 MB/) });
    expect(await t.run((ctx) => ctx.db.system.get(fileId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(0);
  });

  test("a valid upload becomes a document that is being prepared", async () => {
    const { t, asA } = await setup();
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["%PDF-1.4 small"])));
    const res = await asA.mutation(api.documents.create, { fileId, fileName: "My_Book.pdf" });
    if (!res.ok) throw new Error("expected ok");
    const documentId = res.documentId;
    const doc = await asA.query(api.documents.get, { documentId });
    expect(doc?.status).toBe("processing");
    expect(doc?.title).toBe("My_Book");
    expect(doc && "fileId" in doc).toBe(false); // the storage id never reaches the browser
  });

  test("only a failed document can be discarded, and only by its owner", async () => {
    const { t, asA, asB, userA } = await setup();
    const [failed, ready] = await t.run(async (ctx) => {
      const fileId = await ctx.storage.store(new Blob(["x"]));
      const f = await ctx.db.insert("documents", { userId: userA, title: "F", sourceType: "pdf", fileId, status: "failed" });
      const r = await ctx.db.insert("documents", { userId: userA, title: "R", sourceType: "pdf", fileId, status: "ready" });
      return [f, r];
    });
    await asB.mutation(api.documents.discard, { documentId: failed });
    expect(await t.run((ctx) => ctx.db.get(failed))).not.toBeNull();
    await asA.mutation(api.documents.discard, { documentId: ready });
    expect(await t.run((ctx) => ctx.db.get(ready))).not.toBeNull();
    await asA.mutation(api.documents.discard, { documentId: failed });
    expect(await t.run((ctx) => ctx.db.get(failed))).toBeNull();
  });

  test("saveProgress remembers the page, for the owner only, and ignores bad pages", async () => {
    const { t, asA, asB, userA } = await setup();
    const documentId = await t.run(async (ctx) => {
      const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
      return await ctx.db.insert("documents", { userId: userA, title: "B", sourceType: "pdf", fileId, status: "ready", pageCount: 10 });
    });
    const lastPage = async () => (await asA.query(api.documents.get, { documentId }))?.lastLocator;
    await asA.mutation(api.documents.saveProgress, { documentId, page: 4 });
    expect(await lastPage()).toEqual({ kind: "pdf", page: 4 });
    await asB.mutation(api.documents.saveProgress, { documentId, page: 7 });
    await asA.mutation(api.documents.saveProgress, { documentId, page: 99 });
    await asA.mutation(api.documents.saveProgress, { documentId, page: 0 });
    await asA.mutation(api.documents.saveProgress, { documentId, page: 2.5 });
    expect(await lastPage()).toEqual({ kind: "pdf", page: 4 });
  });

  test("only the owner gets a file link", async () => {
    const { t, asA, asB, userA } = await setup();
    const documentId = await t.run(async (ctx) => {
      const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
      return await ctx.db.insert("documents", { userId: userA, title: "L", sourceType: "pdf", fileId, status: "ready" });
    });
    expect(await asA.query(api.documents.fileUrl, { documentId })).toEqual(expect.stringContaining("http"));
    expect(await asB.query(api.documents.fileUrl, { documentId })).toBeNull();
  });
});
