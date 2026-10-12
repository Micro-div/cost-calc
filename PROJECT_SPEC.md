# PROJECT SPEC — CostWise

> **Single source of truth** for designers, developers, and AI agents building the CostWise website.
> Anything not defined here must be proposed as a change request before implementation.
> Every unknown is written as **(Assumption)** and is safe to override with a decision recorded in this file.

| Field | Value |
|---|---|
| Product name | CostWise **(Assumption)** — placeholder; the repo is `cost-calc` |
| Tagline | "Type it. Price it. Plan it." |
| Version | 1.0.0 |
| Status | Approved for build |
| Last updated | 2026-10-12 |
| Default currency | PKR (switchable to USD) |
| Default locale | `en` (English); UI copy is English-only v1 |
| Design language | Controlled Glassmorphism on a clean solid base |
| Primary platform | Responsive web (mobile-first) |

---

## 1. Overview

### 1.1 Purpose
CostWise lets anyone describe **anything they want to build, buy, start, or do** — a website, an online shop, a physical shop, a wedding, a house renovation, a mobile app, a trip — and instantly returns:

1. A **total estimated cost** as a **min–max range** with a point estimate.
2. A **breakdown of 5–6 main cost items** (what each part costs, in currency and percent).
3. A **chart** of that breakdown.
4. Options to **save, share, and download** the result as a PDF.

The estimate adapts to three user choices: **Online vs Physical**, **Budget level (Low/Medium/High)**, and **Location/City**.

### 1.2 Target users
| Persona | Need | Primary device |
|---|---|---|
| Individual / household ("I want to renovate my kitchen") | Rough budget before talking to vendors | Mobile |
| Student ("I want to build a final-year app") | Cheap, quick ballpark | Mobile |
| Small business owner ("I want to open a shop") | Compare online vs physical cost | Mobile + Desktop |
| Startup founder ("I want an MVP + branding") | Investor-ready cost range + shareable link | Desktop |

**Market:** Pakistan-first. Default currency **PKR**; **USD** toggle for international comparisons.

### 1.3 Goals
- **G1 — Speed:** first useful estimate in ≤ 6 s on 4G; instant (< 300 ms) when a cached/fallback match exists.
- **G2 — Clarity:** total + breakdown readable at a glance; no financial jargon.
- **G3 — Confidence:** show min–max range, assumptions, and sources so users trust the number.
- **G4 — Shareability:** every estimate is a shareable URL and a downloadable PDF.
- **G5 — Accessibility:** WCAG 2.1 AA minimum everywhere; works on low-end Android.
- **G6 — Resilience:** if the AI API is down, a predefined cost dataset still returns a usable estimate.

### 1.4 Non-goals (v1)
- No user accounts / login. History is local to the browser.
- No vendor marketplace, no real quotes, no payments.
- No live currency forex API (fixed rate, see §7.9) **(Assumption)**.
- No multi-language UI (English only v1).

### 1.5 Global assumptions
| # | Assumption |
|---|---|
| A1 | AI estimation is exposed via one server endpoint `POST /api/estimate`; the model returns *inputs/shares*, the app computes totals. |
| A2 | Fallback: a curated static dataset in `constants/costData.ts` keyed by item class + mode. |
| A3 | 1 USD = 280 PKR (fixed) for v1. |
| A4 | Budget multipliers: Low ×0.7, Medium ×1.0, High ×1.6. |
| A5 | City multipliers come from a fixed table `constants/cities.ts` (see §7.6). |
| A6 | "5–6 items" means **exactly 6 for most items**, collapsed to 5 when two items are trivial. Never fewer than 5, never more than 6. |
| A7 | Chart library: **Recharts** (donut + bar). A plain HTML table is always the accessible equivalent. |
| A8 | PDF: **print stylesheet + `window.print()`** is the primary path; `html2canvas` + `jsPDF` is the optional "instant download" path. |
| A9 | No auth; history stored in `localStorage` (max 20 entries). |
| A10 | Light mode is default; dark mode via `prefers-color-scheme` + manual toggle. |

---

## 2. Sitemap & Pages

### 2.1 Sitemap
```
/
├─ /                      Home (hero + estimate form)
├─ /result/[id]           Result (total + breakdown + chart + actions)
├─ /how-it-works          How It Works
├─ /about                 About
├─ /contact               Contact
├─ /history               Estimate History (client-side)   (Assumption: could be a drawer instead)
└─ /404                   Not Found
```

### 2.2 Page table
| # | Page | Route | Purpose | Key sections | Glass used? |
|---|---|---|---|---|---|
| 1 | Home | `/` | Capture the item + preferences, start an estimate | Navbar (glass), Hero, **Estimate form card (glass)**, "Popular" chips, How-it-works teaser, Trust strip, Footer | Yes — navbar + form card |
| 2 | Result | `/result/[id]` | Show total + breakdown + chart + actions | Navbar, **Total card (glass)**, **6 breakdown cards (glass)**, Chart, Assumptions, Sources, Actions (Save/Share/PDF), Related | Yes — total + breakdown cards only |
| 3 | How It Works | `/how-it-works` | Explain the method & trust | Navbar, solid hero, 4-step process, data sources, FAQ, CTA, Footer | Only navbar |
| 4 | About | `/about` | Who we are, mission, disclaimer | Navbar, solid hero, mission, team, disclaimer, FAQ, Footer | Only navbar |
| 5 | Contact | `/contact` | Support + feedback | Navbar, solid hero, **contact form (solid)**, business info, map (optional), Footer | Only navbar |
| 6 | History | `/history` | List past estimates | Navbar, solid table/list, empty state, clear-all, Footer | Only navbar |
| 7 | Not Found | `/404` | Recover from bad URL | Solid centered card, search field, home link | No |

### 2.3 Global chrome
- **Navbar** is on every page; **Footer** on every page except 404.
- A **Toast host** and a **Modal host** are mounted once in `app/layout.tsx`.
- Background **gradient mesh + blobs** render once at the root (`PageShell`) so glass has something to blur.

---

## 3. User Flows

Notation: `→` screen change, `⚙` system action, `⏳` loading, `⚠` error, `✅` success.

### 3.1 Flow A — Enter any item and get an estimate (primary)
1. User lands on `/`. Hero headline + estimate form card visible above the fold.
2. Types in the **search/input field** (e.g. "ecommerce website"). Debounced suggestions appear after 250 ms (max 8).
3. Selects a suggestion **or** submits free text.
4. Chooses **Online / Physical** (segmented toggle, default Online).
5. Chooses **Budget:** Low / Medium / High (default Medium).
6. Types **City** (autocomplete; default "Lahore").
7. Chooses **Currency:** PKR / USD (default PKR).
8. Presses **Estimate cost**.
   - ⚙ Validate (§7.4). If invalid → inline errors, stop.
   - ⏳ Button → disabled + spinner; form card dims 40%; skeleton result section appears; toast "Estimating…".
   - ⚙ `POST /api/estimate`.
   - ✅ Success → navigate to `/result/[id]`; total **counts up 800 ms**.
   - ⚠ Error → inline alert in the card + **Retry**; if fallback data exists, show fallback result with a "based on saved data" badge (see §7.3).
9. On result page user reads total + breakdown + chart, then can save/share/download.

