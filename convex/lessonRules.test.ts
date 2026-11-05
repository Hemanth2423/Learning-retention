import { describe, expect, test } from "vitest";
import { cleanVisual } from "./lessonRules";

describe("lesson rules", () => {
  test("falls back to the pillar's sub-ideas when the visual is malformed", () => {
    const v = cleanVisual({ kind: "matrix", title: "x" }, "Pillar", [{ title: "A", detail: "a", children: [] }]);
    expect(v.kind).toBe("hierarchy");
  });
});
