import {
  allCurrencies,
  categories,
  locations,
  projectSizes,
  qualityOptions,
} from "@/constants";

export type CategoryId = (typeof categories)[number]["id"];
export type LocationId = (typeof locations)[number]["id"];
export type ProjectSizeId = (typeof projectSizes)[number]["id"];
export type QualityId = (typeof qualityOptions)[number]["id"];
// One cost line of an estimate. share = fraction of the project total
// (shares are normalized to 1 before pricing). quantity defaults to 1.
export type LineItemSpec = {
  name: string;
  detail: string;
  share: number;
  quantity?: number;
};

export type CitySpec = { name: string; factor: number };

// Widened structural shapes: a built-in category/location satisfies them as-is;
// an AI-provided custom category/location can too (same field names).
export type Category =
  | (typeof categories)[number]
  | {
      id: CategoryId;
      name: string;
      shortName: string;
      description: string;
      icon: string;
      base: number;
      hours: number;
      weeks: number;
      example: string;
      range: string;
      lineItems?: ReadonlyArray<LineItemSpec>;
    };
export type Location =
  | (typeof locations)[number]
  | {
      id: LocationId;
      country: string;
      city: string;
      currency: (typeof allCurrencies)[number];
      multiplier: number;
      taxRate: number;
      cities?: ReadonlyArray<CitySpec>;
    };
export type ProjectSize = (typeof projectSizes)[number];
export type QualityOption = (typeof qualityOptions)[number];
export type CurrencyCode = (typeof allCurrencies)[number];

export type Stage = "describe" | "questions" | "complete";

export type IconName =
  | "arrow-right"
  | "bot"
  | "calculator"
  | "check"
  | "chevron-down"
  | "clock"
  | "close"
  | "code"
  | "download"
  | "file-text"
  | "globe"
  | "layers"
  | "lock"
  | "megaphone"
  | "menu"
  | "palette"
  | "pen-tool"
  | "plus"
  | "rotate"
  | "search"
  | "share"
  | "shield"
  | "shopping-bag"
  | "sparkles"
  | "smartphone"
  | "trending"
  | "users"
  | "zap";

export interface EstimateItem {
  name: string;
  detail: string;
  quantity: number;
  rate: number;
}

export interface EstimateResult {
  projectTitle: string;
  description: string;
  category: Category;
  location: Location;
  size: ProjectSize;
  quality: QualityOption;
  items: EstimateItem[];
  subtotal: number;
  contingency: number;
  taxes: number;
  total: number;
  low: number;
  high: number;
  confidence: number;
  durationMin: number;
  durationMax: number;
  scope: string[];
  assumptions: string[];
  complexity: string;
}

export interface SharedEstimate {
  description: string;
  categoryId: CategoryId;
  locationId: LocationId;
  sizeId: ProjectSizeId;
  qualityId: QualityId;
}

export interface CustomProjectType {
  name: string;
  type: CategoryId;
  features: string[];
}
