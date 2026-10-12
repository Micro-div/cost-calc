# CostCalc: AI Chatbot Integration Guide (Roman Urdu)

## 0. Pehle ye 4 baatein (zaroori)

1. **Maine sirf `PROJECT_CONTEXT.md` parhi hai, asli source files nahi** (`page.tsx`, `Estimator.tsx`, `lib/index.ts`, `constants/index.ts`). Isliye naye files (routes, chatbot, memory, fallback) mukammal hain, lekin purani files mein jo changes hain wo "patch sketch" hain. Exact patch ke liye ye 6 files bhej dein: `app/page.tsx`, `components/home/Estimator.tsx`, `components/home/EstimateResult.tsx`, `lib/index.ts`, `constants/index.ts`, `next.config.mjs`.
2. **Hosting ka farq:** file mein deploy **GitLab Pages** likha hai, aap keh rahe hain **GitHub org + live**. Agar live site GitHub/GitLab Pages par hai to wo sirf static hosting hai, wahan API routes **kabhi** nahi chalenge. Chatbot ke liye Vercel (ya koi Node host) chahiye. Section 6 dekhein.
3. **File mein 10 countries hain, 8 nahi** (`us, ca, uk, ae, pk, in, au, de, sg, ng`). Categories 8 hi hain. Code file ke mutabiq 10 par bana hai; agar aap ne 2 hata di hain to list `constants/index.ts` se khud aati hai, code change nahi chahiye.
4. **Privacy text galat ho jayega.** UI mein likha hai *"Your description stays private and is never shared"* aur *"Private by default"* (`Estimator.tsx:415, 604`). Chatbot ke baad description AI provider (Anthropic) ko jati hai. Ye text badal dein, e.g. *"Your history is saved only in your browser. Text is sent to an AI provider to generate answers; we do not store it."* Warna user se jhoot hoga.

---

## 1. Ye sab kaise kaam karta hai

```
User (chat button)
   |  idea likhta hai
   v
/api/chat  (Claude, user ki language mein, short jawab + structured brief)
   |  brief: refined description + category + complexity (+ country agar bataya)
   v
Chat poochta hai: "Cost estimate chahiye?"  [Haan] [Abhi nahi]
   |  Haan
   v
Description box + Category select khud bhar jate hain
   |  country maloom nahi? -> chat poochta hai (10 country chips + "doosri country")
   v
Country in 10 mein?  --Haan--> Country select mein wo country
   |
   Nahi --> /api/estimate-params (Claude + WEB SEARCH):
            price level, tax rate, exchange rate + sources
            -> Country select mein "AI-found" country ban kar aa jati hai
   v
calculateEstimate()  <- paisay ka hisab SIRF ye code karta hai
   v
Estimate page + /api/estimate-detail (AI ka detailed write-up)
```

**Accuracy ka rule:** AI kabhi final price nahi likhta. AI sirf *inputs* dhoondta hai (price level, tax, exchange rate, benchmarks), hisab aapka engine karta hai. README §8 aur context file ka bhi yehi rule hai. Isi liye same input par same price aata hai aur web search se accuracy aati hai.

---

## 2. Files kahan rakhni hain

`costcalc-ai/` ka andar ka structure project root ke barabar hai. Copy kar dein:

| File | Kaam |
|---|---|
| `app/api/_lib/ai.ts` | Anthropic client, rate limit, sanitizers |
| `app/api/chat/route.ts` | Chatbot (language mirror, clean jawab, brief) |
| `app/api/estimate-params/route.ts` | Web search: country / custom category ka data |
| `app/api/estimate-detail/route.ts` | Estimate ka detailed text |
| `lib/chatbot/knowledge.ts` | Project ki puri tafseel (kya, kyun, kaisay) |
| `lib/chatbot/memory.ts` | localStorage memory |
| `lib/chatbot/fallback.ts` | Offline jawab + country table |
| `lib/chatbot/types.ts` | Types |
| `components/chatbot/ChatBot.tsx` | Floating button + chat panel |
| `components/home/AiEstimateDetail.tsx` | Estimate page ka detailed section |

Install:

```bash
npm i @anthropic-ai/sdk
```

---

## 3. Purani files mein changes

### 3.1 `next.config.mjs` (sab se zaroori)
`output: 'export'` **hata dein**. Ye line API routes ko mar deti hai.

