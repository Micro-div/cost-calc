"use client";

import { useEffect, useRef, useState } from "react";
import type { Complexity, CustomCategory, CustomLocation, ProjectDraft } from "@/lib/chatbot/types";
import {
  cacheParams,
  emptyMemory,
  getCached,
  loadMemory,
  newId,
  rememberQA,
  saveMemory,
  type ChatMsg,
  type Memory,
} from "@/lib/chatbot/memory";
import { localAnswer, looksUrdu, matchSupportedCountry, offlineCountry } from "@/lib/chatbot/fallback";

// categoryId: one of the 8 ids, "custom:<name>" (customCategory set), or "auto" (keep detectCategory)
export type ApplyProject = { description: string; categoryId: string; complexity: Complexity; customCategory?: CustomCategory };
export type ApplyCountry = { locationId?: string; custom?: CustomLocation };

type Props = {
  supportedCountries: { id: string; country: string }[];
  onApplyProject: (p: ApplyProject) => void; // fills description box + category select
  onApplyCountry: (c: ApplyCountry) => void; // fills country select
  onRunEstimate: () => void; // starts the normal estimate flow
  estimateSummary?: string; // formatted result of the current estimate (from the engine)
};

const S = (ur: boolean) => ({
  hello: ur
    ? "Assalam o alaikum! Apna project idea batayein. Main use clear kar ke estimate ke liye tayyar kar dunga."
    : "Hi! Tell me your project idea and I'll turn it into a clear brief ready for a cost estimate.",
  yes: ur ? "Haan, estimate chahiye" : "Yes, estimate it",
  no: ur ? "Abhi nahi" : "Not now",
  skipped: ur ? "Theek hai. Jab chahein estimate bata dein." : "Okay. Ask whenever you want an estimate.",
  askCountry: ur
    ? "Estimate kis country ke hisab se chahiye? Neeche se chunein ya country ka naam likhein."
    : "Which country should the estimate be for? Pick one below or type a country name.",
  other: ur ? "Doosri country: naam likhein" : "Other country: type its name",
  looking: ur ? "Is country ke local rates web par dhoond raha hun..." : "Looking up local rates on the web...",
  noData: ur
    ? "Is country ka data nahi mil saka. Koi aur country chunein ya thori der baad dobara try karein."
    : "I couldn't get rates for that country. Pick another or try again shortly.",
  filled: ur ? "Form bhar diya gaya hai. Estimate ban raha hai." : "The form is filled in. Your estimate is being generated.",
  offline: ur
    ? "AI abhi available nahi hai. Aap apna text description bana kar normal estimate chala sakte hain."
    : "The AI is unavailable right now. You can still run a normal estimate using your own text.",
  useText: ur ? "Mera text use karo" : "Use my text",
  retry: ur ? "Dobara try karein" : "Retry",
  placeholder: ur ? "Apna sawal ya project idea likhein..." : "Ask a question or describe your idea...",
});

const mk = (role: ChatMsg["role"], text: string, note?: string): ChatMsg => ({ id: newId(), role, text, ts: Date.now(), note });

