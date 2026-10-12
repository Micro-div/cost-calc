// Offline "brain" for the assistant. When the AI/server is unreachable these
// helpers still produce useful results in the user's own language:
//   - offlineBrief():  turn a raw description into a project brief
//   - offlineDetail(): turn an estimate into the detailed write-up section
//     (the same shape the AI detail route returns), so the result page is never
//     left with an "unavailable" gap.
import { detectCategory } from "@/lib";
import { scopeByCategory } from "@/constants";
import type { CustomCategory } from "./types";
import {
  detectLang,
  matchesBusinessTemplate,
  offlineCategory,
  type Lang,
} from "./fallback";

// ---- shared bits ----
export type Detail = {
  headline: string;
  why: string;
  phases: { name: string; weeks: string; deliverables: string[] }[];
  scope: string[];
  assumptions: string[];
  risks: { risk: string; fix: string }[];
  tips: string[];
  next: string[];
};

export type DetailEstimate = {
  projectTitle: string;
  description: string;
  category: { id?: string; name: string };
  location: { country: string; city?: string; currency?: string; taxRate?: number };
  size: { name: string };
  quality: { name: string };
  items: { name: string; quantity: number; rate: number }[];
  subtotal: number;
  contingency: number;
  taxes: number;
  total: number;
  low: number;
  high: number;
  confidence: number;
  durationMin: number;
  durationMax: number;
};

type Strings = {
  weeks: string;
  headline: (title: string, size: string, quality: string, min: number, max: number) => string;
  why: (country: string, city: string, low: string, high: string) => string;
  plan: string;
  phases: { name: string; deliverables: string[] }[];
  scopeTitle: string;
  scopeFallback: string[];
  assumptionsTitle: string;
  assumptions: string[];
  risksTitle: string;
  risks: { risk: string; fix: string }[];
  tipsTitle: string;
  tips: string[];
  nextTitle: string;
  next: string[];
  note: string;
};

