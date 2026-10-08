// Single source of truth about CostCalc. Used (1) in the AI system prompt and
// (2) as an offline FAQ when the AI/server is unreachable.
// If you change pricing rules in lib/index.ts, update this text too.

export const PROJECT_KNOWLEDGE = `ABOUT COSTCALC
CostCalc is a web app that gives a fast, localized cost estimate and an editable quotation for digital projects.
Flow: (1) user describes the project (12-500 chars); (2) picks country and category; (3) answers two questions: size (small=Focused, medium=Standard, large=Complex) and quality (essential, standard, premium); (4) gets the estimate page; (5) can open an editable quotation and save it as PDF (print).
CATEGORIES (8): web, mobile, ecommerce, design (UI/UX), seo, social (social media management), branding, ai.
COUNTRIES (10 built in): us, ca, uk, ae, pk, in, au, de, sg, ng. For any other country the assistant looks up local price level, tax and exchange rate on the web, then feeds them into the same engine.
PRICE CALCULATION (done by code, never by AI): base price of category x country price level x size factor x quality factor, converted to local currency. Split into 5 line items: Discovery & strategy 14%, UX & UI design 16%, Development 42%, Quality assurance 16%, Project management 12%. Then +5% contingency and the country's tax on (subtotal + contingency). Range: low = total -12%, high = total +17%. Timeline (weeks) scales with size and quality, +/-20%. Confidence 80-94% rises with how detailed the description is.
LIMITS: The result is a preliminary market estimate, not a legally binding quotation. Exchange rates are snapshots, not live. Quotation is valid 30 days; a 50% deposit may apply. History is stored only in the user's own browser (last 50 estimates).
PRIVACY: Text typed in the app or chat is sent to an AI provider to produce answers. CostCalc does not store it on a server.`;

export type FaqItem = { keys: string[]; en: string; ur: string };

// ur = Roman Urdu. keys are matched against the normalized question.
export const FAQ: FaqItem[] = [
  {
    keys: ["what is costcalc", "costcalc kya", "project kya", "kya hai ye"],
    en: "CostCalc turns a plain description of your digital project into a localized cost estimate, a timeline and an editable quotation you can save as PDF.",
    ur: "CostCalc aapke digital project ke description se local cost estimate, timeline aur editable quotation (PDF) bana deta hai.",
  },
  {
    keys: ["how does it work", "kaise work", "kaisy work", "kaise kaam", "kaisy kaam", "steps"],
    en: "1) Describe your project. 2) Pick country and category. 3) Choose size and quality. 4) Get the estimate with breakdown, range and timeline. 5) Open the quotation and save it as PDF.",
    ur: "1) Project describe karein. 2) Country aur category chunein. 3) Size aur quality chunein. 4) Breakdown, range aur timeline wala estimate milta hai. 5) Quotation khol kar PDF save karein.",
  },
  {
    keys: ["how is price calculated", "price kaise", "price kaisy", "formula", "calculate", "accurate"],
    en: "Price = category base x country price level x size x quality, split into 5 work items, plus 5% contingency and local tax. Range is -12% / +17%. The math is done by fixed code, not by AI, so the same input always gives the same price.",
    ur: "Price = category base x country price level x size x quality, jo 5 work items mein banta hai, phir 5% contingency aur local tax lagta hai. Range -12% / +17% hai. Hisab code karta hai, AI nahi, isliye same input par same price aata hai.",
  },
  {
    keys: ["categories", "category", "services"],
    en: "8 categories: website, mobile app, ecommerce, UI/UX design, SEO, social media management, branding/graphic design and AI solutions.",
    ur: "8 categories hain: website, mobile app, ecommerce, UI/UX design, SEO, social media, branding/graphic design aur AI solutions.",
  },
  {
    keys: ["countries", "country", "kon si country", "which country"],
    en: "10 countries are built in: US, Canada, UK, UAE, Pakistan, India, Australia, Germany, Singapore, Nigeria. For other countries the assistant looks up local rates on the web.",
    ur: "10 countries built-in hain: US, Canada, UK, UAE, Pakistan, India, Australia, Germany, Singapore, Nigeria. Baqi countries ke liye assistant web se local rates dhoondta hai.",
  },
  {
    keys: ["tax", "contingency", "range", "confidence"],
    en: "Contingency is a fixed 5%. Tax is the country's rate applied to subtotal + contingency. Range is -12% to +17%. Confidence (80-94%) grows with how detailed your description is.",
    ur: "Contingency fixed 5% hai. Tax country ke rate se (subtotal + contingency) par lagta hai. Range -12% se +17% hai. Confidence (80-94%) description jitna detailed ho utna barhta hai.",
  },
  {
    keys: ["privacy", "private", "data safe", "save", "history"],
    en: "Your history is saved only in your own browser. Text you type here is sent to an AI provider to answer you; CostCalc does not keep it on a server.",
    ur: "History sirf aapke apne browser mein save hoti hai. Yahan likha text jawab ke liye AI provider ko jata hai; CostCalc usay server par store nahi karta.",
  },
  {
    keys: ["quotation", "pdf", "download"],
    en: "After the estimate, open the quotation, edit quantities and rates, then use Download PDF (it uses your browser's print-to-PDF). It is valid for 30 days.",
    ur: "Estimate ke baad quotation kholein, quantity/rate edit karein, phir Download PDF dabayein (browser ka print-to-PDF). Ye 30 din valid hota hai.",
  },
];
