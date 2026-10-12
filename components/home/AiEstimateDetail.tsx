"use client";

import { useEffect, useState } from "react";
import { offlineDetail, resolveLang, type Detail, type DetailEstimate } from "@/lib/chatbot/offline";

// Structural type: your real EstimateResult already satisfies it.
export type EstimateLike = {
  projectTitle: string;
  description: string;
  category: { name: string; id?: string };
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

const CACHE_KEY = "costcalc-detail-cache-v1";

const HEADINGS: Record<string, { plan: string; scope: string; assumptions: string; risks: string; tips: string; next: string; offline: string; ai: string }> = {
  en: {
    plan: "Delivery plan",
    scope: "What is included",
    assumptions: "Assumptions",
    risks: "Risks that can change the price",
    tips: "Ways to reduce cost",
    next: "Next steps",
    offline: "Written from the figures above using built-in data. All amounts come from the CostCalc engine. This is a preliminary estimate, not a legally binding quotation.",
    ai: "AI notes based on the figures above. All amounts come from the CostCalc engine. This is a preliminary estimate, not a legally binding quotation.",
  },
  roman: {
    plan: "Delivery plan",
    scope: "Kya kya shamil hai",
    assumptions: "Bunyadi assumptions",
    risks: "Wo risks jo price badal sakte hain",
    tips: "Cost kam karne ke tareeqay",
    next: "Agle qadam",
    offline: "Upar di gayi figures se built-in data ki madad se likha gaya. Tamam raqam CostCalc engine se hain. Ye ibtidayi estimate hai, qanooni tor par paband quotation nahi.",
    ai: "Upar di gayi figures par mabni AI notes. Tamam raqam CostCalc engine se hain. Ye ibtidayi estimate hai, qanooni tor par paband quotation nahi.",
  },
  urdu: {
    plan: "ڈیلیوری پلان",
    scope: "کیا کیا شامل ہے",
    assumptions: "بنیادی مفروضے",
    risks: "وہ خطرات جو قیمت بدل سکتے ہیں",
    tips: "لاگت کم کرنے کے طریقے",
    next: "اگلے مراحل",
    offline: "اوپر دی گئی تفصیلات سے بلٹ اِن ڈیٹا کی مدد سے لکھا گیا۔ تمام رقوم CostCalc انجن سے ہیں۔ یہ ابتدائی اندازہ ہے، قانونی طور پر پابند کوٹیشن نہیں۔",
    ai: "اوپر دی گئی تفصیلات پر مبنی AI نوٹس۔ تمام رقوم CostCalc انجن سے ہیں۔ یہ ابتدائی اندازہ ہے، قانونی طور پر پابند کوٹیشن نہیں۔",
  },
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
};
const readCache = (): Record<string, { d: Detail; ts: number }> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeCache = (key: string, d: Detail) => {
  try {
    const all = readCache();
    all[key] = { d, ts: Date.now() };
    const keep = Object.entries(all).sort((a, b) => b[1].ts - a[1].ts).slice(0, 20);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    /* ignore */
  }
};

export default function AiEstimateDetail({ estimate, currency, language }: { estimate: EstimateLike; currency: string; language?: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [offline, setOffline] = useState(false);

  const lang = resolveLang(estimate.description, language);
  const headings = HEADINGS[lang] ?? HEADINGS.en;
  const payload = {
    description: estimate.description.slice(0, 500),
    language: lang === "urdu" ? "Urdu" : lang === "roman" ? "Roman Urdu" : "English",
    estimate: {
      title: estimate.projectTitle,
      category: estimate.category.name,
      country: estimate.location.country,
      currency,
      size: estimate.size.name,
      quality: estimate.quality.name,
      items: estimate.items.map((i) => ({ name: i.name, amount: i.quantity * i.rate })),
      subtotal: estimate.subtotal,
      contingency: estimate.contingency,
      taxes: estimate.taxes,
      total: estimate.total,
      low: estimate.low,
      high: estimate.high,
      durationMin: estimate.durationMin,
      durationMax: estimate.durationMax,
      confidence: estimate.confidence,
    },
  };
  const key = hash(JSON.stringify(payload));

  useEffect(() => {
    let alive = true;
    setState("loading");
    setOffline(false);

    const fallback = () => {
      const d = offlineDetail(estimate as DetailEstimate, lang, currency);
      setDetail(d);
      setOffline(true);
      setState("ready");
    };

    const hit = readCache()[key];
    if (hit) {
      setDetail(hit.d);
      setState("ready");
      return;
    }
    // No internet: skip the network entirely and build the detail locally.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      fallback();
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/estimate-detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as Detail;
        if (!alive) return;
        writeCache(key, d);
        setDetail(d);
        setState("ready");
      } catch {
        if (alive) fallback();
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state === "loading" || !detail) {
    return (
      <div className="mt-6 animate-pulse space-y-3 rounded-2xl border border-[#ece9fa] bg-white p-6" aria-busy="true" aria-label="Preparing detailed notes">
        <div className="h-5 w-2/3 rounded bg-[#ece9fa]" />
        <div className="h-4 w-full rounded bg-[#f3f1ff]" />
        <div className="h-4 w-5/6 rounded bg-[#f3f1ff]" />
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-[#ece9fa] bg-white p-6 text-[#1c1923]" dir="auto">
      <div>
        <h3 className="text-lg font-semibold">{detail.headline}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#4b4757]">{detail.why}</p>
      </div>

      {detail.phases.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">{headings.plan}</h4>
          <ol className="space-y-3">
            {detail.phases.map((p) => (
              <li key={p.name} className="rounded-xl bg-[#faf9ff] p-3">
                <p className="text-sm font-medium">
                  {p.name} <span className="font-normal text-[#6b6778]">({p.weeks})</span>
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-[#4b4757]">
                  {p.deliverables.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Block title={headings.scope} items={detail.scope} />
      <Block title={headings.assumptions} items={detail.assumptions} />

      {detail.risks.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">{headings.risks}</h4>
          <ul className="space-y-2 text-sm text-[#4b4757]">
            {detail.risks.map((r) => (
              <li key={r.risk}>
                <span className="font-medium text-[#1c1923]">{r.risk}</span> - {r.fix}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Block title={headings.tips} items={detail.tips} />
      <Block title={headings.next} items={detail.next} />
      <p className="text-xs text-[#6b6778]">{offline ? headings.offline : headings.ai}</p>
    </section>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm text-[#4b4757]">
        {items.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </div>
  );
}
