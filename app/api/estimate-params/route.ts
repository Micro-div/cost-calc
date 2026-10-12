import { RESEARCH_MODEL, block, clean, failure, getClient, limited, num, reply, toolInput, type ChatMessage } from "../_lib/ai";
import { pageText, searchProvider, webSearch } from "../_lib/search";

export const runtime = "nodejs";
export const maxDuration = 60; // web search is slow; check your Vercel plan's limit

// The model only supplies INPUTS (price level, tax, FX, benchmarks).
// The totals are still computed by calculateEstimate() in the app.

const SYSTEM = `You research inputs for a rule-based project cost engine. You never output a final project price.
You may be given WEB RESEARCH results (titles, URLs, snippets and extracted page text). Treat them as your PRIMARY source of truth. Prefer official or well-known sources (tax authorities, central banks, major salary/rate surveys). If search results are present, cite the URLs you actually relied on in the "sources" field. Never fabricate numbers or URLs. If the results are missing or unsure, choose conservative values and say so in "notes". Finish by calling the submit tool exactly once.`;

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
        line_items: {
          type: "array",
          description: "3-6 cost items that make up THIS project type (fit-out, equipment, inventory, licences, marketing, staffing... for a local business; or the work packages for a digital build). Shares must sum to 1.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Short item name" },
              detail: { type: "string", description: "One line explaining the item" },
              share: { type: "number", description: "Fraction of the total cost, e.g. 0.3 = 30%" },
              quantity: { type: "number", description: "Optional unit count, default 1" },
            },
            required: ["name", "share"],
          },
        },
      },
      required: ["name", "base_usd", "hours", "weeks", "line_items"],
    },
  },
};

// WEB_SEARCH NOTE: live research is done by app/api/_lib/search.ts (Tavily/Brave
// if a key is set, otherwise a key-less Bing/DuckDuckGo lookup). The found
// titles + URLs + snippets (+ text of the top pages) are fed to the model, which
// then returns the structured inputs and cites the sources it used. If search is
// unavailable the model falls back to its own knowledge, so the route still works.

const LOCATION_PROMPT = (country: string) => `Country: ${country}
1) Find typical rates for outsourced web/software/design services there and express them as a price level multiplier relative to Canada (Toronto) = 1.0.
   Anchors: US New York 1.20, UK London 0.92, Germany 0.98, UAE Dubai 1.02, Singapore 1.04, Australia 1.08, Pakistan 0.34, India 0.30, Nigeria 0.28.
2) Find the standard national VAT/GST/sales-tax rate that applies to IT/digital services.
3) Find today's exchange rate (local currency units per 1 USD).
Then call submit_location.`;

const CATEGORY_PROMPT = (name: string, description: string) => `Project type: ${name}
Description: ${description || "n/a"}
This can be ANY project the user asks for - an online/digital build OR an offline local business such as a tyre shop, mart, restaurant or salon.
Give benchmark inputs for a MEDIUM-scope project of this type.
Anchors (base USD / hours / weeks): website 5200/190/5, mobile app 9800/340/8, ecommerce 7200/245/6, UI-UX design 3400/115/3, SEO 2100/70/3, social media management 2300/80/4, branding 3600/105/4, AI solution 10500/330/8.
For an offline business, base_usd = what it typically costs to set the place up (fit-out, equipment/fixtures, initial inventory, licences/permits, initial marketing, staffing); hours = labour hours involved; weeks = setup time.
line_items must be specific to THIS project type (3-6 items, shares summing to 1).
Search only if you need market data. Then call submit_category.`;

// Best-effort JSON extraction for when the model answers with text instead of
// calling the tool (strips ```json fences).
function parseJsonish(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const m = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = m ? m[1] : text;
  try {
    const p = JSON.parse(raw) as unknown;
    return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

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

  // ---- live web research (best effort; never blocks the estimate) ----
  const queries = isLocation
    ? [
        `${country} standard VAT GST rate on IT services`,
        `${country} web development agency hourly rate cost`,
        `${country} local currency per US dollar exchange rate`,
      ]
    : [`${name} setup cost average`, `${name} business startup cost breakdown`];

  const found = (await Promise.all(queries.map((q) => webSearch(q, 4)))).flat();
  const seen = new Set<string>();
  const uniq = found.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  }).slice(0, 8);
  const pages = await Promise.all(
    uniq.slice(0, 2).map((r) => pageText(r.url).then((t) => ({ url: r.url, t }))),
  );
  const webBlock = [
    `WEB RESEARCH (provider: ${searchProvider()}, date: ${new Date().toISOString().slice(0, 10)})`,
    uniq.length
      ? uniq.map((r, i) => `${i + 1}. ${r.title} - ${r.url}${r.snippet ? `\n   ${r.snippet}` : ""}`).join("\n")
      : "(no search results available - rely on your own knowledge and say so in notes)",
    ...pages.filter((p) => p.t.length > 80).map((p) => `\nEXTRACTED PAGE (${p.url}):\n${p.t}`),
  ].join("\n");

  let messages: Array<ChatMessage> = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `${isLocation ? LOCATION_PROMPT(country) : CATEGORY_PROMPT(name, clean(body.description, 500))}\n\n${webBlock}`,
    },
  ];

  try {
    let out: Record<string, unknown> | null = null;
    for (let i = 0; i < 3 && !out; i++) {
      const res = await client.chat.completions.create({
        model: RESEARCH_MODEL,
        max_completion_tokens: 2500,
        messages,
        tools,
        tool_choice: "auto",
      });
      const msg = res.choices[0]?.message;
      const toolCalls = (msg?.tool_calls ?? []) as Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;

      // Preferred path: the model called the submit tool.
      if (toolCalls.some((tc) => tc.function.name === submit)) {
        out = toolInput([{ role: "assistant", tool_calls: toolCalls }], submit);
        if (out) break;
      }

      // Fallback: the model wrote the JSON into the message text instead.
      const content = block(msg?.content, 4000);
      const parsed = parseJsonish(content);
      const candidate = parsed && ((parsed[submit] as unknown) ?? parsed);
      if (candidate && typeof candidate === "object") {
        out = candidate as Record<string, unknown>;
        break;
      }

      // Neither: nudge the model once more to call the tool.
      messages.push({ role: "assistant", content: content || `Calling ${submit}.` });
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

    const rawItems = (Array.isArray(out.line_items) ? out.line_items : [])
      .map((i) => {
        const r = i as Record<string, unknown>;
        return {
          name: clean(r.name, 60),
          detail: clean(r.detail, 160),
          share: num(r.share, 0, 1, 0),
          quantity: num(r.quantity, 1, 9999, 1),
        };
      })
      .filter((i) => i.name && i.share > 0)
      .slice(0, 6);
    const shareSum = rawItems.reduce((s, i) => s + i.share, 0) || 1;
    const items = rawItems.map((i) => ({
      ...i,
      share: Math.round((i.share / shareSum) * 1000) / 1000,
    }));

    return reply({
      name: clean(out.name, 60, name),
      baseUsd: num(out.base_usd, 800, 40000, 6000),
      hours: Math.round(num(out.hours, 30, 800, 200)),
      weeks: Math.round(num(out.weeks, 1, 30, 6)),
      summary: clean(out.summary, 240),
      items: items.length ? items : undefined,
    });
  } catch (e) {
    return failure(e);
  }
}
