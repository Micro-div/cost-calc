import { RESEARCH_MODEL, block, clean, failure, getClient, limited, list, num, reply, toolInput, type ChatMessage } from "../_lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM = `You write the detailed explanation section of a project cost estimate.
- Write in the requested language, clean and clear, plain text, no markdown, no emojis.
- All numbers (totals, line items, range, weeks) are given to you and are READ-ONLY. Never change, recompute or invent prices. Refer to them only as given.
- Be specific to THIS project and country. Avoid generic filler.
- Phases must add up to roughly the given timeline in weeks.
Finish by calling submit_detail once.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "submit_detail",
    description: "Submit the detailed estimate write-up.",
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string", description: "One sentence summary of the project and investment level" },
        why: { type: "string", description: "Why the price is what it is (max ~90 words)" },
        phases: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, weeks: { type: "string" }, deliverables: { type: "array", items: { type: "string" } } },
            required: ["name", "weeks", "deliverables"],
          },
        },
        scope: { type: "array", items: { type: "string" } },
        assumptions: { type: "array", items: { type: "string" } },
        risks: {
          type: "array",
          items: { type: "object", properties: { risk: { type: "string" }, fix: { type: "string" } }, required: ["risk", "fix"] },
        },
        tips: { type: "array", items: { type: "string" }, description: "Ways to reduce cost without hurting the result" },
        next: { type: "array", items: { type: "string" } },
      },
      required: ["headline", "why", "phases", "scope", "assumptions", "risks", "tips", "next"],
    },
  },
};

export async function POST(req: Request) {
  if (limited(req, 8)) return reply({ error: "Too many requests.", code: "rate_limited" }, 429);
  const client = getClient();
  if (!client) return reply({ error: "AI is not configured on this server.", code: "no_key" }, 500);

  let body: { description?: unknown; language?: unknown; estimate?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid request body." }, 400);
  }

  const e = (body.estimate ?? null) as Record<string, unknown> | null;
  if (!e) return reply({ error: "Missing estimate." }, 400);

  const items = (Array.isArray(e.items) ? e.items : []).slice(0, 8).map((i) => {
    const r = i as Record<string, unknown>;
    return `${clean(r.name, 60)}: ${num(r.amount, 0, 1e12, 0)}`;
  });
  const facts = [
    `Project: ${clean(e.title, 80)}`,
    `Category: ${clean(e.category, 60)}`,
    `Country: ${clean(e.country, 60)} (currency ${clean(e.currency, 3)})`,
    `Size: ${clean(e.size, 30)}, quality: ${clean(e.quality, 30)}`,
    `Line items (${clean(e.currency, 3)}): ${items.join("; ")}`,
    `Subtotal ${num(e.subtotal, 0, 1e12, 0)}, contingency ${num(e.contingency, 0, 1e12, 0)}, taxes ${num(e.taxes, 0, 1e12, 0)}, TOTAL ${num(e.total, 0, 1e12, 0)}`,
    `Range: ${num(e.low, 0, 1e12, 0)} to ${num(e.high, 0, 1e12, 0)}`,
    `Timeline: ${num(e.durationMin, 0, 200, 0)} to ${num(e.durationMax, 0, 200, 0)} weeks`,
    `Confidence: ${num(e.confidence, 0, 100, 0)}%`,
  ].join("\n");

  try {
    const first = await client.chat.completions.create({
      model: RESEARCH_MODEL,
      max_completion_tokens: 2200,
      messages: [
        {
          role: "user",
          content: `Language: ${clean(body.language, 30, "English")}\nProject description: ${block(body.description, 500)}\n\nENGINE RESULT (read-only):\n${facts}`,
        } as ChatMessage,
      ],
      tools: [TOOL],
      tool_choice: "auto",
    });

    const firstMsg = first.choices[0]?.message;
    if (!firstMsg) return reply({ error: "Empty AI response.", code: "empty" }, 502);

    const toolCalls = (firstMsg.tool_calls ?? []) as Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
    if (toolCalls.some((tc) => tc.function.name === "submit_detail")) {
      const out = toolInput([{ role: "assistant", tool_calls: toolCalls }], "submit_detail");
      if (!out) return reply({ error: "Empty AI response.", code: "empty" }, 502);

      return reply({
        headline: clean((out.headline as string | undefined) ?? "", 220),
        why: block((out.why as string | undefined) ?? "", 700),
        phases: (Array.isArray(out.phases) ? out.phases : []).slice(0, 6).map((p) => {
          const r = p as Record<string, unknown>;
          return { name: clean((r.name as string | undefined) ?? "", 60), weeks: clean((r.weeks as string | undefined) ?? "", 20), deliverables: list((r.deliverables as unknown) as string[], 5, 120) };
        }),
        scope: list(out.scope, 8, 160),
        assumptions: list(out.assumptions, 6, 160),
        risks: (Array.isArray(out.risks) ? out.risks : []).slice(0, 5).map((x) => {
          const r = x as Record<string, unknown>;
          return { risk: clean((r.risk as string | undefined) ?? "", 140), fix: clean((r.fix as string | undefined) ?? "", 160) };
        }),
        tips: list(out.tips, 4, 160),
        next: list(out.next, 4, 140),
      });
    }

    const text = clean(firstMsg.content ?? "", 3000);
    if (!text) return reply({ error: "Empty AI response.", code: "empty" }, 502);

    const codeMatch = text.match(/```json\s*([\s\S]*?)```/i);
    const jsonish = codeMatch ? codeMatch[1] : text;
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(jsonish);
    } catch {
      return reply({
        headline: block(text, 220),
        why: block(text, 700),
        phases: [],
        scope: [],
        assumptions: [],
        risks: [],
        tips: [],
        next: [],
      });
    }

    const safe = parsed ?? {};
    return reply({
      headline: clean((safe.headline as string | undefined) ?? "", 220),
      why: block((safe.why as string | undefined) ?? "", 700),
      phases: (Array.isArray(safe.phases) ? safe.phases : []).slice(0, 6).map((p) => {
        const r = p as Record<string, unknown>;
        return { name: clean((r.name as string | undefined) ?? "", 60), weeks: clean((r.weeks as string | undefined) ?? "", 20), deliverables: list((r.deliverables as unknown) as string[], 5, 120) };
      }),
      scope: list(safe.scope, 8, 160),
      assumptions: list(safe.assumptions, 6, 160),
      risks: (Array.isArray(safe.risks) ? safe.risks : []).slice(0, 5).map((x) => {
        const r = x as Record<string, unknown>;
        return { risk: clean((r.risk as string | undefined) ?? "", 140), fix: clean((r.fix as string | undefined) ?? "", 160) };
      }),
      tips: list(safe.tips, 4, 160),
      next: list(safe.next, 4, 140),
    });
  } catch (err) {
    return failure(err);
  }
}
