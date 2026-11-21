import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { cleanEmoji, folderCounts, inFolder, MAX_FOLDERS, validateFolderName } from "./folderRules";
import schema from "./schema";
import { modules } from "./test.setup";

describe("folder rules", () => {
  test("names: trimmed, 1–40 characters, no duplicates ignoring case", () => {
    expect(validateFolderName("  Work  ", [])).toBeUndefined();
    expect(validateFolderName("   ", [])).toMatch(/Give the folder a name/);
    expect(validateFolderName("x".repeat(41), [])).toMatch(/under 40/);
    expect(validateFolderName("habits", ["Habits"])).toMatch(/already have a folder called “habits”/);
  });
  test("emoji: one emoji or the default folder", () => {
    expect(cleanEmoji("🌱")).toBe("🌱");
    expect(cleanEmoji(undefined)).toBe("📁");
    expect(cleanEmoji("<script>")).toBe("📁");
    expect(cleanEmoji("a very long label")).toBe("📁");
  });
  test("views and counts: all, no folder, one folder", () => {
    const items = [{ folderId: "a" }, { folderId: null }, { folderId: "a" }, { folderId: "b" }];
    expect(inFolder(items, "all")).toHaveLength(4);
    expect(inFolder(items, "none")).toEqual([{ folderId: null }]);
    expect(inFolder(items, "a")).toHaveLength(2);
    const c = folderCounts(items);
    expect([c.all, c.none, c.byFolder.get("a"), c.byFolder.get("b")]).toEqual([4, 1, 2, 1]);
  });
});

async function setup() {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  const doc = (userId: Id<"users">, title: string, sourceType: "pdf" | "article" | "video" | "epub" = "pdf") =>
    t.run((ctx) => ctx.db.insert("documents", { userId, title, sourceType, status: "ready", pageCount: 3 }));
  const [book, article, video, theirs] = [await doc(userA, "Book"), await doc(userA, "Essay", "article"), await doc(userA, "Talk", "video"), await doc(userB, "Theirs")];
  return { t, userA, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), book, article, video, theirs };
}
const folderOf = async (s: Awaited<ReturnType<typeof setup>>, id: Id<"documents">) => (await s.asA.query(api.documents.list, {})).find((d) => d._id === id)?.folderId;