### 3.2 Flow B — Switch Online ⇄ Physical
1. On Home form or Result page, user changes the segmented toggle.
2. On Home: if a result already exists (returning user), show a subtle inline note "Breakdown will change" — do **not** auto-submit.
3. On Result: changing the toggle **re-runs** the estimate for the same item (keeps budget/city/currency), shows loading, replaces total + breakdown with a cross-fade (200 ms).
4. The item names in the breakdown change per mode (see §7.5).

### 3.3 Flow C — Change budget level
1. Segmented control Low / Medium / High.
2. On Result, changing it re-runs immediately (same pattern as Flow B).
3. Total and all item amounts scale by the multiplier (A4); percentages stay ~the same.

### 3.4 Flow D — Change city/location
1. City input with autocomplete from `constants/cities.ts`.
2. Unknown city → still allowed; uses country default multiplier (Pakistan = 1.0) and shows a chip "Using country average".
3. On Result, re-runs with the new city multiplier (A5).

### 3.5 Flow E — Read the result
1. Page loads `/result/[id]`; skeleton first if data not cached.
2. **Total card** shows range `PKR 285,000 – 420,000` with point estimate in giant tabular numbers.
3. **Breakdown grid**: 6 glass cards, each with icon, label, amount, percent, mini progress bar.
4. **Chart**: donut by default; toggle to bar.
5. **Assumptions** list + **Sources** links below (solid surfaces).
6. **Action bar**: Save · Share · Download PDF · Start over.

### 3.6 Flow F — Save to history
1. User presses **Save**.
2. ⚙ Writes to `localStorage` key `costwise:history:v1` (max 20; oldest evicted).
3. ✅ Toast "Saved to history" + button becomes "Saved ✓". Save is idempotent by `id`.

### 3.7 Flow G — Share
1. User presses **Share**.
2. If `navigator.share` exists (mobile) → native share sheet with URL.
3. Else → copy `/result/[id]` to clipboard; toast "Link copied".
4. Shared URL must reproduce the estimate without re-calling the AI if the payload is encoded **(Assumption: payload compressed into the id and validated server-side)**.

### 3.8 Flow H — Download PDF
1. User presses **Download PDF**.
2. Primary: open a print-optimized view and call `window.print()` (user picks "Save as PDF").
3. Optional "instant" path: `html2canvas` → `jsPDF` → `costwise-<item>-<date>.pdf`.
4. Filename sanitized: lowercase, spaces→`-`, max 60 chars.

### 3.9 Flow I — Contact
1. `/contact` → form: Name, Email, Subject (select), Message, Consent checkbox.
2. Validate (§7.4). Submit → `POST /api/contact`.
3. ⏳ spinner on button; ✅ success replaces form with confirmation card; ⚠ error shows inline alert + keeps input.

### 3.10 Flow J — Return / history
1. Navbar "History" → `/history`.
2. Lists saved estimates (item, mode, total range, date). Click → `/result/[id]`.
3. Empty state if none. "Clear all" asks confirmation modal.

---

## 4. Design System

### 4.1 Color palette

#### 4.1.1 Brand & semantic
| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-primary` | `#6366F1` | `#818CF8` | Accents, links, focus rings, chart series 1 |
| `--color-primary-strong` | `#4F46E5` | `#6366F1` | **Button backgrounds with white text** (AA safe, §10.1) |
| `--color-accent` | `#14B8A6` | `#2DD4BF` | Highlights, chart series 2 |
| `--color-accent-strong` | `#0F766E` | `#14B8A6` | Accent text/buttons with white text |
| `--color-success` | `#22C55E` | `#4ADE80` | Positive deltas, success badge bg |
| `--color-success-text` | `#15803D` | `#4ADE80` | Success text on light surfaces |
| `--color-danger` | `#EF4444` | `#F87171` | Errors, destructive |
| `--color-danger-strong` | `#B91C1C` | `#EF4444` | Danger buttons with white text |
| `--color-warning` | `#F59E0B` | `#FBBF24` | Warnings, "assumption" callouts |

#### 4.1.2 Surfaces & text
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-base` | `#F7F8FC` | `#0B1020` | Solid page base behind the gradient |
| `--grad-1` | `#EEF2FF` | `#0F172A` | Gradient mesh start |
| `--grad-2` | `#F5F3FF` | `#6D28D9` | Gradient mesh mid |
| `--grad-3` | `#ECFEFF` | `#0EA5E9` | Gradient mesh end |
| `--blob-a` | `#C7D2FE` | `#7C3AED` | Blurred blob 1 |
| `--blob-b` | `#99F6E4` | `#0EA5E9` | Blurred blob 2 |
| `--blob-c` | `#DDD6FE` | `#4F46E5` | Blurred blob 3 |
| `--surface` | `#FFFFFF` | `#111827` | Solid card (where glass is NOT used) |
| `--surface-2` | `#F3F4F6` | `#1F2937` | Inset/secondary solid |
| `--text-strong` | `#0F172A` | `#FFFFFF` | Headings, amounts |
| `--text` | `#1E293B` | `#E5E7EB` | Body |
| `--text-muted` | `#64748B` | `#94A3B8` | Captions, meta |
| `--border` | `#E2E8F0` | `#334155` | Solid borders/dividers |
| `--focus-ring` | `#4F46E5` | `#A5B4FC` | 2px outline + 2px offset |

#### 4.1.3 Glass tokens
| Token | Light | Dark |
|---|---|---|
| `--glass-bg` | `rgba(255,255,255,0.65)` | `rgba(255,255,255,0.15)` |
| `--glass-bg-hover` | `rgba(255,255,255,0.78)` | `rgba(255,255,255,0.22)` |
| `--glass-border` | `1px solid rgba(255,255,255,0.55)` | `1px solid rgba(255,255,255,0.25)` |
| `--glass-blur` | `blur(12px) saturate(140%)` | `blur(12px) saturate(140%)` |
| `--glass-blur-mobile` | `blur(8px) saturate(140%)` | `blur(8px) saturate(140%)` |
| `--glass-shadow` | `0 8px 32px rgba(31,38,135,0.20)` | `0 8px 32px rgba(0,0,0,0.45)` |
| `--glass-fallback` | `rgba(255,255,255,0.92)` | `rgba(15,23,42,0.85)` |

> In **light mode**, the border is more opaque (`0.55`) and background lighter (`0.65`) to keep text contrast ≥ 4.5:1 over the pale gradient. If any measured contrast < 4.5:1, raise `--glass-bg` opacity in steps of `0.05` until it passes (§10.1).

### 4.2 Typography
- **UI font:** `Inter` (fallback `Poppins`, then `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`).
- **Amounts/numerals:** Inter with `font-variant-numeric: tabular-nums;` and weight 700.
- Base body **minimum 16px**.

| Token | Size (rem / px) | Weight | Line height | Letter spacing | Use |
|---|---|---|---|---|---|
| `--text-display` | `3.5rem / 56px` | 700 | 1.05 | `-0.02em` | Hero headline |
| `--text-h1` | `2.5rem / 40px` | 700 | 1.15 | `-0.02em` | Page titles |
| `--text-h2` | `1.75rem / 28px` | 700 | 1.25 | `-0.01em` | Section titles |
| `--text-h3` | `1.25rem / 20px` | 600 | 1.35 | `0` | Card titles |
| `--text-lg` | `1.125rem / 18px` | 400–500 | 1.6 | `0` | Lead paragraphs |
| `--text-body` | `1rem / 16px` | 400 | 1.6 | `0` | Body |
| `--text-sm` | `0.875rem / 14px` | 500 | 1.5 | `0` | Labels, meta |
| `--text-xs` | `0.75rem / 12px` | 600 | 1.4 | `0.01em` | Badges, captions |
| `--text-amount` | `3rem / 48px` | 700 | 1.0 | `-0.02em` | Total amount |
| `--text-amount-sm` | `1.375rem / 22px` | 700 | 1.1 | `-0.01em` | Breakdown amounts |

