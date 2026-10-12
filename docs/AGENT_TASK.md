# AGENT_TASK.md: CostCalc AI chatbot integration

You are a coding agent working inside a Next.js 15 (App Router, React 19, TypeScript strict, Tailwind 3) repo called **CostCalc**.
Read this whole file first. Then read `PROJECT_CONTEXT.md` (what the codebase is) and `INTEGRATION_GUIDE.md` (the plan; section 3 has code sketches).

A human will review your work afterwards. Accuracy and honesty matter more than speed.

---

## 0. ABSOLUTE RULES (never break these)

1. **Do NOT run any of:** `git commit`, `git push`, `git add`, `git switch`, `git reset`, `git clean`, `git stash`, `git rebase`, `git merge`, and no `git checkout` except the single allowed command in Step S (`git checkout -b feat/ai-chatbot`). Reading git (`git status`, `git diff`, `git log`) is fine. The human will commit.
2. **Do NOT deploy**, do not run `vercel`, do not touch GitHub/GitLab settings or CI files (`.gitlab-ci.yml` stays as is).
3. **Never create, edit, print or read** `.env`, `.env.local` or any file containing secrets. Never write an API key into code. Never use `NEXT_PUBLIC_` for secrets.
4. **Do NOT change pricing data or math:** values in `constants/index.ts` (categories, locations, sizes, quality, USD_RATES), the shares 14/16/42/16/12, contingency 5%, tax rule, range -12%/+17%, confidence formula, rounding. The numbers produced for the same input must stay **identical**.
5. **Do NOT rewrite these already-provided files.** Only fix a genuine compile/lint error in them, and report exactly what you changed and why:
   `app/api/_lib/ai.ts`, `app/api/chat/route.ts`, `app/api/estimate-params/route.ts`, `app/api/estimate-detail/route.ts`, `lib/chatbot/knowledge.ts`, `lib/chatbot/memory.ts`, `lib/chatbot/fallback.ts`, `lib/chatbot/types.ts`, `components/chatbot/ChatBot.tsx`, `components/home/AiEstimateDetail.tsx`.
6. **Do NOT touch** `README.md`, `public/`, or any file not listed in a step below. No drive-by refactors, no reformatting, no renaming, no import reordering in files you edit. Keep diffs small.
7. **Do NOT start long-running processes** (`npm run dev`, `npm start`). `lint`, `tsc` and `build` are fine.
8. Only new dependency allowed: `@anthropic-ai/sdk`. (Temporary `npx --yes tsx` for the verification script is also allowed.)
9. Deleting is allowed ONLY for the exact items in Step 2 and for the `costcalc-ai/` kit folder at the end of Step S. Before deleting a folder, list its contents and confirm they match what the step says. If anything differs, STOP and report.
10. **If a step is unclear, or the real code differs from what this file assumes, do not guess.** Write the question in the report, skip that step, and continue with the next independent step.
11. Work **one step at a time**. After each step: run `npx tsc --noEmit`, then **append** a section to `AGENT_REPORT.md` (see section 14). If you run out of budget, the report must show exactly where you stopped.

Shell note: the human uses Windows PowerShell. Use PowerShell-compatible commands (`Remove-Item`, `Get-ChildItem`), not bash-only ones.

---

## 0.5 Step S: Setup (you do this, the human does not)

The human put a folder named `costcalc-ai/` inside the repo root. It is a **ready-made kit**. Its inner structure mirrors the repo root. You are reading this file from inside it. These kit files are already written and reviewed: **do not edit their content** (rule 5).

1. Run `git status` and `git branch --show-current`.
   - If the branch is `main` or `master` and the only untracked item is `costcalc-ai/`, run **exactly** `git checkout -b feat/ai-chatbot` (the only allowed checkout).
   - If the branch is already `feat/ai-chatbot`, stay on it.
   - If there are other uncommitted changes or another branch name, do NOT switch. Write it in the report and continue on the current branch.
2. Copy the kit into the repo root **without overwriting anything**. PowerShell, from the repo root:
   `Copy-Item -Recurse -Path .\costcalc-ai\* -Destination . -ErrorAction Continue`
   (do NOT use `-Force`). Before copying, list kit files whose target path already exists in the repo; if any exist, do not overwrite them, and list them in the report as conflicts.
3. Verify every file from rule 5 exists at its real path, plus these in the repo root: `PROJECT_CONTEXT.md`, `INTEGRATION_GUIDE.md`, `AGENT_TASK.md`, `MANUAL_GUIDE.md`.
4. Only after step 3 passes, delete the kit folder `costcalc-ai/` (it must not stay inside the project, otherwise TypeScript compiles every file twice and reports false errors). Never delete anything else here.
5. Start `AGENT_REPORT.md` in the repo root and log Step S (branch result, conflicts, files copied).
6. From now on, read `AGENT_TASK.md` from the repo root.

