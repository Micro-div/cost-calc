# Manual Guide: Khud karna ho to (asaan lafzon mein)

Har step mein 4 cheezein hain: **kahan jana hai**, **kya karna hai**, **kyun**, **kaise pata chale ke theek hua**.
Pehle saare steps **ek ke baad ek, order mein** karein. Beech mein skip na karein.

> Jo files maine nahi dekhin (`page.tsx`, `Estimator.tsx`, `lib/index.ts` waghera), un ke steps mein "dhoondein" likha hai, kyunke exact line mujhe nahi pata. Phans jayen to wo file chat mein bhej dein, main exact code bana dunga.

---

## PART 1: Tayari (10 minute)

### Step 1: Kit download karein
- **Kahan:** is chat mein jo file cards hain.
- **Kya:** poora `costcalc-ai` folder download karke Desktop par rakhein: `C:\Users\cc\Desktop\costcalc-ai`
- **Kyun:** is mein saari naye files hain.

### Step 2: VS Code mein project kholein aur terminal kholein
- VS Code mein `File > Open Folder` se `C:\Users\cc\Desktop\Project\cost-calc` kholein.
- Menu `Terminal > New Terminal`. Neeche PowerShell khulega, aur wo project folder mein hi hoga.

### Step 3: Naya branch banayein (backup)
Terminal mein ye 3 lines ek ek kar ke chalayein:
```powershell
git status
git checkout -b feat/ai-chatbot
git branch --show-current
```
- **Kyun:** aap ka `main` branch bacha rehta hai. Kuch ghalat ho jaye to `main` par wapas ja sakte hain.
- **Theek hua?** Aakhri line `feat/ai-chatbot` dikhaye.

### Step 4: Files project mein copy karein
```powershell
Copy-Item -Recurse -Force "$HOME\Desktop\costcalc-ai\*" .
```
- **Kya hua:** naye folders `app/api/chat`, `app/api/estimate-params`, `app/api/estimate-detail`, `app/api/_lib`, `lib/chatbot`, `components/chatbot` ban gaye, aur `components/home` mein `AiEstimateDetail.tsx` aa gayi.
- **Theek hua?** VS Code ke left side (Explorer) mein ye folders nazar aayen.
- `PROJECT_CONTEXT.md` ko bhi root mein rakh lein (ye aap ke upload ki copy hai).

### Step 5: SDK install karein
```powershell
npm i @anthropic-ai/sdk
```
- **Kyun:** ye Claude se baat karne ka official package hai.
- **Theek hua?** `package.json` ke `dependencies` mein `@anthropic-ai/sdk` likha aaye.

### Step 6: Key banayein aur rakhein
1. console.anthropic.com par jayen, **API Keys > Create Key**. Key copy karein (dobara nahi dikhti).
2. Usi Console mein **Billing/Limits** mein monthly **spend limit** lagayein.
3. Console ki settings mein **web search enable** karwayein (organization admin ka option hai).
4. VS Code mein project root par nayi file banayein, naam: `.env.local`
5. Us mein sirf ye ek line likhein (apni key ke saath), save karein:
   ```
   ANTHROPIC_API_KEY=sk-ant-yahan-apni-key
   ```
- **Kyun:** key sirf server par rehti hai, browser tak nahi jati.
- **Khabardar:** key kisi ko na dein, chat mein na likhein, agent ko na dikhayen. `.env.local` git mein nahi jani chahiye (step 8 mein is ka bandobast hai).

---

## PART 2: Purani files mein changes

### Step 7: `next.config.mjs` (sab se zaroori)
- **Kahan:** root mein `next.config.mjs`.
- **Kya:** `output: 'export'` wali line **delete** karein. Agar `images: { unoptimized: true }` bhi ho to wo bhi delete.
- `experimental: { workerThreads: false, cpus: 1 }` **rehne dein**.
- **Kyun:** `output: 'export'` ka matlab "sirf static site". Is ke saath API routes (chatbot) kaam hi nahi karte.
- **Theek hua?** File kuch aisi dikhe:
  ```js
  const nextConfig = {
    experimental: { workerThreads: false, cpus: 1 },
  };
  export default nextConfig;
  ```

### Step 8: `.gitignore`
- **Kahan:** root mein `.gitignore`.
- **Kya:** file ke bilkul aakhir mein ye 3 lines add karein:
  ```
  .env
  .env*
  !.env.example
  ```
- **Kyun:** taake key wali file kabhi GitHub par na chali jaye.
- **Theek hua?** Terminal mein `git status` chalayein. Agar `.env.local` list mein na aaye to theek hai.

### Step 9: Purani aur faltu cheezein delete karein
Pehle dekh lein ke ye files hain:
```powershell
Get-ChildItem app\api
Get-ChildItem cost-calc
```
- `app\api` mein `estimates` folder hona chahiye (purana Gemini route).
- `cost-calc` **khali** hona chahiye (ye project ke andar ka chhota khali folder hai, project ka root nahi).

