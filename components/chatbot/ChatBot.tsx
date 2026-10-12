"use client";

import { useEffect, useRef, useState } from "react";
import { categories, projectSizes, qualityOptions } from "@/constants";
import type { ProjectSizeId, QualityId } from "@/types";
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
import {
  detectLang,
  localAnswer,
  matchSupportedCountry,
  offlineCategory,
  offlineCountry,
  type Lang,
} from "@/lib/chatbot/fallback";
import { offlineBrief } from "@/lib/chatbot/offline";

// categoryId: one of the 8 ids, "custom" (custom category set), or "auto" (keep detectCategory)
export type ApplyProject = {
  description: string;
  categoryId: string;
  complexity: Complexity;
  qualityId?: QualityId;
  customCategory?: CustomCategory;
  customCategoryName?: string;
};
export type ApplyCountry = { locationId?: string; city?: string; custom?: CustomLocation };

type SupportedCountry = { id: string; country: string; cities: string[] };
type AwaitingCity = { locationId: string; country: string };

type PendingSetup = {
  project: ProjectDraft;
  sizeId: ProjectSizeId;
  qualityId: QualityId;
  categoryId: string; // builtin id | "custom"
  customCategoryName?: string;
  customCategory?: CustomCategory;
};

type Props = {
  supportedCountries: SupportedCountry[];
  onApplyProject: (p: ApplyProject) => void; // fills description box + category/size/quality
  onApplyCountry: (c: ApplyCountry) => void; // fills country + city select
  onRunEstimate: () => void; // starts the normal estimate flow
  estimateSummary?: string; // formatted result of the current estimate (from the engine)
};

type Phase = "closed" | "open" | "min";

const POS_KEY_LAUNCHER = "costcalc-chat-launcher-v1";