```js
const nextConfig = {
  experimental: { workerThreads: false, cpus: 1 }, // rakh sakte hain
  // output: 'export',   <- DELETE
  // images.unoptimized: true bhi hata sakte hain (Vercel images optimize karta hai)
};
export default nextConfig;
```

### 3.2 Purana Gemini route
`app/api/estimates/route.ts` (Gemini) ab zaroorat nahi, kyunke naya chatbot wahi kaam behtar karta hai. Is folder ko delete kar dein, saath mein `GEMINI_*` env aur `Estimator.tsx:319-362` ka commented "Analyze" block, aur page.tsx se `onAnalyzeCustom, analyzing, customDescription, customSummary` props.

### 3.3 `calculateEstimate()` (patch sketch)
Custom country / category ko engine mein daalne ke liye aakhir mein ek optional parameter:

```ts
export function calculateEstimate(
  description, categoryId, locationId, sizeId, qualityId, currencyOverride?,
  custom?: { location?: CustomLocation; category?: CustomCategory },
) {
  const location = custom?.location
    ? { id: "custom", country: custom.location.country, city: custom.location.city,
        currency: custom.location.currency, multiplier: custom.location.multiplier,
        taxRate: custom.location.taxRate }
    : locations.find((l) => l.id === locationId) ?? locations[0];

  const category = custom?.category
    ? { id: "custom", name: custom.category.name, shortName: custom.category.name,
        base: custom.category.baseUsd, hours: custom.category.hours, weeks: custom.category.weeks,
        description: custom.category.summary ?? "", /* icon, example, range: defaults */ }
    : categories.find((c) => c.id === categoryId) ?? categories[0];

  const currency = currencyOverride ?? location.currency;
  const fx = custom?.location && currency === custom.location.currency
    ? custom.location.unitsPerUsd
    : USD_RATES[currency];
  // baqi formula bilkul wohi rahe (14/16/42/16/12, 5%, tax, -12%/+17%)
}
```
Notes:
- `formatCurrency` `Intl.NumberFormat` use karta hai, to koi bhi valid ISO currency chal jati hai.
- `scopeByCategory["custom"]` nahi hogi: `?? []` laga dein, kyunke `AiEstimateDetail` scope khud deta hai.
- `QuoteModal.tsx:29-37` mein dobara hisab hota hai, wahan sirf quantity/rate se hota hai, isliye custom ke saath masla nahi.

### 3.4 `app/page.tsx` mein chatbot jodna (patch sketch)

```tsx
import ChatBot from "@/components/chatbot/ChatBot";
import type { CustomLocation, CustomCategory } from "@/lib/chatbot/types";

const [customLocation, setCustomLocation] = useState<CustomLocation | null>(null);
const [customCategory, setCustomCategory] = useState<CustomCategory | null>(null);
const [pendingRun, setPendingRun] = useState(false);

// JSX mein (Hero ke baad, kahin bhi):
<ChatBot
  supportedCountries={locations.map((l) => ({ id: l.id, country: l.country }))}
  onApplyProject={(p) => {
    setDescription(p.description.slice(0, 500));               // description box
    setSizeId(p.complexity);                                    // small|medium|large
    if (p.customCategory) { setCustomCategory(p.customCategory); setCategoryId(p.categoryId as CategoryId); }
    else { setCustomCategory(null); if (p.categoryId !== "auto") setCategoryId(p.categoryId as CategoryId); }
  }}
  onApplyCountry={(c) => {
    if (c.locationId) { setCustomLocation(null); setLocationId(c.locationId as LocationId); setLocationSelectedManually(true); setCurrencyOverride(undefined); }
    else if (c.custom) { setCustomLocation(c.custom); setLocationSelectedManually(true); }
  }}
  onRunEstimate={() => setPendingRun(true)}
  estimateSummary={result ? `${result.projectTitle}, ${result.location.country}, total ${formatCurrency(result.total, currency)}, range ${formatCurrency(result.low, currency)} to ${formatCurrency(result.high, currency)}, ${result.durationMin}-${result.durationMax} weeks` : undefined}
/>

// Pehle bhare hue state se estimate chalane ke liye (stale state se bachne ke liye):
useEffect(() => {
  if (!pendingRun) return;
  setPendingRun(false);
  continueQuestions();            // wohi function jo page.tsx:312 par calculateEstimate chalata hai
}, [pendingRun]);                 // eslint exhaustive-deps ke liye continueQuestions ko useCallback bana lein
```

