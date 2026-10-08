import type { ProjectDraft } from "./types";

const KEY = "costcalc-chat-memory-v1";
const DAY = 86_400_000;

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
  note?: string; // e.g. "saved answer"
};

export type Memory = {
  messages: ChatMsg[]; // last 40 shown in the chat
  qa: { q: string; a: string; ts: number }[]; // last 100 Q&A pairs for offline answers
  params: Record<string, { data: unknown; ts: number }>; // country / category lookups
  draft?: ProjectDraft; // last project brief
};

export const emptyMemory = (): Memory => ({ messages: [], qa: [], params: {} });

export const newId = () => Math.random().toString(36).slice(2, 10);

export function loadMemory(): Memory {
  if (typeof window === "undefined") return emptyMemory();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyMemory();
    const p = JSON.parse(raw) as Partial<Memory>;
    return {
      messages: Array.isArray(p.messages) ? p.messages : [],
      qa: Array.isArray(p.qa) ? p.qa : [],
      params: p.params && typeof p.params === "object" ? p.params : {},
      draft: p.draft,
    };
  } catch {
    return emptyMemory();
  }
}

export function saveMemory(m: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...m, messages: m.messages.slice(-40), qa: m.qa.slice(-100) }));
  } catch {
    /* storage full or blocked: chat still works, just without persistence */
  }
}

export function clearMemory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const tokens = (s: string) => new Set(normalize(s).split(" ").filter((w) => w.length > 1));

export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  A.forEach((w) => {
    if (B.has(w)) common++;
  });
  return common / (A.size + B.size - common);
}

export function rememberQA(m: Memory, q: string, a: string) {
  if (q.trim().length < 4 || !a.trim()) return;
  m.qa = [...m.qa.filter((x) => normalize(x.q) !== normalize(q)), { q, a, ts: Date.now() }].slice(-100);
}

export function findSavedAnswer(m: Memory, q: string, threshold = 0.6): string | null {
  let best = 0;
  let answer: string | null = null;
  for (const item of m.qa) {
    const s = similarity(q, item.q);
    if (s > best) {
      best = s;
      answer = item.a;
    }
  }
  return best >= threshold ? answer : null;
}

export function cacheParams(m: Memory, key: string, data: unknown) {
  m.params[key] = { data, ts: Date.now() };
}

// maxAgeDays = Infinity -> accept stale data (used when the web lookup failed)
export function getCached<T>(m: Memory, key: string, maxAgeDays = 30): T | null {
  const hit = m.params[key];
  if (!hit) return null;
  return Date.now() - hit.ts <= maxAgeDays * DAY ? (hit.data as T) : null;
}
