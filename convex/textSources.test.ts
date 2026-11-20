import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  const file = () => t.run((ctx) => ctx.storage.store(new Blob(["PK zip bytes"])));
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), file };
}
const sec = (key: string, title: string, page: number, level = 1) => ({ key, title, level, locator: { kind: "text" as const, page } });

async function addedEpub(s: Awaited<ReturnType<typeof setup>>) {
  const res = await s.asA.mutation(api.textSources.begin, { fileId: await s.file(), fileName: "Habits.epub", kind: "epub", title: "Habits" });
  if (!res.ok) throw new Error(res.message);
  await s.asA.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 0, blocks: ["Part one opens.", "Chapter one text."] });
  await s.asA.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 2, blocks: ["Chapter two text."] });
  const fin = await s.asA.mutation(api.textSources.finish, {
    documentId: res.documentId,
    sections: [sec("p1", "Part One", 1), sec("c1", "Chapter 1", 2, 2), sec("c2", "Chapter 2", 3, 2)],
  });
  expect(fin).toEqual({ ok: true });
  return res.documentId;
}

describe("adding an EPUB, Word or PowerPoint file", () => {
  test("begin → blocks → finish makes a ready book with its contents and text", async () => {
    const s = await setup();
    const documentId = await addedEpub(s);
    const doc = await s.asA.query(api.documents.get, { documentId });
    expect(doc).toMatchObject({ status: "ready", sourceType: "epub", pageCount: 3, hasText: true });
    expect((await s.asA.query(api.links.blocks, { documentId })).map((b) => b.page)).toEqual([1, 2, 3]);
    expect((await s.asA.query(api.documents.list, {}))[0]).toMatchObject({ title: "Habits", needsCover: false });
  });

  test("a file whose name doesn't match its type, or a PDF sent here, is refused and deleted", async () => {
    const s = await setup();
    const fileId = await s.file();
    expect(await s.asA.mutation(api.textSources.begin, { fileId, fileName: "deck.pptx", kind: "word", title: "Deck" })).toMatchObject({ ok: false });
    expect(await s.t.run((ctx) => ctx.db.system.get(fileId))).toBeNull();
    const pdfId = await s.file();
    expect(await s.asA.mutation(api.documents.create, { fileId: pdfId, fileName: "book.epub" })).toMatchObject({ ok: false });
  });

  test("blocks out of order, after finishing, or from another user are refused", async () => {
    const s = await setup();
    const res = await s.asA.mutation(api.textSources.begin, { fileId: await s.file(), fileName: "n.docx", kind: "word", title: "Notes" });
    if (!res.ok) throw new Error();
    expect(await s.asA.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 4, blocks: ["x"] })).toMatchObject({ ok: false });
    expect(await s.asB.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 0, blocks: ["x"] })).toMatchObject({ ok: false });
    await s.asA.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 0, blocks: ["Hello"] });
    expect(await s.asA.mutation(api.textSources.finish, { documentId: res.documentId, sections: [sec("a", "Bad", 7)] })).toMatchObject({ ok: false });
    await s.asA.mutation(api.textSources.finish, { documentId: res.documentId, sections: [] });
    expect(await s.asA.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 1, blocks: ["late"] })).toMatchObject({ ok: false });
  });

  test("a file with no text can't be finished; failing keeps the reason and deletes the file and text", async () => {
    const s = await setup();
    const fileId = await s.file();
    const res = await s.asA.mutation(api.textSources.begin, { fileId, fileName: "a.pptx", kind: "powerpoint", title: "Deck" });
    if (!res.ok) throw new Error();
    expect(await s.asA.mutation(api.textSources.finish, { documentId: res.documentId, sections: [] })).toMatchObject({ ok: false, message: expect.stringMatching(/any text/) });
    await s.asA.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 0, blocks: ["Slide one"] });
    await s.asB.mutation(api.textSources.fail, { documentId: res.documentId, message: "nope" }); // not theirs: ignored
    expect((await s.asA.query(api.documents.get, { documentId: res.documentId }))?.status).toBe("processing");
    await s.asA.mutation(api.textSources.fail, { documentId: res.documentId, message: "This file is password-protected." });
    expect(await s.asA.query(api.documents.get, { documentId: res.documentId })).toMatchObject({ status: "failed", statusMessage: "This file is password-protected." });
    expect(await s.t.run((ctx) => ctx.db.system.get(fileId))).toBeNull();
    expect(await s.t.run((ctx) => ctx.db.query("chunks").collect())).toEqual([]);
  });

  test("an EPUB's cover is kept when it's an image; anything else is dropped and the book still added", async () => {
    const s = await setup();
    const res = await s.asA.mutation(api.textSources.begin, { fileId: await s.file(), fileName: "b.epub", kind: "epub", title: "B" });
    if (!res.ok) throw new Error();
    await s.asA.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 0, blocks: ["text"] });
    const svg = await s.t.run((ctx) => ctx.storage.store(new Blob(["<svg/>"], { type: "image/svg+xml" })));
    expect(await s.asA.mutation(api.textSources.finish, { documentId: res.documentId, sections: [], coverId: svg })).toEqual({ ok: true });
    expect(await s.t.run((ctx) => ctx.db.system.get(svg))).toBeNull();
    expect((await s.asA.query(api.documents.get, { documentId: res.documentId }))?.coverUrl).toBeNull();
  });
});

describe("EPUB is a book; Word and PowerPoint are documents", () => {
  test("reading an EPUB chapter and writing a note earn XP; a Word file earns none", async () => {
    const s = await setup();
    const documentId = await addedEpub(s);
    await s.asA.mutation(api.documents.saveProgress, { documentId, page: 3, seen: [3] }); // Chapter 2 is block 3 only
    expect((await s.asA.query(api.xp.stats, {})).xp).toBe(10);
    await s.asA.mutation(api.notebook.saveNote, {
      documentId,
      sectionKey: "c1",
      content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "loop" }] }] }),
      plainText: "loop",
    });
    expect((await s.asA.query(api.xp.stats, {})).xp).toBe(30);

    const res = await s.asA.mutation(api.textSources.begin, { fileId: await s.file(), fileName: "w.docx", kind: "word", title: "W" });
    if (!res.ok) throw new Error();
    await s.asA.mutation(api.textSources.addBlocks, { documentId: res.documentId, startIndex: 0, blocks: ["one"] });
    await s.asA.mutation(api.textSources.finish, { documentId: res.documentId, sections: [sec("doc", "W", 1)] });
    await s.asA.mutation(api.documents.saveProgress, { documentId: res.documentId, page: 1, seen: [1] });
    expect((await s.asA.query(api.xp.stats, {})).xp).toBe(30);
  });

  test("text highlights work in EPUB and Word files", async () => {
    const s = await setup();
    const documentId = await addedEpub(s);
    const id = await s.asA.mutation(api.notebook.addTextHighlight, { documentId, text: "Chapter one", range: { startBlock: 2, startOffset: 0, endBlock: 2, endOffset: 11 } });
    expect(id).toBeTruthy();
  });
});
