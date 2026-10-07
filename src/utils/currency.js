// =====================================================================
// CURRENCY CONFIG
// =====================================================================
const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "EU", name: "Eurozone", currency: "EUR" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "CN", name: "China", currency: "CNY" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "TR", name: "Turkey", currency: "TRY" },
  { code: "KR", name: "South Korea", currency: "KRW" },
  { code: "KW", name: "Kuwait", currency: "KWD" },
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
];

// Fallback rates: 1 USD = X currency
const FALLBACK_RATES = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  INR: 83.2,
  PKR: 278.5,
  AED: 3.67,
  SAR: 3.75,
  AUD: 1.52,
  CAD: 1.36,
  JPY: 149.5,
  CNY: 7.24,
  BRL: 5.05,
  ZAR: 18.4,
  TRY: 34.1,
  KRW: 1385,
  KWD: 0.31,
  EGP: 48.2,
  NGN: 1580,
};

// Currencies that need special rounding (places after decimal point)
const FRACTION_DIGITS = {
  JPY: 0,
  KRW: 0,
  KWD: 3,
  VND: 0,
  ISK: 0,
};
const CACHE_KEY = "etaflow_fx_rates";
const CACHE_TS_KEY = "etaflow_fx_rates_ts";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const API_URL = "https://open.er-api.com/v6/latest/USD"; // free, no key
// =====================================================================

function safeStorage() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* ignore */
  }
  return null;
}

async function getRates() {
  const store = safeStorage();
  if (store) {
    try {
      const ts = Number(store.getItem(CACHE_TS_KEY) || 0);
      const cached = store.getItem(CACHE_KEY);
      if (cached && Date.now() - ts < CACHE_TTL) {
        return { ...JSON.parse(cached), source: "cache" };
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("rate fetch failed");
    const data = await res.json();
    const rates = data && data.rates ? data.rates : null;
    if (!rates) throw new Error("bad rate payload");
    if (store) {
      try {
        store.setItem(CACHE_KEY, JSON.stringify(rates));
        store.setItem(CACHE_TS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    }
    return { ...rates, source: "api" };
  } catch {
    return { ...FALLBACK_RATES, source: "fallback" };
  }
}

function detectCountry() {
  try {
    const locale =
      (typeof navigator !== "undefined" && (navigator.language || (navigator.languages && navigator.languages[0]))) || "en-US";
    const region = String(locale).split(/[-_]/)[1];
    if (region) {
      const hit = COUNTRIES.find((c) => c.code === region.toUpperCase());
      if (hit) return hit;
    }
  } catch {
    /* ignore */
  }
  return COUNTRIES[0];
}

function getCurrencyForCountry(code) {
  const hit = COUNTRIES.find((c) => c.code === String(code || "").toUpperCase());
  return hit ? hit.currency : "USD";
}

function convert(amount, from, to, rates) {
  const table = rates || FALLBACK_RATES;
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  const fromRate = table[String(from || "USD").toUpperCase()] ?? FALLBACK_RATES[from] ?? 1;
  const toRate = table[String(to || "USD").toUpperCase()] ?? FALLBACK_RATES[to] ?? 1;
  const inUSD = value / fromRate;
  return inUSD * toRate;
}

function decimalsFor(currency) {
  const code = String(currency || "USD").toUpperCase();
  if (code in FRACTION_DIGITS) return FRACTION_DIGITS[code];
  return 2;
}

function formatMoney(amount, currency, countryCode, locale) {
  const code = String(currency || getCurrencyForCountry(countryCode) || "USD").toUpperCase();
  const digits = decimalsFor(code);
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(locale || (typeof navigator !== "undefined" ? navigator.language : "en-US"), {
    style: "currency",
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export { COUNTRIES, FALLBACK_RATES, getRates, detectCountry, getCurrencyForCountry, convert, formatMoney, decimalsFor };