Rules:
- Never set body text below 16px.
- Long paragraphs max width **68ch**.
- Amounts always tabular; never on glass without a high-contrast backing (see §4.1.2 note & §10.1).

### 4.3 Spacing, grid, breakpoints
- **Spacing scale (8px base):** `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` px → tokens `--space-1..12`.
- **Container:** `max-width: 1200px`, horizontal padding `20px` mobile, `28px` ≥640, `40px` ≥1024.
- **Gutters:** 16px mobile, 24px desktop.
- **Grid:** 12-column desktop, 8-column tablet, 4-column mobile.

| Breakpoint | Token | Range | Columns | Container |
|---|---|---|---|---|
| Mobile S | `--bp-xs` | 0–479px | 4 | fluid |
| Mobile L | `--bp-sm` | 480–767px | 4 | fluid, pad 20px |
| Tablet | `--bp-md` | 768–1023px | 8 | 720px |
| Desktop | `--bp-lg` | 1024–1279px | 12 | 960px |
| Desktop XL | `--bp-xl` | ≥1280px | 12 | 1200px |

### 4.4 Radius, shadows, blur
| Token | Value | Use |
|---|---|---|
| `--radius-card` | `16px` | Glass/solid cards |
| `--radius-input` | `12px` | Inputs, buttons, selects |
| `--radius-pill` | `999px` | Segmented controls, chips, badges |
| `--radius-sm` | `8px` | Small chips, inner rows |
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,0.06)` | Subtle solid cards |
| `--shadow-md` | `0 4px 12px rgba(15,23,42,0.10)` | Dropdowns, popovers |
| `--shadow-glass` | `0 8px 32px rgba(31,38,135,0.20)` | All glass surfaces |
| `--shadow-glow` | `0 0 0 4px rgba(99,102,241,0.18), 0 8px 24px rgba(99,102,241,0.30)` | Button hover |
| `--blur-glass` | `blur(12px) saturate(140%)` | Desktop glass |
| `--blur-glass-mobile` | `blur(8px) saturate(140%)` | ≤767px |
| `--blur-blob` | `blur(64px)` | Decorative background blobs |

### 4.5 Icons & imagery
- **Icons:** `lucide-react`, stroke width **2**, sizes `16 / 20 / 24 / 32px`. Icon color inherits `currentColor`.
- **Breakdown icons (fixed set):** `palette` (design), `code-2` (development), `wrench` (setup/labor), `package` (materials/stock), `megaphone` (marketing), `shield-check` (ops/maintenance), `truck` (logistics), `graduation-cap` (training), `receipt` (fees/permits), `server` (hosting).
- **Imagery:** no stock-photo collages. Prefer **abstract gradient shapes**, simple 2-tone line illustrations, and product screenshots in a browser frame. Any photo must be `WebP`, ≤ 200 KB, `loading="lazy"`, explicit width/height.
- **Empty/IQ illustration:** single-line abstract, 2 colors (primary + accent), 160×160.

---

## 5. Component Library

Conventions:
- Class prefix **`cw-`**.
- Every interactive component: **default / hover / active / focus-visible / disabled** states.
- Focus style everywhere: `outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: inherit;`
- Motion uses §8 tokens; respects `prefers-reduced-motion`.
- **No nested glass.** A glass card never contains another backdrop-filter element.

### 5.1 Navbar (Glass)
- **Style:** glass bar, sticky top, full width.
- **Anatomy:** logo (left) · nav links (center) · currency toggle + theme toggle + "Estimate" button (right) · mobile: logo + hamburger.
- **CSS:**
```css
.cw-nav {
  position: sticky; top: 0; z-index: var(--z-nav);
  height: 64px; display: flex; align-items: center;
  padding-inline: var(--space-5);
  background: var(--glass-bg);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-bottom: var(--glass-border);
  box-shadow: var(--glass-shadow);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .cw-nav { background: var(--glass-fallback); }
}
.cw-nav__link { color: var(--text); padding: 8px 12px; border-radius: var(--radius-input); transition: background 200ms ease-out; }
.cw-nav__link:hover { background: var(--glass-bg-hover); }
.cw-nav__link[aria-current="page"] { color: var(--color-primary-strong); font-weight: 600; }
```
- **States:** default / hover (bg tint) / active (press 60ms) / focus-visible (ring) / scrolled (adds `--shadow-glass` once `scrollY > 8`). Disabled: n/a.
- **Mobile:** ≤767px collapses links into a full-screen **solid** sheet (`--surface`), NOT glass (perf + readability).

### 5.2 Footer (Solid)
- **Style:** solid `--surface` or `--bg-base`, top border `--border`; never glass.
- **Columns:** brand+blurb · Product · Company · Legal. Bottom row: copyright + currency note.
- **Links:** `color: var(--text-muted)` → hover `var(--color-primary-strong)`; focus ring; underline on hover.

### 5.3 Buttons
| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| Primary | `--color-primary-strong` | `#FFFFFF` | none | `--shadow-glow`, translateY(-1px) |
| Secondary | transparent | `--text-strong` | `1px solid var(--border)` | `--surface-2` bg |
| Ghost | transparent | `--color-primary-strong` | none | `rgba(99,102,241,0.08)` bg |
| Destructive | `--color-danger-strong` | `#FFFFFF` | none | darken 6%, glow red |
| Icon | transparent | `--text` | none | `--surface-2` bg |

```css
.cw-btn {
  --h: 44px;
  height: var(--h); padding-inline: 20px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font: 600 15px/1 Inter, sans-serif;
  border-radius: var(--radius-input);
  transition: transform 200ms ease-out, box-shadow 200ms ease-out, background 200ms ease-out;
  cursor: pointer;
}
.cw-btn--primary { background: var(--color-primary-strong); color: #fff; }
.cw-btn--primary:hover { box-shadow: var(--shadow-glow); transform: translateY(-1px); }
.cw-btn--primary:active { transform: translateY(0); }
.cw-btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.cw-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
.cw-btn--lg { --h: 52px; padding-inline: 28px; font-size: 16px; }
.cw-btn--sm { --h: 36px; padding-inline: 14px; font-size: 14px; }
```
- **Loading state:** spinner replaces leading icon; `aria-busy="true"`; label stays (e.g. "Estimating…").

### 5.4 GlassCard (base primitive)
```css
.cw-glass {
  background: var(--glass-bg);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: var(--glass-border);
  border-radius: var(--radius-card);
  box-shadow: var(--glass-shadow);
  color: var(--text-strong);
  transition: transform 200ms ease-out, background 200ms ease-out, box-shadow 200ms ease-out;
}
.cw-glass--interactive:hover { transform: translateY(-4px); background: var(--glass-bg-hover); }
@media (max-width: 767px) {
  .cw-glass { -webkit-backdrop-filter: var(--glass-blur-mobile); backdrop-filter: var(--glass-blur-mobile); }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .cw-glass { background: var(--glass-fallback); }
}
```
- States: default / hover (lift 4px) / focus-within (ring) / disabled (n/a).
- **Count guard:** ≤ 6 `.cw-glass` elements visible at once (§11).

