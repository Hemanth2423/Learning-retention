import { describe, expect, it } from "vitest";
import { allowsFraming, cleanArticleBlocks, cleanArticleMarkdown, isPublicHost, parseLink, playlistPageVideos, readableEnough, splitArticle, unwrapLines } from "./linkRules";

describe("parseLink", () => {
  it("recognises every common YouTube form as the same video", () => {
    const forms = [
      "https://www.youtube.com/watch?v=5MgBikgcWnY",
      "https://youtube.com/watch?v=5MgBikgcWnY&t=42s&si=abc",
      "https://youtu.be/5MgBikgcWnY?si=xyz",
      "https://m.youtube.com/watch?v=5MgBikgcWnY",
      "https://www.youtube.com/shorts/5MgBikgcWnY",
      "https://www.youtube.com/embed/5MgBikgcWnY",
      "youtube.com/live/5MgBikgcWnY",
    ];
    for (const f of forms) expect(parseLink(f)).toEqual({ kind: "video", url: "https://www.youtube.com/watch?v=5MgBikgcWnY", videoId: "5MgBikgcWnY" });
  });

  it("refuses YouTube links without a valid video", () => {
    expect(parseLink("https://www.youtube.com/@veritasium")).toBeNull();
    expect(parseLink("https://www.youtube.com/watch?v=short")).toBeNull();
  });

  it("gives an article one canonical form: no tracking, no hash, no www, no trailing slash", () => {
    const a = parseLink("https://www.PaulGraham.com/greatwork.html?utm_source=twitter&utm_medium=x#top");
    const b = parseLink("paulgraham.com/greatwork.html");
    expect(a).toEqual({ kind: "article", url: "https://paulgraham.com/greatwork.html", host: "paulgraham.com" });
    expect(b).toEqual(a);
    expect(parseLink("https://blog.example.com/posts/1/?b=2&fbclid=x&a=1")!.url).toBe("https://blog.example.com/posts/1?a=1&b=2");
  });

  it("refuses things that aren't web links", () => {
    for (const bad of ["", "   ", "not a link", "ftp://example.com/x", "javascript:alert(1)", "http://localhost:3000", "https://user:pw@example.com/x", "x".repeat(3000)])
      expect(parseLink(bad)).toBeNull();
  });
});

describe("article text", () => {
  it("strips layout tables and spacer images; <br><br> is a paragraph, one <br> a line wrap (real paulgraham.com output)", () => {
    const md = [
      "|     |     |     |",
      "| --- | --- | --- |",
      "| ![](https://s.turbifycdn.com/aah/paulgraham/bel-7.gif) | ![](https://sep.turbifycdn.com/ca/Img/trans_1x1.gif) | [![](https://s.turbifycdn.com/aah/paulgraham/bel-8.gif)](https://paulgraham.com/index.html)",
      "",
      "|     |",
      "| --- |",
      "| ![How to Do Great Work](https://s.turbifycdn.com/aah/paulgraham/how-to-do-great-work-2.gif)<br>July 2023<br><br>If you collected lists of techniques<br>for doing great work.<br><br>The first step is to decide what to work on. |",
      "",
      "## Curiosity",
      "",
      "Develop a habit of working on your own projects.",
    ].join("\n");
    const out = cleanArticleMarkdown(md);
    expect(out).not.toMatch(/\||---|\.gif|<br>|!\[/);
    expect(out).toContain("July 2023");
    expect(out).toContain("If you collected lists of techniques for doing great work.");
    expect(out.split("\n\n")).toContain("The first step is to decide what to work on.");
    expect(out).toContain("## Curiosity");
  });

  it("rebuilds paragraphs from hard-wrapped lines (real paulgraham.com text)", () => {
    const pg =
      "July 2023<br>If you collected lists of techniques for doing great work in a lot<br>of different fields, what would the intersection look like? I decided<br>to find out by making it.<br>Partly my goal was to create a guide that could be used by someone<br>working in any field. But I was also curious about the shape of the<br>intersection. And one thing this exercise shows is that it does<br>have a definite shape; it's not just a point labelled \"work hard.\"<br>The following recipe assumes you're very ambitious.<br>The first step is to decide what to work on. The work you choose<br>needs to have three qualities: it has to be something you have a<br>natural aptitude for, that you have a deep interest in, and that<br>offers scope to do great work.<br>In practice you don't have to worry much about the third criterion.";
    const paras = unwrapLines(pg).split("\n\n");
    expect(paras[0]).toBe("July 2023");
    expect(paras[1]).toBe("If you collected lists of techniques for doing great work in a lot of different fields, what would the intersection look like? I decided to find out by making it.");
    expect(paras.some((p) => p.startsWith("Partly my goal") && p.endsWith("The following recipe assumes you're very ambitious."))).toBe(true);
    expect(paras.some((p) => p.endsWith("offers scope to do great work."))).toBe(true);
    expect(unwrapLines("Line one<br>line two")).toBe("Line one line two");
  });

  it("splits into blocks at paragraph breaks, none over the limit", () => {
    const paras = Array.from({ length: 10 }, (_, i) => `Paragraph ${i} ` + "word ".repeat(60));
    const blocks = splitArticle(paras.join("\n\n"), 1000);
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((b) => b.length <= 1000)).toBe(true);
    expect(blocks.join("\n\n")).toContain("Paragraph 9");
    expect(splitArticle("x".repeat(2500), 1000).map((b) => b.length)).toEqual([1000, 1000, 500]);
  });

  it("tells a real article from a paywall stub", () => {
    expect(readableEnough("Subscribe to keep reading. [Sign in](https://x)")).toBe(false);
    expect(readableEnough("A real paragraph about learning. ".repeat(20))).toBe(true);
  });
});

