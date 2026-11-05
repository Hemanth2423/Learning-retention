import { describe, expect, test } from "vitest";
import { cleanVisual, mentionsSource } from "./lessonRules";

describe("lesson rules", () => {
  test("falls back to the pillar's sub-ideas when the visual is malformed", () => {
    const v = cleanVisual({ kind: "matrix", title: "x" }, "Pillar", [{ title: "A", detail: "a", children: [] }]);
    expect(v.kind).toBe("hierarchy");
  });

  test("blocks questions that point at the material, allows scenarios that involve one", () => {
    for (const s of [
      "According to the source, what is X?",
      "What does the author argue about memory?",
      "In this chapter, which step comes first?",
      "What does the text say about encoding?",
      "Which idea, as described in the reading, applies here?",
    ])
      expect(mentionsSource(s), s).toBe(true);
    for (const s of [
      "A student spent three hours re-reading the chapter. What's wrong with that plan?",
      "Encounter the new concept in the text or lecture",
      "Close the book and write the key ideas from memory",
    ])
      expect(mentionsSource(s), s).toBe(false);
  });
});
