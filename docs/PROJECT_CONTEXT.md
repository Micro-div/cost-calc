# PROJECT_CONTEXT.md — CostCalc (AI Integration Reference)

> **Purpose of this file:** give an external AI assistant a complete, accurate picture of
> the CostCalc codebase before integrating the Anthropic (Claude) API.
> **Secrets:** none are included. Any credential found is written as `[REDACTED]`.
> **Repo root:** `C:\Users\cc\Desktop\Project\cost-calc` (git repo, branch `main`, clean working tree).

---

## 1. Project Overview

**CostCalc** is a single-page **AI-powered project cost estimation and quotation web app**.
A user types a plain-language description of what they want to build, answers two quick
questions (project size + quality level), and the app produces a localized cost estimate:
line-item breakdown, low/typical/high range, contingency, taxes, timeline, confidence score,
suggested scope of work and an editable quotation that can be "downloaded" as a PDF.

**What kind of costs it estimates today:** *digital services only* — 8 categories:
website development, mobile app, ecommerce, UI/UX design, SEO, social media management,
branding/graphic design, and AI solutions.

> The `README.md` (25 KB) is a **product spec**, not a status report. It describes a much
> larger future platform: home services, construction, events (phases 2–4), user/provider/
> admin dashboards, payment subscriptions, a provider marketplace and a public API. **None of
> that is implemented.** Only Phase One (digital services) exists, as a static marketing page
> with a client-side calculator.

**Who uses it:** individual customers, freelancers/consultants and small agencies who want a
quick, localized budget figure + a client-ready quotation (per README §4).

**Current status: working prototype / MVP front-end.**
- Builds and lints clean (`npm run lint` → no errors; `npm run build` → static export).
- All estimation logic is deterministic and runs **entirely in the browser** (no DB, no auth).
- Only one AI feature is wired (project-description analysis via **Google Gemini**), and its
  UI entry point is currently commented out (see §11).
- One TypeScript error exists (see §11, Known Issues).

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | **15.3.8** |
| UI library | React | **^19.0.0** |
| Language | TypeScript (`strict: true`) | **^5** |
| Styling | Tailwind CSS 3.4.1 + custom CSS in `app/globals.css` | 3.4.1 |
| Linting | ESLint / `eslint-config-next` (`next/core-web-vitals`) | 9 / 15.3.0 |
| Runtime (CI) | Node.js | **22.14.0** (GitLab CI image) |
| Package manager | **npm** (`package-lock.json` present; no yarn/pnpm) | — |
| Database | **None** | — |
| ORM | **None** | — |
| Persistence | `localStorage` only (history, custom project types) | — |
| Hosting | **GitLab Pages** via `.gitlab-ci.yml` (`npm ci` → `npm run build` → publish `out/`) | — |
| Build mode | `output: 'export'` → **fully static site**, `images.unoptimized: true` | — |
| Deploy config | `next.config.mjs` (`experimental: { workerThreads: false, cpus: 1 }` to avoid OOM on a 4 GB machine) | — |

### Dependencies (`package.json`)

**dependencies**
```
next         15.3.8
react        ^19.0.0
react-dom    ^19.0.0
react-loading-indicators ^1.0.1   (used only by GeneratingOverlay / Loader)
```

**devDependencies**
```
@types/node ^20 · @types/react ^19 · @types/react-dom ^19
cross-env ^10.1.0 · eslint ^9 · eslint-config-next 15.3.0
postcss ^8 · tailwindcss ^3.4.1 · typescript ^5
```

**Scripts**
```json
"dev":   "cross-env NODE_OPTIONS=--no-experimental-webstorage next dev",
"build": "cross-env NODE_OPTIONS=--no-experimental-webstorage next build",
"start": "cross-env NODE_OPTIONS=--no-experimental-webstorage next start",
"lint":  "next lint"
```

> There is **no `typecheck` script** — run `npx tsc --noEmit` manually.
> There is **no test framework, no CI test job, no formatter**.

### ⚠️ Critical deployment constraint
`next.config.mjs` sets `output: 'export'`. **Next.js route handlers that accept POST are not
supported in a static export.** `app/api/estimates/route.ts` therefore contains
`export const dynamic = "force-static"` with a comment explaining that this only makes the
*build* pass; the route works in `next dev` and on a server deployment, but **it does not
work on the deployed GitLab Pages site.** Any Claude integration that needs a server-side API
call must either (a) drop `output: 'export'` and deploy a Node server, or (b) move the AI call
to a separate serverless/edge endpoint, or (c) accept that the feature is dev-only.

---

## 3. Folder Structure

