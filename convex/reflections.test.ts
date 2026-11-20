import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

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

describe("images in notes", () => {
  test("logged-out visitors are rejected", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.reflections.imageUploadUrl, {})).rejects.toThrow();
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