Phir delete:
```powershell
Remove-Item -Recurse -Force app\api\estimates
Remove-Item -Recurse -Force cost-calc
Remove-Item -Force woocommerce-country-currency-switcher.php
```
- **Kyun:** Gemini route ki ab zaroorat nahi, baqi dono faltu hain.
- **Khabardar:** `app\api\chat`, `estimate-params`, `estimate-detail`, `_lib` ko **mat** delete karein.

### Step 10: `lib/index.ts`: engine ko naye countries/categories sikhana
- **Kahan:** `lib/index.ts`, function `calculateEstimate` (line ~148).
- **Kyun:** jab user ki country 10 mein na ho, to chatbot web se jo rates laya, engine un se hisab kare.

**10a.** File ke sab se upar imports mein ye add karein:
```ts
import type { CustomLocation, CustomCategory } from "@/lib/chatbot/types";
```

**10b.** `calculateEstimate(...)` ke arguments ke **aakhir mein** ek aur argument add karein:
```ts
custom?: { location?: CustomLocation; category?: CustomCategory }
```

**10c.** Function ke andar wo jagah dhoondein jahan `locations.find(...)` aur `categories.find(...)` se country aur category li ja rahi hai. Un ki jagah ye logic rakhein (apni file ke variable naam rakhte hue):
```ts
const location = custom?.location
  ? {
      id: "custom",
      country: custom.location.country,
      city: custom.location.city,
      currency: custom.location.currency,
      multiplier: custom.location.multiplier,
      taxRate: custom.location.taxRate,
    }
  : /* aap ka purana locations.find(...) wala code */;

const category = custom?.category
  ? {
      id: "custom",
      name: custom.category.name,
      shortName: custom.category.name,
      base: custom.category.baseUsd,
      hours: custom.category.hours,
      weeks: custom.category.weeks,
      description: custom.category.summary ?? "",
      // icon, example, range: wohi fields jo Category type maangti hai.
      // Pehli category jaisi value ya khali string de dein.
    }
  : /* aap ka purana categories.find(...) wala code */;
```

**10d.** Exchange rate wali jagah dhoondein (`USD_RATES[currency]`). Usay aise karein:
```ts
const fx =
  custom?.location && currency === custom.location.currency
    ? custom.location.unitsPerUsd
    : USD_RATES[currency];
```

**10e.** Baqi formula (14/16/42/16/12, 5%, tax, -12%/+17%) ko **haath na lagayein**.

- **Theek hua?** `npx tsc --noEmit` chalayein. Is function se related koi error na aaye. Type errors aaye (jaise `Category` type custom se match nahi karti) to error ki line mujhe bhej dein.

### Step 11: `lib/index.ts`: `detectCategory()` ka bug
- **Kahan:** usi file mein `detectCategory` (line ~48).
- **Masla:** ye pehli category jis ka ek keyword mil jaye wahi return kar deta hai. "website with basic SEO" ko `seo` samajh leta hai.
- **Kya karna hai:** har category ke keywords ginein aur **sab se zyada match** wali chunein. Barabar ho to `web`.
- Agar keywords aise array mein hon: `{ id, keywords: [...] }`, to code kuch aisa hoga:
  ```ts
  const text = description.toLowerCase();
  let best = defaultId;       // jo abhi default hai
  let bestScore = 0;
  for (const group of groups) {            // groups = aap ki keyword list
    const score = group.keywords.filter((k) => text.includes(k)).length;
    if (score > bestScore || (score === bestScore && score > 0 && group.id === "web")) {
      best = group.id;
      bestScore = score;
    }
  }
  return best;
  ```
- Agar structure alag ho to function mujhe bhej dein.
- **Theek hua?** "business website with basic SEO" likhne par category `web` aani chahiye.

### Step 12: `components/home/Estimator.tsx`
- **12a (TypeScript error):** `EstimatorProps` (line ~26) dhoondein. Is mein ye line add karein:
  ```ts
  isGenerating?: boolean;
  ```
  Is se `TS2322` error khatam hoti hai.
- **12b (purana Analyze block):** line ~319-362 ke beech ek bara commented JSX hai ("Describe your own project" + Analyze button). Poora delete karein.
  Phir `onAnalyzeCustom`, `analyzing`, `customDescription`, `customSummary` jahan jahan unused rahe gaye (`Estimator.tsx`, `Hero.tsx`, `page.tsx`), un ko hata dein. VS Code ka search (`Ctrl+Shift+F`) use karein. Jo item kahin aur istemal ho raha ho use na hatayein.
- **12c (naye props):** `EstimatorProps` mein 2 aur optional props add karein:
  ```ts
  customLocation?: { country: string } | null;
  customCategory?: { name: string } | null;
  ```