### 5.5 Estimate Form (glass card on Home)
- **Anatomy (vertical stack):** label → search input + submit → segmented Online/Physical → budget segmented → city autocomplete → currency toggle → primary CTA.
- **Search input:**
```css
.cw-field {
  height: 48px; width: 100%;
  background: rgba(255,255,255,0.85);
  border: 1px solid var(--border);
  border-radius: var(--radius-input);
  padding-inline: 14px 44px; /* room for icon */
  font-size: 16px; color: var(--text-strong);
}
.cw-field:hover { border-color: #CBD5E1; }
.cw-field:focus { outline: none; border-color: var(--color-primary-strong); box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
.cw-field[aria-invalid="true"] { border-color: var(--color-danger); box-shadow: 0 0 0 4px rgba(239,68,68,0.15); }
.cw-field:disabled { background: var(--surface-2); opacity: .6; }
```
- **Segmented control (Online/Physical, Budget):** pill container, sliding thumb.
```css
.cw-seg { display: inline-flex; padding: 4px; gap: 4px; background: rgba(255,255,255,0.55); border-radius: var(--radius-pill); border: 1px solid var(--border); }
.cw-seg__opt { position: relative; z-index: 1; padding: 8px 16px; border-radius: var(--radius-pill); font-weight: 600; color: var(--text); }
.cw-seg__opt[aria-checked="true"] { color: #fff; }
.cw-seg__thumb { position: absolute; inset: 4px auto 4px 4px; background: var(--color-primary-strong); border-radius: var(--radius-pill); transition: transform 200ms ease-out, width 200ms ease-out; }
```
- **Suggestion dropdown:** solid `--surface`, `--shadow-md`, max 8 items, keyboard-navigable.
- **Validation:** see §7.4. Errors render under the field in `--color-danger-strong`, 13px, with `role="alert"`.

### 5.6 Breakdown Card (glass)
- **Anatomy:** icon (32) · label (+ optional `detail` caption) · **amount** (tabular, right-aligned) · percent badge · progress bar (share of total).
- **CSS:**
```css
.cw-breakdown { padding: 20px; display: grid; gap: 12px; }
.cw-breakdown__amount { font-size: var(--text-amount-sm); font-weight: 700; font-variant-numeric: tabular-nums; }
.cw-breakdown__bar { height: 8px; border-radius: 999px; background: rgba(15,23,42,0.12); overflow: hidden; }
.cw-breakdown__fill { height: 100%; background: linear-gradient(90deg, var(--color-primary), var(--color-accent)); transition: width 800ms ease-out; }
```
- Morphism: **glass**, interactive (lift 4px on hover). Percent shows `48%`.

### 5.7 Total Card (glass)
- **Anatomy:** item name · mode/budget/city chips · giant range + point · confidence note ("Estimates are a range").
- Range line: `PKR 285,000 – 420,000`; point: `≈ PKR 350,000`.
- Count-up animation 800 ms (§8). Numbers tabular, `--text-amount`.
- High-contrast backing: a `rgba(0,0,0,0.20)` inner plaque OR `--glass-bg` opacity raised until ratio ≥ 4.5:1.

### 5.8 Chart
- **Donut** (default): 6 slices, palette = primary, accent, + 4 derived hues (`#8B5CF6`, `#0EA5E9`, `#F59E0B`, `#10B981`).
- **Bar** (toggle): horizontal, sorted desc.
- Legend = label + amount + percent. Accessible equivalent: a visually-hidden `<table>`.
- Hover slice → tooltip `{label}: {amount} ({percent}%)`.
- No animation if reduced motion.

### 5.9 Modal
- **Style: SOLID** (`--surface`), **never glass**. Overlay `rgba(15,23,42,0.55)`.
- Radius 16px, `--shadow-md`, max-width 480px, padding 24px.
- Traps focus; `Esc` closes; returns focus to trigger. Used by: confirm clear-history, PDF options, share fallback.

### 5.10 Alert & Toast
- **Inline alert:** solid tinted surface.
  - info: bg `#EEF2FF`, border `#C7D2FE`, text `#3730A3`.
  - success: bg `#DCFCE7`, border `#86EFAC`, text `#15803D`.
  - warning: bg `#FEF3C7`, border `#FCD34D`, text `#92400E`.
  - danger: bg `#FEE2E2`, border `#FCA5A5`, text `#B91C1C`.
  - Each has icon + title + message + optional action. `role="alert"` for danger/warning.
- **Toast:** bottom-right, solid `--surface`, 4px left bar in semantic color, auto-dismiss `4000ms`, max 3 stacked, pause on hover/focus.

### 5.11 Table (History, sources, assumptions)
- Solid `--surface`. Header `--text-sm` 600, row dividers `--border`.
- Zebra optional `--surface-2` at 40%.
- Numeric columns right-aligned, tabular.
- Mobile: transform to stacked cards (< 640px).
- Row actions: open, delete (icon buttons).

### 5.12 Chips / Badges
- Pill, `--radius-pill`, height 24–28px, padding 8px 10px, `--text-xs`.
- Variants: neutral (`--surface-2`), mode-online (primary tint), mode-physical (accent tint), budget (warning tint), success.
- Removable chip: trailing × button, 16px.

### 5.13 Skeleton & Empty State
- **Skeleton:** `--surface-2` blocks with shimmer:
```css
@keyframes cw-shimmer { 100% { background-position: 200% 0; } }
.cw-skeleton { background: linear-gradient(90deg,#EEF2F7 25%,#E2E8F0 37%,#EEF2F7 63%); background-size: 200% 100%; animation: cw-shimmer 1.4s ease-in-out infinite; border-radius: 12px; }
```
- **Empty state:** illustration + title + one-sentence help + primary CTA.

---

## 6. Page-by-Page UI Layout

Legend: sections listed top→bottom. Glass only where marked.

### 6.1 Home `/`
| Order | Section | Content | Desktop (≥1024) | Tablet (768–1023) | Mobile (<768) |
|---|---|---|---|---|---|
| 1 | Navbar (glass) | logo, links, currency, theme, CTA | full | full | logo + hamburger |
| 2 | Hero (solid bg + blobs) | H1 "Know what anything costs.", sub, trust chips | H1 56px, centered, max 16ch lines | H1 40px | H1 32px |
| 3 | **Estimate form (glass)** | search, mode seg, budget seg, city, currency, CTA | card 720px centered | 100% 640px | 100%, sticky CTA |
| 4 | Popular chips | "ecommerce website", "wedding", "house renovation", "mobile app", "grocery shop", "trip" | row, 6 | wrap | 2 rows scroll-x |
| 5 | How-it-works teaser | 3 steps, icons | 3 cols | 3 cols compact | stacked |
| 6 | Trust strip (solid) | "AI + curated data", "PKR & USD", "Free" | 3 cols | 3 cols | stacked |
| 7 | Footer (solid) | see §5.2 | 4 cols | 2 cols | accordion/stacked |

