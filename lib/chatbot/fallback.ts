import { FAQ } from "./knowledge";
import { findSavedAnswer, normalize, type Memory } from "./memory";
import type { CustomCategory, CustomLocation } from "./types";

// ---- language detection: "en" | "roman" (Roman Urdu) | "urdu" (Urdu script) ----
export type Lang = "en" | "roman" | "urdu";

// true for Urdu script or Roman Urdu. Used to choose the language of local messages.
export function looksUrdu(text: string): boolean {
  if (/[\u0600-\u06FF]/.test(text)) return true;
  return /\b(kya|kaisy|kaise|kyun|kyu|hai|hain|nahi|nhi|mujhe|mera|meri|karna|karni|chahiye|chaiye|batao|bta|aur|ky|ka|ki|ko|mein|mai|wala|waly|bnana|banana|banaye|banana|cost|kitna|kitne|paisa|paise)\b/i.test(
    text,
  );
}

// The three languages the assistant itself can speak offline.
export function detectLang(text: string): Lang {
  if (/[\u0600-\u06FF]/.test(text)) return "urdu";
  if (looksUrdu(text)) return "roman";
  return "en";
}

export type LocalAnswer = { text: string; source: "saved" | "faq" | "none" };

export function localAnswer(question: string, mem: Memory): LocalAnswer {
  const saved = findSavedAnswer(mem, question);
  if (saved) return { text: saved, source: "saved" };
  const q = normalize(question);
  const lang = detectLang(question);
  const hit = FAQ.find((f) => f.keys.some((k) => q.includes(normalize(k))));
  if (hit) return { text: lang === "urdu" ? hit.urdu : lang === "roman" ? hit.roman : hit.en, source: "faq" };
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
  sa: ["saudi arabia", "ksa", "riyadh", "jeddah", "سعودی عرب"],
  tr: ["turkey", "turkiye", "istanbul", "ankara"],
  ph: ["philippines", "manila", "cebu"],
  ke: ["kenya", "nairobi", "mombasa"],
  my: ["malaysia", "kuala lumpur", "penang"],
  bd: ["bangladesh", "dhaka", "chittagong", "بنگلہ دیش"],
  fr: ["france", "paris", "lyon", "فرانس"],
  br: ["brazil", "sao paulo", "rio"],
  eg: ["egypt", "cairo", "alexandria", "مصر"],
  id: ["indonesia", "jakarta", "surabaya", "bali"],
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
  ["United States", "usa|united states of america|america|new york|california", "New York", "USD", 1, 1.2, 0.08875],
  ["Canada", "toronto|vancouver|montreal", "Toronto", "CAD", 1.37, 1, 0.13],
  ["United Kingdom", "uk|england|britain|london|manchester", "London", "GBP", 0.79, 0.92, 0.2],
  ["United Arab Emirates", "uae|emirates|dubai|abu dhabi", "Dubai", "AED", 3.67, 1.02, 0.05],
  ["Pakistan", "karachi|lahore|islamabad", "Karachi", "PKR", 280, 0.34, 0.05],
  ["India", "mumbai|delhi|bengaluru|bangalore", "Mumbai", "INR", 88, 0.3, 0.18],
  ["Australia", "sydney|melbourne", "Sydney", "AUD", 1.52, 1.08, 0.1],
  ["Germany", "berlin|munich|deutschland", "Berlin", "EUR", 0.86, 0.98, 0.19],
  ["Singapore", "", "Singapore", "SGD", 1.29, 1.04, 0.09],
  ["Nigeria", "lagos|abuja", "Lagos", "NGN", 1500, 0.28, 0.075],
  ["Saudi Arabia", "ksa|saudi|riyadh|jeddah", "Riyadh", "SAR", 3.75, 0.95, 0.15],
  ["Turkey", "turkiye|istanbul|ankara", "Istanbul", "TRY", 42, 0.5, 0.2],
  ["Philippines", "manila|cebu", "Manila", "PHP", 57, 0.35, 0.12],
  ["Kenya", "nairobi|mombasa", "Nairobi", "KES", 129, 0.32, 0.16],
  ["Malaysia", "kuala lumpur|penang", "Kuala Lumpur", "MYR", 4.4, 0.55, 0.08],
  ["Bangladesh", "dhaka|chittagong", "Dhaka", "BDT", 122, 0.3, 0.15],
  ["France", "paris|lyon", "Paris", "EUR", 0.86, 0.97, 0.2],
  ["Brazil", "sao paulo|rio de janeiro", "Sao Paulo", "BRL", 5.4, 0.5, 0.15],
  ["Egypt", "cairo|alexandria", "Cairo", "EGP", 48, 0.3, 0.14],
  ["Indonesia", "jakarta|bali|surabaya", "Jakarta", "IDR", 16500, 0.38, 0.11],
  ["Qatar", "doha", "Doha", "QAR", 3.64, 0.9, 0],
  ["Kuwait", "kuwait city", "Kuwait City", "KWD", 0.31, 0.95, 0],
  ["Bahrain", "manama", "Manama", "BHD", 0.38, 0.9, 0.1],
  ["Oman", "muscat", "Muscat", "OMR", 0.385, 0.85, 0.05],
  ["Jordan", "amman", "Amman", "JOD", 0.71, 0.6, 0.16],
  ["Lebanon", "beirut", "Beirut", "LBP", 89000, 0.5, 0.11],
  ["Iraq", "baghdad", "Baghdad", "IQD", 1310, 0.45, 0.15],
  ["Iran", "tehran", "Tehran", "IRR", 42000, 0.35, 0.09],
  ["Israel", "tel aviv", "Tel Aviv", "ILS", 3.7, 1.1, 0.17],
  ["Sri Lanka", "colombo", "Colombo", "LKR", 300, 0.32, 0.18],
  ["Vietnam", "hanoi|ho chi minh", "Ho Chi Minh City", "VND", 26000, 0.33, 0.1],
  ["Thailand", "bangkok", "Bangkok", "THB", 36, 0.45, 0.07],
  ["South Korea", "korea|seoul", "Seoul", "KRW", 1400, 0.85, 0.1],
  ["Japan", "tokyo", "Tokyo", "JPY", 148, 0.95, 0.1],
  ["China", "shanghai|beijing", "Shanghai", "CNY", 7.1, 0.55, 0.13],
  ["Hong Kong", "hongkong", "Hong Kong", "HKD", 7.8, 1, 0],
  ["Taiwan", "taipei", "Taipei", "TWD", 32, 0.6, 0.05],
  ["Italy", "milan|rome", "Milan", "EUR", 0.86, 0.9, 0.22],
  ["Spain", "madrid|barcelona", "Madrid", "EUR", 0.86, 0.85, 0.21],
  ["Netherlands", "amsterdam|holland", "Amsterdam", "EUR", 0.86, 1, 0.21],
  ["Belgium", "brussels", "Brussels", "EUR", 0.86, 0.98, 0.21],
  ["Ireland", "dublin", "Dublin", "EUR", 0.86, 1, 0.23],
  ["Portugal", "lisbon", "Lisbon", "EUR", 0.86, 0.78, 0.23],
  ["Sweden", "stockholm", "Stockholm", "SEK", 9.4, 1, 0.25],
  ["Norway", "oslo", "Oslo", "NOK", 10, 1.15, 0.25],
  ["Denmark", "copenhagen", "Copenhagen", "DKK", 6.9, 1.05, 0.25],
  ["Finland", "helsinki", "Helsinki", "EUR", 0.86, 0.98, 0.24],
  ["Switzerland", "zurich|geneva", "Zurich", "CHF", 0.8, 1.25, 0.081],
  ["Austria", "vienna", "Vienna", "EUR", 0.86, 0.98, 0.2],
  ["Poland", "warsaw", "Warsaw", "PLN", 4, 0.65, 0.23],
  ["Czechia", "czech republic|prague", "Prague", "CZK", 23, 0.65, 0.21],
  ["Romania", "bucharest", "Bucharest", "RON", 4.6, 0.6, 0.19],
  ["Greece", "athens", "Athens", "EUR", 0.86, 0.72, 0.24],
  ["Russia", "moscow", "Moscow", "RUB", 92, 0.55, 0.2],
  ["Ukraine", "kyiv|kiev", "Kyiv", "UAH", 41, 0.35, 0.2],
  ["Hungary", "budapest", "Budapest", "HUF", 360, 0.6, 0.27],
  ["Bulgaria", "sofia", "Sofia", "BGN", 1.8, 0.62, 0.2],
  ["Croatia", "zagreb", "Zagreb", "EUR", 0.86, 0.72, 0.25],
  ["Serbia", "belgrade", "Belgrade", "RSD", 108, 0.55, 0.2],
  ["Slovakia", "bratislava", "Bratislava", "EUR", 0.86, 0.8, 0.2],
  ["Slovenia", "ljubljana", "Ljubljana", "EUR", 0.86, 0.85, 0.22],
  ["Lithuania", "vilnius", "Vilnius", "EUR", 0.86, 0.75, 0.21],
  ["Latvia", "riga", "Riga", "EUR", 0.86, 0.72, 0.21],
  ["Estonia", "tallinn", "Tallinn", "EUR", 0.86, 0.8, 0.22],
  ["Luxembourg", "luxembourg city", "Luxembourg", "EUR", 0.86, 1.15, 0.17],
  ["Iceland", "reykjavik", "Reykjavik", "ISK", 138, 1.25, 0.24],
  ["Malta", "valletta", "Valletta", "EUR", 0.86, 0.85, 0.18],
  ["Cyprus", "nicosia", "Nicosia", "EUR", 0.86, 0.8, 0.19],
  ["Kazakhstan", "almaty|astana", "Almaty", "KZT", 480, 0.5, 0.12],
  ["Uzbekistan", "tashkent", "Tashkent", "UZS", 12800, 0.35, 0.12],
  ["Azerbaijan", "baku", "Baku", "AZN", 1.7, 0.45, 0.18],
  ["Georgia", "tbilisi", "Tbilisi", "GEL", 2.7, 0.45, 0.18],
  ["Armenia", "yerevan", "Yerevan", "AMD", 390, 0.4, 0.2],
  ["Nepal", "kathmandu", "Kathmandu", "NPR", 140, 0.3, 0.13],
  ["Afghanistan", "kabul", "Kabul", "AFN", 70, 0.25, 0.02],
  ["Myanmar", "yangon", "Yangon", "MMK", 2100, 0.3, 0.05],
  ["Cambodia", "phnom penh", "Phnom Penh", "KHR", 4100, 0.32, 0.1],
  ["Mongolia", "ulaanbaatar", "Ulaanbaatar", "MNT", 3400, 0.35, 0.1],
  ["Mexico", "mexico city|guadalajara", "Mexico City", "MXN", 18.5, 0.5, 0.16],
  ["Argentina", "buenos aires", "Buenos Aires", "ARS", 1000, 0.4, 0.21],
  ["Chile", "santiago", "Santiago", "CLP", 950, 0.6, 0.19],
  ["Colombia", "bogota|medellin", "Bogota", "COP", 4000, 0.45, 0.19],
  ["Peru", "lima", "Lima", "PEN", 3.7, 0.45, 0.18],
  ["Ecuador", "quito|guayaquil", "Quito", "USD", 1, 0.5, 0.15],
  ["Uruguay", "montevideo", "Montevideo", "UYU", 40, 0.65, 0.22],
  ["Paraguay", "asuncion", "Asuncion", "PYG", 7300, 0.45, 0.1],
  ["Bolivia", "la paz|santa cruz", "La Paz", "BOB", 6.9, 0.4, 0.13],
  ["Venezuela", "caracas", "Caracas", "VES", 40, 0.4, 0.16],
  ["Guatemala", "guatemala city", "Guatemala City", "GTQ", 7.8, 0.5, 0.12],
  ["Costa Rica", "san jose", "San Jose", "CRC", 510, 0.6, 0.13],
  ["Panama", "panama city", "Panama City", "PAB", 1, 0.75, 0.07],
  ["Dominican Republic", "santo domingo", "Santo Domingo", "DOP", 59, 0.5, 0.18],
  ["Jamaica", "kingston", "Kingston", "JMD", 155, 0.55, 0.167],
  ["South Africa", "johannesburg|cape town", "Johannesburg", "ZAR", 17.5, 0.45, 0.15],
  ["Morocco", "casablanca", "Casablanca", "MAD", 10, 0.4, 0.2],
  ["Algeria", "algiers", "Algiers", "DZD", 134, 0.35, 0.19],
  ["Tunisia", "tunis", "Tunis", "TND", 3.1, 0.38, 0.19],
  ["Ghana", "accra", "Accra", "GHS", 15, 0.35, 0.15],
  ["Ethiopia", "addis ababa", "Addis Ababa", "ETB", 120, 0.28, 0.15],
  ["Tanzania", "dar es salaam", "Dar es Salaam", "TZS", 2700, 0.3, 0.18],
  ["Uganda", "kampala", "Kampala", "UGX", 3800, 0.3, 0.18],
  ["New Zealand", "auckland|wellington|nz", "Auckland", "NZD", 1.68, 1, 0.15],
  ["Mauritius", "port louis", "Port Louis", "MUR", 46, 0.5, 0.15],
  ["Fiji", "suva", "Suva", "FJD", 2.3, 0.6, 0.15],
];

