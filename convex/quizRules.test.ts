import { describe, expect, it } from "vitest";
import { bestScore, cleanQuestion, cleanQuiz, gradeChoice, isFinished, missedOf, publicQuestion, QUIZ_SIZE, scoreOf, shuffle, tidy } from "./quizRules";

const raw = (n = 1) => ({
  question: `Question ${n} about the chapter?`,
  correct: `Right ${n}`,
  wrong: [
    { option: `Wrong A${n}`, why: "Sounds close." },
    { option: `Wrong B${n}`, why: "" },
    { option: `Wrong C${n}`, why: "Easy to mix up." },
  ],
  explanation: "Because the chapter says so.",
  page: 12,
});

describe("cleanQuestion", () => {
  it("keeps 4 options with exactly one right answer, and the notes follow their options", () => {
    const q = cleanQuestion(raw(), [12, 13])!;
    expect(q.options).toHaveLength(4);
    expect(q.options[q.answer]).toBe("Right 1");
    expect(q.whyWrong[q.answer]).toBe("");
    expect(q.whyWrong[q.options.indexOf("Wrong A1")]).toBe("Sounds close.");
    expect(q.page).toBe(12);
  });

  it("shuffles where the right answer sits", () => {
    const spots = new Set([0, 0.3, 0.6, 0.99].map((r) => cleanQuestion(raw(), [12], () => r)!.answer));
    expect(spots.size).toBeGreaterThan(1);
  });

  it("refuses repeated options, a missing answer, or the wrong number of options", () => {
    expect(cleanQuestion({ ...raw(), wrong: [{ option: "right 1!" }, { option: "b" }, { option: "c" }] }, [])).toBeNull();
    expect(cleanQuestion({ ...raw(), correct: " " }, [])).toBeNull();
    expect(cleanQuestion({ ...raw(), wrong: [{ option: "a" }, { option: "b" }] }, [])).toBeNull();
    expect(cleanQuestion({ ...raw(), explanation: "" }, [])).toBeNull();
    expect(cleanQuestion({ ...raw(), question: "x".repeat(400) }, [])).toBeNull();
  });

  it("refuses catch-all options like 'all of the above'", () => {
    expect(cleanQuestion({ ...raw(), wrong: [{ option: "All of the above" }, { option: "b" }, { option: "c" }] }, [])).toBeNull();
    expect(cleanQuestion({ ...raw(), correct: "None of these" }, [])).toBeNull();
    expect(cleanQuestion({ ...raw(), wrong: [{ option: "A and B" }, { option: "b" }, { option: "c" }] }, [])).toBeNull();
  });

  it("drops a page the chapter doesn't have", () => {
    expect(cleanQuestion(raw(), [40])!.page).toBeUndefined();
  });
});

describe("cleanQuiz", () => {
  it("keeps exactly 5 different questions, skipping bad ones", () => {
    const list = [raw(1), { question: "bad" }, raw(1), raw(2), raw(3), raw(4), raw(5), raw(6)];
    const quiz = cleanQuiz({ questions: list }, [12])!;
    expect(quiz).toHaveLength(QUIZ_SIZE);
    expect(quiz.map((q) => q.question)).toEqual([1, 2, 3, 4, 5].map((n) => `Question ${n} about the chapter?`));
  });

  it("fails when fewer than 5 are usable", () => {
    expect(cleanQuiz({ questions: [raw(1), raw(2), raw(3), raw(4)] }, [])).toBeNull();
    expect(cleanQuiz("nope", [])).toBeNull();
  });
});

describe("tidy", () => {
  it("removes talk of passages and citation numbers", () => {
    expect(tidy("According to the passage, habits form loops [2].")).toBe("Habits form loops.");
    expect(tidy("What does the passage say?")).toBe("What does the chapter say?");
  });
});

describe("grading and scores", () => {
  const q = cleanQuestion(raw(), [12], () => 0)!;

  it("grades on the server and explains a wrong choice", () => {
    expect(gradeChoice(q, q.answer)).toMatchObject({ correct: true, whyWrong: "" });
    const wrong = q.options.indexOf("Wrong C1");
    expect(gradeChoice(q, wrong)).toMatchObject({ correct: false, answer: q.answer, whyWrong: "Easy to mix up." });
  });

  it("never shows the answer before answering", () => {
    expect(Object.keys(publicQuestion(q)).sort()).toEqual(["options", "question"]);
  });

  it("counts score, missed and finished", () => {
    const results = [
      { index: 0, choice: 1, correct: true },
      { index: 1, choice: 2, correct: false },
      { index: 3, choice: null, correct: null },
    ];
    expect(scoreOf(results)).toBe(1);
    expect(missedOf(results)).toEqual([1]);
    expect(isFinished(results)).toBe(false);
    expect(isFinished([])).toBe(false);
  });

  it("best score counts finished full tests only", () => {
    expect(bestScore([])).toBeNull();
    expect(
      bestScore([
        { review: false, finished: true, score: 3 },
        { review: true, finished: true, score: 5 },
        { review: false, finished: false, score: 4 },
      ])
    ).toBe(3);
  });

  it("shuffle keeps every item", () => {
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});
