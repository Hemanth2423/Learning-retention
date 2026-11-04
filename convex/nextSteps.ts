import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { askJson, webSearch } from "./llm";
import { MASTERY_PCT } from "./progress";

type Suggestion = { concepts: { concept: string; why: string; searchQuery: string }[] };

// Suggests 3–5 concepts to learn next, each with a real resource found by web search.
export const suggest = action({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please log in first.");
    const course = await ctx.runQuery(internal.processing.getCourse, { courseId });
    if (!course || course.userId !== userId) throw new ConvexError("Course not found.");

    const progress = await ctx.runQuery(internal.processing.progressForCourse, { courseId });
    const lines = progress.map(
      (t) => `- ${t.title}: ${t.best === null ? "not tested" : `best quiz ${t.best}%`}${t.best !== null && t.best >= MASTERY_PCT ? " (mastered)" : ""}`
    );

    let suggestion: Suggestion;
    try {
      suggestion = await askJson<Suggestion>([
        {
          role: "system",
          content: "You are an honest learning coach. You recommend what to study next based on real evidence of mastery. Answer with one JSON object.",
        },
        {
          role: "user",
          content: `Course: "${course.title}"${course.subject ? ` (${course.subject})` : ""}.
Topics and the learner's quiz results:
${lines.join("\n")}

Suggest 3–5 NEXT concepts to learn. Rules:
- If a topic is not mastered, the first suggestion should be the prerequisite or foundation that would help with it.
- Otherwise suggest concepts that naturally come AFTER this material (going deeper or applying it), not concepts already covered.
Return JSON: {"concepts": [{"concept": "short name", "why": "1 sentence tied to their results", "searchQuery": "web query to find a high-quality free resource (article, course, or video) to learn this concept"}]}`,
        },
      ]);
    } catch (err) {
      throw new ConvexError(err instanceof Error ? err.message : "Couldn't reach the AI.");
    }

    const steps = await Promise.all(
      (suggestion.concepts ?? []).slice(0, 5).map(async (c) => {
        const [top] = await webSearch(c.searchQuery || c.concept, 3);
        return top ? { concept: c.concept, why: c.why, resourceTitle: top.title, resourceUrl: top.url } : null;
      })
    );
    const nextSteps = steps.filter((s) => s !== null);
    await ctx.runMutation(internal.processing.saveNextSteps, { courseId, nextSteps });
    return nextSteps.length;
  },
});
