"use node";

import { v } from "convex/values";
import { extractText, getDocumentProxy } from "unpdf";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { askJson, SearchResult, webSearch } from "./llm";

const MAX_CHARS = 250_000; // ~60k tokens: roughly a 100-page chapter

const SYSTEM = `You are a learning designer. You turn source material into a structure built for long-term retention.
Only teach ideas that are in the source. Write plainly, for a motivated beginner. Always answer with a single JSON object.`;

type Outline = {
  mindMap: string;
  topics: { title: string; summary: string; keyPoints: string[]; searchQuery: string }[];
};

type TopicExtras = {
  examples: { title: string; description: string; sourceIndex: number }[];
  quiz: { question: string; options: string[]; answerIndex: number; explanation: string }[];
};

export const processCourse = internalAction({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const setStatus = (statusMessage: string) =>
      ctx.runMutation(internal.processing.setStatus, { courseId, status: "processing", statusMessage });

    try {
      const course = await ctx.runQuery(internal.processing.getCourse, { courseId });
      if (!course) return;

      // 1. PDF → text
      await setStatus("Reading your PDF…");
      const blob = await ctx.storage.get(course.fileId);
      if (!blob) throw new Error("The uploaded file is missing.");
      const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      const source = text.replace(/\s+\n/g, "\n").trim().slice(0, MAX_CHARS);
      if (source.length < 200) {
        throw new Error("We couldn't find text in this PDF. Scanned pages (images) aren't supported yet.");
      }
      const sourceBlock = `SOURCE — "${course.title}" (${course.subject}):\n"""\n${source}\n"""`;

      // 2. Outline: mind map + topics
      await setStatus("Finding the key topics…");
      const outline = await askJson<Outline>([
        { role: "system", content: `${SYSTEM}\n\n${sourceBlock}` },
        {
          role: "user",
          content: `Break the SOURCE into 4–8 key topics, in the order it teaches them. Return JSON:
{
  "mindMap": "Markdown outline. First line '# ${course.title.replace(/"/g, "'")}'. Then one '## <topic title>' per topic (titles identical to the topics array), each with 2–4 '- sub-concept' bullets (nested '  - detail' allowed).",
  "topics": [{
    "title": "≤ 6 words",
    "summary": "2–3 plain sentences explaining the idea",
    "keyPoints": ["3–5 short, self-contained statements, each ≤ 25 words"],
    "searchQuery": "a web search query that would find a REAL, documented real-world case of this concept (a company, product, study, or event) — not an analogy"
  }]
}`,
        },
      ]);
      const topics = (outline.topics ?? []).slice(0, 8);
      if (topics.length === 0) throw new Error("The AI couldn't find topics in this document.");

      // 3. For each topic (in parallel): real examples from the web + a 5-question quiz
      await setStatus(`Building quizzes and finding real examples for ${topics.length} topics…`);
      const detailed = await Promise.all(
        topics.map(async (t) => {
          const results = await webSearch(t.searchQuery || `${t.title} real world example`);
          const extras = await askJson<TopicExtras>([
            { role: "system", content: `${SYSTEM}\n\n${sourceBlock}` },
            { role: "user", content: topicPrompt(t, results) },
          ]);
          return {
            title: t.title,
            summary: t.summary,
            keyPoints: (t.keyPoints ?? []).slice(0, 5),
            examples: (extras.examples ?? [])
              .filter((e) => results[e.sourceIndex - 1]) // only keep examples tied to a real search result
              .slice(0, 2)
              .map((e) => ({ title: e.title, description: e.description, sourceUrl: results[e.sourceIndex - 1].url })),
            quiz: (extras.quiz ?? [])
              .filter((q) => q.options?.length === 4 && q.answerIndex >= 0 && q.answerIndex < 4)
              .slice(0, 5),
          };
        })
      );

      await ctx.runMutation(internal.processing.saveResults, {
        courseId,
        pageCount: totalPages,
        mindMap: outline.mindMap ?? `# ${course.title}`,
        topics: detailed,
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

function topicPrompt(t: Outline["topics"][number], results: SearchResult[]) {
  const web = results.length
    ? results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.description}`).join("\n\n")
    : "(no web results)";
  return `TOPIC: ${t.title}
SUMMARY: ${t.summary}
KEY POINTS:
${(t.keyPoints ?? []).map((p) => `- ${p}`).join("\n")}

WEB RESULTS:
${web}

Return JSON:
{
  "examples": [{ "title": "short name of the real case", "description": "2–3 sentences: what happened and how it shows this concept", "sourceIndex": <number of the web result it comes from> }],
  "quiz": [{ "question": "...", "options": ["A", "B", "C", "D"], "answerIndex": 0, "explanation": "1–2 sentences on why" }]
}
Rules:
- Up to 2 examples. Each must be a real case actually described in the WEB RESULTS above. If none fit, return an empty list. Never invent cases or URLs.
- Exactly 5 quiz questions grounded in the SOURCE. Test understanding and application, not trivia. Spread the correct answer across positions 0–3.`;
}
