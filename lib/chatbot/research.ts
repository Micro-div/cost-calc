// Shared, client-side research used by the top estimator section (and anywhere
// else that needs it). It mirrors the chat's lookup order so both entry points
// behave the same:
//     cache -> /api/estimate-params (live web research) -> offline table.
// It never throws; when the network and cache are both unavailable it falls
// back to the built-in offline data so the user still gets an estimate.
import { offlineCategory, offlineCountry } from "./fallback";
import type { CustomCategory, CustomLocation } from "./types";

const KEY = "costcalc-research-v1";
const DAY = 86_400_000;

type Store = Record<string, { data: unknown; ts: number }>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    // Keep only the 40 most recent entries so storage never grows without bound.
    const entries = Object.entries(store)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, 40);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* storage blocked: research still works, just without caching */
  }
}

// maxAgeDays = Infinity -> accept stale data (used after a failed lookup).
function get<T>(store: Store, key: string, maxAgeDays = 30): T | null {
  const hit = store[key];
  if (!hit) return null;
  return Date.now() - hit.ts <= maxAgeDays * DAY ? (hit.data as T) : null;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// Research benchmark inputs for a project/business type that is not one of the
// 8 built-in categories (e.g. "tyre shop", "restaurant", "gym").
export async function researchCategory(name: string, description = ""): Promise<CustomCategory> {
  const clean = name.trim().slice(0, 60) || "Business setup";
  const key = `cat:${clean.toLowerCase()}`;
  const store = read();

  const fresh = get<CustomCategory>(store, key);
  if (fresh) return { ...fresh, origin: "cache" };
  if (isOffline()) {
    const stale = get<CustomCategory>(store, key, Infinity);
    return stale ? { ...stale, origin: "cache" } : offlineCategory(clean, description);
  }
  try {
    const r = await fetch("/api/estimate-params", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "category", name: clean, description: description.slice(0, 500) }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const data = { ...(await r.json()), origin: "web" } as CustomCategory;
    store[key] = { data, ts: Date.now() };
    write(store);
    return data;
  } catch {
    const stale = get<CustomCategory>(store, key, Infinity);
    return stale ? { ...stale, origin: "cache" } : offlineCategory(clean, description);
  }
}

// Research country inputs (currency, price level, tax, FX) for any country.
// Returns null only when nothing at all could be found for the name.
export async function researchLocation(country: string, city = ""): Promise<CustomLocation | null> {
  const clean = country.trim().slice(0, 60);
  if (!clean) return null;
  const key = `loc:${clean.toLowerCase()}`;
  const store = read();

  const withCity = (loc: CustomLocation): CustomLocation =>
    city.trim() ? { ...loc, city: city.trim().slice(0, 60) } : loc;

  const fresh = get<CustomLocation>(store, key);
  if (fresh) return withCity({ ...fresh, origin: "cache" });
  if (isOffline()) {
    const stale = get<CustomLocation>(store, key, Infinity);
    if (stale) return withCity({ ...stale, origin: "cache" });
    const off = offlineCountry(clean);
    return off ? withCity(off) : null;
  }
  try {
    const r = await fetch("/api/estimate-params", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "location", country: clean }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const data = { ...(await r.json()), origin: "web" } as CustomLocation;
    store[key] = { data, ts: Date.now() };
    write(store);
    return withCity(data);
  } catch {
    const stale = get<CustomLocation>(store, key, Infinity);
    if (stale) return withCity({ ...stale, origin: "cache" });
    const off = offlineCountry(clean);
    return off ? withCity(off) : null;
  }
}
