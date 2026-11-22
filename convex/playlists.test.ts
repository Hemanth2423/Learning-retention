import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const URL_ = "https://www.youtube.com/playlist?list=PL1234567890";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const item = (n: number) => ({ snippet: { title: `Video ${n}`, videoOwnerChannelTitle: "Ch", resourceId: { videoId: `vid${String(n).padStart(8, "0")}` } }, status: { privacyStatus: "public" } });

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "a@test.com" }));
  return { t, as: t.withIdentity({ subject: userId }) };
}
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YOUTUBE_API_KEY;
});

describe("links.addPlaylist", () => {
  test("without a key it says so and calls nothing", async () => {
    const { as } = await setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await as.action(api.links.addPlaylist, { url: URL_ })).toMatchObject({ ok: false, message: expect.stringMatching(/switched on/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("reads every page and makes a folder", async () => {
    const { as } = await setup();
    process.env.YOUTUBE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const u = new URL(String(input));
      if (u.pathname.endsWith("/playlists")) return json({ items: [{ snippet: { title: "Neural networks" } }] });
      return u.searchParams.get("pageToken") ? json({ items: [item(51)] }) : json({ nextPageToken: "p2", items: Array.from({ length: 50 }, (_, i) => item(i + 1)) });
    }));
    const res = await as.action(api.links.addPlaylist, { url: URL_ });
    expect(res).toMatchObject({ ok: true, name: "Neural networks", added: 51, capped: false });
    expect(await as.query(api.documents.list, {})).toHaveLength(51);
  });

  test("stops at 200 videos and says so", async () => {
    const { as } = await setup();
    process.env.YOUTUBE_API_KEY = "test-key";
    let page = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (new URL(String(input)).pathname.endsWith("/playlists")) return json({ items: [{ snippet: { title: "Huge" } }] });
      const start = page++ * 50;
      return json({ nextPageToken: "more", items: Array.from({ length: 50 }, (_, i) => item(start + i + 1)) });
    }));
    expect(await as.action(api.links.addPlaylist, { url: URL_ })).toMatchObject({ ok: true, added: 200, capped: true });
  });

  test("a private playlist or a YouTube error saves nothing and says why", async () => {
    const { as } = await setup();
    process.env.YOUTUBE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => json({ items: [] })));
    expect(await as.action(api.links.addPlaylist, { url: URL_ })).toMatchObject({ ok: false, message: expect.stringMatching(/private/) });
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: {} }, 403)));
    expect(await as.action(api.links.addPlaylist, { url: URL_ })).toMatchObject({ ok: false, message: expect.stringMatching(/reach YouTube/) });
    expect(await as.query(api.folders.list, {})).toEqual([]);
  });
});