`.env.local` (the API key) is the human's job and is NOT needed for your work. Never create or open it. `npm run lint`, `tsc` and `build` run without it.

---

## 1. Step 0: Preflight (read-only + baseline)

1. Run `git status` and `git branch --show-current`. Record both in the report. If the working tree has uncommitted changes other than the copied kit files, note it.
2. Confirm the provided files from rule 5 exist. List any missing.
3. Read these real files fully before editing: `app/page.tsx`, `components/home/Estimator.tsx`, `components/home/Hero.tsx`, `components/home/EstimateResult.tsx`, `components/quotation/QuoteModal.tsx`, `lib/index.ts`, `constants/index.ts`, `types/index.ts`, `app/layout.tsx`, `next.config.mjs`, `.gitignore`.
4. Baseline checks (before any change). Run and save the **last ~30 lines** of each into the report: `npm run lint`, `npx tsc --noEmit` (expected: 1 error TS2322 `isGenerating`), `npm run build`.
   - If `npm install` is needed first, run `npm ci`.
5. **Engine snapshot.** Create a temporary script `scripts/_verify-engine.ts` that imports `calculateEstimate` from `../lib/index` and prints JSON for these inputs (use explicit category ids; do NOT use detectCategory):
   - A: description "I need a responsive business website with a modern design, contact form and basic SEO for my bakery in Toronto.", category `web`, location `ca`, size `small`, quality `essential`
   - B: "I need an ecommerce website for a clothing brand with online payments, customer accounts and about 500 products in London.", `ecommerce`, `uk`, `large`, `premium`
   - C: "I need a cross-platform fitness app with user profiles, subscriptions and progress tracking in Dubai.", `mobile`, `ae`, `medium`, `standard`
   - D: any short description (>=12 chars), `ai`, `pk`, `medium`, `essential`
   - E: same, `seo`, `de`, `small`, `premium`
   Run it with `npx --yes tsx scripts/_verify-engine.ts > agent_baseline.json`.
   Expected (from PROJECT_CONTEXT.md section 9): **B** total 13664, low 12024, high 15987 (GBP). **C** total 40461, low 35606, high 47339 (AED). If B or C do not match, STOP and report (the baseline itself is off).
   If `tsx` cannot be installed, say so in the report and compare B and C by reading the code path manually instead.

---

## 2. Step 1: Dependency

Run `npm i @anthropic-ai/sdk`. Only `package.json` and `package-lock.json` may change. Add a script `"typecheck": "tsc --noEmit"` to `package.json`.

## 3. Step 2: next.config.mjs and cleanup

1. `next.config.mjs`: remove `output: 'export'` and `images: { unoptimized: true }` (if present). Keep `experimental: { workerThreads: false, cpus: 1 }`.
2. Delete the old Gemini route folder `app/api/estimates/` (it should contain only `route.ts`). Do not delete `app/api/chat`, `app/api/estimate-params`, `app/api/estimate-detail`, `app/api/_lib`.
3. Delete the empty directory `cost-calc/` that sits inside the repo root (verify it is empty and is a child of the root, not the root itself).
4. Delete `woocommerce-country-currency-switcher.php` in the repo root.
5. In `components/home/Estimator.tsx` remove the commented-out "Describe your own project" / Analyze JSX block (around lines 319-362), and remove the now-unused props `onAnalyzeCustom`, `analyzing`, `customDescription`, `customSummary` and their wiring through `Hero.tsx` and `app/page.tsx`. Also remove the `analyzeCustomProject()` function in `page.tsx` and its state if nothing else uses them. **Check with a search that nothing else uses an item before removing it.** Keep the existing `customProjectTypes` localStorage mechanism and the `custom:<name>` category option if other code uses it; report what you found.
6. `.gitignore`: append these lines (keep existing ones):
   ```
   .env
   .env*
   !.env.example
   ```

## 4. Step 3: Engine accepts custom country / category (lib/index.ts)

Goal: `calculateEstimate` gets one **optional last parameter** `custom?: { location?: CustomLocation; category?: CustomCategory }` (types are in `lib/chatbot/types.ts`).