### 6.2 Result `/result/[id]`
| Order | Section | Content | Notes |
|---|---|---|---|
| 1 | Navbar (glass) | + "Back to estimate" | |
| 2 | Breadcrumb (solid) | Home / Result | |
| 3 | **Total card (glass)** | item, chips, range, point, count-up, confidence | full-width, max 900px |
| 4 | **Breakdown grid (glass ×6)** | 6 cards | desktop 3×2, tablet 2×3, mobile 1×6 |
| 5 | Chart (solid card) | donut/bar toggle + legend | 2-col: chart + legend (desktop) |
| 6 | Assumptions (solid) | bullet list | max 68ch |
| 7 | Sources (solid) | links (if any) | |
| 8 | Action bar (solid, sticky mobile) | Save · Share · PDF · Start over | |
| 9 | Related items (solid) | 3 suggestion chips | |
| 10 | Footer (solid) | | |

### 6.3 How It Works `/how-it-works`
Solid hero → 4 steps (Describe → Choose mode → AI + data estimate → Breakdown & share) → "What's in the number" (labor, materials, tools, marketing, fees, contingency) → Data sources → FAQ (accordion) → CTA → Footer. **No glass except navbar.**

### 6.4 About `/about`
Solid hero → Mission → How estimates are made (brief) → Team (avatars) → **Disclaimer** (estimates are indicative, not quotes) → FAQ → Footer. No glass except navbar.

### 6.5 Contact `/contact`
Solid hero → **Contact form (solid)**: Name, Email, Subject(select), Message, Consent → Submit → Success card. Right column (desktop): email, response time, socials. Optional map (lazy). No glass except navbar.

### 6.6 History `/history`
Solid header + "Clear all" → solid table/list of saved estimates → empty state → Footer. No glass except navbar.

### 6.7 404
Solid centered card: "We couldn't find that page." Search input + "Go home". No navbar glass needed (still render navbar for consistency, glass allowed = 1).

---

## 7. Functionality & Working

### 7.1 Input model
| Field | Type | Default | Required | Notes |
|---|---|---|---|---|
| `item` | string | — | ✅ | 3–120 chars, free text or suggestion |
| `mode` | `"online" \| "physical"` | `online` | ✅ | segmented |
| `budget` | `"low" \| "medium" \| "high"` | `medium` | ✅ | segmented |
| `city` | string | `Lahore` | ✅ | autocomplete; unknown allowed |
| `currency` | `"PKR" \| "USD"` | `PKR` | ✅ | toggle |
| `locale` | string | `en` | ➖ | reserved |

### 7.2 API contract — `POST /api/estimate`
Request:
```json
{
  "item": "ecommerce website",
  "mode": "online",
  "budget": "medium",
  "city": "Lahore",
  "currency": "PKR"
}
```
Response `200`:
```json
{
  "id": "est_8f3a12c9",
  "item": "ecommerce website",
  "mode": "online",
  "budget": "medium",
  "city": "Lahore",
  "currency": "PKR",
  "provider": "ai",
  "total": { "min": 285000, "max": 420000, "point": 350000 },
  "breakdown": [
    { "id": "design",  "label": "UI/UX Design",       "amount": 63000, "percent": 18, "share": 0.18, "icon": "palette",    "detail": "Wireframes, visual design, prototype" },
    { "id": "dev",     "label": "Development",         "amount": 126000,"percent": 36, "share": 0.36, "icon": "code-2",     "detail": "Frontend, backend, integrations" },
    { "id": "content", "label": "Content & Catalog",   "amount": 42000, "percent": 12, "share": 0.12, "icon": "package",    "detail": "Product upload, copywriting" },
    { "id": "marketing","label": "Marketing Launch",   "amount": 49000, "percent": 14, "share": 0.14, "icon": "megaphone",  "detail": "Ads, SEO baseline" },
    { "id": "hosting", "label": "Hosting & Tools",     "amount": 28000, "percent": 8,  "share": 0.08, "icon": "server",     "detail": "12 months hosting, domains, SaaS" },
    { "id": "buffer",  "label": "Contingency (12%)",   "amount": 42000, "percent": 12, "share": 0.12, "icon": "shield-check","detail": "Change requests, overruns" }
  ],
  "assumptions": ["Prices for a mid-level freelancer/agency in Pakistan.", "6-month delivery window."],
  "sources": [{ "title": "Local agency rate survey", "url": "https://example.com" }],
  "generatedAt": "2026-10-12T10:20:00Z"
}
```
Error `4xx/5xx`:
```json
{ "error": "Unable to estimate right now", "code": "estimate_failed", "retryable": true }
```
Also: `GET /api/estimate/[id]` (cached/reproducible payload) and `POST /api/contact`.

### 7.3 Estimation logic
1. Validate input (§7.4).
2. Try AI: send item + mode + budget + city to the model; the model returns **shares and notes**, never a raw final price.
3. If AI fails/timeouts (> 8 s) → use **fallback dataset** matched by item keywords + mode (`constants/costData.ts`). Mark `provider: "fallback"`.
4. Normalize shares so `Σ share = 1` and there are exactly **5–6** items (merge the two smallest if > 6; split "General" if < 5).
5. Compute:
   - `point = baseItemCost × budgetMult × cityMult`
   - `item.amount = round(point × share)` (round to nearest 500 PKR / nearest 5 USD)
   - `min = round(point × 0.82)`, `max = round(point × 1.20)`
6. Convert currency if `USD`: `amount_usd = round(amount_pkr / 280)`.
7. Persist payload under `id` for share/PDF/history.

### 7.4 Validation
| Field | Rule | Message |
|---|---|---|
| item | non-empty after trim, 3–120 chars | "Tell us what you want to estimate (at least 3 characters)." |
| item | must not be only numbers/symbols | "Please describe the item in words." |
| mode/budget/currency | one of allowed values | "Choose an option." |
| city | ≤ 60 chars | "City name is too long." |
| contact email | RFC-5322-lite regex | "Enter a valid email address." |
| contact message | 10–2000 chars | "Message must be at least 10 characters." |
| consent | checked | "Please accept the privacy notice." |

Validation runs on submit; after first submit, field validates on blur. Errors announced via `role="alert"`.

### 7.5 Mode effect on breakdown
| Breakdown slot | Online | Physical |
|---|---|---|
| 1 | UI/UX & Brand | Site & Interiors |
| 2 | Development | Equipment & Fit-out |
| 3 | Content & Catalog | Inventory / Stock |
| 4 | Marketing (digital) | Marketing (local) |
| 5 | Hosting & Tools | Utilities, Rent & Licenses |
| 6 | Contingency | Labor & Contingency |
Shares differ per mode (e.g. physical puts more weight on equipment/inventory/rent; online on development/marketing). Item count stays 5–6.

### 7.6 City multipliers (Assumption)
| City | Mult | | City | Mult |
|---|---|---|---|---|
| Karachi | 1.10 | | Rawalpindi | 1.00 |
| Lahore | 1.00 | | Faisalabad | 0.92 |
| Islamabad | 1.15 | | Multan | 0.90 |
| Peshawar | 0.90 | | Quetta | 0.88 |
| Unknown (PK) | 1.00 | | Non-PK | 1.25 |

Country default = 1.0. Unknown city → show chip "Using country average".

### 7.7 Loading states
- Form submit → CTA spinner, form `aria-busy`, skeleton result section, toast "Estimating…".
- Result load → skeleton total card + 6 skeleton breakdown cards + skeleton chart.
- Contact submit → button spinner, fields disabled.
- Never block the whole page; overlay only on the estimate card for ≤ 6 s.

