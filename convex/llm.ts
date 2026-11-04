// Small wrappers around the DeepSeek (LLM) and Firecrawl (web search) HTTP APIs.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type Message = { role: "system" | "user"; content: string };

export type AskOptions = {
  model?: "deepseek-flash" | "deepseek-v4-pro";
  effort?: "low" | "high" | "max";
  label?: string; // shown in the token-usage log line
};

// Asks DeepSeek for a JSON object and parses it. Logs token usage so we can track cost per document.
export async function askJson<T>(messages: Message[], opts: AskOptions = {}): Promise<T> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set in Convex.");
  const model = opts.model ?? "deepseek-flash";
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
      ...(opts.effort ? { reasoning_effort: opts.effort } : {}),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`DeepSeek error: ${body?.error?.message ?? res.status}`);
  const u = body.usage ?? {};
  console.log(
    `[tokens] ${opts.label ?? "call"} model=${model} in=${u.prompt_tokens} (cached ${u.prompt_cache_hit_tokens ?? 0}) out=${u.completion_tokens} (reasoning ${u.completion_tokens_details?.reasoning_tokens ?? 0})`
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