// ---- all UI text in the three languages the assistant speaks ----
const S = (lang: Lang) => {
  const ur = lang === "urdu";
  const ro = lang === "roman";
  const pick = (en: string, roman: string, urdu: string) => (ur ? urdu : ro ? roman : en);
  return {
    hello: pick(
      "Hi! Tell me your project idea and I'll turn it into a clear brief ready for a cost estimate.",
      "Assalam o alaikum! Apna project idea batayein. Main use clear kar ke estimate ke liye tayyar kar dunga.",
      "السلام علیکم! اپنے پروجیکٹ کا آئیڈیا بتائیں، میں اسے واضح کر کے اندازے کے لیے تیار کر دیتا ہوں۔",
    ),
    yes: pick("Yes, estimate it", "Haan, estimate chahiye", "ہاں، اندازہ چاہیے"),
    no: pick("Not now", "Abhi nahi", "ابھی نہیں"),
    skipped: pick("Okay. Ask whenever you want an estimate.", "Theek hai. Jab chahein estimate bata dein.", "ٹھیک ہے۔ جب چاہیں اندازہ بتا دیں۔"),
    askCountry: pick(
      "Which country should the estimate be for? Pick one below or type a country name (any country works).",
      "Estimate kis country ke hisab se chahiye? Neeche se chunein ya country ka naam likhein (koi bhi country).",
      "اندازہ کس ملک کے حساب سے چاہیے؟ نیچے سے چنیں یا ملک کا نام لکھیں (کوئی بھی ملک)۔",
    ),
    askCity: (country: string) =>
      pick(
        `Pick a city in ${country} (5 available) or type your own.`,
        `${country} ki 5 shehron mein se city chunein, ya apni city ka naam likhein.`,
        `${country} کے 5 شہروں میں سے شہر چنیں، یا اپنے شہر کا نام لکھیں۔`,
      ),
    other: pick("Other country: type its name", "Doosri country: naam likhein", "دوسرا ملک: نام لکھیں"),
    looking: pick("Looking up local rates...", "Is country ke local rates dhoond raha hun...", "اس ملک کے مقامی ریٹ تلاش کر رہا ہوں..."),
    noData: pick(
      "I couldn't get rates for that country. Pick another or try again shortly.",
      "Is country ka data nahi mil saka. Koi aur country chunein ya thori der baad dobara try karein.",
      "اس ملک کا ڈیٹا نہیں مل سکا۔ کوئی اور ملک چنیں یا تھوڑی دیر بعد دوبارہ کوشش کریں۔",
    ),
    filled: pick("The form is filled in. Your estimate is being generated.", "Form bhar diya gaya hai. Estimate ban raha hai.", "فارم بھر دیا گیا ہے۔ اندازہ تیار ہو رہا ہے۔"),
    offline: pick(
      "The AI is unavailable right now, but I can still prepare an estimate offline.",
      "AI abhi available nahi hai, lekin main offline bhi estimate tayyar kar sakta hun.",
      "AI ابھی دستیاب نہیں، لیکن میں آف لائن بھی اندازہ تیار کر سکتا ہوں۔",
    ),
    retry: pick("Retry", "Dobara try karein", "دوبارہ کوشش کریں"),
    placeholder: pick("Ask a question or describe your idea...", "Apna sawal ya project idea likhein...", "اپنا سوال یا پروجیکٹ آئیڈیا لکھیں..."),
    newChat: pick("New chat", "Nayi chat", "نئی چیٹ"),
    minimize: pick("Minimize", "Minimize karein", "چھوٹا کریں"),
    close: pick("Close chat", "Chat band karein", "چیٹ بند کریں"),
    open: pick("Open project assistant", "Assistant kholein", "اسسٹنٹ کھولیں"),
    send: pick("Send", "Bhejein", "بھیجیں"),
    title: pick("Project assistant", "Project assistant", "پروجیکٹ اسسٹنٹ"),
    subtitle: pick("Prices come from the CostCalc engine", "Prices CostCalc engine se aate hain", "قیمتیں CostCalc انجن سے آتی ہیں"),
    optionsTitle: pick("Fine-tune the details", "Tafseel set karein", "تفصیلات سیٹ کریں"),
    optionsHint: pick("Optional. Tap to change, then estimate.", "Optional. Badalne ke liye tap karein, phir estimate.", "اختیاری۔ بدلنے کے لیے دبائیں، پھر اندازہ۔"),
    categoryLabel: pick("Category", "Category", "کیٹیگری"),
    sizeLabel: pick("Size", "Size", "سائز"),
    qualityLabel: pick("Quality", "Quality", "کوالٹی"),
    cityHint: pick("You can type any city name too.", "Koi bhi apni city ka naam likh sakte hain.", "آپ کسی بھی شہر کا نام لکھ سکتے ہیں۔"),
    online: pick("Online", "Online", "آن لائن"),
    offlineStatus: pick("Offline mode", "Offline mode", "آف لائن موڈ"),
    saved: pick("saved answer (offline)", "pehle ka jawab (offline)", "پچھلا جواب (آف لائن)"),
    builtin: pick("built-in answer (offline)", "built-in jawab (offline)", "بلٹ اِن جواب (آف لائن)"),
    noteCache: pick("saved data", "saved data", "محفوظ ڈیٹا"),
    noteOffline: pick("approximate offline data", "takmeeni offline data", "تخمینی آف لائن ڈیٹا"),
  };
};

const mk = (role: ChatMsg["role"], text: string, note?: string): ChatMsg => ({ id: newId(), role, text, ts: Date.now(), note });

function pendingFromProject(project: ProjectDraft, known?: CustomCategory): PendingSetup {
  const sizeId = (["small", "medium", "large"].includes(project.complexity) ? project.complexity : "medium") as ProjectSizeId;
  return {
    project,
    sizeId,
    qualityId: project.quality ?? "standard",
    categoryId: project.category === "custom" ? "custom" : project.category,
    customCategoryName: project.customCategoryName,
    customCategory: known,
  };
}