Phir `calculateEstimate(..., { location: customLocation ?? undefined, category: customCategory ?? undefined })`.

**Country / category select mein "AI-found" option:** `Estimator.tsx` ke country `<select>` mein agar `customLocation` ho to ek `<option value="custom">{customLocation.country} (AI-found)</option>` add karein aur wahi selected rakhein. Category select mein pehle se "Your projects" optgroup hai, usi tarah `customCategory.name` wala option add ho jata hai.

### 3.5 `EstimateResult.tsx` mein detailed section
"Cost breakdown" ke baad:

```tsx
import AiEstimateDetail from "./AiEstimateDetail";
<AiEstimateDetail estimate={result} currency={currency} />
```
Agar AI chal na sake to purana static "Suggested scope / Key assumptions" jo pehle se hai wohi dikhta rehta hai, UI kharab nahi hota.

---

## 4. Purani problems ka hal (context file §11 ke mutabiq)

| # | Problem | Hal |
|---|---|---|
| 1 | TS error `isGenerating` (`page.tsx:584`) | `EstimatorProps` mein `isGenerating?: boolean` add karein (ya prop hata dein). Phir `package.json` mein `"typecheck": "tsc --noEmit"` add kar ke build se pehle chalayein |
| 2 | `/api/estimates` production mein nahi chalta | 3.1: `output: 'export'` hatayein, route se `force-static` hatayein, Vercel par deploy |
| 3 | "Analyze" UI commented | 3.2: chatbot isay replace karta hai, dead code delete |
| 4 | `detectCategory()` pehle match par ruk jata hai ("website... basic SEO" -> seo) | Har category ke keywords ginein aur **sab se zyada match** wali chunein; barabar hon to `web` ko priority dein. Chatbot se aaye hue category ko ye override nahi karta (`categoryId` seedha set hota hai) |
| 5 | PDF sirf `window.print()` | Chal raha hai. Behtar hona abhi scope se bahar hai |
| 6 | Hard-coded `QF-2026-0248`, "updated September 2026" | Quote number: `QF-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`. Date text ko `constants` mein `PRICING_UPDATED` bana dein |
| 7 | `layout.tsx` mein toota hua em dash | File ko UTF-8 mein dobara save karein aur title mein `-` ya `–` likhein |
| 8 | Khali `cost-calc/` folder aur `.php` file | Dono delete |
| 9 | `.env` ignore nahi hota | `.gitignore` mein `.env` aur `.env*` add karein (sirf `.env.example` rakhein) |
| 10 | Rate limiting nahi | Routes mein basic limiter hai. Asal protection ke liye Upstash Redis / Vercel KV (neeche section 8) |

---

## 5. Memory (localStorage) aur fallback

`localStorage` key: `costcalc-chat-memory-v1`. Isme: aakhri 40 messages, aakhri 100 sawal-jawab, country/category lookups (30 din), aakhri project brief.

Jab kuch kharab ho:

| Kya kharab hua | Chatbot kya karta hai |
|---|---|
| `/api/chat` fail (key nahi, limit, network) | 1) Mehfooz kiya hua milta-julta jawab, 2) built-in FAQ (English/Roman Urdu), 3) saaf message + **Retry** + **"Use my text"** chip. Estimate engine phir bhi browser mein chalta hai |
| Web search fail (country) | 1) 30 din ka saved data, 2) purana saved data, 3) ~24 countries ka offline approximate table (`fallback.ts`), 4) warna user se doosri country chunne ko kehta hai |
| Web search fail (custom category) | Saved data, warna safe default (6000 USD / 200 hrs / 6 weeks), badge "offline" ke saath |
| `/api/estimate-detail` fail | Same estimate ka purana saved write-up, warna purana static scope/assumptions page par rehta hai |
| Pura Vercel down | Site hi nahi khulti. Koi code isay theek nahi kar sakta |

Offline table ke numbers **approximate** hain. Aap review kar lein ya jin par bharosa na ho wo rows delete kar dein.

---

## 6. GitHub + Vercel: kaise live karein

### A. Anthropic taraf
1. console.anthropic.com par API key banayein.
2. **Spend limit** lagayein (Billing / Limits). Bina limit ke koi bhi bot aap ka bill barha sakta hai.
3. Web search ke liye Console mein organization level par **web search enable** hona chahiye (admin setting). Warna `estimate-params` error dega aur chatbot offline table par chala jayega.
4. Web search tool ka version string (`web_search_20250305` in `estimate-params/route.ts`) docs se confirm kar lein, naya version aa sakta hai.