export function offlineCountry(text: string): CustomLocation | null {
  const t = ` ${normalize(text)} `;
  for (const [name, aliases, city, currency, unitsPerUsd, multiplier, taxRate] of OFFLINE) {
    const names = [name, ...(aliases ? aliases.split("|") : [])];
    if (names.some((n) => n && t.includes(` ${normalize(n)} `))) {
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

// ---- offline business templates (used when web + cache both fail) ----
type OfflineTemplate = {
  keys: string[];
  name: string;
  baseUsd: number;
  hours: number;
  weeks: number;
  summary: string;
  items: { name: string; detail: string; share: number }[];
};

const BUSINESS_TEMPLATES: OfflineTemplate[] = [
  {
    keys: ["tyre", "tire", "tyres", "tires", "puncture", "ٹائر", "پنکچر"],
    name: "Tyre shop setup",
    baseUsd: 40000,
    hours: 450,
    weeks: 10,
    summary: "Fit-out and opening of a tyre/auto service shop with tools, stock and an online booking site.",
    items: [
      { name: "Garage equipment & lifts", detail: "Tyre machines, balancer, compressor, jacks and tools", share: 0.32 },
      { name: "Shop fit-out", detail: "Reception, flooring, lighting, signage and storage", share: 0.22 },
      { name: "Opening tyre stock", detail: "Initial inventory across common sizes and brands", share: 0.2 },
      { name: "Booking website & POS", detail: "Online booking, invoicing and inventory system", share: 0.12 },
      { name: "Licences & branding", detail: "Permits, insurance and brand identity", share: 0.08 },
      { name: "Launch marketing", detail: "Local ads, social setup and opening promotion", share: 0.06 },
    ],
  },
  {
    keys: ["restaurant", "cafe", "café", "coffee", "diner", "eatery", "bistro", "ریستوران", "ریسٹورنٹ", "کیفے", "ہوٹل کا کھانا"],
    name: "Restaurant setup",
    baseUsd: 75000,
    hours: 900,
    weeks: 14,
    summary: "Opening a restaurant/cafe: kitchen, dining fit-out, licences, stock and ordering website.",
    items: [
      { name: "Kitchen & cooking equipment", detail: "Hobs, ovens, refrigeration, prep and utensils", share: 0.26 },
      { name: "Interior fit-out", detail: "Flooring, walls, lighting, counters and signage", share: 0.22 },
      { name: "Furniture & decor", detail: "Tables, chairs, crockery and styling", share: 0.1 },
      { name: "Initial food & drink stock", detail: "Opening ingredients, beverages and consumables", share: 0.1 },
      { name: "Licences & permits", detail: "Food licence, safety and insurance", share: 0.06 },
      { name: "Staffing & training", detail: "Hiring and training for opening team", share: 0.14 },
      { name: "Ordering website & marketing", detail: "Menu site/ordering plus launch campaign", share: 0.12 },
    ],
  },
  {
    keys: ["grocery", "mart", "supermarket", "kirana", "general store", "mini market", "store", "مارٹ", "کریانہ", "گروسری", "سپر مارکیٹ"],
    name: "Grocery mart setup",
    baseUsd: 55000,
    hours: 600,
    weeks: 10,
    summary: "Setting up a grocery/mini-market with shelving, refrigeration, stock and a billing system.",
    items: [
      { name: "Shelving & shop fit-out", detail: "Racks, counters, flooring and lighting", share: 0.24 },
      { name: "Refrigeration", detail: "Chillers, freezers and cold storage", share: 0.14 },
      { name: "Opening stock", detail: "Initial inventory across fast-moving goods", share: 0.3 },
      { name: "POS & inventory system", detail: "Billing, barcode and stock software", share: 0.12 },
      { name: "Licences & permits", detail: "Trade, food and municipal licences", share: 0.06 },
      { name: "Signage & launch", detail: "Branding, signage and opening promotion", share: 0.14 },
    ],
  },
  {
    keys: ["salon", "beauty", "parlour", "parlor", "barber", "spa", "hairdress", "سیلون", "پارلر", "حجام", "بیوٹی"],
    name: "Salon setup",
    baseUsd: 22000,
    hours: 260,
    weeks: 6,
    summary: "Opening a salon/beauty parlour with equipment, fit-out, products and a booking system.",
    items: [
      { name: "Equipment & tools", detail: "Chairs, dryers, styling tools and stations", share: 0.28 },
      { name: "Interior fit-out", detail: "Flooring, mirrors, lighting and wash units", share: 0.24 },
      { name: "Furniture & reception", detail: "Waiting area, reception and storage", share: 0.12 },
      { name: "Product inventory", detail: "Opening stock of hair and skin products", share: 0.14 },
      { name: "Licences & branding", detail: "Permits, insurance and brand identity", share: 0.08 },
      { name: "Booking site & marketing", detail: "Online booking plus launch promotion", share: 0.14 },
    ],
  },
  {
    keys: ["clinic", "hospital", "medical", "doctor", "dental", "dentist", "diagnostic", "lab", "کلینک", "ہسپتال", "ڈاکٹر", "دندان"],
    name: "Clinic setup",
    baseUsd: 65000,
    hours: 780,
    weeks: 12,
    summary: "Opening a clinic: medical equipment, fit-out, licences, systems and patient booking.",
    items: [
      { name: "Medical equipment", detail: "Examination, diagnostic and treatment equipment", share: 0.3 },
      { name: "Clinic fit-out", detail: "Consult rooms, flooring, lighting and plumbing", share: 0.22 },
      { name: "Furniture & fixtures", detail: "Reception, waiting area and storage", share: 0.1 },
      { name: "Licences & compliance", detail: "Health permits, insurance and safety", share: 0.1 },
      { name: "Software & records system", detail: "Appointments, records and billing", share: 0.12 },
      { name: "Staffing & marketing", detail: "Hiring plus launch and patient outreach", share: 0.16 },
    ],
  },
  {
    keys: ["pharmacy", "chemist", "medical store", "drug store", "فارمیسی", "دواخانہ", "میڈیکل اسٹور"],
    name: "Pharmacy setup",
    baseUsd: 45000,
    hours: 420,
    weeks: 8,
    summary: "Opening a pharmacy with fit-out, refrigeration, opening stock and billing software.",
    items: [
      { name: "Shelving & fit-out", detail: "Racks, counters, flooring and lighting", share: 0.24 },
      { name: "Refrigeration", detail: "Medicine fridges and cold storage", share: 0.12 },
      { name: "Opening medicine stock", detail: "Initial licensed inventory", share: 0.34 },
      { name: "Billing & inventory software", detail: "POS with expiry and stock tracking", share: 0.12 },
      { name: "Licences & compliance", detail: "Pharmacy licence and insurance", share: 0.08 },
      { name: "Signage & launch", detail: "Branding and opening promotion", share: 0.1 },
    ],
  },
  {
    keys: ["gym", "fitness", "health club", "workout", "جم", "فٹنس"],
    name: "Gym setup",
    baseUsd: 60000,
    hours: 700,
    weeks: 12,
    summary: "Opening a gym/fitness studio with equipment, fit-out, systems and memberships.",
    items: [
      { name: "Fitness equipment", detail: "Cardio, strength and free-weight machines", share: 0.34 },
      { name: "Fit-out & flooring", detail: "Rubber flooring, mirrors, lighting and changing rooms", share: 0.2 },
      { name: "Reception & furniture", detail: "Front desk, lockers and lounge", share: 0.08 },
      { name: "Membership & access system", detail: "CRM, access control and billing", share: 0.1 },
      { name: "Licences & insurance", detail: "Permits, safety and insurance", share: 0.08 },
      { name: "Staffing & marketing", detail: "Trainers plus launch and membership drive", share: 0.2 },
    ],
  },
  {
    keys: ["bakery", "patisserie", "cake", "bread", "بیکری", "کیک"],
    name: "Bakery setup",
    baseUsd: 35000,
    hours: 420,
    weeks: 9,
    summary: "Opening a bakery with ovens, fit-out, stock and a small shop/ordering site.",
    items: [
      { name: "Ovens & baking equipment", detail: "Deck ovens, mixers, proofers and trays", share: 0.3 },
      { name: "Shop fit-out", detail: "Display counters, flooring, lighting and signage", share: 0.22 },
      { name: "Initial ingredients & stock", detail: "Flour, sugar, dairy and packaging", share: 0.16 },
      { name: "Refrigeration", detail: "Chillers and display refrigeration", share: 0.12 },
      { name: "Licences & branding", detail: "Food licence, insurance and identity", share: 0.08 },
      { name: "Shop site & marketing", detail: "Ordering page plus launch promotion", share: 0.12 },
    ],
  },
  {
    keys: ["clothing", "boutique", "apparel", "fashion", "garment", "clothes", "بوتیک", "کپڑوں", "کپڑے"],
    name: "Clothing store setup",
    baseUsd: 30000,
    hours: 340,
    weeks: 8,
    summary: "Opening a clothing boutique with fit-out, opening stock and an online shop.",
    items: [
      { name: "Shop fit-out", detail: "Flooring, lighting, racks and fitting rooms", share: 0.24 },
      { name: "Opening stock", detail: "Initial clothing inventory across sizes", share: 0.34 },
      { name: "Furniture & displays", detail: "Racks, mannequins and counters", share: 0.12 },
      { name: "POS & online shop", detail: "Billing plus ecommerce storefront", share: 0.14 },
      { name: "Licences & branding", detail: "Permits, insurance and brand identity", share: 0.06 },
      { name: "Marketing & launch", detail: "Photography, ads and opening promotion", share: 0.1 },
    ],
  },
  {
    keys: ["electronics", "mobile shop", "phone shop", "computer shop", "gadget"],
    name: "Electronics shop setup",
    baseUsd: 40000,
    hours: 400,
    weeks: 8,
    summary: "Opening an electronics/mobile shop with fit-out, opening stock and billing.",
    items: [
      { name: "Shop fit-out", detail: "Counters, display cases, lighting and security", share: 0.22 },
      { name: "Opening stock", detail: "Initial devices, accessories and spares", share: 0.38 },
      { name: "Security & fixtures", detail: "CCTV, shutters and display units", share: 0.1 },
      { name: "POS & ecommerce", detail: "Billing plus online storefront", share: 0.14 },
      { name: "Licences & branding", detail: "Permits, warranty setup and identity", share: 0.06 },
      { name: "Marketing & launch", detail: "Ads and opening promotion", share: 0.1 },
    ],
  },
  {
    keys: ["warehouse", "storage", "godown", "logistics", "distribution"],
    name: "Warehouse setup",
    baseUsd: 90000,
    hours: 800,
    weeks: 14,
    summary: "Setting up a warehouse with racking, handling equipment, systems and staffing.",
    items: [
      { name: "Racking & shelving", detail: "Pallet racking, bin shelving and layout", share: 0.24 },
      { name: "Handling equipment", detail: "Forklifts, pallet jacks and trolleys", share: 0.2 },
      { name: "Facility fit-out", detail: "Flooring, lighting, docks and security", share: 0.18 },
      { name: "WMS & tracking", detail: "Stock management and barcode system", share: 0.12 },
      { name: "Licences & insurance", detail: "Permits, fire safety and insurance", share: 0.08 },
      { name: "Staffing & launch", detail: "Hiring, training and initial operations", share: 0.18 },
    ],
  },
  {
    keys: ["hotel", "motel", "guest house", "guesthouse", "resort", "hostel"],
    name: "Hotel setup",
    baseUsd: 220000,
    hours: 1800,
    weeks: 28,
    summary: "Opening a small hotel/guest house with rooms, fit-out, systems and booking.",
    items: [
      { name: "Building fit-out", detail: "Rooms, bathrooms, lobby and common areas", share: 0.34 },
      { name: "Furniture & fixtures", detail: "Beds, wardrobes, lighting and linens", share: 0.16 },
      { name: "Kitchen & dining", detail: "Kitchen equipment and dining setup", share: 0.12 },
      { name: "Booking system & website", detail: "Reservations, channel manager and site", share: 0.1 },
      { name: "Licences & compliance", detail: "Tourism permits, fire and safety", share: 0.08 },
      { name: "Staffing & marketing", detail: "Hiring plus launch and OTA listing", share: 0.2 },
    ],
  },
  {
    keys: ["school", "academy", "tuition", "education", "college", "institute", "training center", "training centre"],
    name: "School / academy setup",
    baseUsd: 80000,
    hours: 900,
    weeks: 16,
    summary: "Opening a school/training academy with classrooms, furniture, systems and staffing.",
    items: [
      { name: "Classroom fit-out", detail: "Rooms, flooring, lighting and boards", share: 0.24 },
      { name: "Furniture & equipment", detail: "Desks, chairs, computers and lab kit", share: 0.2 },
      { name: "Learning systems", detail: "LMS, website and admin software", share: 0.14 },
      { name: "Licences & accreditation", detail: "Registration, permits and insurance", share: 0.1 },
      { name: "Staffing & training", detail: "Teachers and admin hiring", share: 0.18 },
      { name: "Marketing & launch", detail: "Branding, ads and admission drive", share: 0.14 },
    ],
  },
  {
    keys: ["car wash", "vehicle wash", "auto wash", "detailing"],
    name: "Car wash setup",
    baseUsd: 30000,
    hours: 320,
    weeks: 7,
    summary: "Opening a car wash/detailing service with equipment, fit-out and booking.",
    items: [
      { name: "Wash & detailing equipment", detail: "Washers, vacuums, polishers and tanks", share: 0.3 },
      { name: "Site fit-out", detail: "Flooring, drainage, shelter and lighting", share: 0.22 },
      { name: "Water & power setup", detail: "Plumbing, recycling and electrical", share: 0.14 },
      { name: "Booking site & POS", detail: "Online booking and billing", share: 0.12 },
      { name: "Licences & permits", detail: "Environmental and trade permits", share: 0.08 },
      { name: "Marketing & launch", detail: "Local ads and opening offers", share: 0.14 },
    ],
  },
  {
    keys: ["laundry", "laundromat", "dry clean", "dryclean"],
    name: "Laundry setup",
    baseUsd: 35000,
    hours: 360,
    weeks: 8,
    summary: "Opening a laundry/dry-cleaning service with machines, fit-out and pickup booking.",
    items: [
      { name: "Washing & drying machines", detail: "Commercial washers, dryers and press", share: 0.32 },
      { name: "Shop fit-out", detail: "Counters, shelving, flooring and lighting", share: 0.2 },
      { name: "Utilities & plumbing", detail: "Water, drainage and power upgrades", share: 0.14 },
      { name: "Booking & POS software", detail: "Orders, pickup tracking and billing", share: 0.12 },
      { name: "Licences & permits", detail: "Trade and environmental permits", share: 0.08 },
      { name: "Marketing & launch", detail: "Local promotion and pickup service ads", share: 0.14 },
    ],
  },
  {
    keys: ["farm", "agriculture", "poultry", "dairy", "livestock", "greenhouse"],
    name: "Farm / agri business setup",
    baseUsd: 50000,
    hours: 620,
    weeks: 16,
    summary: "Setting up a small farm/agri business with land prep, equipment, stock and sales.",
    items: [
      { name: "Land prep & infrastructure", detail: "Clearing, irrigation and sheds", share: 0.26 },
      { name: "Equipment & machinery", detail: "Tractors, tools and processing equipment", share: 0.24 },
      { name: "Seeds, feed & livestock", detail: "Opening stock to start production", share: 0.22 },
      { name: "Storage & utilities", detail: "Cold/grain storage, water and power", share: 0.12 },
      { name: "Licences & insurance", detail: "Permits and crop/livestock insurance", share: 0.06 },
      { name: "Sales site & marketing", detail: "Website and market development", share: 0.1 },
    ],
  },
  {
    keys: ["printing", "press", "graphics", "signage", "print shop"],
    name: "Printing press setup",
    baseUsd: 45000,
    hours: 400,
    weeks: 9,
    summary: "Opening a printing press with machines, fit-out, stock and an order site.",
    items: [
      { name: "Printing machines", detail: "Digital press, cutter, laminator and binding", share: 0.34 },
      { name: "Shop fit-out", detail: "Flooring, storage, lighting and counters", share: 0.18 },
      { name: "Raw material stock", detail: "Paper, ink, boards and consumables", share: 0.16 },
      { name: "Order site & design tools", detail: "Online ordering plus design software", share: 0.12 },
      { name: "Licences & branding", detail: "Permits and brand identity", share: 0.06 },
      { name: "Marketing & launch", detail: "Samples, ads and opening promotion", share: 0.14 },
    ],
  },
  {
    keys: ["travel", "tour", "tourism", "ticketing"],
    name: "Travel agency setup",
    baseUsd: 18000,
    hours: 200,
    weeks: 5,
    summary: "Opening a travel agency with office fit-out, systems and booking channels.",
    items: [
      { name: "Office fit-out", detail: "Furniture, flooring, lighting and signage", share: 0.22 },
      { name: "Booking systems", detail: "GDS/booking tools and licenses", share: 0.26 },
      { name: "Licences & deposits", detail: "IATA/registration and insurance", share: 0.18 },
      { name: "Website & branding", detail: "Booking website and brand identity", share: 0.18 },
      { name: "Staffing & launch", detail: "Agent hiring and launch marketing", share: 0.16 },
    ],
  },
  {
    keys: ["real estate", "property", "realtor", "estate agency"],
    name: "Real estate agency setup",
    baseUsd: 20000,
    hours: 220,
    weeks: 5,
    summary: "Opening a real-estate agency with office fit-out, listings platform and marketing.",
    items: [
      { name: "Office fit-out", detail: "Furniture, meeting room and signage", share: 0.22 },
      { name: "Listings website & CRM", detail: "Property portal, CRM and lead tools", share: 0.3 },
      { name: "Licences & legal", detail: "Agency licence, registration and insurance", share: 0.16 },
      { name: "Photography & media kit", detail: "Listing photos, branding and templates", share: 0.12 },
      { name: "Staffing & launch", detail: "Agent hiring and launch campaign", share: 0.2 },
    ],
  },
  {
    keys: ["construction", "contracting", "builder", "interior design", "renovation"],
    name: "Construction company setup",
    baseUsd: 60000,
    hours: 700,
    weeks: 14,
    summary: "Setting up a construction/interior contracting business with equipment, tools and office.",
    items: [
      { name: "Tools & machinery", detail: "Power tools, mixers, scaffolding and equipment", share: 0.3 },
      { name: "Vehicles & transport", detail: "Utility vehicles and material transport", share: 0.2 },
      { name: "Office & workshop", detail: "Office fit-out, storage and workshop", share: 0.16 },
      { name: "Licences & insurance", detail: "Contracting licence and site insurance", share: 0.1 },
      { name: "Software & website", detail: "Project tools and company website", share: 0.1 },
      { name: "Staffing & launch", detail: "Crew hiring and launch marketing", share: 0.14 },
    ],
  },
];

const GENERIC_TEMPLATE: Omit<OfflineTemplate, "keys"> = {
  name: "Business setup",
  baseUsd: 9000,
  hours: 260,
  weeks: 8,
  summary: "A typical setup cost for this project, covering planning, fit-out, equipment, systems and launch.",
  items: [
    { name: "Planning & permits", detail: "Requirements, design and licences", share: 0.14 },
    { name: "Location & fit-out", detail: "Premises, interior and utilities", share: 0.24 },
    { name: "Equipment & stock", detail: "Machinery, fixtures and initial inventory", share: 0.26 },
    { name: "Systems & website", detail: "Software, POS and online presence", share: 0.14 },
    { name: "Staffing & training", detail: "Hiring and onboarding the team", share: 0.12 },
    { name: "Marketing & launch", detail: "Branding, ads and opening promotion", share: 0.1 },
  ],
};

// Word-boundary match first; only allow a loose substring match for longer keys
// so short keys (e.g. "جم") do not match inside unrelated words.
function keyHit(hay: string, k: string): boolean {
  const nk = normalize(k);
  if (!nk) return false;
  return hay.includes(` ${nk} `) || (nk.length >= 5 && hay.includes(nk));
}

// True when the text looks like one of the known offline business types.
export function matchesBusinessTemplate(text: string): boolean {
  const hay = ` ${normalize(text)} `;
  return BUSINESS_TEMPLATES.some((t) => t.keys.some((k) => keyHit(hay, k)));
}

// Returns a decent offline estimate for a custom business, or null if nothing matches.
export function offlineCategory(name: string, description = ""): CustomCategory {
  const hay = ` ${normalize(`${name} ${description}`)} `;
  const hit = BUSINESS_TEMPLATES.find((t) => t.keys.some((k) => keyHit(hay, k)));
  const t = hit ?? GENERIC_TEMPLATE;
  return {
    name: hit ? hit.name : name || "Business setup",
    baseUsd: t.baseUsd,
    hours: t.hours,
    weeks: t.weeks,
    summary: t.summary,
    items: t.items.map((i) => ({ ...i })),
    origin: "offline",
  };
}