- **12d (country dropdown):** country wala `<select>` (line ~371) dhoondein. Us ke `<option>` list mein sab se upar ye add karein:
  ```tsx
  {customLocation && (
    <option value="custom">{customLocation.country} (AI-found)</option>
  )}
  ```
  Aur select ki `value`: agar `customLocation` ho to `"custom"`, warna purani value. Normal country chunne par `customLocation` khatam ho jana chahiye (page.tsx mein Step 13 mein).
- **12e (category dropdown):** line ~264 ke `<select>` mein, "Your projects" wale group ke andar:
  ```tsx
  {customCategory && <option value="custom">{customCategory.name}</option>}
  ```
- **12f (privacy text):** `Ctrl+Shift+F` se `never shared` aur `Private by default` search karein (line ~415 aur ~604). Un ki jagah ye likhein:
  `Your history is saved only in your browser. Text is sent to an AI provider to generate answers; we do not store it.`
  **Kyun:** ab description AI ko jati hai, purana text jhoot hota.

### Step 13: `components/home/Hero.tsx`
- `Hero` ke props mein `customLocation` aur `customCategory` add karein (wohi 2 optional props) aur unhein `<Estimator ... />` ko pass kar dein. Agar Hero `{...props}` spread karta hai to shayad kuch na karna pade.

### Step 14: `app/page.tsx` (sab se bara step)
**14a. Imports (upar):**
```tsx
import ChatBot from "@/components/chatbot/ChatBot";
import type { CustomLocation, CustomCategory } from "@/lib/chatbot/types";
```

**14b. State (doosre `useState` ke saath):**
```tsx
const [customLocation, setCustomLocation] = useState<CustomLocation | null>(null);
const [customCategory, setCustomCategory] = useState<CustomCategory | null>(null);
const [pendingRun, setPendingRun] = useState(false);
```

**14c. `<ChatBot />` lagayein** (JSX ke andar, aakhir mein, bahar wale fragment ke band hone se pehle). Apne state ke naam rakhein (neeche aam naam use kiye hain):
```tsx
<ChatBot
  supportedCountries={locations.map((l) => ({ id: l.id, country: l.country }))}
  onApplyProject={(p) => {
    setDescription(p.description.slice(0, 500));
    setSizeId(p.complexity);
    if (p.customCategory) {
      setCustomCategory(p.customCategory);
    } else {
      setCustomCategory(null);
      if (p.categoryId !== "auto") setCategoryId(p.categoryId as CategoryId);
    }
  }}
  onApplyCountry={(c) => {
    if (c.locationId) {
      setCustomLocation(null);
      setLocationId(c.locationId as LocationId);
    } else if (c.custom) {
      setCustomLocation(c.custom);
    }
    setLocationSelectedManually(true);
    setCurrencyOverride(undefined);   // agar aap ke yahan aise state ka naam hai
  }}
  onRunEstimate={() => setPendingRun(true)}
  estimateSummary={
    result
      ? `${result.projectTitle}, ${result.location.country}, total ${formatCurrency(result.total, currency)}, range ${formatCurrency(result.low, currency)} to ${formatCurrency(result.high, currency)}, ${result.durationMin}-${result.durationMax} weeks`
      : undefined
  }
/>
```
(`result`, `currency`, `formatCurrency` aap ki file ke naamon se badlein. `setDescription`, `setSizeId` waghera bhi.)

**14d. Estimate chalane wala `useEffect`:**
```tsx
useEffect(() => {
  if (!pendingRun) return;
  setPendingRun(false);
  continueQuestions();     // wohi function jo (line ~312) calculateEstimate chalata hai
}, [pendingRun, continueQuestions]);
```
`continueQuestions` ko `useCallback` mein lapet dein warna ESLint warning dega.
**Kyun effect?** React state turant nahi badalta. Effect tab chalta hai jab description/country/category sab update ho chuke hon.

**14e. `calculateEstimate(...)` ke har call mein** aakhir mein ye argument add karein:
```tsx
{ location: customLocation ?? undefined, category: customCategory ?? undefined }
```

**14f. Estimator ko naye props dein:** jahan `<Hero ... />` (ya `<Estimator />`) hai wahan `customLocation={customLocation}` aur `customCategory={customCategory}` add karein.

**14g.** Jab user dropdown se khud normal country chune to `setCustomLocation(null)`, aur normal category chune to `setCustomCategory(null)` chalayein.

- **Theek hua?** `npx tsc --noEmit` mein koi error na ho.

### Step 15: `components/home/EstimateResult.tsx`
- Upar: `import AiEstimateDetail from "./AiEstimateDetail";`
- "Cost breakdown" section ke bilkul neeche:
  ```tsx
  <AiEstimateDetail estimate={result} currency={currency} />
  ```
  `result` aur `currency` apni file ke naam se. `currency` wo ho jo asal mein hisab mein use hui (override ke baad wali).