```
cost-calc/
├── app/
│   ├── layout.tsx              # Root layout: metadata (title/description/OG), LoadingWrapper
│   ├── page.tsx                # ⭐ THE whole app: all state, wizard flow, history, share/save
│   ├── globals.css             # Design tokens, hero/orb styles, print (PDF) rules, loaders
│   ├── loading.tsx             # Next.js route-level loading stub
│   ├── favicon.ico
│   └── api/estimates/route.ts  # ⭐ ONLY backend endpoint: Gemini project analysis (POST)
├── components/
│   ├── common/
│   │   ├── Icon.tsx            # Inline SVG icon set (name-keyed, ~28 icons)
│   │   ├── Loader.tsx          # Full-screen boot splash
│   │   ├── LoadingWrapper.tsx  # Shows Loader for min 2.2s + 0.6s fade before children
│   │   ├── GeneratingOverlay.tsx # "generating estimate" overlay (react-loading-indicators)
│   │   ├── Reveal.tsx          # Scroll-triggered reveal wrapper
│   │   └── Toast.tsx           # Bottom toast (success / error variants)
│   ├── home/
│   │   ├── Hero.tsx            # Hero copy + letter animation; renders <Estimator {...props}/>
│   │   ├── Estimator.tsx       # ⭐ 3-stage wizard UI: describe → questions → complete
│   │   ├── EstimateResult.tsx  # ⭐ Full result page: totals, breakdown, scope, assumptions
│   │   ├── ServicesSection.tsx # 8 category cards (click → prefill example description)
│   │   ├── HowItWorks.tsx      # Marketing "3 steps" section
│   │   ├── WhyCostCalc.tsx     # Marketing trust section
│   │   └── CtaSection.tsx      # Bottom call-to-action
│   ├── layout/
│   │   ├── Header.tsx          # Nav (#services, #how-it-works, #why-costcalc) + History drawer
│   │   ├── Footer.tsx          # Footer links, mailto:hello@costcalc.com, SVG wave
│   │   └── Brand.tsx           # Logo link to #top
│   └── quotation/
│       └── QuoteModal.tsx      # ⭐ Editable quotation + "Download PDF" (window.print)
├── constants/index.ts          # ⭐ ALL pricing data: categories, locations, sizes, quality, FX
├── lib/index.ts                # ⭐ ALL calculation logic: calculateEstimate() + helpers
├── types/index.ts              # Shared TS types (derived from the const arrays)
├── public/                     # logo.png, banner.png, plus.png, next.svg, vercel.svg
├── app/api/…                   # (see above)
├── cost-calc/                  # ⚠️ empty leftover directory
├── woocommerce-country-currency-switcher.php  # ⚠️ unrelated WordPress/WooCommerce snippet
├── README.md                   # Full product spec (not implementation status)
├── next.config.mjs, tailwind.config.ts, tsconfig.json, postcss.config.mjs, .eslintrc.json
├── .gitlab-ci.yml              # GitLab Pages build/publish
└── .gitignore
```

---

## 4. Cost Estimation Logic (most important)

### 4.1 Where it lives

| Concern | File / symbol |
|---|---|
| **The whole calculation** | `lib/index.ts:148` → `calculateEstimate(description, categoryId, locationId, sizeId, qualityId, currencyOverride)` |
| Money rounding | `lib/index.ts:20` → `roundMoney(v) = Math.round(v)` (integer, no decimals) |
| Currency formatting | `lib/index.ts:24` `formatCurrency()`, `lib/index.ts:32` `formatCompactCurrency()` (`Intl.NumberFormat`, `maximumFractionDigits: 0`) |
| Category detection from text | `lib/index.ts:48` `detectCategory()` (keyword matching) |
| Location detection from text | `lib/index.ts:114` `detectLocation()` (keyword matching) |
| Project title from text | `lib/index.ts:138` `getProjectTitle()` |
| Browser-locale currency guess | `lib/index.ts:246` `detectCurrencyFromLocale()` |
| Rate/base/multiplier tables | `constants/index.ts` (`categories`, `locations`, `projectSizes`, `qualityOptions`, `USD_RATES`) |
| Scope-of-work text | `constants/index.ts:250` `scopeByCategory` (static, per category) |
| Assumptions text | `constants/index.ts:301` `assumptions` (4 static strings) |
| Quotation re-calculation (when user edits qty/rate) | `components/quotation/QuoteModal.tsx:29-37` (duplicates the same 5% + tax formula) |
| Trigger of the calculation | `app/page.tsx:312` inside `continueQuestions()` (after a fixed 2000 ms `setTimeout` that drives the "Generating…" overlay) |

### 4.2 The formula (verbatim from `calculateEstimate`)