const T = (lang: Lang): Strings => {
  if (lang === "urdu") {
    return {
      weeks: "ہفتے",
      headline: (title, size, quality, min, max) =>
        `${title} — ${size} دائرہ، ${quality} کوالٹی، تخمینی دورانیہ ${min}–${max} ہفتے۔`,
      why: (country, city, low, high) =>
        `یہ اندازہ ${city}، ${country} کی مقامی قیمتوں، منتخب سائز اور کوالٹی، 5% کنٹینجینسی اور مقامی ٹیکس سے بنایا گیا ہے۔ متوقع رینج ${low} سے ${high} ہے۔`,
      plan: "ڈیلیوری پلان",
      phases: [
        { name: "دریافت اور منصوبہ بندی", deliverables: ["ضروریات اور دائرہ کار طے کرنا", "منصوبہ اور ٹائم لائن"] },
        { name: "ڈیزائن", deliverables: ["لے آؤٹ اور بصری ڈیزائن", "منظوری کے لیے پیشکش"] },
        { name: "تعمیر اور ترتیب", deliverables: ["بنیادی کام مکمل کرنا", "انضمام اور جانچ"] },
        { name: "لانچ اور حوالگی", deliverables: ["حتمی جانچ اور لانچ", "دستاویزات اور تربیت"] },
      ],
      scopeTitle: "کیا کیا شامل ہے",
      scopeFallback: ["منصوبے کی منصوبہ بندی اور تیاری", "بنیادی تعمیراتی کام", "سامان اور ابتدائی اسٹاک", "لانچ، جانچ اور تربیت"],
      assumptionsTitle: "بنیادی مفروضے",
      assumptions: [
        "قیمتیں فی الوقت دستیاب مقامی ڈیٹا پر مبنی ہیں۔",
        "دائرہ کار میں کوئی بڑی تبدیلی قیمت بدل سکتی ہے۔",
        "ٹیکس اور شرحِ مبادلہ تخمینی ہیں۔",
      ],
      risksTitle: "وہ خطرات جو قیمت بدل سکتے ہیں",
      risks: [
        { risk: "دائرہ کار میں اضافہ", fix: "لکھا ہوا دائرہ کار طے کریں اور تبدیلیوں کی منظوری لیں۔" },
        { risk: "سامان یا مواد کی قیمت میں اضافہ", fix: "اہم اشیاء پہلے سے خرید لیں یا متبادل رکھیں۔" },
        { risk: "دیر سے فیصلے", fix: "اہم فیصلے شروع میں کر لیں۔" },
      ],
      tipsTitle: "لاگت کم کرنے کے طریقے",
      tips: ["کم اہم فیچرز بعد کے مرحلے میں ڈالیں۔", "چھوٹے دائرے سے شروع کریں، بعد میں بڑھائیں۔", "مقامی اور تیار حل استعمال کریں۔"],
      nextTitle: "اگلے مراحل",
      next: ["کوٹیشن کھولیں اور آئٹمز ایڈٹ کریں۔", "PDF محفوظ کریں۔", "دائرہ کار اور ٹائم لائن حتمی کریں۔"],
      note: "تمام رقوم CostCalc انجن سے ہیں۔ یہ ابتدائی اندازہ ہے، قانونی طور پر پابند کوٹیشن نہیں۔",
    };
  }
  if (lang === "roman") {
    return {
      weeks: "haftay",
      headline: (title, size, quality, min, max) =>
        `${title} — ${size} scope, ${quality} quality, takmeeni waqt ${min}–${max} haftay.`,
      why: (country, city, low, high) =>
        `Ye estimate ${city}, ${country} ke local rates, chuni hui size aur quality, 5% contingency aur local tax se bana hai. Tawaqqo range ${low} se ${high} hai.`,
      plan: "Delivery plan",
      phases: [
        { name: "Samajh aur planning", deliverables: ["Requirements aur scope tay karna", "Plan aur timeline"] },
        { name: "Design", deliverables: ["Layout aur visual design", "Approval ke liye peshkash"] },
        { name: "Build aur setup", deliverables: ["Main kaam mukammal karna", "Integration aur testing"] },
        { name: "Launch aur handover", deliverables: ["Final testing aur launch", "Documentation aur training"] },
      ],
      scopeTitle: "Kya kya shamil hai",
      scopeFallback: ["Project ki planning aur taiyari", "Main build ka kaam", "Equipment aur opening stock", "Launch, testing aur training"],
      assumptionsTitle: "Bunyadi assumptions",
      assumptions: [
        "Rates filhal dastiyab local data par mabni hain.",
        "Scope mein bari tabdeeli price badal sakti hai.",
        "Tax aur exchange rate takmeeni hain.",
      ],
      risksTitle: "Wo risks jo price badal sakte hain",
      risks: [
        { risk: "Scope mein izafa", fix: "Likha hua scope tay karein aur tabdeelion ki approval lein." },
        { risk: "Material ya equipment mehnga ho jaye", fix: "Ahem cheezein pehle khareed lein ya alternate rakhein." },
        { risk: "Der se faislay", fix: "Bunyadi faislay shuru mein kar lein." },
      ],
      tipsTitle: "Cost kam karne ke tareeqay",
      tips: ["Kam ahem features baad ke phase mein daalein.", "Chhote scope se shuru karein, baad mein barhayein.", "Local aur ready-made solutions use karein."],
      nextTitle: "Agle qadam",
      next: ["Quotation kholein aur items edit karein.", "PDF save karein.", "Scope aur timeline final karein."],
      note: "Tamam raqam CostCalc engine se hain. Ye ibtidayi estimate hai, qanooni tor par paband quotation nahi.",
    };
  }
  return {
    weeks: "weeks",
    headline: (title, size, quality, min, max) =>
      `${title} — ${size} scope, ${quality} quality, about ${min}–${max} weeks.`,
    why: (country, city, low, high) =>
      `This estimate uses local rates in ${city}, ${country}, the chosen size and quality, a 5% contingency and local tax. The expected range is ${low} to ${high}.`,
    plan: "Delivery plan",
    phases: [
      { name: "Discovery & planning", deliverables: ["Agree requirements and scope", "Plan and timeline"] },
      { name: "Design", deliverables: ["Layout and visual design", "Presentation for approval"] },
      { name: "Build & setup", deliverables: ["Complete the main work", "Integrations and testing"] },
      { name: "Launch & handover", deliverables: ["Final testing and launch", "Documentation and training"] },
    ],
    scopeTitle: "What is included",
    scopeFallback: ["Planning and preparation", "The main build work", "Equipment and opening stock", "Launch, testing and training"],
    assumptionsTitle: "Key assumptions",
    assumptions: [
      "Rates are based on currently available local data.",
      "A major scope change may change the price.",
      "Tax and exchange rate are approximate.",
    ],
    risksTitle: "Risks that can change the price",
    risks: [
      { risk: "Scope grows", fix: "Agree the scope in writing and approve any change." },
      { risk: "Material or equipment price rises", fix: "Buy key items early or keep alternatives." },
      { risk: "Late decisions", fix: "Make the key decisions at the start." },
    ],
    tipsTitle: "Ways to reduce cost",
    tips: ["Move lower-priority features to a later phase.", "Start with a smaller scope and expand later.", "Use local and ready-made solutions."],
    nextTitle: "Next steps",
    next: ["Open the quotation and edit the items.", "Save it as a PDF.", "Finalise the scope and timeline."],
    note: "All amounts come from the CostCalc engine. This is a preliminary estimate, not a legally binding quotation.",
  };
};

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
};