- If `custom.location` is set, use it **instead of** the `locations` lookup: `{ id: "custom", country, city, currency, multiplier, taxRate }`. For the exchange rate use `custom.location.unitsPerUsd` when the chosen currency equals `custom.location.currency`; otherwise `USD_RATES[currency]` as before.
- If `custom.category` is set, use it instead of the `categories` lookup: `base = baseUsd`, `hours`, `weeks`, `name`/`shortName = name`, `description = summary ?? ""`. For fields the `Category` type requires but we do not have (icon, example, range), use the same values as the first built-in category or safe defaults (use an icon name that exists in `components/common/Icon.tsx`). Compute `range` as a string like the others (for example `"$X - $Y"` from base x 0.6 and base x 2.4, rounded).
- Types: `types/index.ts` derives ids from const arrays. Do not widen exported types more than needed. If `EstimateResult.category`/`location` must accept the custom shapes, introduce the smallest possible widening and list it in the report.
- All other behavior and math stay byte-for-byte equal when `custom` is undefined.
- `formatCurrency` already uses `Intl.NumberFormat`, so any valid ISO currency works. Verify it does not look the currency up in a fixed table; if it does, fix minimally.

## 5. Step 4: page.tsx wiring

Follow `INTEGRATION_GUIDE.md` section 3.4. Required result:

```tsx
import ChatBot from "@/components/chatbot/ChatBot";
import type { CustomLocation, CustomCategory } from "@/lib/chatbot/types";

const [customLocation, setCustomLocation] = useState<CustomLocation | null>(null);
const [customCategory, setCustomCategory] = useState<CustomCategory | null>(null);
const [pendingRun, setPendingRun] = useState(false);
```
- Render `<ChatBot />` once, outside the wizard (for example right before the closing fragment of the page). Props:
  - `supportedCountries={locations.map(l => ({ id: l.id, country: l.country }))}`
  - `onApplyProject`: set the description (slice to 500), set size from `p.complexity` (ids are the same: small/medium/large), set the category: if `p.customCategory` then `setCustomCategory(p.customCategory)` and make the category select show it; else `setCustomCategory(null)` and, unless `p.categoryId === "auto"`, set `categoryId`. Do not allow a state that breaks the existing `custom:<name>` handling.
  - `onApplyCountry`: if `c.locationId` set `locationId`, `setCustomLocation(null)`, mark `locationSelectedManually = true`, clear the currency override; else if `c.custom` `setCustomLocation(c.custom)` and mark manual.
  - `onRunEstimate={() => setPendingRun(true)}`
  - `estimateSummary`: a plain string built from the **existing result** (project title, country, formatted total, formatted low-high, weeks) or `undefined` when no result. Use the existing format helpers.
- `useEffect`: when `pendingRun` is true, set it false and call the **existing function that starts the estimate generation** (it is called inside `continueQuestions()` around line 312). Wrap that function in `useCallback` if needed so the effect has correct dependencies and `react-hooks/exhaustive-deps` passes (no eslint-disable unless unavoidable; if you must, report it). The estimate must start with the **already-updated** description/category/country/size, so the effect approach is required (do not call it directly inside the callbacks).
- Every `calculateEstimate(...)` call gets the new last argument `{ location: customLocation ?? undefined, category: customCategory ?? undefined }`.
- If the user manually changes the country or category select afterwards, clear the matching custom state.
- The wizard behavior for normal users (no chatbot) must stay exactly as before.

## 6. Step 5: Estimator.tsx

1. Add `isGenerating?: boolean` to `EstimatorProps` (fixes TS2322 at `page.tsx:584`). Do not otherwise change what the prop does unless it is clearly meant to disable inputs while generating; if so, report it.
2. Country `<select>`: if a `customLocation` prop is provided, render one extra `<option value="custom">{country} (AI-found)</option>` and show it selected. Selecting a normal country must clear it. Add the minimal new optional props needed (`customLocation?`, `customCategory?`) and thread them from `Hero.tsx`/`page.tsx`.
3. Category `<select>`: same idea for `customCategory` (use the existing "Your projects" optgroup style).
4. Privacy copy: search the repo for "never shared" and "Private by default" (about lines 415 and 604) and replace the sentences with: `Your history is saved only in your browser. Text is sent to an AI provider to generate answers; we do not store it.` Keep the surrounding markup/classes.

## 7. Step 6: EstimateResult.tsx

- Add `import AiEstimateDetail from "./AiEstimateDetail";`
- Render `<AiEstimateDetail estimate={result} currency={...} />` directly after the "Cost breakdown" section. `currency` must be the currency actually used by the result (the one passed/overridden in calculation, not just `location.currency` if the override can differ). Find how the file formats money to know which variable holds it.
- Guard any lookup of `scopeByCategory[category.id]` with `?? []`.
- If `result` is not structurally assignable to `EstimateLike`, fix by adapting the call site, not the other way around, unless a one-line change in `AiEstimateDetail.tsx` is clearly needed (then report it).

