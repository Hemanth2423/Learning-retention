import { describe, expect, test } from "vitest";
import { pickProvider } from "./llm";

describe("pickProvider", () => {
  test("uses DeepSeek by default, with the requested model", () => {
    const p = pickProvider({ DEEPSEEK_API_KEY: "d" }, "deepseek-v4-pro");
    expect(p).toMatchObject({ name: "deepseek", model: "deepseek-v4-pro", supportsEffort: true });
  });
  test("uses Gemini only when LLM_PROVIDER=gemini, with its own key and model", () => {
    const p = pickProvider({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "g", GEMINI_MODEL: "m1", DEEPSEEK_API_KEY: "d" }, "deepseek-flash");
    expect(p).toMatchObject({ name: "gemini", key: "g", model: "m1", supportsEffort: false });
    expect(pickProvider({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "g" }, "deepseek-flash").model).toBe("gemini-flash-lite-latest");
  });
  test("a missing key is a clear error", () => {
    expect(() => pickProvider({}, "deepseek-flash")).toThrow(/DEEPSEEK_API_KEY/);
    expect(() => pickProvider({ LLM_PROVIDER: "gemini" }, "deepseek-flash")).toThrow(/GEMINI_API_KEY/);
  });
});
