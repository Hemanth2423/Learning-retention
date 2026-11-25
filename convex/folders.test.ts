import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { cleanEmoji, flattenFolders, folderCounts, folderPath, inFolder, MAX_FOLDERS, moveFolderProblem, totalInFolder, uniqueFolderName, validateFolderName } from "./folderRules";
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
    expect(await s.asB.mutation(api.folders.remove, { folderId: mine })).toMatchObject({ moved: [], children: [] });
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

describe("nested folder rules", () => {
  const tree = [
    { _id: "a", name: "A", parentId: null },
    { _id: "b", name: "B", parentId: "a" },
    { _id: "c", name: "C", parentId: "b" },
    { _id: "d", name: "D", parentId: "c" },
    { _id: "z", name: "Z", parentId: null },
  ];
  test("path and display order", () => {
    expect(folderPath(tree, "c").map((f) => f.name)).toEqual(["A", "B", "C"]);
    expect(flattenFolders(tree).map((f) => [f.name, f.depth])).toEqual([["A", 0], ["B", 1], ["C", 2], ["D", 3], ["Z", 0]]);
  });
  test("a folder can't go inside itself or its own subfolder, or past 4 levels", () => {
    expect(moveFolderProblem(tree, "a", "a")).toMatch(/inside itself/);
    expect(moveFolderProblem(tree, "a", "c")).toMatch(/inside itself/);
    expect(moveFolderProblem(tree, "z", "d")).toMatch(/4 levels/);
    expect(moveFolderProblem(tree, "a", "z")).toMatch(/4 levels/); // A's four levels under Z would be five
    expect(moveFolderProblem(tree, "b", "z")).toBeUndefined(); // Z > B > C > D is exactly four
    expect(moveFolderProblem(tree, "d", null)).toBeUndefined();
  });
  test("counts include subfolders; clashing names get a number", () => {
    expect(totalInFolder(tree, new Map([["a", 1], ["c", 2], ["z", 9]]), "a")).toBe(3);
    expect(uniqueFolderName("Notes", ["notes", "Notes (2)"])).toBe("Notes (3)");
    expect(uniqueFolderName("Fresh", ["notes"])).toBe("Fresh");
  });
});