### 7.8 Error states
- **Validation:** inline under field; scroll + focus first invalid.
- **API error:** inline alert in the estimate card: "We couldn't reach the estimator. Retry, or we'll use saved rates." with **Retry** and **Use saved rates** buttons.
- **Offline:** banner "You're offline — showing saved rates." Fallback dataset used.
- **404 result id:** "This estimate has expired." → CTA to Home.
- **Rate limited (429):** toast "Too many requests. Please wait a moment." auto-retry disabled.

### 7.9 Currency
- Fixed rate 1 USD = 280 PKR (A3). Display symbol `₨` for PKR, `$` for USD.
- Formatting: `Intl.NumberFormat('en-PK'|'en-US', { maximumFractionDigits: 0 })`, thousands separators.
- Toggle re-renders instantly by converting stored PKR base (no re-fetch).

### 7.10 Save / History
- `localStorage["costwise:history:v1"]` = array of `{ id, item, mode, budget, city, currency, total, savedAt }`, max 20, newest first.
- Save is idempotent by `id`. History page reads it; "Clear all" uses confirm modal.

### 7.11 Share
- Build `${origin}/result/${id}`. `navigator.share` if available else clipboard + toast.
- The result page reads the payload from cache/API; an unknown id → "expired" state.

### 7.12 Download PDF
- Primary: print stylesheet (hide navbar/chart controls, show a clean header, force light colors, `page-break-inside: avoid` on cards) + `window.print()`.
- Optional: `html2canvas` + `jsPDF` "Download now".
- Filename: `costwise-<slug(item)>-<YYYYMMDD>.pdf`.

### 7.13 Empty states
- History empty: illustration + "No estimates yet" + CTA "Create your first estimate".
- No suggestions: "No match — press Enter to estimate anyway."
- No sources: hide the Sources block entirely.

### 7.14 Rate limits & caching (Assumption)
- `/api/estimate`: 10 requests / minute / IP.
- Cache identical `{item,mode,budget,city}` for 24 h server-side.
- Client keeps last 20 results in memory for instant back/forward.

---

## 8. Animations & Interactions

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | `100ms` | Press feedback |
| `--dur-fast` | `200ms` | Hover, toggle, focus |
| `--dur-base` | `300ms` | Reveal, modal |
| `--dur-slow` | `800ms` | Count-up, progress fill |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances, hover |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Position slides |

| Interaction | Detail |
|---|---|
| Card hover | `translateY(-4px)` + `--glass-bg-hover`, `200ms --ease-out` |
| Card focus-within | focus ring; same lift |
| Button hover | `--shadow-glow` + `translateY(-1px)`, `200ms` |
| Button press | `translateY(0)`, `100ms` |
| Total count-up | 0 → point over `800ms`, `--ease-out`, tabular |
| Breakdown bar | width 0 → share over `800ms`, staggered `60ms` |
| Chart draw | donut arc sweep `600ms`; bar grow `600ms` |
| Section reveal | opacity 0→1 + translateY(12px→0), `300ms`, once on scroll (IntersectionObserver, threshold 0.15) |
| Segmented thumb | transform/width `200ms --ease-out` |
| Modal | overlay fade `200ms`; panel scale `0.96→1` + fade `300ms` |
| Toast | slide-in from right `300ms`, auto-out `200ms` |
| Page/route change | cross-fade `200ms` (View Transitions API where supported) |
| Skeleton | shimmer `1.4s` infinite |

**Reduced motion:** wrap all of the above in `@media (prefers-reduced-motion: no-preference)` or, when JS-driven, gate on `matchMedia('(prefers-reduced-motion: reduce)').matches`. When reduced: no transforms, no count-up (show final number immediately), no shimmer (static gray), instant reveals.

---

## 9. Responsive Behavior

| Element | < 768px | 768–1023px | ≥ 1024px |
|---|---|---|---|
| Navbar | logo + hamburger; links in solid sheet | full links, tighter padding | full links, 64px height |
| Glass blur | `8px` | `12px` | `12px` |
| Hero H1 | 32px | 40px | 56px |
| Estimate form | full-width card, sticky CTA bottom | 640px centered | 720px centered |
| Breakdown grid | 1 column | 2 columns | 3 columns |
| Chart + legend | stacked | stacked | 2 columns |
| Total card | range wraps to 2 lines | single line | single line |
| Tables | stacked cards | table | table |
| Action bar | sticky bottom, icon+label | inline | inline |
| Background blobs | 2 blobs | 3 blobs | 3 blobs |
| Max glass visible | 4 | 5 | 6 |

Also: reduce decorative blob size/blur below 768px; disable backdrop-filter animations on low-end (feature flag `navigator.hardwareConcurrency <= 4` → use fallback surface on hero form only, keep navbar glass).

---

## 10. Accessibility

### 10.1 Contrast (WCAG 2.1 AA; normal text ≥ 4.5:1, large/UI ≥ 3:1)
| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `#0F172A` text | light glass `rgba(255,255,255,0.65)` over pale gradient | ≈ 13.4:1 | ✅ |
| `#FFFFFF` text | dark glass `rgba(255,255,255,0.15)` over `#0F172A` | ≈ 12.8:1 | ✅ |
| `#FFFFFF` | `--color-primary` `#6366F1` | ≈ 4.46:1 | ⚠ fails — **use `--color-primary-strong` `#4F46E5`** ≈ 6.3:1 |
| `#FFFFFF` | `--color-accent` `#14B8A6` | ≈ 2.49:1 | ❌ never for text — use `#0F766E` ≈ 5.5:1 |
| `#FFFFFF` | `--color-success-text` `#15803D` | ≈ 5.0:1 | ✅ |
| `#FFFFFF` | `--color-danger-strong` `#B91C1C` | ≈ 6.5:1 | ✅ |

**Rule:** if any measured contrast on glass < 4.5:1, raise `--glass-bg` opacity by `0.05` steps until it passes. Amounts/totals must always sit on a ≥ 4.5:1 surface.

### 10.2 Keyboard navigation
- All interactive elements reachable in DOM order; visible focus ring (`--focus-ring`, 2px, offset 2px).
- Navbar: `Tab` through; mobile sheet traps focus and closes on `Esc`.
- Search: `↑/↓` move suggestions, `Enter` select, `Esc` close.
- Segmented controls are `role="radiogroup"` with `←/→` (and `↑/↓`) to change, `Space/Enter` to select.
- Modal: focus trap, `Esc` to close, restore focus to trigger.
- Skip link "Skip to content" as first focusable element.

### 10.3 ARIA
| Element | Attribute |
|---|---|
| Navbar | `<nav aria-label="Primary">` |
| Mobile menu button | `aria-expanded`, `aria-controls` |
| Search input | `aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant` |
| Suggestions | `role="listbox"` + `role="option"` |
| Segmented | `role="radiogroup"` + `role="radio"` + `aria-checked` |
| Total live region | `aria-live="polite"` announcing the final total once |
| Chart | `role="img"` + `aria-label` summary; hidden `<table>` equivalent |
| Loading | `aria-busy="true"`, `role="status"` |
| Alerts | `role="alert"` for errors/warnings |
| Modal | `role="dialog"` `aria-modal="true"` `aria-labelledby` |
| Toasts | `role="status"` container |