```
projectTotalUSD = category.base × location.multiplier × size.multiplier × quality.multiplier

lineItemShares  = [0.14, 0.16, 0.42, 0.16, 0.12]        # sums to 1.00
lineItemNames   = Discovery & strategy, UX & UI design, Development,
                  Quality assurance, Project management
lineItemQty     = [1, 28, round(category.hours × 0.62), 28, 16]

rate_local_i    = roundMoney( (projectTotalUSD × share_i × fx) / qty_i )
lineAmount_i    = qty_i × rate_i                           # re-multiplied AFTER rounding

subtotal        = Σ (qty_i × rate_i)
contingency     = roundMoney(subtotal × 0.05)             # fixed 5 %
taxes           = roundMoney((subtotal + contingency) × location.taxRate)
total           = subtotal + contingency + taxes

low             = roundMoney(total × 0.88)                # −12 %
high            = roundMoney(total × 1.17)                # +17 %

baseWeeks       = category.weeks × size.weekFactor × quality.weekFactor
durationMin     = max(1, round(baseWeeks × 0.8))
durationMax     = max(2, round(baseWeeks × 1.2))

confidence      = min(94, 80 + min(12, floor(description.length / 10)))   # 80–94 %
```

* `fx = USD_RATES[currency]` — the amount is computed in USD first, then converted per line item.
* Currency = the location's currency, unless `currencyOverride` is passed (set from the
  browser locale via `detectCurrencyFromLocale()`; cleared when the user changes location manually).
* There is **no margin/profit markup line**, no material/equipment/labour split, no discount,
  no per-hour rate display — `quantity` is a display-only unit (hours for Development, "1"/"28"
  pseudo-units for the others) and `rate` is a back-computed value.
* Rate data is **not** per-item: all items derive from one category base price.

### 4.3 Where rates/prices/materials live

**No database, no JSON, no Excel/CSV.** Everything is hard-coded as `as const` TypeScript
arrays in `constants/index.ts`. Currency rates are a static table (`USD_RATES`) with **no
live FX feed** — they are snapshots and will drift.

**`categories` (8 rows) — sample:**

| id | name | base (USD) | hours | weeks | displayed `range` |
|---|---|---|---|---|---|
| `web` | Website development | 5200 | 190 | 5 | `$3k – $12k` |
| `mobile` | Mobile application | 9800 | 340 | 8 | `$7k – $28k` |
| `ecommerce` | Ecommerce development | 7200 | 245 | 6 | `$5k – $17k` |
| `design` | UI and UX design | 3400 | 115 | 3 | `$2k – $8k` |
| `seo` | Search engine optimization | 2100 | 70 | 3 | `$1.2k – $5k` |
| `social` | Social media management | 2300 | 80 | 4 | `$1.5k – $6k` |
| `branding` | Branding and graphic design | 3600 | 105 | 4 | `$1.8k – $8k` |
| `ai` | AI solutions | 10500 | 330 | 8 | `$8k – $32k` |

*(each row also has `shortName`, `description`, `icon`, and an `example` description used to prefill the form)*

**`locations` (10 rows) — sample:**

| id | country / city | currency | multiplier | taxRate |
|---|---|---|---|---|
| `us` | United States / New York | USD | 1.20 | 0.08875 |
| `ca` | Canada / Toronto | CAD | 1.00 | 0.13 |
| `uk` | United Kingdom / London | GBP | 0.92 | 0.20 |
| `ae` | United Arab Emirates / Dubai | AED | 1.02 | 0.05 |
| `pk` | Pakistan / Karachi | PKR | 0.34 | 0.05 |
| `in` | India / Mumbai | INR | 0.30 | 0.18 |
| `au` | Australia / Sydney | AUD | 1.08 | 0.10 |
| `de` | Germany / Berlin | EUR | 0.98 | 0.19 |
| `sg` | Singapore | SGD | 1.04 | 0.09 |
| `ng` | Nigeria / Lagos | NGN | 0.28 | 0.075 |

**`projectSizes` (3 rows):** `small`=Focused (0.72 price, 0.75 weeks) · `medium`=Standard (1.0, 1.0) · `large`=Complex (1.58, 1.45).

**`qualityOptions` (3 rows):** `essential` (0.82, 0.9) · `standard` (1.0, 1.0) · `premium` (1.38, 1.2).

**`USD_RATES` (20 currencies, sample):** `USD 1, CAD 1.37, GBP 0.75, AED 3.67, PKR 280,
INR 88, AUD 1.52, EUR 0.86, SGD 1.29, NGN 1500, JPY 148, CNY 7.1, KRW 1400, BRL 5.4,
MXN 18.5, ZAR 17.5, SAR 3.75, CHF 0.8, SEK 9.4, NOK 10`.

**Static text blocks (also in `constants/index.ts`):**
- `scopeByCategory`: 4 bullet points per category (8 × 4 strings) → rendered as "Suggested scope of work".
- `assumptions`: 4 strings → first 3 rendered as "Key assumptions".

