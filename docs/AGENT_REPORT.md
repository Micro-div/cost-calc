## Groq migration — DONE

Status: Groq (OpenAI-compatible) integration complete. Model used: `openai/gpt-oss-120b` (override via `GROQ_CHAT_MODEL`/`GROQ_RESEARCH_MODEL`; `GROQ_API_KEY` required server-side only).

Files changed this migration:
- `package.json` — added `groq-sdk@^1.6.0` (kept `@anthropic-ai/sdk` temporarily during migration, removed at end).
- `app/api/_lib/ai.ts` — replaced Anthropic client with Groq SDK. Exported helpers preserved: `getClient()`, `limited()`, `reply()`, `failure()`, `clean()`, `block()`, `num()`, `list()`, `toolInput()`. `toolInput()` now parses Groq ChatCompletion function-call turns.
- `app/api/chat/route.ts` — rewritten to `client.chat.completions.create` with a single `respond` function tool and auto toolchoice. Single-turn first response; if the model emits a `respond` tool call, it is parsed from the tool-call payload first; otherwise the text reply is used (with a best-effort JSON block parse for `project`).
- `app/api/estimate-detail/route.ts` — rewritten to Groq function tool `submit_detail` with the same single-turn-first pattern and a JSON-block fallback.
- `app/api/estimate-params/route.ts` — rewritten to Groq function tools `submit_location`/`submit_category`. **Dropped native web_search tool** (Groq does not expose `web_search_20250305`). The route now sends an explicit web-search instruction in the user prompt and the model must call the submit tool directly with researched values and source URLs. Limitation recorded in final summary.

Verification (after migration):
- `npm install` → passed.
- `npx tsc --noEmit` → 0 errors.
- `npm run lint` → 0 warnings/errors.
- `npm run build` → 0 errors, 8/8 static pages, 3 dynamic API routes.

Limitations:
- **Web search**: replaced with prompt-based instruction + sources in `submit_location`. The precise Anthropic `web_search_20250305` tool is not available on Groq; the app no longer performs an automatic parallel web search. Research quality depends on model knowledge + provided source URLs. Documented, not removed silently.
- **Tool calling fidelity**: rewritten to Groq's OpenAI-compatible function-calling pattern; the existing JSON-output prompts are preserved but rely on the model emitting stable JSON in function-call arguments. Fallback JSON-block parsing added to both detail and params routes to avoid hard failures if the model emits markdown-wrapped JSON in `content` instead of a tool call.

Model used: `openai/gpt-oss-120b` (configurable via `GROQ_CHAT_MODEL` / `GROQ_RESEARCH_MODEL`).

TypeScript / Lint / Build:
- TypeScript: 0 errors.
- Lint: 0 warnings/errors.
- Build: 0 errors, 8/8 static pages, 3 dynamic API routes.

Files new/modified this migration:
Modified: `package.json`, `app/api/_lib/ai.ts`, `app/api/chat/route.ts`, `app/api/estimate-detail/route.ts`, `app/api/estimate-params/route.ts`.

Final note
All known Anthropic/Anthropic namespace references removed. The `@anthropic-ai/sdk` dependency removed from `package.json`. The `groq-sdk` dependency added. The `web_search_20250305` native tool dropped (documented). Message-type noise removed by using ad-hoc object shapes for the message arrays and tool-call follow-up loops. Fallback JSON-block parsing kept in detail and params routes.
