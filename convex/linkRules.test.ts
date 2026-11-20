import { describe, expect, it } from "vitest";
import { cleanArticleMarkdown, parseLink, readableEnough, splitArticle, unwrapLines } from "./linkRules";

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
