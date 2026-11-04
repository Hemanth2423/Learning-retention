"use node";

// Step 1 of the pipeline: read the whole document ONCE and build a concept model.
// Everything after this (lessons, questions, mind map) works from the model, never the full text,
// which keeps per-document token use low.
import { v } from "convex/values";
import { extractText, getDocumentProxy } from "unpdf";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { askJson } from "./llm";
import { SubIdea } from "./lessonTypes";

const MAX_CHARS = 250_000; // ~60k tokens: roughly a 100-page chapter

type ConceptModel = {
  thesis: string;
  pillars: {
    title: string;
    summary: string;
    subIdeas: SubIdea[];
    insights: { text: string; quote: string }[];
    misconceptions: string[];
    searchQuery: string;
  }[];
  links: { from: string; to: string; relation: string }[];
};

const PROMPT = `You are an expert teacher building a CONCEPT MODEL of the SOURCE so someone can learn what it teaches without reading it.

Think about the domain, not the document's layout:
- Imagine explaining this to a smart friend who will never read it. What are the 4–7 load-bearing ideas ("pillars")?
- Group by IDEA, not by chapter or slide order. One section may hold two pillars; one pillar may span many sections.
- If the material implies a framework, use it (e.g. product growth → acquisition, activation, engagement, retention, monetization).
- Pillars must not overlap, and together must cover everything important.
- Order pillars the way a learner should learn them: prerequisites first.
- Write every field as plain statements about the world. Never mention "the source", "the text", "the author", "the chapter", or "the document".

Return JSON:
{
  "thesis": "one sentence: the single big idea that ties all pillars together",
  "pillars": [{
    "title": "≤ 5 words",
    "summary": "1–2 sentences: what this idea is and why it matters",
    "subIdeas": [{ "title": "≤ 6 words", "detail": "1 sentence", "children": ["0–3 finer points, ≤ 6 words each"] }],
    "insights": [{ "text": "a key insight, as a standalone claim a reader should remember", "quote": "≤ 20-word phrase from the SOURCE that supports it" }],
    "misconceptions": ["a plausible but WRONG belief a learner might hold about this idea"],
    "searchQuery": "a web search query that finds a REAL, documented case of this idea (a company, product, study, or event), not an analogy"
  }],
  "links": [{ "from": "pillar title", "to": "pillar title", "relation": "≤ 5 words, e.g. 'feeds into', 'trades off against', 'is measured by'" }]
}
Sizes: 2–4 subIdeas, 3–5 insights, 2–3 misconceptions per pillar; 3–8 links.`;

export const processCourse = internalAction({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const setStatus = (statusMessage: string) =>
      ctx.runMutation(internal.processing.setStatus, { courseId, status: "processing", statusMessage });

    try {
      const course = await ctx.runQuery(internal.processing.getCourse, { courseId });
      if (!course) return;

      await setStatus("Reading your PDF…");
      const blob = await ctx.storage.get(course.fileId);
      if (!blob) throw new Error("The uploaded file is missing.");
      const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      const source = text.replace(/\s+\n/g, "\n").trim().slice(0, MAX_CHARS);
      if (source.length < 200) {
        throw new Error("We couldn't find text in this PDF. Scanned pages (images) aren't supported yet.");
      }

      await setStatus("Mapping the core ideas…");
      const subject = course.subject ? ` (${course.subject})` : "";
      const model = await askJson<ConceptModel>(
        [
          { role: "system", content: `${PROMPT}\n\nSOURCE: "${course.title}"${subject}\n"""\n${source}\n"""` },
          { role: "user", content: "Build the concept model as JSON." },
        ],
        { model: "deepseek-v4-pro", effort: "high", label: "concept-model" }
      );

      const pillars = (model.pillars ?? []).slice(0, 7).map((p) => ({
        title: p.title,
        summary: p.summary,
        subIdeas: (p.subIdeas ?? []).slice(0, 4).map((s) => ({
          title: s.title,
          detail: s.detail ?? "",
          children: (s.children ?? []).slice(0, 3),
        })),
        insights: (p.insights ?? []).slice(0, 5).map((i) => ({ text: i.text, quote: i.quote ?? "" })),
        misconceptions: (p.misconceptions ?? []).slice(0, 3),
        searchQuery: p.searchQuery || `${p.title} real world example`,
      }));
      if (pillars.length === 0) throw new Error("The AI couldn't find the core ideas in this document.");
      const titles = new Set(pillars.map((p) => p.title));
      const links = (model.links ?? []).filter((l) => titles.has(l.from) && titles.has(l.to)).slice(0, 8);

      await ctx.runMutation(internal.processing.saveConceptModel, {
        courseId,
        pageCount: totalPages,
        thesis: model.thesis ?? "",
        conceptLinks: links,
        pillars,
      });
    } catch (err) {
      await ctx.runMutation(internal.processing.setStatus, {
        courseId,
        status: "failed",
        statusMessage: err instanceof Error ? err.message : "Something went wrong while processing.",
      });
    }
  },
});
