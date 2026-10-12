import type { LineItemSpec } from "@/types";

export type Complexity = "small" | "medium" | "large";

export type ProjectDraft = {
  title: string;
  description: string; // ready-to-paste, <= 500 chars (UI limit)
  features: string[];
  category: string; // one of 8 ids | "custom" | "auto"
  customCategoryName?: string;
  complexity: Complexity;
  quality?: "essential" | "standard" | "premium"; // optional, chat can preselect
  country?: string; // English country name if the user said one
};

export type Source = { title: string; url: string };

// Country that is NOT in the 10 built-in locations. Fed into the same engine.
export type CustomLocation = {
  country: string;
  city: string;
  currency: string; // ISO 4217
  unitsPerUsd: number; // local currency units for 1 USD
  multiplier: number; // price level, Canada = 1.0
  taxRate: number; // 0.15 = 15%
  notes?: string;
  sources: Source[];
  origin: "web" | "cache" | "offline";
};

// Project type that does not fit the 8 categories (e.g. a tyre shop, a mart,
// a restaurant). The estimate uses its own researched breakdown items.
export type CustomCategory = {
  name: string;
  baseUsd: number;
  hours: number;
  weeks: number;
  summary?: string;
  items?: LineItemSpec[];
  origin: "web" | "cache" | "offline";
};