describe("cleanArticleBlocks (reader view)", () => {
  const lenny = [
    "SubscribeSign in\n\n# Everyone should be using Claude Code more\n\n## How to get started, and 50 ways non-technical people are using it\n\n![Lenny](https://substackcdn.com/image/fetch/w_120,h_120,c_fill/avatar.png)\n\n[Lenny Rachitsky](https://x.com/lenny)\n\nOct 14, 2025\n\n∙ Paid\n\n850\n\n25\n\n66\n\nShare",
    "Claude Code changed how I work. In 2025 we saw 42 teams adopt it.\n\n42\n\nHere is how to start.",
    "This post is for paid subscribers\n\nAlready a paid subscriber? Sign in",
    "Never shown after the paywall.",
  ].map((text, i) => ({ page: i + 1, text }));

  it("removes buttons, counters, the avatar and the repeated title, and keeps the writing", () => {
    const { blocks } = cleanArticleBlocks(lenny, "Everyone should be using Claude Code more");
    const text = blocks.map((b) => b.text).join("\n");
    for (const junk of ["SubscribeSign", "Paid", "\n850", "\n66", "Share", "avatar.png", "# Everyone should"]) expect(text).not.toContain(junk);
    for (const keep of ["How to get started", "Lenny Rachitsky", "Oct 14, 2025", "Claude Code changed how I work", "Here is how to start."]) expect(text).toContain(keep);
  });

  it("spots a paywall, stops there, and keeps block numbers so citations and highlights still line up", () => {
    const res = cleanArticleBlocks(lenny, "Everyone should be using Claude Code more");
    expect(res.partial).toBe(true);
    expect(res.blocks.map((b) => b.page)).toEqual([1, 2]);
    expect(res.blocks.map((b) => b.text).join(" ")).not.toContain("Never shown");
  });

  it("leaves a normal article alone, including numbers and words deep in the text", () => {
    const filler = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} of the essay.`).join("\n\n");
    const res = cleanArticleBlocks([{ page: 1, text: `${filler}\n\n1984\n\n## Notes\n\nThe end.` }], "Essay");
    expect(res.blocks[0].text).toContain("## Notes");
    expect(res.partial).toBe(false);
    expect(res.blocks[0].text).toContain("1984");
    expect(res.blocks[0].text).toContain("The end.");
  });

  it("stops where the site's own page takes over", () => {
    const res = cleanArticleBlocks([{ page: 1, text: "Real ending.\n\n## Discussion about this post\n\nA comment" }]);
    expect(res.blocks[0].text).toBe("Real ending.");
    expect(res.partial).toBe(false);
  });
});

describe("showing the original page", () => {
  it("only looks at public web hosts", () => {
    for (const h of ["paulgraham.com", "www.lennysnewsletter.com"]) expect(isPublicHost(h)).toBe(true);
    for (const h of ["localhost", "169.254.169.254", "10.0.0.1", "127.0.0.1", "[::1]", "printer.local", "db.internal"]) expect(isPublicHost(h)).toBe(false);
  });
  it("reads the site's framing rules", () => {
    expect(allowsFraming({})).toBe(true);
    expect(allowsFraming({ xFrameOptions: "SAMEORIGIN" })).toBe(false);
    expect(allowsFraming({ csp: "default-src 'self'; frame-ancestors 'none'" })).toBe(false);
    expect(allowsFraming({ csp: "frame-ancestors https://a.com" })).toBe(false);
    expect(allowsFraming({ csp: "frame-ancestors *" })).toBe(true);
    expect(allowsFraming({ csp: "default-src 'self'" })).toBe(true);
  });
});

describe("YouTube playlists", () => {
  it("recognises a playlist page; a video opened from a playlist stays that video", () => {
    const list = "PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj";
    for (const u of [`https://www.youtube.com/playlist?list=${list}`, `youtube.com/playlist?list=${list}&si=abc`, `https://m.youtube.com/playlist/?list=${list}`])
      expect(parseLink(u)).toEqual({ kind: "playlist", url: `https://www.youtube.com/playlist?list=${list}`, listId: list });
    expect(parseLink(`https://www.youtube.com/watch?v=5MgBikgcWnY&list=${list}`)).toMatchObject({ kind: "video", videoId: "5MgBikgcWnY" });
    expect(parseLink("https://www.youtube.com/playlist?list=<bad>")).toBeNull();
  });
  it("keeps watchable videos and leaves out private and deleted ones", () => {
    const v = (videoId: string, title: string, privacyStatus = "public") => ({ snippet: { title, videoOwnerChannelTitle: "Karpathy - Topic", resourceId: { videoId } }, status: { privacyStatus } });
    const res = playlistPageVideos({ nextPageToken: "n2", items: [v("aaaaaaaaaaa", "Intro"), v("bbbbbbbbbbb", "Private video"), v("ccccccccccc", "Deleted video"), v("ddddddddddd", "Hidden", "private"), v("short", "Bad id")] });
    expect(res).toEqual({ videos: [{ videoId: "aaaaaaaaaaa", title: "Intro", channel: "Karpathy" }], hidden: 4, next: "n2" });
  });
});