export default function ChatBot({ supportedCountries, onApplyProject, onApplyCountry, onRunEstimate, estimateSummary }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ProjectDraft | null>(null); // brief waiting for "yes"
  const [awaiting, setAwaiting] = useState<ProjectDraft | null>(null); // waiting for country
  const [retryText, setRetryText] = useState<string | null>(null);
  const [ur, setUr] = useState(false);
  const mem = useRef<Memory>(emptyMemory());
  const endRef = useRef<HTMLDivElement>(null);
  const t = S(ur);

  useEffect(() => {
    mem.current = loadMemory();
    setMessages(mem.current.messages);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, open, pending, awaiting]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const push = (m: ChatMsg) => {
    mem.current.messages = [...mem.current.messages, m].slice(-40);
    setMessages(mem.current.messages);
    saveMemory(mem.current);
  };

  // ---------- research helpers: server (web search) -> cache -> offline table ----------
  async function lookup<T>(key: string, url: string, payload: object, fallback: () => T | null): Promise<T | null> {
    const fresh = getCached<T>(mem.current, key, 30);
    if (fresh) return { ...(fresh as object), origin: "cache" } as T;
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(String(r.status));
      const data = { ...(await r.json()), origin: "web" } as T;
      cacheParams(mem.current, key, data);
      saveMemory(mem.current);
      return data;
    } catch {
      const stale = getCached<T>(mem.current, key, Infinity);
      if (stale) return { ...(stale as object), origin: "cache" } as T;
      return fallback();
    }
  }

  async function resolveCategory(d: ProjectDraft): Promise<ApplyProject> {
    const base = { description: d.description, complexity: d.complexity };
    if (d.category !== "custom") return { ...base, categoryId: d.category };
    const name = d.customCategoryName || d.title || "Custom project";
    const cat = await lookup<CustomCategory>(
      `cat:${name.toLowerCase()}`,
      "/api/estimate-params",
      { kind: "category", name, description: d.description },
      () => ({ name, baseUsd: 6000, hours: 200, weeks: 6, origin: "offline" as const }),
    );
    return { ...base, categoryId: `custom:${name}`, customCategory: cat ?? undefined };
  }

  async function finishWithCountry(text: string, d: ProjectDraft) {
    const id = matchSupportedCountry(text, supportedCountries);
    if (id) {
      onApplyCountry({ locationId: id });
    } else {
      push(mk("assistant", t.looking));
      const loc = await lookup<CustomLocation>(
        `loc:${text.toLowerCase().trim()}`,
        "/api/estimate-params",
        { kind: "location", country: text },
        () => offlineCountry(text),
      );
      if (!loc) {
        push(mk("assistant", t.noData));
        setAwaiting(d); // let the user pick another country
        return;
      }
      onApplyCountry({ custom: loc });
      const src = loc.origin === "web" ? loc.sources.map((s) => s.title).filter(Boolean).slice(0, 2).join(", ") : loc.origin;
      push(
        mk(
          "assistant",
          `${loc.country}: ${loc.currency}, tax ${Math.round(loc.taxRate * 1000) / 10}%, price level ${loc.multiplier.toFixed(2)}x${src ? ` (${src})` : ""}.`,
          loc.origin === "web" ? undefined : loc.origin === "cache" ? "saved data" : "approximate offline data",
        ),
      );
    }
    setAwaiting(null);
    push(mk("assistant", t.filled));
    onRunEstimate();
  }

  // ---------- user actions ----------
  async function acceptEstimate() {
    const d = pending;
    if (!d || busy) return;
    setPending(null);
    push(mk("user", t.yes));
    setBusy(true);
    try {
      onApplyProject(await resolveCategory(d)); // category + description boxes fill here
      if (d.country) await finishWithCountry(d.country, d);
      else {
        push(mk("assistant", t.askCountry));
        setAwaiting(d);
      }
    } finally {
      setBusy(false);
    }
  }

  function declineEstimate() {
    setPending(null);
    push(mk("user", t.no));
    push(mk("assistant", t.skipped));
  }

  async function pickCountry(name: string) {
    if (!awaiting || busy) return;
    push(mk("user", name));
    setBusy(true);
    try {
      await finishWithCountry(name, awaiting);
    } finally {
      setBusy(false);
    }
  }

  async function send(raw: string) {
    const text = raw.trim().slice(0, 1500);
    if (!text || busy) return;
    const isUr = looksUrdu(text);
    setUr(isUr);
    setInput("");
    setRetryText(null);

    // while we wait for a country, a short plain answer is treated as the country name
    if (awaiting && text.length <= 40 && !text.includes("?")) return void pickCountry(text);

    push(mk("user", text));
    setPending(null);
    setAwaiting(null);
    setBusy(true);
    try {
      const history = [...mem.current.messages].slice(-12).map((m) => ({ role: m.role, content: m.text }));
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, estimateSummary }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { reply: string; offerEstimate: boolean; project?: ProjectDraft };
      push(mk("assistant", d.reply));
      if (!estimateSummary) rememberQA(mem.current, text, d.reply);
      if (d.project) {
        mem.current.draft = d.project;
        if (d.offerEstimate) setPending(d.project);
      }
      saveMemory(mem.current);
    } catch {
      // AI/server down: saved answer -> FAQ -> honest message. The estimate engine still works offline.
      const a = localAnswer(text, mem.current);
      const s = S(isUr);
      if (a.source !== "none") {
        push(mk("assistant", a.text, a.source === "saved" ? "saved answer (offline)" : "built-in answer (offline)"));
      } else {
        push(mk("assistant", s.offline, "offline"));
        if (text.length >= 12) {
          setPending({ title: "My project", description: text.slice(0, 500), features: [], category: "auto", complexity: "medium" });
        }
        setRetryText(text);
      }
    } finally {
      setBusy(false);
    }
  }

  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="print:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open project assistant"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#6754e7] text-white shadow-lg transition hover:bg-[#5644d4] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#6754e7]/40"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Project assistant"
          className="fixed bottom-0 right-0 z-50 flex h-[min(82vh,620px)] w-full flex-col overflow-hidden bg-white shadow-2xl sm:bottom-5 sm:right-5 sm:w-[400px] sm:rounded-2xl"
        >
          <header className="flex items-center justify-between bg-[#1c1923] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Project assistant</p>
              <p className="text-xs text-white/60">Prices come from the CostCalc engine</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-md p-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#faf9ff] px-4 py-4" aria-live="polite">
            <Bubble role="assistant" text={t.hello} />
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} note={m.note} />
            ))}
            {busy && <p className="text-xs text-[#6b6778]">...</p>}

            {pending && !busy && (
              <div className="flex flex-wrap gap-2">
                <Chip primary onClick={acceptEstimate}>{t.yes}</Chip>
                <Chip onClick={declineEstimate}>{t.no}</Chip>
              </div>
            )}
            {awaiting && !busy && (
              <div className="flex flex-wrap gap-2">
                {supportedCountries.map((c) => (
                  <Chip key={c.id} onClick={() => pickCountry(c.country)}>{c.country}</Chip>
                ))}
                <p className="w-full text-xs text-[#6b6778]">{t.other}</p>
              </div>
            )}
            {retryText && !busy && lastIsAssistant && (
              <div className="flex gap-2">
                <Chip onClick={() => send(retryText)}>{t.retry}</Chip>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-[#ece9fa] bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 1500))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              dir="auto"
              rows={1}
              placeholder={t.placeholder}
              aria-label="Message"
              className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-[#d9d5f3] px-3 py-2 text-sm text-[#1c1923] focus:border-[#6754e7] focus:outline-none focus:ring-2 focus:ring-[#6754e7]/30"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="h-[42px] rounded-xl bg-[#6754e7] px-4 text-sm font-semibold text-white transition hover:bg-[#5644d4] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6754e7]/50"
            >
              Send
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

function Bubble({ role, text, note }: { role: "user" | "assistant"; text: string; note?: string }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${mine ? "bg-[#6754e7] text-white" : "bg-white text-[#1c1923] shadow-sm ring-1 ring-[#ece9fa]"}`} dir="auto">
        {text}
        {note && <span className="mt-1 block text-[11px] italic opacity-60">{note}</span>}
      </div>
    </div>
  );
}

function Chip({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6754e7]/50 ${primary ? "bg-[#6754e7] text-white hover:bg-[#5644d4]" : "border border-[#d9d5f3] bg-white text-[#1c1923] hover:bg-[#f3f1ff]"}`}
    >
      {children}
    </button>
  );
}
