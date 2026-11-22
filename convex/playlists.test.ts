import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { PLAYLIST_MAX_UNITS, YOUTUBE_DAILY_BUDGET, YOUTUBE_DAILY_QUOTA, YOUTUBE_QUOTA_TIME_ZONE, YOUTUBE_USER_DAILY_BUDGET, youtubeBudgetProblem } from "./linkRules";
import { dayKey } from "./xpRules";
import schema from "./schema";
import { modules } from "./test.setup";

const URL_ = "https://www.youtube.com/playlist?list=PL1234567890";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const item = (n: number) => ({ snippet: { title: `Video ${n}`, videoOwnerChannelTitle: "Ch", resourceId: { videoId: `vid${String(n).padStart(8, "0")}` } }, status: { privacyStatus: "public" } });

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "a@test.com" }));
  return { t, userId, as: t.withIdentity({ subject: userId }) };
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

describe("YouTube budget (under 10% of the daily quota)", () => {
  const today = () => dayKey(Date.now(), YOUTUBE_QUOTA_TIME_ZONE);
  const units = async (t: Awaited<ReturnType<typeof setup>>["t"], scope: string) =>
    (await t.run((ctx) => ctx.db.query("apiUsage").withIndex("by_api_day_scope", (q) => q.eq("api", "youtube").eq("day", today()).eq("scope", scope)).first()))?.units ?? 0;
  const smallPlaylist = () =>
    vi.fn(async (input: string | URL) => (new URL(String(input)).pathname.endsWith("/playlists") ? json({ items: [{ snippet: { title: "Small" } }] }) : json({ items: [item(1)] })));

  test("the cap is 10% of Google's quota, and one reader can't use it all", () => {
    expect(YOUTUBE_DAILY_BUDGET).toBeLessThanOrEqual(YOUTUBE_DAILY_QUOTA * 0.1);
    expect(YOUTUBE_USER_DAILY_BUDGET).toBeLessThan(YOUTUBE_DAILY_BUDGET);
    expect(PLAYLIST_MAX_UNITS).toBe(5);
    expect(youtubeBudgetProblem({ all: 995, user: 0 }, 5)).toBeUndefined();
    expect(youtubeBudgetProblem({ all: 996, user: 0 }, 5)).toMatch(/today's limit/);
    expect(youtubeBudgetProblem({ all: 0, user: 46 }, 5)).toMatch(/a lot of playlists/);
  });

  test("only the calls actually made are counted", async () => {
    const { t, userId, as } = await setup();
    process.env.YOUTUBE_API_KEY = "test-key";
    const fetchMock = smallPlaylist();
    vi.stubGlobal("fetch", fetchMock);
    await as.action(api.links.addPlaylist, { url: URL_ });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await units(t, "all")).toBe(2);
    expect(await units(t, userId)).toBe(2);
  });

  test("failed calls still count, because YouTube charges for them", async () => {
    const { t, as } = await setup();
    process.env.YOUTUBE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: {} }, 403)));
    await as.action(api.links.addPlaylist, { url: URL_ });
    expect(await units(t, "all")).toBe(1);
  });

  test("at the app's cap or a reader's cap, YouTube is not called at all", async () => {
    const { t, userId, as } = await setup();
    process.env.YOUTUBE_API_KEY = "test-key";
    const fetchMock = smallPlaylist();
    vi.stubGlobal("fetch", fetchMock);
    const id = await t.run((ctx) => ctx.db.insert("apiUsage", { api: "youtube", day: today(), scope: "all", units: YOUTUBE_DAILY_BUDGET - 4 }));
    expect(await as.action(api.links.addPlaylist, { url: URL_ })).toMatchObject({ ok: false, message: expect.stringMatching(/today's limit/) });
    await t.run((ctx) => ctx.db.patch(id, { units: 0 }));
    await t.run((ctx) => ctx.db.insert("apiUsage", { api: "youtube", day: today(), scope: userId, units: YOUTUBE_USER_DAILY_BUDGET - 4 }));
    expect(await as.action(api.links.addPlaylist, { url: URL_ })).toMatchObject({ ok: false, message: expect.stringMatching(/a lot of playlists/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