### 10.4 Other
- Respect `prefers-reduced-motion` (§8) and `prefers-color-scheme`.
- Hit targets ≥ 44×44px.
- Form errors tied with `aria-describedby`.
- Language: `<html lang="en">`.
- Text zoom to 200% without loss of content.

---

## 11. Performance Guidelines

- **Glass budget:** max **6** `.cw-glass` elements visible at once; **no nested glass**; no `backdrop-filter` on large scrolling areas (body, footer, long lists, tables).
- Blur: `12px` desktop, `8px` mobile. Avoid animating `backdrop-filter` itself (animate transform/opacity instead).
- Shadows: reuse named tokens; avoid stacking multiple large shadows on one element.
- **Fallback:** always include the `@supports not (backdrop-filter)` rule → solid `--glass-fallback` (dark `rgba(15,23,42,0.85)`, light `rgba(255,255,255,0.92)`).
- Images: WebP/AVIF, `width`+`height` set, `loading="lazy"`, `decoding="async"`; hero image `fetchpriority="high"`. Decorative images `aria-hidden` + CSS backgrounds.
- Code: route-level code splitting; chart library lazy-loaded (`next/dynamic`) only on the result page; icons tree-shaken (import per-icon).
- Fonts: self-host, `font-display: swap`, preload the 600/700 weights only.
- Budgets (Assumption): LCP < 2.5 s on 4G, CLS < 0.1, INP < 200 ms, First-Load JS < 180 KB gzip (chart excluded), Lighthouse perf ≥ 90.
- Reduce motion / low-end: detect `hardwareConcurrency <= 4` or `saveData` → drop blobs and hero glass to solid.

---

## 12. Tech Stack & Folder Structure

### 12.1 Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router)** + React 19 | SSR/SEO, API routes, image optimization |
| Language | **TypeScript** (strict) | Safety across estimate math |
| Styling | **CSS Modules + CSS variables** (design tokens) | No runtime cost; glass needs raw CSS control |
| State (client) | React hooks + `localStorage` | Small scope; no Redux |
| Icons | `lucide-react` | Consistent 2px stroke set |
| Charts | `recharts` (lazy) | Donut/bar, accessible |
| PDF | print stylesheet + `window.print()`; optional `jspdf` + `html2canvas` | Reliability |
| Validation | `zod` | Shared client/server schemas |
| AI | Server route calling an LLM (model-agnostic) | Returns shares/notes, app computes totals |
| Deploy | Vercel (Node runtime for API routes) | Functions for `/api/*` |
| Tests | Vitest (units: math, currency, validation) + Playwright (flows) | Confidence |

### 12.2 Folder structure
```
costwise/
├─ app/
│  ├─ layout.tsx                # tokens, fonts, PageShell, Toast/Modal hosts
│  ├─ globals.css               # base + tokens import
│  ├─ page.tsx                  # Home
│  ├─ result/[id]/page.tsx
│  ├─ how-it-works/page.tsx
│  ├─ about/page.tsx
│  ├─ contact/page.tsx
│  ├─ history/page.tsx
│  ├─ not-found.tsx
│  └─ api/
│     ├─ estimate/route.ts      # POST create, GET list
│     ├─ estimate/[id]/route.ts # GET one
│     └─ contact/route.ts       # POST
├─ components/
│  ├─ layout/    Navbar.tsx  Footer.tsx  PageShell.tsx  BackgroundMesh.tsx
│  ├─ home/      Hero.tsx  EstimateForm.tsx  PopularChips.tsx  HowTeaser.tsx
│  ├─ result/    TotalCard.tsx  BreakdownGrid.tsx  BreakdownCard.tsx  BreakdownChart.tsx  ActionBar.tsx
│  ├─ ui/        Button.tsx  GlassCard.tsx  Field.tsx  Segmented.tsx  CityAutocomplete.tsx
│  │             Modal.tsx  Toast.tsx  Alert.tsx  Table.tsx  Badge.tsx  Skeleton.tsx  EmptyState.tsx
│  └─ common/    Icon.tsx  CountUp.tsx  Reveal.tsx  CurrencyTsx
├─ lib/
│  ├─ estimate.ts   # computeTotal, normalizeShares
│  ├─ currency.ts   # convert, format
│  ├─ validation.ts # zod schemas
│  ├─ storage.ts    # history read/write
│  ├─ format.ts     # slug, date, number
│  └─ api.ts        # fetch wrappers
├─ constants/
│  ├─ cities.ts  budget.ts  breakdown.ts  costData.ts  nav.ts  modes.ts
├─ types/index.ts
├─ styles/tokens.css
└─ public/ (og.png, favicon.ico, illustrations/*.svg)
```

### 12.3 Naming conventions
- Components: `PascalCase.tsx` (one exported component per file).
- Hooks: `useThing.ts`, called as `useThing()`.
- Utilities/constants exports: `camelCase`; constant maps/values: `UPPER_SNAKE_CASE`.
- Types/interfaces: `PascalCase`; no `I` prefix. Props type = `ComponentNameProps`.
- CSS classes: `cw-block__element--modifier`.
- API payload keys: `camelCase`; error codes `snake_case`.
- Files for tests: `*.test.ts` / `*.spec.ts` next to source or in `tests/`.

### 12.4 Environment variables
| Name | Required | Notes |
|---|---|---|
| `AI_API_KEY` | ✅ (server) | LLM key; **never** `NEXT_PUBLIC_` |
| `AI_MODEL` | ➖ | e.g. a fast model id |
| `AI_BASE_URL` | ➖ | custom endpoint |
| `CONTACT_WEBHOOK_URL` | ➖ | where contact submissions go |
| `NEXT_PUBLIC_SITE_URL` | ✅ | for share links/OG |

---

## 13. CSS Variables / Design Tokens

Copy into `styles/tokens.css` and import once in `app/globals.css`.

