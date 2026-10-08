"use client";

import { useEffect, useState } from "react";
import { looksUrdu } from "@/lib/chatbot/fallback";

// Structural type: your real EstimateResult already satisfies it.
export type EstimateLike = {
  projectTitle: string;
  description: string;
  category: { name: string };
  location: { country: string };
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

type Detail = {
  headline: string;
  why: string;
  phases: { name: string; weeks: string; deliverables: string[] }[];
  scope: string[];
  assumptions: string[];
  risks: { risk: string; fix: string }[];
  tips: string[];
  next: string[];
};

const CACHE_KEY = "costcalc-detail-cache-v1";

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

  const lang = language || (looksUrdu(estimate.description) ? "Roman Urdu" : "English");
  const payload = {
    description: estimate.description.slice(0, 500),
    language: lang,
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
    const hit = readCache()[key];
    if (hit) {
      setDetail(hit.d);
      setState("ready");
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
        if (alive) setState("failed"); // static scope/assumptions on the page stay visible
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state === "failed") {
    return <p className="mt-6 text-sm text-[#6b6778]">Detailed AI notes are unavailable right now. The estimate above is complete and unaffected.</p>;
  }
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
          <h4 className="mb-2 text-sm font-semibold">Delivery plan</h4>
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

      <Block title="What is included" items={detail.scope} />
      <Block title="Assumptions" items={detail.assumptions} />

      {detail.risks.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Risks that can change the price</h4>
          <ul className="space-y-2 text-sm text-[#4b4757]">
            {detail.risks.map((r) => (
              <li key={r.risk}>
                <span className="font-medium text-[#1c1923]">{r.risk}</span> - {r.fix}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Block title="Ways to reduce cost" items={detail.tips} />
      <Block title="Next steps" items={detail.next} />
      <p className="text-xs text-[#6b6778]">Written by AI from the figures above. All amounts come from the CostCalc engine. This is a preliminary estimate, not a legally binding quotation.</p>
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
