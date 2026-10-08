import { RESEARCH_MODEL, clean, failure, getClient, limited, num, reply, toolInput } from "../_lib/ai";

// NOTE: groq-sdk may not export ChatCompletionMessageParam in every published
// version. Declare a local, structurally compatible type here so the chat
// completions call stays typed while avoiding a per-version import error.
type ChatCompletionMessageParam = {
  role?: "user" | "assistant" | "system" | "function" | "tool";
  content?: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> | null;
  name?: string | null;
  tool_call_id?: string | null;
  function_call?: { name: string; arguments: string } | null;
};

export const runtime = "nodejs";
export const maxDuration = 60; // web search is slow; check your Vercel plan's limit

// The model only supplies INPUTS (price level, tax, FX, benchmarks).
// The totals are still computed by calculateEstimate() in the app.

const SYSTEM = `You research inputs for a rule-based project cost engine. You never output a final project price.
Search the web (max 4 searches), prefer official or well-known sources (tax authorities, central banks, major salary/rate surveys). Never fabricate numbers or URLs. If unsure, choose conservative values and say so in "notes". Finish by calling the submit tool exactly once.`;

const LOCATION_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_location",
    description: "Submit researched inputs for one country.",
    parameters: {
      type: "object",
      properties: {
        country: { type: "string", description: "English country name" },
        city: { type: "string", description: "Main business city" },
        currency: { type: "string", description: "ISO 4217 code, e.g. SAR" },
        units_per_usd: { type: "number", description: "Local currency units for 1 USD today" },
        multiplier: { type: "number", description: "Price level of agency/freelance web & software services vs Canada(Toronto)=1.0" },
        tax_rate: { type: "number", description: "Standard VAT/GST on IT services as a decimal, 0.15 = 15%" },
        notes: { type: "string" },
        sources: {
          type: "array",
          items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } }, required: ["title", "url"] },
        },
      },
      required: ["country", "currency", "units_per_usd", "multiplier", "tax_rate", "sources"],
    },
  },
};

const CATEGORY_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_category",
    description: "Submit benchmark inputs for a project type.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        base_usd: { type: "number", description: "Typical total price in USD for a medium-scope project in a Canada-level market" },
        hours: { type: "number", description: "Typical total working hours for that scope" },
        weeks: { type: "number", description: "Typical delivery time in weeks" },
        summary: { type: "string" },
      },
      required: ["name", "base_usd", "hours", "weeks"],
    },
  },
};

// WEB_SEARCH NOTE: Groq does not expose Anthropic's web_search_20250305 tool.
// The route instructs the model to research via its own knowledge and emit source
// URLs in submit_location.sources. No separate web_search tool call is made.

const LOCATION_PROMPT = (country: string) => `Country: ${country}
1) Find typical rates for outsourced web/software/design services there and express them as a price level multiplier relative to Canada (Toronto) = 1.0.
   Anchors: US New York 1.20, UK London 0.92, Germany 0.98, UAE Dubai 1.02, Singapore 1.04, Australia 1.08, Pakistan 0.34, India 0.30, Nigeria 0.28.
2) Find the standard national VAT/GST/sales-tax rate that applies to IT/digital services.
3) Find today's exchange rate (local currency units per 1 USD).
Then call submit_location.`;

const CATEGORY_PROMPT = (name: string, description: string) => `Project type: ${name}
Description: ${description || "n/a"}
Give benchmark inputs for a MEDIUM-scope project of this type.
Anchors (base USD / hours / weeks): website 5200/190/5, mobile app 9800/340/8, ecommerce 7200/245/6, UI-UX design 3400/115/3, SEO 2100/70/3, social media management 2300/80/4, branding 3600/105/4, AI solution 10500/330/8.
Search only if you need market data. Then call submit_category.`;

export async function POST(req: Request) {
  if (limited(req, 6)) return reply({ error: "Too many requests.", code: "rate_limited" }, 429);
  const client = getClient();
  if (!client) return reply({ error: "AI is not configured on this server.", code: "no_key" }, 500);

  let body: { kind?: unknown; country?: unknown; name?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid request body." }, 400);
  }

  const isLocation = body.kind === "location";
  const isCategory = body.kind === "category";
  const country = clean(body.country, 60);
  const name = clean(body.name, 60);
  if ((isLocation && !country) || (isCategory && !name) || (!isLocation && !isCategory)) {
    return reply({ error: "Missing country or name." }, 400);
  }

  const submit = isLocation ? "submit_location" : "submit_category";
  const tools = isLocation ? [LOCATION_TOOL] : [CATEGORY_TOOL];
  let messages: Array<ChatCompletionMessageParam> = [
    {
      role: "user",
      content: isLocation ? LOCATION_PROMPT(country) : CATEGORY_PROMPT(name, clean(body.description, 500)),
    },
  ];

  try {
    let out: Record<string, unknown> | null = null;
    for (let i = 0; i < 4 && !out; i++) {
      const res = await client.chat.completions.create({
        model: RESEARCH_MODEL,
        max_completion_tokens: 2000,
        messages,
        tools,
        tool_choice: "auto",
      });
      out = toolInput(messages, submit);
      if (out) break;
      const assistantContent = res.choices[0]?.message?.content;
      messages.push({ role: "assistant", content: assistantContent as string });
      messages.push({ role: "user", content: `Now call ${submit} with your best researched values.` });
    }
    if (!out) return reply({ error: "No result from research.", code: "empty" }, 502);

    if (isLocation) {
      const currency = clean(out.currency, 3).toUpperCase();
      try {
        new Intl.NumberFormat("en", { style: "currency", currency });
      } catch {
        return reply({ error: "Invalid currency from research.", code: "invalid" }, 502);
      }
      const unitsPerUsd = num(out.units_per_usd, 0, 1e7, 0);
      if (unitsPerUsd <= 0) return reply({ error: "Invalid exchange rate.", code: "invalid" }, 502);
      const sources = (Array.isArray(out.sources) ? out.sources : [])
        .map((s) => ({ title: clean((s as { title?: unknown }).title as string | undefined, 120), url: clean((s as { url?: unknown }).url as string | undefined, 300) }))
        .filter((s) => /^https:\/\//.test(s.url))
        .slice(0, 4);
      return reply({
        country: clean(out.country, 60, country),
        city: clean(out.city, 60),
        currency,
        unitsPerUsd,
        multiplier: num(out.multiplier, 0.15, 1.6, 0.6),
        taxRate: num(out.tax_rate, 0, 0.3, 0.1),
        notes: clean(out.notes, 240),
        sources,
      });
    }

    return reply({
      name: clean(out.name, 60, name),
      baseUsd: num(out.base_usd, 800, 40000, 6000),
      hours: Math.round(num(out.hours, 30, 800, 200)),
      weeks: Math.round(num(out.weeks, 1, 30, 6)),
      summary: clean(out.summary, 240),
    });
  } catch (e) {
    return failure(e);
  }
}