export default function ChatBot({ supportedCountries, onApplyProject, onApplyCountry, onRunEstimate, estimateSummary }: Props) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [pending, setPending] = useState<PendingSetup | null>(null);
  const [awaiting, setAwaiting] = useState<ProjectDraft | null>(null);
  const [awaitingCity, setAwaitingCity] = useState<AwaitingCity | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [online, setOnline] = useState(true);
  const mem = useRef<Memory>(emptyMemory());
  const endRef = useRef<HTMLDivElement>(null);
  const t = S(lang);
  const open = phase === "open";

  const launcher = useDrag(POS_KEY_LAUNCHER);

  // Restore the previous conversation (so "minimize" / reopening keeps it).
  useEffect(() => {
    const loaded = loadMemory();
    mem.current = loaded;
    setMessages(loaded.messages.slice(-40));
    try {
      const l = localStorage.getItem("costcalc-chat-lang");
      if (l === "en" || l === "roman" || l === "urdu") setLang(l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("costcalc-chat-lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  useEffect(() => {
    const update = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, phase, pending, awaiting, awaitingCity, showTyping]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPhase("min");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const resetSession = (keepOpen: boolean) => {
    mem.current = { ...mem.current, messages: [] };
    setMessages([]);
    setPending(null);
    setAwaiting(null);
    setAwaitingCity(null);
    setRetryText(null);
    setInput("");
    setShowTyping(false);
    saveMemory(mem.current);
    setPhase(keepOpen ? "open" : "closed");
  };

  const push = (m: ChatMsg) => {
    mem.current.messages = [...mem.current.messages, m].slice(-40);
    setMessages(mem.current.messages);
    saveMemory(mem.current);
  };

  // ---------- research helpers: server (web search) -> cache -> offline table ----------
  async function lookup<T>(key: string, url: string, payload: object, fallback: () => T | null): Promise<T | null> {
    const fresh = getCached<T>(mem.current, key, 30);
    if (fresh) return { ...(fresh as object), origin: "cache" } as T;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const stale = getCached<T>(mem.current, key, Infinity);
      return stale ? ({ ...(stale as object), origin: "cache" } as T) : fallback();
    }
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

  async function resolveCategory(ps: PendingSetup): Promise<ApplyProject> {
    const base: ApplyProject = {
      description: ps.project.description,
      complexity: ps.sizeId as Complexity,
      qualityId: ps.qualityId,
      categoryId: ps.categoryId,
    };
    if (ps.categoryId !== "custom") return base;
    if (ps.customCategory) return { ...base, categoryId: `custom:${ps.customCategory.name}`, customCategory: ps.customCategory };
    const name = ps.customCategoryName || ps.project.title || "Custom project";
    const cat = await lookup<CustomCategory>(
      `cat:${name.toLowerCase()}`,
      "/api/estimate-params",
      { kind: "category", name, description: ps.project.description },
      () => offlineCategory(name, ps.project.description),
    );
    return { ...base, categoryId: `custom:${name}`, customCategory: cat ?? undefined };
  }

  async function askForCity(ac: AwaitingCity) {
    setAwaitingCity(ac);
    push(mk("assistant", t.askCity(ac.country)));
  }

  async function finishWithCountry(text: string, d: ProjectDraft) {
    const id = matchSupportedCountry(text, supportedCountries);
    if (id) {
      const loc = supportedCountries.find((c) => c.id === id);
      await askForCity({ locationId: id, country: loc?.country ?? text });
      return;
    }
    push(mk("assistant", t.looking));
    const loc = await lookup<CustomLocation>(
      `loc:${text.toLowerCase().trim()}`,
      "/api/estimate-params",
      { kind: "location", country: text },
      () => offlineCountry(text),
    );
    if (!loc) {
      push(mk("assistant", t.noData));
      setAwaiting(d);
      return;
    }
    onApplyCountry({ custom: loc });
    const src = loc.origin === "web" ? loc.sources.map((s) => s.title).filter(Boolean).slice(0, 2).join(", ") : loc.origin;
    push(
      mk(
        "assistant",
        `${loc.country}: ${loc.currency}, tax ${Math.round(loc.taxRate * 1000) / 10}%, price level ${loc.multiplier.toFixed(2)}x${src ? ` (${src})` : ""}.`,
        loc.origin === "web" ? undefined : loc.origin === "cache" ? t.noteCache : t.noteOffline,
      ),
    );
    setAwaitingCity(null);
    setAwaiting(null);
    push(mk("assistant", t.filled));
    onRunEstimate();
  }

  // ---------- user actions ----------
  async function runSetup(ps: PendingSetup, announce: boolean) {
    if (busy) return;
    setPending(null);
    if (announce) push(mk("user", t.yes));
    setBusy(true);
    const timer = window.setTimeout(() => setShowTyping(true), 400);
    try {
      onApplyProject(await resolveCategory(ps));
      if (ps.project.country) await finishWithCountry(ps.project.country, ps.project);
      else {
        push(mk("assistant", t.askCountry));
        setAwaiting(ps.project);
      }
    } finally {
      window.clearTimeout(timer);
      setShowTyping(false);
      setBusy(false);
    }
  }

  const acceptEstimate = () => {
    if (pending) void runSetup(pending, true);
  };

  function declineEstimate() {
    setPending(null);
    push(mk("user", t.no));
    push(mk("assistant", t.skipped));
  }

  async function pickCountry(name: string) {
    if (!awaiting || busy) return;
    push(mk("user", name));
    setBusy(true);
    const timer = window.setTimeout(() => setShowTyping(true), 400);
    try {
      await finishWithCountry(name, awaiting);
    } finally {
      window.clearTimeout(timer);
      setShowTyping(false);
      setBusy(false);
    }
  }

  async function pickCity(city: string) {
    if (!awaitingCity || busy) return;
    const ac = awaitingCity;
    push(mk("user", city));
    setAwaitingCity(null);
    setAwaiting(null);
    setBusy(true);
    const timer = window.setTimeout(() => setShowTyping(true), 400);
    try {
      onApplyCountry({ locationId: ac.locationId, city });
      push(mk("assistant", t.filled));
      onRunEstimate();
    } finally {
      window.clearTimeout(timer);
      setShowTyping(false);
      setBusy(false);
    }
  }

  async function send(raw: string) {
    const text = raw.trim().slice(0, 1500);
    if (!text || busy) return;
    const l = detectLang(text);
    setLang(l);
    setInput("");
    setRetryText(null);

    if (awaiting && text.length <= 40 && !text.includes("?")) return void pickCountry(text);
    if (awaitingCity && text.length <= 40 && !text.includes("?")) return void pickCity(text);

    push(mk("user", text));
    setPending(null);
    setAwaiting(null);
    setAwaitingCity(null);
    setBusy(true);
    const timer = window.setTimeout(() => setShowTyping(true), 400);
    try {
      const history = [...mem.current.messages].slice(-12).map((m) => ({ role: m.role, content: m.text }));
      const detectedLanguage =
        l === "urdu"
          ? "Urdu script (Arabic letters, not Roman)"
          : l === "roman"
            ? "Roman Urdu (Latin letters)"
            : "English";
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, estimateSummary, language: detectedLanguage }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { reply: string; offerEstimate: boolean; estimateNow?: boolean; project?: ProjectDraft };
      push(mk("assistant", d.reply));
      if (!estimateSummary) rememberQA(mem.current, text, d.reply);
      if (d.project) {
        mem.current.draft = d.project;
        const ps = pendingFromProject(d.project);
        if (d.estimateNow) await runSetup(ps, false);
        else if (d.offerEstimate) setPending(ps);
      }
      saveMemory(mem.current);
    } catch {
      // AI/server down: saved answer -> FAQ -> offline brief. The estimate engine still works.
      const a = localAnswer(text, mem.current);
      const s = S(l);
      if (a.source !== "none") {
        push(mk("assistant", a.text, a.source === "saved" ? s.saved : s.builtin));
      } else {
        push(mk("assistant", s.offline, s.noteOffline));
        if (text.length >= 12) {
          const brief = offlineBrief(text);
          const project: ProjectDraft = {
            title: "My project",
            description: brief.description,
            features: [],
            category: brief.customCategory ? "custom" : brief.categoryId,
            customCategoryName: brief.customCategory?.name,
            complexity: brief.complexity,
          };
          setPending(pendingFromProject(project, brief.customCategory));
        }
        setRetryText(text);
      }
    } finally {
      window.clearTimeout(timer);
      setShowTyping(false);
      setBusy(false);
    }
  }

  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="print:hidden">
      <style>{chatCss}</style>

      {phase !== "open" && (
        <button
          ref={launcher.ref as React.RefObject<HTMLButtonElement>}
          type="button"
          onClick={() => {
            if (launcher.wasDragged()) return;
            setPhase("open");
          }}
          aria-label={t.open}
          style={launcher.style}
          className={`${
            launcher.pos ? "fixed" : "fixed bottom-5 right-5"
          } z-50 flex h-14 w-14 touch-none items-center justify-center rounded-full bg-gradient-to-br from-[#6f5be8] to-[#5a45d6] text-white shadow-[0_12px_30px_rgba(103,84,231,0.42)] transition hover:scale-105 hover:shadow-[0_16px_36px_rgba(103,84,231,0.5)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#6754e7]/40 active:scale-95`}
          {...launcher.handlers}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {pending && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#f0a020]" />}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label={t.title}
          className="chat-panel-enter fixed bottom-0 right-0 z-50 flex h-[min(82vh,620px)] w-full flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-black/5 sm:bottom-5 sm:right-5 sm:w-[410px] sm:rounded-2xl"
        >
          <header className="flex items-center justify-between bg-gradient-to-r from-[#241f31] to-[#3a3350] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#7a66ef] to-[#5a45d6] shadow-inner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-white/60">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${online ? "bg-[#4fd0a5]" : "bg-[#f0a020]"}`} />
                  {online ? t.subtitle : t.offlineStatus}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => resetSession(true)} aria-label={t.newChat} title={t.newChat} className="rounded-lg p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button type="button" onClick={() => setPhase("min")} aria-label={t.minimize} title={t.minimize} className="rounded-lg p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <button type="button" onClick={() => resetSession(false)} aria-label={t.close} title={t.close} className="rounded-lg p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          <div className="chat-scroll flex-1 space-y-3 overflow-y-auto bg-[#faf9ff] px-4 py-4" aria-live="polite">
            <Bubble role="assistant" text={t.hello} />
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} note={m.note} />
            ))}
            {busy && showTyping && <TypingDots />}
            {busy && !showTyping && <div className="h-4" />}

            {pending && !busy && (
              <div className="rounded-2xl border border-[#e6e2f4] bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-[#39344a]">{t.optionsTitle}</p>
                <p className="mb-2 mt-0.5 text-[11px] text-[#8a8695]">{t.optionsHint}</p>

                <p className="mb-1 text-[11px] font-semibold text-[#6b6778]">{t.categoryLabel}</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <Chip
                      key={c.id}
                      active={pending.categoryId === c.id}
                      onClick={() => setPending({ ...pending, categoryId: c.id, customCategoryName: undefined })}
                    >
                      {c.shortName}
                    </Chip>
                  ))}
                  {(pending.customCategoryName || pending.customCategory) && (
                    <Chip active={pending.categoryId === "custom"} onClick={() => setPending({ ...pending, categoryId: "custom" })}>
                      {pending.customCategory?.name || pending.customCategoryName}
                    </Chip>
                  )}
                </div>

                <p className="mb-1 mt-3 text-[11px] font-semibold text-[#6b6778]">{t.sizeLabel}</p>
                <div className="flex flex-wrap gap-1.5">
                  {projectSizes.map((s) => (
                    <Chip key={s.id} active={pending.sizeId === s.id} onClick={() => setPending({ ...pending, sizeId: s.id })}>
                      {s.name}
                    </Chip>
                  ))}
                </div>

                <p className="mb-1 mt-3 text-[11px] font-semibold text-[#6b6778]">{t.qualityLabel}</p>
                <div className="flex flex-wrap gap-1.5">
                  {qualityOptions.map((q) => (
                    <Chip key={q.id} active={pending.qualityId === q.id} onClick={() => setPending({ ...pending, qualityId: q.id })}>
                      {q.name}
                    </Chip>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip primary onClick={acceptEstimate}>{t.yes}</Chip>
                  <Chip onClick={declineEstimate}>{t.no}</Chip>
                </div>
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

            {awaitingCity && !busy && (
              <div className="flex flex-wrap gap-2">
                {supportedCountries
                  .find((c) => c.id === awaitingCity.locationId)
                  ?.cities.map((city) => (
                    <Chip key={city} primary onClick={() => pickCity(city)}>{city}</Chip>
                  ))}
                <p className="w-full text-xs text-[#6b6778]">{t.cityHint}</p>
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
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#d9d5f3] bg-[#fbfaff] px-3.5 py-2.5 text-sm text-[#1c1923] outline-none transition focus:border-[#6754e7] focus:bg-white focus:ring-2 focus:ring-[#6754e7]/25"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t.send}
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#6f5be8] to-[#5a45d6] text-white transition hover:brightness-110 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6754e7]/50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
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
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          mine ? "rounded-br-md bg-gradient-to-br from-[#6f5be8] to-[#5a45d6] text-white" : "rounded-bl-md bg-white text-[#1c1923] shadow-sm ring-1 ring-[#ece9fa]"
        }`}
        dir="auto"
      >
        {text}
        {note && <span className="mt-1 block text-[11px] italic opacity-60">{note}</span>}
      </div>
    </div>
  );
}

function Chip({ children, onClick, primary, active }: { children: React.ReactNode; onClick: () => void; primary?: boolean; active?: boolean }) {
  const base = "rounded-full px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6754e7]/50";
  const look = primary
    ? "bg-gradient-to-br from-[#6f5be8] to-[#5a45d6] text-white hover:brightness-110"
    : active
      ? "border border-[#6754e7] bg-[#f1eeff] text-[#4d3cc0]"
      : "border border-[#d9d5f3] bg-white text-[#1c1923] hover:bg-[#f3f1ff]";
  return (
    <button type="button" onClick={onClick} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="chat-typing flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-[#ece9fa]" aria-label="Preparing your answer">
        <span className="chat-dot" />
        <span className="chat-dot" style={{ animationDelay: "0.16s" }} />
        <span className="chat-dot" style={{ animationDelay: "0.32s" }} />
      </div>
    </div>
  );
}

// ---- drag hook: remembers position across reloads and clamps to the viewport ----
function useDrag(key: string) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  const st = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw) as { x: number; y: number };
        if (typeof p?.x === "number" && typeof p?.y === "number") setPos(clampTo(p.x, p.y, ref.current));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (window.innerWidth < 640) return; // keep the mobile bottom-sheet simple
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    st.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    dragged.current = false;
    setPos({ x: r.left, y: r.top });
    last.current = { x: r.left, y: r.top };
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (!s.moved && Math.hypot(dx, dy) < 4) return;
    s.moved = true;
    dragged.current = true;
    const next = clampTo(s.ox + dx, s.oy + dy, ref.current);
    last.current = next;
    setPos(next);
  };

  const finish = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    st.current = null;
    if (s.moved && last.current) {
      try { localStorage.setItem(key, JSON.stringify(last.current)); } catch { /* ignore */ }
    }
  };

  // Keep a dragged element inside the viewport when the window resizes.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clampTo(p.x, p.y, ref.current) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  const style = pos ? ({ left: pos.x, top: pos.y, right: "auto", bottom: "auto" } as const) : undefined;
  return { pos, ref, style, onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish, handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish }, wasDragged: () => dragged.current };
}

function clampTo(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 340;
  const h = el?.offsetHeight ?? 60;
  const maxX = Math.max(8, window.innerWidth - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
}

const chatCss = `
.chat-panel-enter { animation: chatPanelIn 0.18s ease-out both; }
@keyframes chatPanelIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
.chat-scroll { scrollbar-width: thin; scrollbar-color: #cfc9e6 transparent; }
.chat-scroll::-webkit-scrollbar { width: 8px; }
.chat-scroll::-webkit-scrollbar-thumb { background: #d6d1ea; border-radius: 9999px; }
.chat-dot {
  width: 8px; height: 8px; border-radius: 9999px; background: #8b7ae8; opacity: 0.4;
  animation: chatDotBounce 1.1s ease-in-out infinite;
}
@keyframes chatDotBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-5px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .chat-dot { animation: none; opacity: 0.7; }
  .chat-panel-enter { animation: none; }
}
`;
