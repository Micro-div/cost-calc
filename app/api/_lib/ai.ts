import Groq from "groq-sdk";

// Chat = fast/cheap model. Research (web search) and detail = stronger model.
// Configured via env:
//   GROQ_CHAT_MODEL  (default openai/gpt-oss-120b)
//   GROQ_RESEARCH_MODEL (default openai/gpt-oss-120b)
export const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
export const RESEARCH_MODEL = process.env.GROQ_RESEARCH_MODEL || "openai/gpt-oss-120b";
export const DEFAULT_MODEL = CHAT_MODEL;

export function getClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY; // server only. NEVER NEXT_PUBLIC_
  return apiKey ? new Groq({ apiKey, maxRetries: 1, timeout: 50_000 }) : null;
}

// Basic per-IP limiter. On serverless each instance has its own memory, so this is
// only a first guard. For real protection use Upstash Redis / Vercel KV (see guide).
const hits = new Map<string, number[]>();
export function limited(req: Request, max = 20, windowMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

export const reply = (data: unknown, status = 200) => Response.json(data, { status });

export function failure(e: unknown) {
  // Groq SDK throws on HTTP errors. Map 429 to a friendly rate-limit message.
  let status = (e as { status?: number }).status;
  if (!status && e instanceof Error) {
    if (e.message.includes("429")) status = 429;
    else if (e.message.match(/4\d{2}/)) status = Number((e.message.match(/4\d{2}/) || [])[0]);
  }
  console.error("[ai]", e instanceof Error ? e.message : "unknown error"); // never log keys/bodies
  if (status === 429) return reply({ error: "AI is busy, try again shortly.", code: "rate_limited" }, 429);
  return reply({ error: "AI service unavailable.", code: "upstream" }, 502);
}

// ---- sanitizers (never trust model or client output) ----
export const clean = (v: unknown, max: number, fb = ""): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) || fb : fb;

export const block = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export const num = (v: unknown, min: number, max: number, fb: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
};

export const list = (v: unknown, count: number, max: number): string[] =>
  Array.isArray(v) ? v.map((x) => clean(x, max)).filter(Boolean).slice(0, count) : [];

// Groq uses the OpenAI-compatible tool-call format: function calling with
// role/function/tool-message turns. This helper extracts the first function-call
// payload for a given tool name from a ChatCompletion message array.
export function toolInput(messages: unknown[], toolName: string): Record<string, unknown> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } | undefined;
    if (!msg) continue;
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.function?.name === toolName) {
          try {
            return JSON.parse(tc.function.arguments ?? "{}") as Record<string, unknown>;
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}