// Build a usable project brief with no AI involved.
export function offlineBrief(text: string): {
  description: string;
  categoryId: string;
  complexity: "small" | "medium" | "large";
  customCategory?: CustomCategory;
} {
  const description = text.replace(/\s+/g, " ").trim().slice(0, 500);
  const lower = description.toLowerCase();

  // Complexity: words first, then description length as a rough proxy.
  const words = description.trim().split(/\s+/).length;
  const complexity: "small" | "medium" | "large" = /\b(enterprise|complex|advanced|multi|large|big|bara|bara|بڑا)\b/.test(lower)
    ? "large"
    : /\b(simple|basic|small|mini|landing|chhota|چھوٹا|سادہ)\b/.test(lower) || words < 12
      ? "small"
      : "medium";

  // Known offline business -> custom category with a real breakdown.
  if (matchesBusinessTemplate(description)) {
    const custom = offlineCategory("", description);
    return { description, categoryId: `custom:${custom.name}`, complexity, customCategory: custom };
  }

  return { description, categoryId: detectCategory(description), complexity };
}

export function offlineDetail(e: DetailEstimate, lang: Lang, currency?: string): Detail {
  const s = T(lang);
  const cur = currency || e.location.currency || "USD";
  const avg = Math.max(1, Math.round((e.durationMin + e.durationMax) / 2));
  const span = (from: number, to: number) => `${Math.max(1, Math.round(avg * from))}–${Math.max(2, Math.round(avg * to))}`;

  const phaseWeeks = [span(0.1, 0.2), span(0.15, 0.3), span(0.3, 0.5), span(0.15, 0.25)];
  const phases = s.phases.map((p, i) => ({ name: p.name, weeks: `${phaseWeeks[i]} ${s.weeks}`, deliverables: p.deliverables }));

  const categoryScope = e.category.id ? scopeByCategory[e.category.id as keyof typeof scopeByCategory] : undefined;
  const scope = categoryScope?.length ? [...categoryScope] : e.items.length ? e.items.map((i) => i.name) : s.scopeFallback;

  return {
    headline: s.headline(e.projectTitle, e.size.name, e.quality.name, e.durationMin, e.durationMax),
    why: s.why(e.location.country, e.location.city || e.location.country, money(e.low, cur), money(e.high, cur)),
    phases,
    scope,
    assumptions: s.assumptions,
    risks: s.risks,
    tips: s.tips,
    next: s.next,
  };
}

// Small helper the UI can use to pick a language from free text or a hint.
export function resolveLang(text: string, hint?: string): Lang {
  const h = (hint || "").toLowerCase();
  if (h.includes("urdu script") || h === "urdu") return "urdu";
  if (h.includes("roman")) return "roman";
  if (h.includes("english")) return "en";
  return detectLang(text);
}
