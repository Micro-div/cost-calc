# Gemini migration (Groq → Google Gemini)

Status: **done**. All AI routes now run on Google Gemini via its
**OpenAI-compatible endpoint**. Groq (SDK + key + references) has been removed.

## Why this was easy to swap

The Gemini OpenAI-compat layer accepts the same request shape the Groq
integration used:

```
chat.completions.create({ model, messages, tools, tool_choice, max_completion_tokens })
```

So the three routes kept their logic; only the provider underneath changed.

## Files changed

| File | Change |
|---|---|
| `app/api/_lib/ai.ts` | **Rewritten.** Groq SDK → Gemini via `fetch`. Same exported helpers (`getClient`, `limited`, `reply`, `failure`, `clean`, `block`, `num`, `list`, `toolInput`, `ChatMessage`). Added retries + model fallback + empty-response guard. |
| `app/api/chat/route.ts` | Dropped `groq-sdk` type import; uses `ChatMessage` from `../_lib/ai`. |
| `app/api/estimate-detail/route.ts` | Same type swap. |
| `app/api/estimate-params/route.ts` | Type swap **+ bug fix** (see below) + `parseJsonish` fallback. |
| `package.json` | Removed `groq-sdk`. |
| `.env.local` | Removed `GROQ_API_KEY`; added `GEMINI_API_KEY`. |

## Models (env-overridable)

| Use | Default | Env var |
|---|---|---|
| Chat (`/api/chat`) | `gemini-3.5-flash-lite` | `GEMINI_CHAT_MODEL` |
| Research (`/api/estimate-params`) | `gemini-3.5-flash` | `GEMINI_RESEARCH_MODEL` |
| Detail (`/api/estimate-detail`) | `gemini-3.5-flash` | `GEMINI_RESEARCH_MODEL` |

> Note: `gemini-2.5-*` models are **not available to new API keys** on this
> project; the 3.x family is the current generation.

## Robustness added

1. **Retry** — transient statuses (408/409/425/429/500/502/503/504) are retried
   once with a short backoff.
2. **Model fallback** — if the primary model fails, the client tries
   `gemini-flash-lite-latest` / `gemini-flash-latest` before giving up. (Gemini
   returns sporadic 503 "high demand" errors; this hides them from the user.)
3. **Empty-response guard** — Gemini 3.x "thinks" first; if the whole token
   budget is spent thinking (empty content + no tool call) it is treated as
   transient and retried on the fallback model.
4. **`reasoning_effort: "low"`** by default → faster answers, less token waste.

## Bug fixed in `/api/estimate-params`

The research loop used to look for the tool call inside the **request** message
array, but the tool call actually arrives in `res.choices[0].message.tool_calls`.
It therefore never found the result and returned `502 No result from research`.
It now reads the response tool call directly, with a JSON-in-text fallback and a
nudge retry. Research for new countries / custom businesses **works again**.

## Live web search (follow-up)

Gemini's native **Google Search grounding** (`google_search` tool) is **not
available** on this key's quota (returns `429 RESOURCE_EXHAUSTED`), and the
OpenAI-compat endpoint does not expose it. Instead the research route now does
its own web search via `app/api/_lib/search.ts`:

- Providers, in priority order: **Tavily** → **Brave** → **Bing HTML** → **DuckDuckGo HTML**.
- Tavily/Brave are used automatically when `TAVILY_API_KEY` / `BRAVE_API_KEY` is
  set (recommended: a free Tavily key for the best quality). With no key it uses
  Bing HTML scraping, which works without any key.
- `DISABLE_WEB_SCRAPE=1` turns scraping off. Results are cached in-process for 10
  minutes. Search is best-effort and never throws.
- `/api/estimate-params` runs 3 location queries / 2 category queries, dedupes,
  fetches the top pages as text, and asks the model to cite the URLs it used.

## Chat + offline follow-up

| Area | What changed |
|---|---|
| `app/api/_lib/ai.ts` | `toolInput()` now **salvages** a truncated tool-call JSON (Gemini occasionally cuts the arguments off), so a usable reply is never lost. The empty-response guard also rejects a tool call with empty arguments and retries. |
| `app/api/chat/route.ts` | `tool_choice: "required"` (so the structured reply always comes back), `max_completion_tokens` 800 → 1600, stronger "match the user's script" rule (Urdu script must get Urdu script, not Roman). |
| `lib/chatbot/knowledge.ts` | `FAQ` items now carry `en` / `roman` / `urdu` (Urdu script) plus Urdu-script match keys. |
| `lib/chatbot/fallback.ts` | 3-language `detectLang`/`localAnswer`, ~100-country offline table, ~20 offline business templates (+Urdu keys), `matchesBusinessTemplate`, `offlineCategory`. |
| `lib/chatbot/offline.ts` | **New.** `offlineBrief()` (idea → brief, no AI) and `offlineDetail()` (fully localised estimate write-up) so the result page is never empty offline. |
| `components/chatbot/ChatBot.tsx` | **Rewritten UI.** Draggable launcher **and** draggable window (position persisted), minimize (keeps session) vs close (ends session), 3-language UI, and full estimator parity: category + size + quality chips plus country/city, then runs the estimate. |
| `components/home/AiEstimateDetail.tsx` | Falls back to `offlineDetail` when offline/the route fails; section headings localised. |
| `app/page.tsx` | Chat can run the estimate directly (`generateEstimate`), and accepts the chat's quality selection. |

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm run lint` → clean
- `npm run build` → 0 errors, 8/8 static pages, 3 dynamic API routes
- Live tests (dev server):
  - `POST /api/chat` (English / Roman Urdu / Urdu script) → project brief; Urdu
    script answer stays in Urdu script (`language: ur-PK`, Arabic-script chars).
  - `POST /api/estimate-params` (Portugal) → EUR, 23% VAT, with real source URLs.
  - `POST /api/estimate-params` (Tyre shop setup) → 6 proportional line items.
  - `POST /api/estimate-detail` (Roman Urdu) → localised headline + phases + scope.
- Follow-up: `tool_choice: "required"` + truncated-JSON salvage removed the
  intermittent `{"error":"Empty AI response"}` (502) seen on repeated runs.