## 8. Step 7: detectCategory() (lib/index.ts)

Current behavior: returns the first category in array order whose keyword matches. Change to: count keyword matches for **every** category and return the one with the most matches; on a tie, prefer `web`; if no matches keep the existing default. Keep function signature and keyword lists. Example A text (website + "basic SEO") must now give `web`. Add the before/after result to the report.

## 9. Step 8: Small fixes

1. `app/layout.tsx`: the title/description contains a broken em dash (`"CostCalc ... AI Project Cost Estimator"` with a corrupted character). Replace it with a plain `-`. Ensure the file is UTF-8.
2. Quotation number: `QuoteModal.tsx` (or wherever `QF-2026-0248` is hard-coded) -> `` `QF-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}` `` generated **once per modal open** (use `useMemo`/`useState`, not on every render).
3. "Pricing data updated September 2026" (around `EstimateResult.tsx:195`): add `export const PRICING_UPDATED = "September 2026";` in `constants/index.ts` (adding a constant is allowed; do not change existing values) and use it in the text.
4. Search for `<ChatBot` placement problems: it must not render inside the print/PDF area. `ChatBot` already hides itself on print.

## 10. Step 9: Final verification

1. `npm run lint`, `npx tsc --noEmit`, `npm run build`: all must pass with **0 errors**. Fix problems in files you changed. For problems inside the rule-5 files, make the smallest fix and report it.
2. Run the engine script again: `npx --yes tsx scripts/_verify-engine.ts > agent_after.json`, then compare with `agent_baseline.json`. **They must be identical** (A-E). Put the comparison result in the report (use `Compare-Object` or a small node script). If not identical, find and fix the cause; it means you changed the math.
3. Extra check with a custom location: in the same script add one call with `custom.location = { country: "Testland", city: "Test", currency: "SAR", unitsPerUsd: 3.75, multiplier: 0.95, taxRate: 0.15, sources: [], origin: "offline" }` and a built-in category; print the result and confirm `currency` is SAR and tax is 15% of (subtotal + contingency). Put the output in the report.
4. Delete the temporary files you created for verification: `scripts/_verify-engine.ts` (and the `scripts/` folder if you created it and it is now empty). Keep `agent_baseline.json` and `agent_after.json` for the human.

## 11. Things you must NOT do even if they seem helpful

- Do not "improve" the chatbot UI, prompts or routes.
- Do not add tests, formatters, Prettier configs or CI jobs.
- Do not upgrade Next/React or any other dependency.
- Do not remove `GeneratingOverlay`, history, share, quotation or any existing feature.
- Do not add analytics, logging of user text, or any database.

## 12. Definition of done

- Steps 0-9 finished (or clearly listed as skipped with reason).
- lint, tsc, build pass. Engine snapshot identical.
- No commit, push, deploy. No secrets.
- `AGENT_REPORT.md`, `agent_changes.diff`, `agent_status.txt`, `agent_baseline.json`, `agent_after.json` exist in the repo root.

## 13. Final commands to produce evidence (run at the very end)

```
git status --short > agent_status.txt
git diff --stat > agent_diffstat.txt
git diff > agent_changes.diff
```
(New untracked files are listed in `agent_status.txt`; the human already knows the provided ones.)

## 14. AGENT_REPORT.md (mandatory, written incrementally)

Create `AGENT_REPORT.md` in the repo root at the start and append after every step. It must contain, in this order:

1. **Header:** date/time, agent name and model if known, git branch, starting `git status` summary.
2. **Per step (0 to 9):** status (DONE / PARTIAL / SKIPPED / BLOCKED), files changed (full relative paths), what exactly changed and **why** (plain words, 2-6 lines), important code snippets for the non-trivial changes (calculateEstimate signature and the custom branches, the page.tsx effect, the select options), and the output of `npx tsc --noEmit` after the step (pass/fail + errors).
3. **Decisions and assumptions:** every place where real code differed from this task file, and what you chose.
4. **Questions for the human:** anything unclear.
5. **Baseline vs final:** the 3 command results (lint / tsc / build), before and after, last lines only.
6. **Engine comparison:** identical or not (A-E), plus the custom-location test output.
7. **Not done / risks:** honest list of anything unfinished, hacks, eslint-disable usages, widened types, places you are unsure about.
8. **Files list:** deleted files, new files you created (other than the report/evidence files), modified files.

Do not claim something passed unless you ran the command and saw it pass. If you could not run something, say so.
