import { describe, expect, test } from "vitest";
import { pickProvider } from "./llm";

describe("pickProvider", () => {
  test("uses Groq by default, with its own key and model", () => {
    expect(pickProvider({ GROQ_API_KEY: "q", DEEPSEEK_API_KEY: "d" }, "deepseek-flash")).toMatchObject({ name: "groq", key: "q", model: "openai/gpt-oss-120b", supportsEffort: false });
    expect(pickProvider({ GROQ_API_KEY: "q", GROQ_MODEL: "m2" }, "deepseek-flash").model).toBe("m2");
  });
  test("uses DeepSeek when LLM_PROVIDER=deepseek, with the requested model", () => {
    const p = pickProvider({ LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "d" }, "deepseek-v4-pro");
    expect(p).toMatchObject({ name: "deepseek", model: "deepseek-v4-pro", supportsEffort: true });
  });
  test("uses Gemini only when LLM_PROVIDER=gemini, with its own key and model", () => {
    const p = pickProvider({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "g", GEMINI_MODEL: "m1", DEEPSEEK_API_KEY: "d" }, "deepseek-flash");
    expect(p).toMatchObject({ name: "gemini", key: "g", model: "m1", supportsEffort: false });
    expect(pickProvider({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "g" }, "deepseek-flash").model).toBe("gemini-flash-lite-latest");
  });
  test("a missing key or unknown provider is a clear error", () => {
    expect(() => pickProvider({}, "deepseek-flash")).toThrow(/GROQ_API_KEY/);
    expect(() => pickProvider({ LLM_PROVIDER: "deepseek" }, "deepseek-flash")).toThrow(/DEEPSEEK_API_KEY/);
    expect(() => pickProvider({ LLM_PROVIDER: "gemini" }, "deepseek-flash")).toThrow(/GEMINI_API_KEY/);
    expect(() => pickProvider({ LLM_PROVIDER: "other", GROQ_API_KEY: "q" }, "deepseek-flash")).toThrow(/Unknown/);
  });
});
