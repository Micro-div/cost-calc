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
  const size =
    projectSizes.find((item) => item.id === sizeId) ?? projectSizes[1];
  const quality =
    qualityOptions.find((item) => item.id === qualityId) ?? qualityOptions[1];

  const projectTotal =
    category.base * location.multiplier * size.multiplier * quality.multiplier;
  const lineItemShares = [0.14, 0.16, 0.42, 0.16, 0.12];
  const lineItemDetails = [
    {
      name: "Discovery & strategy",
      detail: "Requirements, research and project plan",
      quantity: 1,
    },
    {
      name: "UX & UI design",
      detail: "Wireframes, interface design and prototype",
      quantity: 28,
    },
    {
      name: "Development",
      detail: "Responsive build, features and integrations",
      quantity: Math.round(category.hours * 0.62),
    },
    {
      name: "Quality assurance",
      detail: "Testing, fixes and launch checks",
      quantity: 28,
    },
    {
      name: "Project management",
      detail: "Communication, coordination and handover",
      quantity: 16,
    },
  ];
  const items: EstimateItem[] = lineItemDetails.map((item, index) => {
    const amountUsd = projectTotal * lineItemShares[index];
    return {
      name: item.name,
      detail: item.detail,
      quantity: item.quantity,
      rate: roundMoney((amountUsd * fx) / item.quantity),
    };
  });
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0,
  );
  const contingency = roundMoney(subtotal * 0.05);
  const taxes = roundMoney((subtotal + contingency) * location.taxRate);
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
    location,
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
      };
      if (regionToCurrency[region]) return regionToCurrency[region];
    }
  } catch {
    // fallback
  }
  return "USD";
}
