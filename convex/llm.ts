// Small wrappers around the AI services (Groq, DeepSeek, Gemini; all OpenAI-compatible) and Firecrawl (web search).

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type Message = { role: "system" | "user"; content: string };

export type AskOptions = {
  model?: "deepseek-flash" | "deepseek-v4-pro";
  effort?: "low" | "high" | "max";
  label?: string; // shown in the token-usage log line
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";

type Env = Record<string, string | undefined>;

// Which AI service answers. Groq is the default (higher free limits for testing). LLM_PROVIDER=deepseek or
// LLM_PROVIDER=gemini picks the others. GROQ_MODEL / GEMINI_MODEL override the model. See decisions/007 and 011.
export function pickProvider(env: Env, requestedModel: string) {
  const provider = env.LLM_PROVIDER || "groq";
  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in Convex.");
    return { name: "gemini", url: GEMINI_URL, key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, supportsEffort: false };
  }
  if (provider === "deepseek") {
    if (!env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not set in Convex.");
    return { name: "deepseek", url: DEEPSEEK_URL, key: env.DEEPSEEK_API_KEY, model: requestedModel, supportsEffort: true };
  }
  if (provider !== "groq") throw new Error(`Unknown LLM_PROVIDER "${provider}".`);
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set in Convex.");
  return { name: "groq", url: GROQ_URL, key: env.GROQ_API_KEY, model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL, supportsEffort: false };
}

// Asks the AI for a JSON object and parses it. Logs token usage so we can track cost per document.
export async function askJson<T>(messages: Message[], opts: AskOptions = {}): Promise<T> {
  const provider = pickProvider(process.env, opts.model ?? "deepseek-flash");
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
      ...(opts.effort && provider.supportsEffort ? { reasoning_effort: opts.effort } : {}),
    }),
  });
  const raw = await res.json();
  const body = Array.isArray(raw) ? raw[0] : raw; // Gemini wraps some errors in a list
  if (!res.ok) throw new Error(`${provider.name} error: ${body?.error?.message ?? res.status}`);
  const u = body.usage ?? {};
  console.log(
    `[tokens] ${opts.label ?? "call"} provider=${provider.name} model=${provider.model} in=${u.prompt_tokens} (cached ${u.prompt_cache_hit_tokens ?? 0}) out=${u.completion_tokens} (reasoning ${u.completion_tokens_details?.reasoning_tokens ?? 0})`
  );
  const text: string = body.choices?.[0]?.message?.content ?? "";
  return parseJson<T>(text);
}

// Tolerates code fences or stray text around the JSON.
export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI didn't return JSON.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export type SearchResult = { url: string; title: string; description: string };

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) return [];
    const body = await res.json();
    const web: SearchResult[] = body?.data?.web ?? [];
    return web
      .filter((r) => r.url)
      .map((r) => ({ url: r.url, title: r.title ?? r.url, description: (r.description ?? "").slice(0, 600) }));
  } catch {
    return []; // search is a bonus: never fail the whole job because of it
  }
}