---

## 5. Inputs and Outputs

### 5.1 User inputs (client-side only; no server-side validation of these)

| Field | UI control | Type | Validation / limits | Default |
|---|---|---|---|---|
| Project description | `<textarea id="project-description">` in `Estimator.tsx:241` | string | sliced to **500 chars** on change; submit requires **≥ 12 trimmed chars** (`page.tsx:287`, `descriptionReady`); API path truncates to **1000 chars** | `""` |
| Category | `<select>` (`Estimator.tsx:264`) — 8 categories + optional "Your projects" optgroup of AI-generated custom types | enum `CategoryId` | must match a `categories[].id`, or `custom:<name>` | `web` |
| Location | `<select>` (`Estimator.tsx:371`) — 10 cities | enum `LocationId` | must match a `locations[].id`; picking it sets `locationSelectedManually=true` and clears currency override | `us` |
| Project size | 3 radio-style buttons (`Estimator.tsx:442`) — step 1 of 2 | enum `ProjectSizeId` | `small \| medium \| large` | `medium` |
| Quality | 3 radio-style buttons (`Estimator.tsx:487`) — step 2 of 2 | enum `QualityId` | `essential \| standard \| premium` | `standard` |
| Custom project description (Analyze) | text input, **currently commented out** (`Estimator.tsx:319-362`) | string | sliced to 200 chars | `""` |
| Quotation: From / Prepared for | text inputs in `QuoteModal.tsx:118,124` | string | none (fallback text if empty) | `"Your Company"` / `""` |
| Quotation line qty & rate | `<input type="number" min="0">` in `QuoteModal.tsx:159,171` | number | `Math.max(0, Number(value) \|\| 0)` | copied from estimate |

**Wizard stages** (`Stage` type): `describe` → `questions` (2 steps) → `complete`.
Auto-detection on submit: `detectCategory(description)` and, unless the user picked a location
manually, `detectLocation(description)`.

**Share input:** URL hash `#estimate=<url-encoded JSON>` of `SharedEstimate`
(`description, categoryId, locationId, sizeId, qualityId`) is parsed on load (`page.tsx:139`).

### 5.2 Estimate output shape (`types/index.ts:58` `EstimateResult`)

```ts
interface EstimateItem { name: string; detail: string; quantity: number; rate: number }

interface EstimateResult {
  projectTitle: string;
  description: string;
  category: Category;      // full category object (id, name, base, hours, weeks, …)
  location: Location;      // full location object (country, city, currency, multiplier, taxRate)
  size: ProjectSize;       // id, name, description, example, multiplier, weekFactor
  quality: QualityOption;  // id, name, description, multiplier, weekFactor
  items: EstimateItem[];   // exactly 5 fixed workstreams
  subtotal: number;
  contingency: number;     // 5 %
  taxes: number;           // location.taxRate applied to (subtotal + contingency)
  total: number;
  low: number;             // total × 0.88
  high: number;            // total × 1.17
  confidence: number;      // 80–94
  durationMin: number;     // weeks
  durationMax: number;     // weeks
}
```

**Real sample output** (computed by running the actual code, see §9 for the inputs):

```json
{
  "projectTitle": "Ecommerce",
  "items": [
    { "name": "Discovery & strategy",  "detail": "Requirements, research and project plan",    "quantity": 1,   "rate": 1517, "amount": 1517 },
    { "name": "UX & UI design",        "detail": "Wireframes, interface design and prototype", "quantity": 28,  "rate": 62,   "amount": 1736 },
    { "name": "Development",           "detail": "Responsive build, features and integrations","quantity": 152, "rate": 30,   "amount": 4560 },
    { "name": "Quality assurance",     "detail": "Testing, fixes and launch checks",           "quantity": 28,  "rate": 62,   "amount": 1736 },
    { "name": "Project management",    "detail": "Communication, coordination and handover",   "quantity": 16,  "rate": 81,   "amount": 1296 }
  ],
  "subtotal": 10845,
  "contingency": 542,
  "taxes": 2277,
  "total": 13664,
  "low": 12024,
  "high": 15987,
  "confidence": 92,
  "durationMin": 8,
  "durationMax": 13,
  "currency": "GBP",
  "formattedTotal": "£13,664"
}
```

**UI rendering of the result** (`EstimateResult.tsx`): dark "Expected investment" card with
Low / Typical / High + range bar, confidence % bar, scope & quality chips, "Cost breakdown"
per-item bars with `% of work costs`, contingency + taxes rows, "Suggested scope of work"
(4 static bullets), "Key assumptions" (3 of 4 static bullets), CTA to build a quotation, and a
fixed disclaimer paragraph.