```css
:root {
  /* ---- Typography ---- */
  --font-ui: Inter, Poppins, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --text-display: 3.5rem;  --text-h1: 2.5rem;  --text-h2: 1.75rem;  --text-h3: 1.25rem;
  --text-lg: 1.125rem;     --text-body: 1rem;   --text-sm: 0.875rem; --text-xs: 0.75rem;
  --text-amount: 3rem;     --text-amount-sm: 1.375rem;
  --lh-tight: 1.05; --lh-snug: 1.25; --lh-normal: 1.6;
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700;

  /* ---- Spacing (8px base) ---- */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px;  --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px; --space-24: 96px;

  /* ---- Radius ---- */
  --radius-sm: 8px; --radius-input: 12px; --radius-card: 16px; --radius-pill: 999px;

  /* ---- Brand & semantic ---- */
  --color-primary: #6366F1;
  --color-primary-strong: #4F46E5;
  --color-accent: #14B8A6;
  --color-accent-strong: #0F766E;
  --color-success: #22C55E;
  --color-success-text: #15803D;
  --color-danger: #EF4444;
  --color-danger-strong: #B91C1C;
  --color-warning: #F59E0B;

  /* ---- Surfaces & text (LIGHT) ---- */
  --bg-base: #F7F8FC;
  --surface: #FFFFFF;
  --surface-2: #F3F4F6;
  --text-strong: #0F172A;
  --text: #1E293B;
  --text-muted: #64748B;
  --border: #E2E8F0;
  --focus-ring: #4F46E5;

  /* ---- Gradient mesh ---- */
  --grad-1: #EEF2FF; --grad-2: #F5F3FF; --grad-3: #ECFEFF;
  --blob-a: #C7D2FE; --blob-b: #99F6E4; --blob-c: #DDD6FE;

  /* ---- Glass ---- */
  --glass-bg: rgba(255,255,255,0.65);
  --glass-bg-hover: rgba(255,255,255,0.78);
  --glass-border: 1px solid rgba(255,255,255,0.55);
  --glass-blur: blur(12px) saturate(140%);
  --glass-blur-mobile: blur(8px) saturate(140%);
  --glass-shadow: 0 8px 32px rgba(31,38,135,0.20);
  --glass-fallback: rgba(255,255,255,0.92);

  /* ---- Shadows ---- */
  --shadow-sm: 0 1px 2px rgba(15,23,42,0.06);
  --shadow-md: 0 4px 12px rgba(15,23,42,0.10);
  --shadow-glow: 0 0 0 4px rgba(99,102,241,0.18), 0 8px 24px rgba(99,102,241,0.30);
  --blur-blob: blur(64px);

  /* ---- Motion ---- */
  --dur-instant: 100ms; --dur-fast: 200ms; --dur-base: 300ms; --dur-slow: 800ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* ---- Layout ---- */
  --container: 1200px; --nav-h: 64px; --bp-md: 768px; --bp-lg: 1024px; --bp-xl: 1280px;

  /* ---- Z-index ---- */
  --z-base: 1; --z-dropdown: 20; --z-sticky: 40; --z-nav: 50; --z-modal: 100; --z-toast: 110;
}

/* Optional manual dark theme; also auto-applied via prefers-color-scheme */
[data-theme="dark"] {
  --color-primary: #818CF8;
  --color-primary-strong: #6366F1;
  --color-accent: #2DD4BF;
  --color-accent-strong: #14B8A6;
  --color-success: #4ADE80;
  --color-success-text: #4ADE80;
  --color-danger: #F87171;
  --color-danger-strong: #EF4444;

  --bg-base: #0B1020;
  --surface: #111827;
  --surface-2: #1F2937;
  --text-strong: #FFFFFF;
  --text: #E5E7EB;
  --text-muted: #94A3B8;
  --border: #334155;
  --focus-ring: #A5B4FC;

  --grad-1: #0F172A; --grad-2: #6D28D9; --grad-3: #0EA5E9;
  --blob-a: #7C3AED; --blob-b: #0EA5E9; --blob-c: #4F46E5;

  --glass-bg: rgba(255,255,255,0.15);
  --glass-bg-hover: rgba(255,255,255,0.22);
  --glass-border: 1px solid rgba(255,255,255,0.25);
  --glass-shadow: 0 8px 32px rgba(0,0,0,0.45);
  --glass-fallback: rgba(15,23,42,0.85);
}
```

Usage snippet (background mesh so glass has something to blur):
```css
.cw-mesh {
  position: fixed; inset: 0; z-index: -1;
  background:
    radial-gradient(40% 40% at 15% 20%, var(--blob-a), transparent 70%),
    radial-gradient(35% 35% at 85% 15%, var(--blob-b), transparent 70%),
    radial-gradient(45% 45% at 60% 85%, var(--blob-c), transparent 70%),
    linear-gradient(135deg, var(--grad-1), var(--grad-2) 55%, var(--grad-3));
}
.cw-mesh::after {
  content: ""; position: absolute; inset: -10%;
  background: inherit; filter: var(--blur-blob); opacity: .55;
}
```

---

## 14. Implementation Checklist

**Phase 0 — Foundations**
- [ ] Create Next.js 15 + TS strict project; enable App Router.
- [ ] Add `styles/tokens.css` from §13; import in `globals.css`.
- [ ] Add `Inter` (600/700 preloaded) with `font-display: swap`.
- [ ] Build `BackgroundMesh` (gradient + 2–3 blobs; 2 blobs on mobile).
- [ ] Add theme detection (`prefers-color-scheme`) + manual toggle persisted in `localStorage`.

**Phase 1 — Primitives**
- [ ] `GlassCard` with `@supports` fallback and mobile blur.
- [ ] `Button` (primary/secondary/ghost/destructive/icon; all states).
- [ ] `Field`, `Segmented`, `CityAutocomplete`, `Badge`, `Modal`, `Toast`, `Alert`.
- [ ] `Table`, `Skeleton`, `EmptyState`, `CountUp`, `Reveal`, `Icon`.

**Phase 2 — Home**
- [ ] `Navbar` (glass) + mobile solid sheet.
- [ ] `Hero` (solid) + `BackgroundMesh`.
- [ ] `EstimateForm` (glass): search + suggestions, mode seg, budget seg, city, currency, CTA with loading/disabled.
- [ ] `PopularChips`, `HowTeaser`, trust strip, `Footer`.
- [ ] Validation via `lib/validation.ts` (zod) with inline `role="alert"` errors.

**Phase 3 — Estimation engine**
- [ ] `POST /api/estimate` (zod, rate limit 10/min, 24 h cache).
- [ ] AI call returning shares/notes; 8 s timeout → fallback.
- [ ] `constants/costData.ts` fallback dataset (per item class × mode).
- [ ] `lib/estimate.ts`: normalize to 5–6 items, `Σ share = 1`, compute point/min/max, round.
- [ ] `lib/currency.ts`: PKR↔USD (280), `Intl` formatting, symbols.
- [ ] `GET /api/estimate/[id]` for share/refresh.

**Phase 4 — Result**
- [ ] `TotalCard` (glass) with count-up + `aria-live`.
- [ ] `BreakdownGrid` (glass ×6) + `BreakdownCard` with progress bars.
- [ ] `BreakdownChart` (lazy recharts donut/bar) + hidden accessible table.
- [ ] Assumptions + Sources blocks (solid).
- [ ] `ActionBar`: Save, Share, Download PDF, Start over.
- [ ] History read/write (`lib/storage.ts`), `/history` page + empty state + clear-all modal.
- [ ] Print stylesheet + PDF export.

**Phase 5 — Secondary pages**
- [ ] `/how-it-works`, `/about`, `/contact` (+ `POST /api/contact`), `/404`.
- [ ] SEO metadata, OG image, `NEXT_PUBLIC_SITE_URL` share links.

**Phase 6 — Motion, A11y, Performance**
- [ ] Wire §8 animations; gate everything behind `prefers-reduced-motion`.
- [ ] Keyboard nav for suggestions/segments/modal; skip link; focus rings.
- [ ] Verify contrast table §10.1 on real glass; raise opacity where needed.
- [ ] Enforce ≤ 6 glass elements; verify no nested glass; add `@supports` fallbacks.
- [ ] Lazy-load chart; audit Lighthouse (perf ≥ 90, a11y = 100); check LCP/CLS/INP budgets.

**Phase 7 — QA**
- [ ] Playwright: enter item → estimate → save → share → PDF → history.
- [ ] Playwright: mode switch and budget/city re-run.
- [ ] Test offline / API failure → fallback path.
- [ ] Test light/dark, reduced motion, 200% zoom, keyboard-only.

---

*End of spec. Changes to any value in this document require a version bump and a note in §1.5 or the relevant section.*
