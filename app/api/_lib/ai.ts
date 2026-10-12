// Google Gemini client (OpenAI-compatible endpoint) + shared server helpers.
// Docs: https://ai.google.dev/gemini-api/docs/openai
//
// The Gemini OpenAI-compat layer accepts the same request shape as the previous
// Groq/GPT-style integration (chat.completions.create with messages / tools / tool_choice),
// so every route keeps its existing logic. Only the provider underneath changed.
//
// Robustness: Gemini sometimes returns 503 ("high demand") or burns its whole
// token budget on "thinking" and returns nothing. This client therefore retries
// transient failures and falls back to a second model before giving up.
//
// Server-side key only. NEVER expose GEMINI_API_KEY to the browser.
// Configure via env:
//   GEMINI_API_KEY        (required)
//   GEMINI_CHAT_MODEL     (default gemini-3.5-flash-lite  - fast/cheap)
//   GEMINI_RESEARCH_MODEL (default gemini-3.5-flash       - stronger)
//   GEMINI_BASE_URL       (override the API base, optional)

const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai";

export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash-lite";
export const RESEARCH_MODEL =
  process.env.GEMINI_RESEARCH_MODEL || "gemini-3.5-flash";
export const DEFAULT_MODEL = CHAT_MODEL;

// OpenAI-style chat message used by every route.
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatCompletion = {
  choices: Array<{
    finish_reason?: string;
    message: {
      role?: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
};

// Gemini 3.x models "think" before answering, which costs tokens and time.
// Default to light reasoning so the chat stays snappy; callers may override.
export type ReasoningEffort = "low" | "medium" | "high";

export type ChatArgs = {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  tool_choice?: unknown;
  max_completion_tokens?: number;
  temperature?: number;
  reasoning_effort?: ReasoningEffort;
};

type Client = {
  chat: { completions: { create: (args: ChatArgs) => Promise<ChatCompletion> } };
};

// Statuses worth retrying / falling back on. 4xx (except 429) are real errors.
const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const unique = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

// If the primary model is unavailable, these are known to support function
// calling. chat (lite) falls back to the other family and vice-versa.
function fallbackModels(model: string): string[] {
  return model.includes("lite")
    ? ["gemini-flash-lite-latest", "gemini-flash-latest"]
    : ["gemini-flash-latest", "gemini-flash-lite-latest"];
}

async function requestCompletion(
  apiKey: string,
  args: ChatArgs,
  model: string,
): Promise<ChatCompletion> {
  const body: Record<string, unknown> = {
    model,
    messages: args.messages,
    max_completion_tokens: args.max_completion_tokens ?? 1200,
    reasoning_effort: args.reasoning_effort ?? "low",
  };
  if (args.tools) body.tools = args.tools;
  if (args.tool_choice) body.tool_choice = args.tool_choice;
  if (typeof args.temperature === "number") body.temperature = args.temperature;

  const res = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`${res.status} ${detail.slice(0, 500)}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as ChatCompletion;
}

export function getClient(): Client | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; // server only
  if (!apiKey) return null;

  return {
    chat: {
      completions: {
        create: async (args) => {
          const chain = unique([args.model, ...fallbackModels(args.model)]);
          let lastError: unknown;

          for (const model of chain) {
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const out = await requestCompletion(apiKey, args, model);
                const msg = out.choices?.[0]?.message;
                const hasText = Boolean(msg?.content && msg.content.trim());
                const toolCalls = msg?.tool_calls ?? [];
                // A tool call with empty args is useless (Gemini sometimes emits
                // one while "thinking"); treat it as no answer so we retry.
                const hasUsableTool = toolCalls.some((tc) => {
                  const a = (tc.function?.arguments ?? "").trim();
                  return a !== "" && a !== "{}";
                });

                // All tokens spent on "thinking" -> no usable answer: treat as
                // transient so we retry (or move to the fallback model).
                if (!msg || (!hasText && !hasUsableTool)) {
                  throw Object.assign(new Error("empty AI response"), { status: 503 });
                }
                return out;
              } catch (e) {
                lastError = e;
                const status = (e as { status?: number }).status;
                // A real 4xx (bad request, auth) must not be retried/faked.
                if (status && !TRANSIENT_STATUS.has(status)) throw e;
                await sleep(300 * (attempt + 1));
              }
            }
          }

          throw lastError;
        },
      },
    },
  };
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
  // The client throws with `status` set on HTTP errors. Map 429 to a friendly
  // rate-limit message; everything else becomes a generic upstream error.
  let status = (e as { status?: number }).status;
  if (!status && e instanceof Error) {
    const m = e.message.match(/\b(4\d{2}|5\d{2})\b/);
    if (m) status = Number(m[1]);
  }
  console.error("[ai]", e instanceof Error ? e.message.slice(0, 300) : "unknown error"); // never log keys
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

// Gemini's OpenAI-compatible endpoint returns tool calls in the OpenAI format:
// assistant message -> tool_calls[] -> function.arguments (a JSON string).
// This helper extracts the first function-call payload for a given tool name.
//
// Gemini occasionally truncates a long arguments string (token budget spent on
// "thinking"), leaving invalid JSON. salvageArgs() recovers the important
// fields from the partial text so a usable answer is never lost.
function salvageArgs(raw: string): Record<string, unknown> | null {
  const str = (key: string): string | undefined => {
    const m = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (!m) return undefined;
    try {
      return JSON.parse(`"${m[1]}"`) as string;
    } catch {
      return m[1];
    }
  };
  const reply = str("reply");
  const language = str("language");
  if (!reply && !language) return null;
  const out: Record<string, unknown> = {};
  if (reply) out.reply = reply;
  if (language) out.language = language;
  const refined = str("refined_description");
  if (refined) {
    out.project = {
      title: str("title"),
      refined_description: refined,
      category: str("category"),
      custom_category_name: str("custom_category_name"),
      complexity: str("complexity"),
      quality: str("quality"),
      country: str("country"),
    };
  }
  const offer = raw.match(/"offer_estimate"\s*:\s*(true|false)/);
  if (offer) out.offer_estimate = offer[1] === "true";
  const now = raw.match(/"estimate_now"\s*:\s*(true|false)/);
  if (now) out.estimate_now = now[1] === "true";
  return out;
}

export function toolInput(messages: unknown[], toolName: string): Record<string, unknown> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } | undefined;
    if (!msg) continue;
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.function?.name === toolName) {
          const args = tc.function.arguments ?? "{}";
          try {
            return JSON.parse(args) as Record<string, unknown>;
          } catch {
            return salvageArgs(args);
          }
        }
      }
    }
  }
  return null;
}