### 5.3 Reports / exports

| Export | Mechanism | File/tech |
|---|---|---|
| **PDF** | `QuoteModal.printQuote()` → adds `printing-quote` class to `<body>` → `window.print()` | Pure CSS `@media print` + `@page { size: A4; margin: 12mm; }` in `app/globals.css:160-205`; no PDF library |
| **Shareable link** | `page.tsx:381 shareEstimate()` → copies `location.href + #estimate=<JSON>` to clipboard (falls back to `window.prompt`) | No server, no short URL, no persistence |
| **Save / history** | `localStorage` keys `costcalc-history` (max **50** entries), `costcalc-latest-estimate`, `customProjectTypes` | No account, device-local only |
| Excel / CSV / email | **None** | — |

---

## 6. API Endpoints / Routes

There is exactly **one** route handler in the project.

### `POST /api/estimates`
File: `app/api/estimates/route.ts`

**Request**
```json
{ "description": "tyre shop with online booking and stock tracking" }
```
- `description` must be a non-empty string (trimmed), otherwise `400`.
- Malformed body → `400 { "error": "Invalid request body." }`.
- The description is truncated to 1000 chars before being put in the prompt.

**Success response — `200`**
```json
{
  "name": "Short project title (max 8 words)",
  "type": "web | mobile | ecommerce | design | seo | social | branding | ai",
  "features": ["feature 1", "feature 2"],
  "complexity": "small | medium | large",
  "summary": "One or two sentences summarizing the project."
}
```
Server-side sanitization (`parseAnalysis`, route.ts:40): `name` ≤ 80 chars (fallback
`"Custom project"`), `type` must be a valid category id (fallback `"web"`), `features` ≤ 12
strings each ≤ 120 chars, `complexity` must be `small|medium|large` (fallback `"medium"`),
`summary` ≤ 400 chars.

**Error responses** (all `{ "error": string }`)

| Status | Condition |
|---|---|
| 400 | invalid body / missing description |
| 405 | `GET /api/estimates` |
| 500 | `GEMINI_API_KEY` missing → `"AI analysis is not configured on this server."` |
| 500 | fetch/parse exception → `"Could not analyze your project. Please try again."` |
| 502 | upstream non-OK, empty text, or unparseable JSON |

**Upstream call:** raw `fetch()` (no SDK) to
`https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}`
with `responseMimeType: "application/json"`, `temperature: 0.4`.

**Consumer:** `page.tsx:226 analyzeCustomProject()` → stores the returned type in
`customProjectTypes` (localStorage), sets category/complexity/title override, and shows
`customSummary`. **But the UI button that triggers it is commented out** (§11).

**No other routes exist.** Everything else (`#services`, `#how-it-works`, `#why-costcalc`,
`#estimator`, `#estimate-result`, `#top`) is a client-side hash anchor, not a route.
There is no auth, no rate limiting, no CORS config, no logging.

---

## 7. Where AI Should Be Added

### Existing AI/LLM integration
**Yes — Google Gemini, already live in code (but only reachable in `next dev`/server mode):**
- `app/api/estimates/route.ts` — single prompt, JSON-mode, temperature 0.4, hand-rolled JSON
  extraction (`extractJson` strips code fences) and validation (`parseAnalysis`).