describe("nested folders", () => {
  test("the same name is fine in different folders, not twice in one", async () => {
    const s = await setup();
    const a = await s.asA.mutation(api.folders.create, { name: "AI" });
    const b = await s.asA.mutation(api.folders.create, { name: "Work" });
    await s.asA.mutation(api.folders.create, { name: "Notes", parentId: a });
    await s.asA.mutation(api.folders.create, { name: "Notes", parentId: b });
    await expect(s.asA.mutation(api.folders.create, { name: "notes", parentId: a })).rejects.toThrow(/already have/);
  });

  test("the New folder pop-up creates a folder with its items in one step", async () => {
    const s = await setup();
    const f = await s.asA.mutation(api.folders.create, { name: "Picked", documentIds: [s.book, s.video] });
    expect(await folderOf(s, s.book)).toBe(f);
    expect(await folderOf(s, s.video)).toBe(f);
    await expect(s.asA.mutation(api.folders.create, { name: "Sneaky", documentIds: [s.theirs] })).rejects.toThrow(/one of those items/);
    expect((await s.asA.query(api.folders.list, {})).map((x) => x.name)).toEqual(["Picked"]); // all or nothing
  });

  test("moving folders: nesting works; cycles, depth and name clashes are refused", async () => {
    const s = await setup();
    const a = await s.asA.mutation(api.folders.create, { name: "A" });
    const b = await s.asA.mutation(api.folders.create, { name: "B", parentId: a });
    const c = await s.asA.mutation(api.folders.create, { name: "C", parentId: b });
    const d = await s.asA.mutation(api.folders.create, { name: "D", parentId: c });
    await expect(s.asA.mutation(api.folders.create, { name: "E", parentId: d })).rejects.toThrow(/4 levels/);
    await expect(s.asA.mutation(api.folders.moveFolder, { folderId: a, parentId: c })).rejects.toThrow(/inside itself/);
    const top = await s.asA.mutation(api.folders.create, { name: "D" });
    await expect(s.asA.mutation(api.folders.moveFolder, { folderId: top, parentId: c })).rejects.toThrow(/already have/);
    await s.asA.mutation(api.folders.moveFolder, { folderId: d, parentId: null }).catch(() => {}); // clash with top-level D
    await s.asA.mutation(api.folders.rename, { folderId: top, name: "Top" });
    await s.asA.mutation(api.folders.moveFolder, { folderId: d, parentId: null });
    expect((await s.asA.query(api.folders.list, {})).find((f) => f._id === d)?.parentId).toBeNull();
    const other = await s.asB.mutation(api.folders.create, { name: "Theirs" });
    await expect(s.asA.mutation(api.folders.moveFolder, { folderId: a, parentId: other })).rejects.toThrow(/couldn't find/);
    await expect(s.asB.mutation(api.folders.moveFolder, { folderId: a, parentId: null })).rejects.toThrow(/couldn't find/);
  });

  test("deleting a folder lifts its items and subfolders one level, and Undo puts everything back", async () => {
    const s = await setup();
    const top = await s.asA.mutation(api.folders.create, { name: "Top" });
    const mid = await s.asA.mutation(api.folders.create, { name: "Mid", parentId: top });
    const sub = await s.asA.mutation(api.folders.create, { name: "Same", parentId: mid });
    await s.asA.mutation(api.folders.create, { name: "Same", parentId: top }); // will clash when Mid is deleted
    await s.asA.mutation(api.folders.moveItems, { documentIds: [s.book], folderId: mid });
    const res = await s.asA.mutation(api.folders.remove, { folderId: mid });
    expect(await folderOf(s, s.book)).toBe(top);
    const lifted = (await s.asA.query(api.folders.list, {})).find((f) => f._id === sub);
    expect(lifted).toMatchObject({ parentId: top, name: "Same (2)" });
    const back = await s.asA.mutation(api.folders.restore, { name: "Mid", emoji: "📁", parentId: res.parentId, documentIds: res.moved, children: res.children });
    expect(await folderOf(s, s.book)).toBe(back);
    expect((await s.asA.query(api.folders.list, {})).find((f) => f._id === sub)).toMatchObject({ parentId: back, name: "Same" });
  });
});

describe("playlists become folders", () => {
  const videos = [
    { videoId: "aaaaaaaaaaa", title: "One", channel: "Ch" },
    { videoId: "bbbbbbbbbbb", title: "Two", channel: "Ch" },
    { videoId: "ccccccccccc", title: "Three", channel: "Ch" },
  ];
  test("a folder with its videos in playlist order; adding it again updates the same folder", async () => {
    const s = await setup();
    const first = await s.t.mutation(internal.links.savePlaylist, { userId: s.userA, listId: "PL1234567890", name: "LLM course", videos: videos.slice(0, 2) });
    expect(first).toMatchObject({ name: "LLM course", added: 2, alreadyHad: 0, updated: false });
    const inFolder = (await s.asA.query(api.documents.list, {})).filter((d) => d.folderId === first.folderId);
    expect(inFolder.map((d) => d.title)).toEqual(["One", "Two"]);
    expect(inFolder[0]).toMatchObject({ sourceType: "video", status: "ready", imageUrl: expect.stringContaining("aaaaaaaaaaa") });
    const again = await s.t.mutation(internal.links.savePlaylist, { userId: s.userA, listId: "PL1234567890", name: "LLM course", videos });
    expect(again).toMatchObject({ folderId: first.folderId, added: 1, alreadyHad: 2, updated: true });
    expect(await s.asA.query(api.folders.list, {})).toHaveLength(1);
  });

  test("videos you already filed stay put; unfiled ones join; a taken name gets a number", async () => {
    const s = await setup();
    const mine = await s.asA.mutation(api.folders.create, { name: "LLM course" });
    const [filed, loose] = await s.t.run(async (ctx) => {
      const make = (videoId: string, folderId?: Id<"folders">) => ctx.db.insert("documents", { userId: s.userA, title: videoId, sourceType: "video", sourceUrl: `https://www.youtube.com/watch?v=${videoId}`, videoId, status: "ready", folderId });
      return [await make("aaaaaaaaaaa", mine), await make("bbbbbbbbbbb")];
    });
    const res = await s.t.mutation(internal.links.savePlaylist, { userId: s.userA, listId: "PL1234567890", name: "LLM course", videos });
    expect(res).toMatchObject({ name: "LLM course (2)", added: 1, alreadyHad: 2 });
    expect(await folderOf(s, filed)).toBe(mine);
    expect(await folderOf(s, loose)).toBe(res.folderId);
  });

  test("it can go inside a folder; another user's playlist folder is separate", async () => {
    const s = await setup();
    const parent = await s.asA.mutation(api.folders.create, { name: "AI" });
    const res = await s.t.mutation(internal.links.savePlaylist, { userId: s.userA, listId: "PL1234567890", name: "Course", parentId: parent, videos });
    expect((await s.asA.query(api.folders.list, {})).find((f) => f._id === res.folderId)?.parentId).toBe(parent);
    expect(await s.asB.query(api.folders.list, {})).toEqual([]);
  });
});