- `scopeByCategory[category.id]` jahan bhi ho wahan aage `?? []` laga dein.

### Step 16: Chhoti theek-kariyan
1. **`app/layout.tsx`:** title mein toota hua em dash (`�?`) hata kar seedha ` - ` likhein. Neeche VS Code ke status bar mein encoding **UTF-8** honi chahiye.
2. **`QuoteModal.tsx`:** `QF-2026-0248` dhoondein aur badlein:
   ```tsx
   const [quoteNo] = useState(() => `QF-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`);
   ```
   aur wahan `{quoteNo}` dikhayein.
3. **`constants/index.ts`:** aakhir mein `export const PRICING_UPDATED = "September 2026";` add karein, phir `EstimateResult.tsx` (line ~195) mein hard-coded text ki jagah `{PRICING_UPDATED}` use karein.

---

## PART 3: Check aur test

### Step 17: Teen commands
```powershell
npm run lint
npx tsc --noEmit
npm run build
```
- Teeno mein **0 error**. Error aaye to pehli error ka poora text copy karke mujhe bhej dein.

### Step 18: Chala kar dekhein
```powershell
npm run dev
```
Browser mein `http://localhost:3000`. Band karne ke liye terminal mein `Ctrl+C`.

Ye cheezein check karein:
1. Neeche right par purple chat button aaye, Esc se band ho.
2. Roman Urdu mein likhein "mujhe tyre shop ka app chahiye": jawab Roman Urdu mein, chhota aur saaf.
3. Clear idea par "Cost estimate chahiye?" ke 2 buttons aayen.
4. "Haan" par description box aur category select bhar jayen.
5. Country poochi jaye. "Pakistan" chunein: estimate ban jaye.
6. Naya chat: "Saudi Arabia" likhein: thori der baad country select mein "Saudi Arabia (AI-found)" aaye, chat mein currency/tax/sources dikhen.
7. Estimate page ke neeche detailed section aaye (pehle loading, phir text).
8. **Engine regression:** website ki jagah UK, ecommerce, large, premium wala example (description: "ecommerce website for a clothing brand with online payments, customer accounts and about 500 products in London") chalayein: total **£13,664** aana chahiye. UAE, mobile, medium, standard: **AED 40,461**.
9. `.env.local` mein key galat kar dein, dev server restart karein, chatbot se sawal poochein: saved jawab / FAQ / Retry aana chahiye, page toote nahi. Phir key theek kar dein.

---

## PART 4: GitHub aur Vercel

### Step 19: Commit aur push
```powershell
git status
git add -A
git commit -m "feat: AI chatbot, web-search estimates, detailed estimate"
git push -u origin feat/ai-chatbot
```
`git status` mein `.env.local` **nahi** aani chahiye. Agar aaye to ruk jayen, `.gitignore` (Step 8) dobara dekhein.

### Step 20: Pull Request
GitHub par repo kholein, **Compare & pull request** dabayein. Abhi merge **na** karein.

### Step 21: Vercel par project lagayein (pehli baar)
1. vercel.com par GitHub se login. **Add New > Project**.
2. Apni organization ka repo **Import**. Agar nazar na aaye: org owner ko Vercel GitHub App ki ijazat deni hogi.
3. Framework **Next.js** (khud detect hota hai). Build Command wahi rehne dein.
4. **Settings > General > Node.js Version: 22.x.**
5. **Settings > Environment Variables:** Name `ANTHROPIC_API_KEY`, Value apni key, teeno (Production, Preview, Development) tick, **Save**. `NEXT_PUBLIC_` mat lagayein.
6. **Deployments** mein `...` menu se **Redeploy** karein. (Env variable ke baad redeploy zaroori hai.)

### Step 22: Preview par test
PR par Vercel ek **Preview link** deta hai. Us par Step 18 ki testing dobara karein. `/api/chat` error aaye to Vercel mein **Deployments > us deployment > Logs / Runtime Logs** dekhein.

### Step 23: Live karna
Sab theek ho to GitHub par PR **Merge** karein. Vercel `main` ko khud production par deploy kar deta hai. Custom domain: **Settings > Domains**.
Purani GitLab/GitHub Pages wali site band kar dein ya link redirect kar dein, warna log purani (bina chatbot) site par jayenge.

---

## Agar kuch bigar jaye

| Hal | Command |
|---|---|
| Ek file ki changes wapas | `git restore path\to\file` |
| Sab uncommitted changes wapas (tracked files) | `git restore .` |
| Purane `main` par wapas | `git checkout main` |
| Koi error samajh na aaye | error ka poora text + file ka naam mujhe bhej dein |

Naye banaye hue (untracked) files `git restore` se nahi hatte. Unhein khud delete karna hoga.