- Env: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.0-flash`).
- **This file is the natural place to swap in the Claude API** — it already has the exact
  contract (input `{description}` → sanitized JSON), the error mapping and the client caller.
  Recommended: keep the response shape, replace the `fetch` + `extractText` with the Anthropic
  SDK (`@anthropic-ai/sdk`) using `messages.create` with a strict JSON output prompt, and keep
  `parseAnalysis()` as the validator.

### Suggested integration points (best → nice-to-have)

| # | Feature | Exact file / function | Notes |
|---|---|---|---|
| 1 | **Replace/parallel Gemini with Claude** for project analysis | `app/api/estimates/route.ts` → `POST()` (lines 88-155) | Drop-in: same request/response contract; caller `page.tsx:226 analyzeCustomProject()` needs no change |
| 2 | **Re-enable the custom-project UI** that calls #1 | `components/home/Estimator.tsx:319-362` (commented JSX block); props `onAnalyzeCustom`, `analyzing`, `customDescription`, `customSummary` are already threaded through `Hero` → `Estimator` and `page.tsx:561` | The whole backend path is dead until this is uncommented |
| 3 | **AI-generated scope of work + assumptions** (currently static) | `constants/index.ts:250 scopeByCategory`, `:301 assumptions` → rendered in `components/home/EstimateResult.tsx:287` and `:307` | Add a new route (e.g. `app/api/scope/route.ts`) or extend `/api/estimates`; replace static bullets with generated ones keyed by `category.id` |
| 4 | **Estimate explanation / summary paragraph** ("why this price") | New field on `EstimateResult` (`types/index.ts:58`), rendered in `EstimateResult.tsx` near the total card (line ~80-143) | Purely additive; the deterministic math must stay in `lib/index.ts` |
| 5 | **Quotation cover note / terms text** | `components/quotation/QuoteModal.tsx` (static footer at lines 221-225, "Valid for 30 days…") | Generate per-project terms/payment schedule |
| 6 | **Better category & location detection** | `lib/index.ts:48 detectCategory()`, `:114 detectLocation()` — currently brittle keyword lists, evaluated in array order (see §11 quirk) | Could be folded into the #1 Claude call, removing the heuristics |
| 7 | **Chat / follow-up Q&A about the estimate** (README §6 Step 3-4) | New component + route; state would live in `app/page.tsx` | Not started |

### Architectural rule to respect (from README §8)
> "AI will be used to understand descriptions, extract requirements, generate tasks, prepare
> scope of work, explain results and write quotation content. **The rule-based pricing engine
> is responsible for cost calculations, regional rates, currency conversion, taxes,
> percentages, min/max ranges, confidence score and mathematical accuracy.**"
> — i.e. **Claude must never invent the numbers.** Always compute totals with
> `calculateEstimate()` and let the model produce text/structure around them.

### Before integrating
- Resolve the `output: 'export'` vs POST-route conflict (§2) — otherwise Claude calls will
  404/405 on the deployed Pages site.
- Add rate limiting / abuse protection: `/api/estimates` currently has none and would bill
  the Anthropic key on every request.
- Never expose `ANTHROPIC_API_KEY` to the browser — keep calls in route handlers only.

---

## 8. Environment and Config

**Environment variables used (names only):**

| Variable | Used in | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `app/api/estimates/route.ts:104` | Google Generative Language API key (value `[REDACTED]`; not present in repo) |
| `GEMINI_MODEL` | `app/api/estimates/route.ts:10` | Model id, defaults to `gemini-2.0-flash` |

No other `process.env` references exist. No `NEXT_PUBLIC_*` vars.

- **`.env` file: none present** (checked for `.env`, `.env.local`, `.env.*` → nothing).
  Presumably the developer exports `GEMINI_API_KEY` manually or the feature simply returns 500.
- **`.gitignore`: yes, present**, but it only ignores `.env*.local` — **plain `.env` is *not*
  ignored** (risk: a future `.env` with keys could be committed). It does ignore
  `/node_modules`, `/.next/`, `/out/`, `/build`, `*.tsbuildinfo`, `next-env.d.ts`, `.vercel`,
  `*.pem`, npm/yarn logs, `/coverage`.
- **No secrets, keys, tokens or passwords are committed anywhere in the repo** (grep over the
  whole tree found only the two `process.env` references above).
- CI config `.gitlab-ci.yml`: image `node:22.14.0`, `npm ci`, `npm run build`, publishes `out/`
  to GitLab Pages on the default branch only. No env vars injected in CI.
- Path alias: `@/*` → project root (`tsconfig.json`).

---

## 9. Sample Data (few-shot examples)

All three outputs below were produced by **running the real `calculateEstimate()` code**, not
by hand. Default selections are used unless noted; `low = total×0.88`, `high = total×1.17`,
`contingency = 5 %`, `tax = location.taxRate × (subtotal+contingency)`, all rounded to whole
currency units.

### Example A — small, essential, Canada

**Input**
```json
{
  "description": "I need a responsive business website with a modern design, contact form and basic SEO for my bakery in Toronto.",
  "locationId": "ca",
  "sizeId": "small",
  "qualityId": "essential"
}
```
Auto-detection: `detectCategory()` → **`seo`** (the keyword list checks `seo` before `web`),
`detectLocation()` → `ca`.

**Expected output**
```json
{
  "projectTitle": "SEO",
  "category": "seo", "location": "ca", "size": "small", "quality": "essential",
  "currency": "CAD", "taxRate": 0.13, "locationMultiplier": 1.0,
  "items": [
    { "name": "Discovery & strategy", "quantity": 1,  "rate": 238, "amount": 238 },
    { "name": "UX & UI design",       "quantity": 28, "rate": 10,  "amount": 280 },
    { "name": "Development",          "quantity": 43, "rate": 17,  "amount": 731 },
    { "name": "Quality assurance",    "quantity": 28, "rate": 10,  "amount": 280 },
    { "name": "Project management",   "quantity": 16, "rate": 13,  "amount": 208 }
  ],
  "subtotal": 1737, "contingency": 87, "taxes": 237, "total": 2061,
  "low": 1814, "high": 2411,
  "confidence": 91, "durationMin": 2, "durationMax": 2,
  "formattedTotal": "CA$2,061"
}
```

### Example B — large, premium, United Kingdom

**Input**
```json
{
  "description": "I need an ecommerce website for a clothing brand with online payments, customer accounts and about 500 products in London.",
  "categoryId": "ecommerce",
  "locationId": "uk",
  "sizeId": "large",
  "qualityId": "premium"
}
```

**Expected output**
```json
{
  "projectTitle": "Ecommerce",
  "items": [
    { "name": "Discovery & strategy", "quantity": 1,   "rate": 1517, "amount": 1517 },
    { "name": "UX & UI design",       "quantity": 28,  "rate": 62,   "amount": 1736 },
    { "name": "Development",          "quantity": 152, "rate": 30,   "amount": 4560 },
    { "name": "Quality assurance",    "quantity": 28,  "rate": 62,   "amount": 1736 },
    { "name": "Project management",   "quantity": 16,  "rate": 81,   "amount": 1296 }
  ],
  "subtotal": 10845, "contingency": 542, "taxes": 2277, "total": 13664,
  "low": 12024, "high": 15987,
  "confidence": 92, "durationMin": 8, "durationMax": 13,
  "currency": "GBP", "taxRate": 0.20, "locationMultiplier": 0.92,
  "formattedTotal": "£13,664", "formattedLow": "£12,024", "formattedHigh": "£15,987"
}
```
*(workings: 7200 × 0.92 × 1.58 × 1.38 = USD 14,297.6 → ×0.75 GBP = 10,723 pre-rounding;
per-line rounding then yields subtotal 10,845 — rounding drift is expected.)*

### Example C — medium, standard, United Arab Emirates

**Input**
```json
{
  "description": "I need a cross-platform fitness app with user profiles, subscriptions and progress tracking in Dubai.",
  "categoryId": "mobile",
  "locationId": "ae",
  "sizeId": "medium",
  "qualityId": "standard"
}
```

**Expected output**
```json
{
  "projectTitle": "Mobile app",
  "items": [
    { "name": "Discovery & strategy", "quantity": 1,   "rate": 5136, "amount": 5136 },
    { "name": "UX & UI design",       "quantity": 28,  "rate": 210,  "amount": 5880 },
    { "name": "Development",          "quantity": 211, "rate": 73,   "amount": 15403 },
    { "name": "Quality assurance",    "quantity": 28,  "rate": 210,  "amount": 5880 },
    { "name": "Project management",   "quantity": 16,  "rate": 275,  "amount": 4400 }
  ],
  "subtotal": 36699, "contingency": 1835, "taxes": 1927, "total": 40461,
  "low": 35606, "high": 47339,
  "confidence": 90, "durationMin": 6, "durationMax": 10,
  "currency": "AED", "taxRate": 0.05, "locationMultiplier": 1.02,
  "formattedTotal": "AED 40,461"
}
```
*(note: the description is 96 chars > 76, so `getProjectTitle()` falls back to the category
short name `"Mobile app"` instead of using the description.)*

---

## 10. Business Rules and Constraints

**Pricing / math (must be reproduced exactly by any AI-assisted path):**
1. All money is **rounded to whole units** — `Math.round`, `maximumFractionDigits: 0`. Never
   emit decimals/cents in totals.
2. Contingency is a **fixed 5 %** of subtotal. Tax is `location.taxRate` applied to
   `(subtotal + contingency)` — never to subtotal alone.
3. Range is **fixed −12 % / +17 %** (`low = ×0.88`, `high = ×1.17`).
4. Confidence is **clamped to 80–94 %** and is currently a function of description length only.
5. Computation order: USD first → convert with static `USD_RATES` → round per line item →
   re-sum. Do not "fix" the rounding drift; totals shown in the UI must match this code path.
6. FX rates are **static snapshots**, not live — never present them as real-time rates.
7. The 5 line-item names, details and share ratios (14/16/42/16/12) are fixed for every
   category; quantity comes from `category.hours` (only the Development row uses hours).
8. Timeline = `category.weeks × size.weekFactor × quality.weekFactor`, then ±20 %,
   floored at 1 and 2 weeks respectively.

**Supported enumerations (the AI must only produce values from these sets):**
- 8 categories: `web, mobile, ecommerce, design, seo, social, branding, ai`
- 10 locations: `us, ca, uk, ae, pk, in, au, de, sg, ng`
- 3 sizes: `small, medium, large` · 3 qualities: `essential, standard, premium`
- 20 currencies: `USD, CAD, GBP, AED, PKR, INR, AUD, EUR, SGD, NGN, JPY, CNY, KRW, BRL,
  MXN, ZAR, SAR, CHF, SEK, NOK`
- Tax rates are **region-fixed** (e.g. UK 20 %, Germany 19 %, India 18 %, US 8.875 %,
  UAE 5 %) — do not invent tax rules per request.

**Input limits (server must enforce, client already does):**
- description ≤ 500 chars in UI, ≤ 1000 chars sent to the AI route, ≥ 12 chars to start.
- AI `name` ≤ 80 chars, ≤ 12 `features` × ≤ 120 chars, `summary` ≤ 400 chars.

**Presentation / legal:**
- The result page must keep the disclaimer: *"preliminary market estimate … not a legally
  binding quotation. Final prices may change after professional review."*
- Quotation: valid **30 days**, may require a **50 % deposit**, quotation number is currently
  hard-coded `QF-2026-0248`.
- Copy is English, tone is direct/marketing; UI colors are hard-coded hex values (brand purple
  `#6754e7`, dark `#1c1923`), no theme system.

**Never do:**
- Never let an LLM output the monetary figures (README §8: model = language, engine = math).
- Never commit or log API keys; never put keys in `NEXT_PUBLIC_*` or client components.
- Never write to a database (there is none) — persistence is device-local `localStorage`.
- Never store user data server-side: the UI promises *"Your description stays private and is
  never shared"* and *"Private by default"* (`Estimator.tsx:415, 604`).
- No rate limiting exists yet — add one before adding paid Claude calls.

---

## 11. Known Issues and Missing Parts

**Bugs / errors**
1. **TypeScript build error** — `app/page.tsx:584` passes `isGenerating` to `<Hero/>`, but
   `EstimatorProps` (`components/home/Estimator.tsx:26`) does not declare it. Result of
   `npx tsc --noEmit`: `TS2322: Property 'isGenerating' does not exist on type 'EstimatorProps'`.
   (`npm run lint` passes; `next build` apparently tolerates it.)
2. **`/api/estimates` cannot work in production** — `output: 'export'` + `dynamic = "force-static"`.
   On the deployed GitLab Pages site the POST endpoint is not available; the custom-project
   analysis will fail with a network/405 error.
3. **Dead feature: the "Analyze" UI is commented out** — `components/home/Estimator.tsx:319-362`
   contains the whole "Describe your own project" input + Analyze button inside a JSX comment.
   `onAnalyzeCustom`, `analyzing`, `customDescription`, `customSummary` are still wired from
   `page.tsx` but nothing can trigger them.
4. **Category detection order bug** — `detectCategory()` returns the *first* matching keyword
   group in array order, so *"…basic SEO"* forces category `seo` even when the user clearly
   wants a website (Example A). `detectLocation()` similarly defaults to `us`.
5. **Quotation "Download PDF" is only `window.print()`** — works, but no file naming, no
   server-side PDF, no email/share link, no logo upload, no multiple templates (all listed as
   requirements in README §10).
6. **Hard-coded strings that will age badly**: quotation number `QF-2026-0248`, *"Pricing data
   updated September 2026"* (`EstimateResult.tsx:195`), fixed `range` labels in `categories`
   that do not match computed values.
7. **Encoding issue**: `app/layout.tsx` title/description contains a broken em dash
   (`"CostCalc �?" AI Project Cost Estimator`) — file is not valid UTF-8 for that glyph.
8. **Empty / stray files**: an empty `cost-calc/` directory and an unrelated
   `woocommerce-country-currency-switcher.php` WordPress plugin at repo root.
9. **No `.env` file and `.gitignore` does not ignore plain `.env`** (only `.env*.local`).

**Missing (specified in README but not implemented)**
- No database, no auth, no user/provider/admin dashboards, no saved-estimate sync,
  no provider quotations/marketplace, no payments/subscriptions, no admin-editable rate cards,
  no SEO pages, no analytics, no i18n (English only), no tests, no rate limiting.
- Categories beyond digital services (home services, construction, events) — Phase 2-4.
- Historical data / feedback loop ("was this estimate helpful?") — README §9.
- Confidence score is a description-length heuristic, not a real uncertainty model.
- No API versioning, no request logging, no error monitoring (Sentry etc.).

**Comments/TODOs in code:** none found (no `TODO`/`FIXME`/`HACK` markers). Several comments
are in Romanized Urdu/Hindi (e.g. `page.tsx:329 "Nayi estimate generate hote hi auto-save
draft mein"`, `:410`, `:430`, `:486`) — they explain the auto-save/convert-draft logic.

**Working commands**
```bash
npm ci          # install
npm run dev     # dev server (the only mode where /api/estimates works today)
npm run lint    # ✅ passes clean
npx tsc --noEmit  # ❌ 1 error (issue #1)
npm run build   # static export to out/
```
