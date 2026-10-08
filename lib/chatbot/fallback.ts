import { FAQ } from "./knowledge";
import { findSavedAnswer, normalize, type Memory } from "./memory";
import type { CustomLocation } from "./types";

// true for Urdu script or Roman Urdu. Used to choose the language of local messages.
export function looksUrdu(text: string): boolean {
  if (/[\u0600-\u06FF]/.test(text)) return true;
  return /\b(kya|kaisy|kaise|kyun|kyu|hai|hain|nahi|nhi|mujhe|mera|meri|karna|karni|chahiye|chaiye|batao|bta|aur|ky|ka|ki|ko|mein|mai|wala|waly|bnana|banana)\b/i.test(text);
}

export type LocalAnswer = { text: string; source: "saved" | "faq" | "none" };

export function localAnswer(question: string, mem: Memory): LocalAnswer {
  const saved = findSavedAnswer(mem, question);
  if (saved) return { text: saved, source: "saved" };
  const q = normalize(question);
  const ur = looksUrdu(question);
  const hit = FAQ.find((f) => f.keys.some((k) => q.includes(normalize(k))));
  if (hit) return { text: ur ? hit.ur : hit.en, source: "faq" };
  return { text: "", source: "none" };
}

// ---- built-in countries (ids from constants/index.ts) ----
const ALIASES: Record<string, string[]> = {
  us: ["usa", "united states", "america", "new york", "امریکہ"],
  ca: ["canada", "toronto", "کینیڈا"],
  uk: ["uk", "united kingdom", "england", "britain", "london", "برطانیہ"],
  ae: ["uae", "united arab emirates", "emirates", "dubai", "abu dhabi", "دبئی", "امارات"],
  pk: ["pakistan", "karachi", "lahore", "islamabad", "پاکستان"],
  in: ["india", "mumbai", "delhi", "انڈیا", "بھارت"],
  au: ["australia", "sydney", "آسٹریلیا"],
  de: ["germany", "berlin", "deutschland", "جرمنی"],
  sg: ["singapore", "سنگاپور"],
  ng: ["nigeria", "lagos"],
};

export function matchSupportedCountry(text: string, supported: { id: string; country: string }[]): string | null {
  const t = ` ${normalize(text)} `;
  for (const s of supported) {
    const names = [s.country, ...(ALIASES[s.id] ?? [])];
    if (names.some((n) => t.includes(` ${normalize(n)} `))) return s.id;
  }
  return null;
}

// ---- approximate offline snapshot, used ONLY if web lookup and cache both fail ----
// [name, aliases(|), city, currency, unitsPerUsd, multiplier(Canada=1.0), taxRate]
// Values are rough. Review them once in a while, or delete rows you do not trust.
const OFFLINE: [string, string, string, string, number, number, number][] = [
  ["Saudi Arabia", "ksa|saudi", "Riyadh", "SAR", 3.75, 0.95, 0.15],
  ["Qatar", "doha", "Doha", "QAR", 3.64, 0.9, 0],
  ["Bangladesh", "dhaka", "Dhaka", "BDT", 122, 0.3, 0.15],
  ["Sri Lanka", "colombo", "Colombo", "LKR", 300, 0.32, 0.18],
  ["Malaysia", "kuala lumpur", "Kuala Lumpur", "MYR", 4.4, 0.55, 0.08],
  ["Indonesia", "jakarta", "Jakarta", "IDR", 16500, 0.38, 0.11],
  ["Philippines", "manila", "Manila", "PHP", 57, 0.35, 0.12],
  ["Vietnam", "hanoi|ho chi minh", "Ho Chi Minh City", "VND", 26000, 0.33, 0.1],
  ["France", "paris", "Paris", "EUR", 0.86, 0.97, 0.2],
  ["Italy", "milan|rome", "Milan", "EUR", 0.86, 0.9, 0.22],
  ["Spain", "madrid", "Madrid", "EUR", 0.86, 0.85, 0.21],
  ["Netherlands", "amsterdam|holland", "Amsterdam", "EUR", 0.86, 1.0, 0.21],
  ["Ireland", "dublin", "Dublin", "EUR", 0.86, 1.0, 0.23],
  ["Sweden", "stockholm", "Stockholm", "SEK", 9.4, 1.0, 0.25],
  ["Norway", "oslo", "Oslo", "NOK", 10, 1.15, 0.25],
  ["Switzerland", "zurich", "Zurich", "CHF", 0.8, 1.25, 0.081],
  ["Japan", "tokyo", "Tokyo", "JPY", 148, 0.95, 0.1],
  ["South Korea", "korea|seoul", "Seoul", "KRW", 1400, 0.85, 0.1],
  ["China", "shanghai|beijing", "Shanghai", "CNY", 7.1, 0.55, 0.13],
  ["Brazil", "sao paulo", "Sao Paulo", "BRL", 5.4, 0.5, 0.15],
  ["Mexico", "mexico city", "Mexico City", "MXN", 18.5, 0.5, 0.16],
  ["South Africa", "johannesburg|cape town", "Johannesburg", "ZAR", 17.5, 0.45, 0.15],
  ["Kenya", "nairobi", "Nairobi", "KES", 129, 0.32, 0.16],
  ["New Zealand", "auckland|nz", "Auckland", "NZD", 1.68, 1.0, 0.15],
];

export function offlineCountry(text: string): CustomLocation | null {
  const t = ` ${normalize(text)} `;
  for (const [name, aliases, city, currency, unitsPerUsd, multiplier, taxRate] of OFFLINE) {
    const names = [name, ...aliases.split("|")];
    if (names.some((n) => t.includes(` ${normalize(n)} `))) {
      return {
        country: name,
        city,
        currency,
        unitsPerUsd,
        multiplier,
        taxRate,
        notes: "Approximate offline data (web lookup unavailable).",
        sources: [],
        origin: "offline",
      };
    }
  }
  return null;
}