### B. Local test pehle
Project root mein `.env.local` (git mein **nahi** jayegi):
```
ANTHROPIC_API_KEY=sk-ant-...
# optional:
# ANTHROPIC_CHAT_MODEL=claude-haiku-5-5
# ANTHROPIC_RESEARCH_MODEL=claude-sonnet-5-5
```
`npm run dev` -> chat test karein. Aap ka "local mein key + model daalun to chalta hai" wala step yehi hai.

### C. GitHub
1. Code GitHub org ke repo mein push karein (branch `main`).
2. `.env.local` commit na ho (check: `git status`).

### D. Vercel
1. vercel.com par GitHub se login karein -> **Add New -> Project** -> apni org ka repo **Import**.
   - Agar org ka repo nazar na aaye: org owner ko Vercel GitHub App install/approve karni hogi.
   - Free (Hobby) plan par org ke **private** repos ki pabandi ho sakti hai; Vercel ke plan docs check karein. Public repo ya Pro plan mein masla nahi.
2. Framework **Next.js** khud detect hota hai. Build command `npm run build` rehne dein. Settings mein **Node.js 22.x** chunein (aap ki CI bhi 22.14 par hai).
3. **Environment Variables** mein `ANTHROPIC_API_KEY` daalein (Production + Preview + Development). `NEXT_PUBLIC_` prefix **kabhi nahi**.
4. **Deploy**.
5. **Yaad rakhein:** env variable baad mein add/change karein to naya **Redeploy** karna parta hai, purani deployment ko nayi value nahi milti.
6. Ab har `git push` to `main` = production deploy. Har Pull Request = alag preview link (wahan key `Preview` scope se aati hai).
7. Masla aaye to Vercel -> project -> **Deployments -> Runtime Logs** mein `/api/chat` ke errors dikhte hain (key kabhi log nahi hoti).
8. `maxDuration = 60` web search ke liye hai. Agar aap ka plan isay allow na kare to deploy warning dega; value plan ke limit tak kam kar dein, ya research route par `max_uses` 4 se 2 kar dein.
9. Domain: Project -> Settings -> Domains.
10. Agar pehle GitLab/GitHub Pages par thi to `.gitlab-ci.yml` hata dein aur purani Pages deployment band kar dein, taake log purani (bina chatbot wali) site par na jayen.

---

## 7. Test checklist (deploy se pehle)

- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` teeno bina error
- [ ] Urdu / Roman Urdu / English mein sawal: jawab usi language mein, chhota aur saaf
- [ ] Vague idea -> sirf 1 sawal; clear idea -> brief + "estimate chahiye?"
- [ ] "Haan" -> description box aur category select bhar jate hain
- [ ] Country poochi jati hai; Pakistan chip -> select mein Pakistan, estimate chalta hai
- [ ] "Saudi Arabia" likhein -> web search, select mein AI-found country, tax/currency sahi, sources
- [ ] Custom project (e.g. "drone delivery app") -> custom category ke saath estimate
- [ ] Internet band / key hata kar: saved answer, FAQ, Retry; UI toot-ta nahi
- [ ] Wohi estimate dobara: detail section cache se foran aata hai
- [ ] Print/PDF mein chat widget nazar nahi aata (`print:hidden`)
- [ ] Mobile par chat poori screen le aur keyboard se band (Esc) ho

---

## 8. Cost aur safety

- **Chat** chhota model (Haiku) use karta hai; **web search + detail** Sonnet. Env se badal sakte hain.
- Web search har query par alag charge hota hai, isliye result 30 din cache hota hai.
- Input limits server par bhi hain (1500 chars/message, 12 messages).
- Serverless par in-memory rate limit har instance ka apna hota hai. Production ke liye Upstash Redis (`@upstash/ratelimit`) lagayein aur Anthropic spend limit zaroor rakhein.
- Prompt-injection se bachao: system prompt mein rule hai, aur AI sirf text/inputs deta hai, **numbers ka server-side clamp** hai (multiplier 0.15-1.6, tax 0-30%, base 800-40000 USD). Phir bhi final price engine ka hai.
- Abhi tak kuch bhi server par store nahi hota. Agar kabhi analytics/logging lagayein to privacy text dobara update karein.
