import { describe, expect, test } from "vitest";
import { nextQuestion } from "./questionFlow";
import { bankOf, cleanQuestions, gapMatches, grade, publicQuestion } from "./questionRules";

const choice = (prompt: string, level?: string, style = "apply") => ({
  type: "choice", style, level, prompt, options: ["right", "wrong 1", "wrong 2", "wrong 3"], answerIndex: 0, explanation: "because",
});
const order = { type: "order", prompt: "Put the loop in order", items: ["Plan", "Act", "Observe", "Reflect"], explanation: "e" };
const match = { type: "match", prompt: "Match each part", pairs: [{ left: "Tools", right: "act on the world" }, { left: "Memory", right: "keeps context" }, { left: "Planner", right: "breaks down goals" }], explanation: "e" };
const gap = { type: "gap", prompt: "An agent that calls APIs is using ___.", accepted: ["tool use", "tools"], explanation: "e" };
const raw = [choice("A team sees Y. What applies?"), match, order, gap, choice("Edge case?", "stretch")];

describe("question bank rules", () => {
  test("keeps a mixed bank and keeps every answer key right after shuffling", () => {
    const bank = cleanQuestions(raw)!;
    expect(bank.map((q) => q.type)).toEqual(["choice", "match", "order", "gap", "choice"]);
    for (const q of bank) {
      if (q.type === "choice") expect(q.options[q.answerIndex]).toBe("right");
      if (q.type === "order") expect(q.answerOrder.map((i) => q.items[i])).toEqual(order.items);
      if (q.type === "match") expect(q.answerMap.map((j) => q.right[j])).toEqual(match.pairs.map((p) => p.right));
    }
  });

  test("never shows the steps already in the right order", () => {
    const q = cleanQuestions(raw, () => 0.999)!.find((x) => x.type === "order")!;
    expect(q.type === "order" && q.items).not.toEqual(order.items);
  });

  test("drops questions about the source, and rejects a bank with too little variety", () => {
    expect(cleanQuestions([choice("According to the text, what is X?"), match, order, gap])).toBeNull(); // no apply left
    expect(cleanQuestions([choice("A?"), choice("B?", "easier", "core"), choice("C?", "stretch"), choice("D?")])).toBeNull(); // one type only
  });

  test("rejects a gap whose answer is already in the sentence", () => {
    const leaky = { ...gap, prompt: "Tool use means ___ when it calls tools." };
    expect(cleanQuestions([choice("A?"), match, order, leaky])).toBeNull();
  });

  test("the browser copy has no answer keys", () => {
    for (const q of cleanQuestions(raw)!) {
      const json = JSON.stringify(publicQuestion(q));
      expect(json).not.toMatch(/answerIndex|answerOrder|answerMap|accepted|explanation/);
    }
  });
});

describe("grading", () => {
  const bank = cleanQuestions(raw)!;
  const of = (t: string) => bank.find((q) => q.type === t)!;

  test("order and match must be fully right", () => {
    const o = of("order");
    expect(grade(o, o.type === "order" ? o.answerOrder : []).correct).toBe(true);
    expect(grade(o, o.type === "order" ? [...o.answerOrder].reverse() : []).correct).toBe(false);
    const m = of("match");
    expect(grade(m, m.type === "match" ? m.answerMap : []).correct).toBe(true);
    expect(grade(m, "nonsense").correct).toBe(false);
  });

  test("fill the gap forgives case, articles and a small typo, but not a different word", () => {
    expect(gapMatches("Tool-Use", ["tool use"])).toBe(true);
    expect(gapMatches("the tool use", ["tool use"])).toBe(true);
    expect(gapMatches("tool usr", ["tool use"])).toBe(true);
    expect(gapMatches("memory", ["tool use"])).toBe(false);
    expect(gapMatches("tool", ["tools"])).toBe(true); // a dropped plural is a typo
    expect(gapMatches("rug", ["RAG"])).toBe(false); // short words need an exact match
  });

  test("old V1 lessons still work as choice questions", () => {
    const old = bankOf({ checks: [{ id: "apply", level: "apply", question: "Q?", options: ["a", "b", "c", "d"], answerIndex: 2, explanation: "e" }] });
    expect(old[0]).toMatchObject({ type: "choice", level: "apply", prompt: "Q?" });
    expect(grade(old[0], 2).correct).toBe(true);
  });
});

describe("adaptive flow", () => {
  const bank = [
    { id: "a1", type: "choice", level: "apply" as const },
    { id: "e1", type: "match", level: "easier" as const },
    { id: "e2", type: "gap", level: "easier" as const },
    { id: "s1", type: "choice", level: "stretch" as const },
    { id: "a2", type: "choice", level: "apply" as const },
  ];

  test("starts at apply, steps down after a miss and up after a hit", () => {
    expect(nextQuestion(bank, [])?.id).toBe("a1");
    expect(nextQuestion(bank, [{ id: "a1", correct: false }])?.level).toBe("easier");
    expect(nextQuestion(bank, [{ id: "a1", correct: true }])?.id).toBe("s1");
  });

  test("never repeats a question and stops after the session length", () => {
    const done = bank.slice(0, 4).map((q) => ({ id: q.id, correct: true }));
    expect(nextQuestion(bank, done)?.id).toBe("a2");
    expect(nextQuestion(bank, [...done, { id: "a2", correct: true }])).toBeNull();
  });
});