describe("folders", () => {
  test("create, list and rename; names are checked on the server", async () => {
    const s = await setup();
    const id = await s.asA.mutation(api.folders.create, { name: "  Work   AI  ", emoji: "🧪" });
    await expect(s.asA.mutation(api.folders.create, { name: "work ai" })).rejects.toThrow(/already have/);
    await expect(s.asA.mutation(api.folders.create, { name: "" })).rejects.toThrow(/Give the folder a name/);
    expect(await s.asA.query(api.folders.list, {})).toMatchObject([{ _id: id, name: "Work AI", emoji: "🧪", colour: expect.stringMatching(/^#/) }]);
    await s.asA.mutation(api.folders.rename, { folderId: id, name: "Evals" });
    await s.asA.mutation(api.folders.rename, { folderId: id, name: "evals" }); // same folder, new case: fine
    expect((await s.asA.query(api.folders.list, {}))[0].name).toBe("evals");
  });

  test("a reader can have up to 100 folders", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      for (let i = 0; i < MAX_FOLDERS; i++) await ctx.db.insert("folders", { userId: s.userA, name: `F${i}`, colour: "#000", emoji: "📁" });
    });
    await expect(s.asA.mutation(api.folders.create, { name: "One more" })).rejects.toThrow(/up to 100/);
  });

  test("any kind of item can be moved into a folder and back out", async () => {
    const s = await setup();
    const f = await s.asA.mutation(api.folders.create, { name: "Mixed" });
    expect(await s.asA.mutation(api.folders.moveItems, { documentIds: [s.book, s.article, s.video], folderId: f })).toEqual({ moved: 3 });
    for (const id of [s.book, s.article, s.video]) expect(await folderOf(s, id)).toBe(f);
    await s.asA.mutation(api.folders.moveItems, { documentIds: [s.article], folderId: null });
    expect(await folderOf(s, s.article)).toBeNull();
    expect(await folderOf(s, s.book)).toBe(f);
  });

  test("deleting a folder keeps its items (they go to No folder) and reports them for Undo", async () => {
    const s = await setup();
    const f = await s.asA.mutation(api.folders.create, { name: "Temp" });
    await s.asA.mutation(api.folders.moveItems, { documentIds: [s.book, s.video], folderId: f });
    const res = await s.asA.mutation(api.folders.remove, { folderId: f });
    expect(res.moved.sort()).toEqual([s.book, s.video].sort());
    expect(await s.asA.query(api.folders.list, {})).toEqual([]);
    expect(await s.asA.query(api.documents.list, {})).toHaveLength(3); // nothing deleted
    expect(await folderOf(s, s.book)).toBeNull();
  });

  test("someone else's folders and items are off limits", async () => {
    const s = await setup();
    const mine = await s.asA.mutation(api.folders.create, { name: "Mine" });
    const theirFolder = await s.asB.mutation(api.folders.create, { name: "Theirs" });
    expect(await s.asB.query(api.folders.list, {})).toMatchObject([{ name: "Theirs" }]);
    await expect(s.asB.mutation(api.folders.rename, { folderId: mine, name: "Hacked" })).rejects.toThrow(/couldn't find/);
    expect(await s.asB.mutation(api.folders.remove, { folderId: mine })).toEqual({ moved: [] });
    expect(await s.asA.query(api.folders.list, {})).toMatchObject([{ name: "Mine" }]);
    // moving my item into their folder, or their item into my folder: refused, nothing changes
    await expect(s.asA.mutation(api.folders.moveItems, { documentIds: [s.book], folderId: theirFolder })).rejects.toThrow(/couldn't find that folder/);
    await expect(s.asA.mutation(api.folders.moveItems, { documentIds: [s.book, s.theirs], folderId: mine })).rejects.toThrow(/one of those items/);
    expect(await folderOf(s, s.book)).toBeNull();
  });

  test("logged-out visitors are rejected", async () => {
    const s = await setup();
    await expect(s.t.query(api.folders.list, {})).rejects.toThrow();
    await expect(s.t.mutation(api.folders.create, { name: "x" })).rejects.toThrow();
  });
});

describe("adding straight into a folder", () => {
  test("a PDF, an EPUB / Word / PowerPoint file and a link can be added into a folder", async () => {
    const s = await setup();
    const f = await s.asA.mutation(api.folders.create, { name: "Inbox" });
    const file = () => s.t.run((ctx) => ctx.storage.store(new Blob(["bytes"])));
    const pdf = await s.asA.mutation(api.documents.create, { fileId: await file(), fileName: "a.pdf", folderId: f });
    const epub = await s.asA.mutation(api.textSources.begin, { fileId: await file(), fileName: "b.epub", kind: "epub", title: "B", folderId: f });
    const link = await s.t.mutation(internal.links.begin, { userId: s.userA, url: "https://example.com/x", kind: "article", title: "X", folderId: f });
    for (const r of [pdf, epub, link]) {
      if (!r.ok) throw new Error("expected ok");
      expect(await folderOf(s, r.documentId)).toBe(f);
    }
  });

  test("a folder that isn't yours (or was deleted mid-upload) is ignored: the item lands in No folder", async () => {
    const s = await setup();
    const theirs = await s.asB.mutation(api.folders.create, { name: "Theirs" });
    const gone = await s.asA.mutation(api.folders.create, { name: "Gone" });
    await s.asA.mutation(api.folders.remove, { folderId: gone });
    for (const folderId of [theirs, gone]) {
      const fileId = await s.t.run((ctx) => ctx.storage.store(new Blob(["bytes"])));
      const r = await s.asA.mutation(api.documents.create, { fileId, fileName: "c.pdf", folderId });
      if (!r.ok) throw new Error("expected ok");
      expect(await folderOf(s, r.documentId)).toBeNull();
    }
  });
});
