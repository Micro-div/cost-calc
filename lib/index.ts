import {
  categories,
  locations,
  projectSizes,
  qualityOptions,
  USD_RATES,
} from "@/constants";
import type {
  Category,
  CategoryId,
  CurrencyCode,
  EstimateItem,
  EstimateResult,
  LineItemSpec,
  Location,
  LocationId,
  ProjectSizeId,
  QualityId,
} from "@/types";
import type { CustomCategory, CustomLocation } from "@/lib/chatbot/types";

export type { CustomCategory, CustomLocation };
export function roundMoney(value: number) {
  return Math.round(value);
}

export function formatCurrency(value: number, location: Location) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: location.currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value: number, location: Location) {
  const symbol = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: location.currency,
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .formatToParts(value)
    .find((part) => part.type === "currency")?.value;

  if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000)
    return `${symbol}${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `${symbol}${Math.round(value)}`;
}

export function detectCategory(description: string): CategoryId {
  const value = description.toLowerCase();
  const matches: Array<{ words: string[]; id: CategoryId }> = [
    {
      words: ["ecommerce", "e-commerce", "online store", "shopify", "checkout"],
      id: "ecommerce",
    },
    {
      words: ["mobile app", "android", "ios", "fitness app", "application"],
      id: "mobile",
    },
    {
      words: [
        "ai ",
        "artificial intelligence",
        "automation",
        "assistant",
        "chatbot",
      ],
      id: "ai",
    },
    {
      words: [
        "logo",
        "branding",
        "brand identity",
        "visual identity",
        "coffee brand",
      ],
      id: "branding",
    },
    {
      words: ["ui", "ux", "prototype", "wireframe", "product design"],
      id: "design",
    },
    {
      words: ["seo", "search engine", "organic traffic", "ranking"],
      id: "seo",
    },
    {
      words: [
        "social media",
        "instagram",
        "content calendar",
        "posts per month",
      ],
      id: "social",
    },
    {
      words: [
        "website",
        "web app",
        "web application",
        "landing page",
        "portfolio",
      ],
      id: "web",
    },
  ];

  // Count keyword matches for EVERY category, pick the one with the most
  // matches. Tie (or no match at all) prefers "web" — the previous behavior
  // stopped at the first matching category in array order, which misfired on
  // texts like "website ... basic SEO" (matched seo first).
  const best = matches.reduce<{ id: CategoryId; count: number } | null>(
    (acc, entry) => {
      const count = entry.words.filter((word) => value.includes(word)).length;
      if (count === 0) return acc;
      if (
        !acc ||
        count > acc.count ||
        (count === acc.count && entry.id === "web")
      ) {
        return { id: entry.id, count };
      }
      return acc;
    },
    null,
  );
  return best?.id ?? "web";
}

export function detectLocation(description: string): LocationId {
  const value = description.toLowerCase();
  const matches: Array<{ words: string[]; id: LocationId }> = [
    { words: ["canada", "toronto", "vancouver", "montreal"], id: "ca" },
    {
      words: ["united states", "usa", "new york", "san francisco", "texas"],
      id: "us",
    },
    { words: ["united kingdom", "uk", "london", "manchester"], id: "uk" },
    { words: ["dubai", "uae", "abu dhabi"], id: "ae" },
    { words: ["pakistan", "karachi", "lahore", "islamabad"], id: "pk" },
    { words: ["india", "mumbai", "delhi", "bangalore"], id: "in" },
    { words: ["australia", "sydney", "melbourne"], id: "au" },
    { words: ["germany", "berlin", "munich"], id: "de" },
    { words: ["singapore"], id: "sg" },
    { words: ["nigeria", "lagos", "abuja"], id: "ng" },
    { words: ["saudi", "riyadh", "jeddah", "ksa"], id: "sa" },
    { words: ["turkey", "turkiye", "istanbul", "ankara"], id: "tr" },
    { words: ["philippines", "manila", "cebu"], id: "ph" },
    { words: ["kenya", "nairobi", "mombasa"], id: "ke" },
    { words: ["malaysia", "kuala lumpur", "penang"], id: "my" },
    { words: ["bangladesh", "dhaka", "chittagong"], id: "bd" },
    { words: ["france", "paris", "lyon", "marseille"], id: "fr" },
    { words: ["brazil", "sao paulo", "rio de janeiro"], id: "br" },
    { words: ["egypt", "cairo", "alexandria"], id: "eg" },
    { words: ["indonesia", "jakarta", "surabaya", "bali"], id: "id" },
  ];

  return (
    matches.find(({ words }) => words.some((word) => value.includes(word)))
      ?.id ?? "us"
  );
}

export function getProjectTitle(description: string, category: Category) {
  const cleaned = description
    .trim()
    .replace(/^(i need|we need|please create|i want|we want)\s+/i, "")
    .replace(/[.!?]+$/, "");

  if (cleaned.length < 20 || cleaned.length > 76) return category.shortName;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Last-resort breakdown if a category somehow has no lineItems of its own.
const FALLBACK_LINE_ITEMS: ReadonlyArray<LineItemSpec> = [
  { name: "Discovery & strategy", detail: "Requirements, research and project plan", share: 0.14, quantity: 1 },
  { name: "UX & UI design", detail: "Wireframes, interface design and prototype", share: 0.16, quantity: 1 },
  { name: "Development", detail: "Responsive build, features and integrations", share: 0.42, quantity: 1 },
  { name: "Quality assurance", detail: "Testing, fixes and launch checks", share: 0.16, quantity: 1 },
  { name: "Project management", detail: "Communication, coordination and handover", share: 0.12, quantity: 1 },
];

export function calculateEstimate(
  description: string,
  categoryId: CategoryId | "custom",
  locationId: LocationId | "custom",
  sizeId: ProjectSizeId,
  qualityId: QualityId,
  currencyOverride?: CurrencyCode | null,
  custom?: {
    category?: CustomCategory;
    location?: CustomLocation;
    city?: string;
  },
): EstimateResult {
  // Custom category: use AI-provided base/hours/weeks instead of the lookup.
  const category: Category = custom?.category
    ? {
        id: categoryId as CategoryId,
        name: custom.category.name,
        shortName: custom.category.name,
        description: custom.category.summary ?? "",
        icon: categories[0].icon,
        base: custom.category.baseUsd,
        hours: custom.category.hours,
        weeks: custom.category.weeks,
        example: "",
        range: `$${Math.round(custom.category.baseUsd * 0.6)} - $${Math.round(custom.category.baseUsd * 2.4)}`,
      }
    : categories.find((item) => item.id === categoryId) ?? categories[0];
  // Custom location: use AI-fetched country data instead of the lookup.
  const rawLocation: Location = custom?.location
    ? {
        id: locationId as LocationId,
        country: custom.location.country,
        city: custom.location.city,
        currency: custom.location.currency as CurrencyCode,
        multiplier: custom.location.multiplier,
        taxRate: custom.location.taxRate,
      }
    : locations.find((item) => item.id === locationId) ?? locations[0];
  // Currency: the location's own currency unless an override was passed.
  // For a custom location its own ISO code is cast in — Intl.NumberFormat
  // accepts any valid ISO 4217 code, no fixed lookup table involved.
  const currency = (
    currencyOverride ?? rawLocation.currency
  ) as CurrencyCode;
  const fx =
    custom?.location && currency === (custom.location.currency as CurrencyCode)
      ? custom.location.unitsPerUsd
      : USD_RATES[currency] ?? 1;
  const location = { ...rawLocation, currency } as Location;
  // City: the chosen city (chat chip or form select) or the location's default.
  // Its factor adjusts the country price level (e.g. New York vs Austin).
  const cityName = custom?.location
    ? custom.location.city
    : (custom?.city || location.city);
  const cityFactor =
    location.cities?.find((item) => item.name === cityName)?.factor ?? 1;
  const resolvedLocation = {
    ...location,
    city: cityName,
    multiplier: location.multiplier * cityFactor,
  } as Location;
  const size =
    projectSizes.find((item) => item.id === sizeId) ?? projectSizes[1];
  const quality =
    qualityOptions.find((item) => item.id === qualityId) ?? qualityOptions[1];

  const projectTotal =
    category.base *
    resolvedLocation.multiplier *
    size.multiplier *
    quality.multiplier;
  // Line items follow WHAT is being estimated: each built-in category carries
  // its own breakdown, custom categories (e.g. a tyre shop or mart) carry the
  // AI-researched items. Shares are normalized so they always sum to 1.
  const rawSpecs: ReadonlyArray<LineItemSpec> =
    custom?.category?.items?.length
      ? custom.category.items
      : (category.lineItems ?? FALLBACK_LINE_ITEMS);
  const shareSum =
    rawSpecs.reduce((sum, spec) => sum + (spec.share > 0 ? spec.share : 0), 0) ||
    1;
  const items: EstimateItem[] = rawSpecs
    .filter((spec) => spec.share > 0)
    .map((spec) => {
      const quantity = Math.max(1, Math.round(spec.quantity ?? 1));
      const amountUsd = projectTotal * (spec.share / shareSum);
      return {
        name: spec.name,
        detail: spec.detail,
        quantity,
        rate: roundMoney((amountUsd * fx) / quantity),
      };
    });
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0,
  );
  const contingency = roundMoney(subtotal * 0.05);
  const taxes = roundMoney(
    (subtotal + contingency) * resolvedLocation.taxRate,
  );
  const total = subtotal + contingency + taxes;
  const baseWeeks = category.weeks * size.weekFactor * quality.weekFactor;
  const confidence = Math.min(
    94,
    80 + Math.min(12, Math.floor(description.length / 10)),
  );

  return {
    projectTitle: getProjectTitle(description, category),
    description,
    category,
    location: resolvedLocation,
    size,
    quality,
    items,
    subtotal,
    contingency,
    taxes,
    total,
    low: roundMoney(total * 0.88),
    high: roundMoney(total * 1.17),
    confidence,
    durationMin: Math.max(1, Math.round(baseWeeks * 0.8)),
    durationMax: Math.max(2, Math.round(baseWeeks * 1.2)),
  };
}

export function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function detectCurrencyFromLocale(): CurrencyCode {
  try {
    const locale =
      typeof navigator !== "undefined" ? navigator.language : "en-US";
    const parts = new Intl.Locale(locale).region;
    if (parts) {
      const region = parts.toUpperCase();
      const regionToCurrency: Record<string, CurrencyCode> = {
        US: "USD",
        CA: "CAD",
        GB: "GBP",
        AE: "AED",
        PK: "PKR",
        IN: "INR",
        AU: "AUD",
        DE: "EUR",
        SG: "SGD",
        NG: "NGN",
        JP: "JPY",
        CN: "CNY",
        KR: "KRW",
        BR: "BRL",
        MX: "MXN",
        ZA: "ZAR",
        SA: "SAR",
        CH: "CHF",
        SE: "SEK",
        NO: "NOK",
        TR: "TRY",
        EG: "EGP",
        MY: "MYR",
        BD: "BDT",
        KE: "KES",
        PH: "PHP",
        ID: "IDR",
      };
      if (regionToCurrency[region]) return regionToCurrency[region];
    }
  } catch {
    // fallback
  }
  return "USD";
}
