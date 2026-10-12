"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  categories,
  locations,
  projectSizes,
  qualityOptions,
} from "@/constants";
import { formatCompactCurrency, formatCurrency, scrollToSection } from "@/lib";
import type {
  Category,
  CategoryId,
  CustomProjectType,
  EstimateResult,
  IconName,
  Location,
  LocationId,
  ProjectSizeId,
  QualityId,
  Stage,
} from "@/types";
import type { CustomCategory, CustomLocation } from "@/lib/chatbot/types";
import { Icon } from "@/components/common/Icon";

export interface EstimatorProps {
  stage: Stage;
  activeStep: number;
  description: string;
  categoryId: CategoryId;
  locationId: LocationId;
  cityName: string;
  sizeId: ProjectSizeId;
  qualityId: QualityId;
  questionStep: number;
  estimate: EstimateResult | null;
  descriptionReady: boolean;
  selectedCategory: Category;
  selectedLocation: Location;
  isGenerating?: boolean;
  customLocation?: CustomLocation | null;
  customCategory?: CustomCategory | null;
  onCategoryChangeCustom?: () => void;
  onLocationChangeCustom?: () => void;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (id: CategoryId) => void;
  onLocationChange: (id: LocationId) => void;
  onCityChange: (name: string) => void;
  onSizeChange: (id: ProjectSizeId) => void;
  onQualityChange: (id: QualityId) => void;
  onSubmitDescription: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onContinueQuestions: () => void;
  onViewEstimate: () => void;
  onNewEstimate: () => void;
  customProjectTypes: CustomProjectType[];
  selectedCustom: CustomProjectType | null;
  onSelectCustomType: (name: string) => void;
  onRemoveCustomType: (name: string) => void;
  // Manual "Other (AI research)" actions. Resolve true when a value was applied.
  onResearchCategory?: (name: string) => Promise<boolean>;
  onResearchLocation?: (country: string, city: string) => Promise<boolean>;
}

// Sentinel values so the two "Other" choices never clash with a real id.
const ADD_CATEGORY = "__add_category__";
const ADD_LOCATION = "__add_location__";

/* Entrance animation: desktop slides in from the right, mobile slides up from the bottom.
   The negative delay makes the motion already "in progress" at first paint (no pause). */
const slideInCss = `
  :root {
    --estimator-slide-distance: 160px;
    --estimator-slide-duration: 1.6s;
    --estimator-slide-delay: -0.25s;
  }

  @keyframes estimatorSlideInRight {
    from {
      opacity: 0;
      transform: translate3d(var(--estimator-slide-distance), 0, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }

  @keyframes estimatorSlideInUp {
    from {
      opacity: 0;
      transform: translate3d(0, var(--estimator-slide-distance), 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .estimator-card {
      animation: estimatorSlideInRight var(--estimator-slide-duration)
        cubic-bezier(0.22, 1, 0.36, 1) var(--estimator-slide-delay) both;
      will-change: transform, opacity;
    }
  }

  /* Mobile: stay hidden until scrolled into view, then slide up from the bottom */
  @media (max-width: 767px) {
    :root {
      --estimator-slide-distance: 90px;
      --estimator-slide-duration: 1.2s;
    }
    @media (prefers-reduced-motion: no-preference) {
      .estimator-card {
        animation: none;
      }
      .estimator-card[data-revealed="false"] {
        opacity: 0;
        transform: translate3d(0, var(--estimator-slide-distance), 0);
      }
      .estimator-card[data-revealed="true"] {
        animation: estimatorSlideInUp var(--estimator-slide-duration)
          cubic-bezier(0.22, 1, 0.36, 1) 0s both;
      }
    }
  }

  html,
  body {
    overflow-x: clip;
  }
`;

export function Estimator({
  stage,
  activeStep,
  description,
  categoryId,
  locationId,
  cityName,
  sizeId,
  qualityId,
  questionStep,
  estimate,
  descriptionReady,
  selectedCategory,
  selectedLocation,
  onDescriptionChange,
  onCategoryChange,
  onLocationChange,
  onCityChange,
  onSizeChange,
  onQualityChange,
  onSubmitDescription,
  onBack,
  onContinueQuestions,
  onViewEstimate,
  onNewEstimate,
  isGenerating,
  customLocation,
  customCategory,
  onCategoryChangeCustom,
  onLocationChangeCustom,
  customProjectTypes,
  selectedCustom,
  onSelectCustomType,
  onRemoveCustomType,
  onResearchCategory,
  onResearchLocation,
}: EstimatorProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [addingLocation, setAddingLocation] = useState(false);
  const [newCountry, setNewCountry] = useState("");
  const [newCity, setNewCity] = useState("");
  const [busyResearch, setBusyResearch] = useState<"category" | "location" | null>(null);
  const [researchError, setResearchError] = useState("");

  const submitCategoryResearch = async () => {
    const name = newCategory.trim();
    if (!name || busyResearch || !onResearchCategory) return;
    setResearchError("");
    setBusyResearch("category");
    try {
      const ok = await onResearchCategory(name);
      if (ok) {
        setAddingCategory(false);
        setNewCategory("");
      } else {
        setResearchError("Could not research this type. Try a different name.");
      }
    } finally {
      setBusyResearch(null);
    }
  };

  const submitLocationResearch = async () => {
    const country = newCountry.trim();
    if (!country || busyResearch || !onResearchLocation) return;
    setResearchError("");
    setBusyResearch("location");
    try {
      const ok = await onResearchLocation(country, newCity.trim());
      if (ok) {
        setAddingLocation(false);
        setNewCountry("");
        setNewCity("");
      } else {
        setResearchError("Could not research this country. Try a different name.");
      }
    } finally {
      setBusyResearch(null);
    }
  };

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{slideInCss}</style>
      <div
        ref={cardRef}
        data-revealed={revealed}
        className="estimator-card relative overflow-hidden rounded-[26px] border border-white/90 bg-white p-3 shadow-[0_30px_90px_rgba(45,38,74,0.14)] sm:p-4">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#6754e7] via-[#9a7cf1] to-[#5cc8aa]" />
        <div className="px-2 pb-3 pt-2 sm:px-3 sm:pb-4 sm:pt-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#26232e]">
                {stage === "describe" && "Describe your project"}
                {stage === "questions" && "A few quick details"}
                {stage === "complete" && "Your estimate is ready"}
              </p>
              <p className="mt-0.5 text-xs text-[#85818c]">
                Free · No account needed
              </p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-[#f0edff] px-3 py-1.5 text-[11px] font-bold text-[#604fc6] sm:flex">
              <Icon name="zap" className="h-3.5 w-3.5" />
              Live estimate
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["Describe", "Details", "Estimate"].map((label, index) => (
              <div key={label} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      index <= activeStep ? "bg-[#6d58e8]" : "bg-[#e9e6ee]"
                    }`}
                  />
                  <p
                    className={`mt-1.5 truncate text-[10px] font-semibold sm:text-[11px] ${
                      index <= activeStep ? "text-[#5b4abe]" : "text-[#a29ea8]"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {stage === "describe" && (
          <form
            onSubmit={onSubmitDescription}
            className="rounded-[20px] border border-[#e8e5ed] bg-[#fcfbfd] p-4 sm:p-5"
          >
            <label
              htmlFor="project-description"
              className="text-sm font-bold text-[#302d37]"
            >
              What do you want to build or improve?
            </label>
            <div className="relative mt-3">
              <textarea
                id="project-description"
                value={description}
                onChange={(event) =>
                  onDescriptionChange(event.target.value.slice(0, 500))
                }
                placeholder="For example: I need an ecommerce website for a clothing brand with payments, customer accounts and around 500 products..."
                className="min-h-[132px] w-full resize-none rounded-2xl border border-[#dedbe4] bg-white px-4 py-3.5 pr-11 text-[14px] leading-6 text-[#33303a] outline-none transition placeholder:text-[#aaa6b0] focus:border-[#7661e8] focus:ring-4 focus:ring-[#7661e8]/10 sm:min-h-[142px] sm:text-[15px]"
              />
              <span className="absolute bottom-3 right-3 text-[10px] font-medium text-[#aaa6b1]">
                {description.length}/500
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block">
                  <span className="sr-only">Project category</span>
                  <span className="relative block">
                    <Icon
                      name={selectedCategory.icon as IconName}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#6d58db]"
                    />
                    <select
                      value={
                        customCategory
                          ? "custom-category"
                          : selectedCustom
                            ? `custom:${selectedCustom.name}`
                            : categoryId
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === ADD_CATEGORY) {
                          setAddingCategory(true);
                          setResearchError("");
                        } else if (value.startsWith("custom:")) {
                          onSelectCustomType(value.slice("custom:".length));
                        } else if (value === "custom-category") {
                          // Already the AI-found category; nothing to change.
                        } else {
                          if (customCategory) onCategoryChangeCustom?.();
                          onCategoryChange(value as CategoryId);
                        }
                      }}
                      className="h-11 w-full appearance-none rounded-xl border border-[#dedbe4] bg-white pl-10 pr-9 text-sm font-semibold text-[#403c47] outline-none transition focus:border-[#7661e8] focus:ring-4 focus:ring-[#7661e8]/10"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.shortName}
                        </option>
                      ))}
                      {customCategory && (
                        <optgroup label="AI found">
                          <option value="custom-category">
                            {customCategory.name}
                          </option>
                        </optgroup>
                      )}
                      {customProjectTypes.length > 0 && (
                        <optgroup label="Your projects">
                          {customProjectTypes.map((custom) => (
                            <option
                              key={custom.name}
                              value={`custom:${custom.name}`}
                            >
                              {custom.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Not in the list?">
                        <option value={ADD_CATEGORY}>
                          Other type — AI research…
                        </option>
                      </optgroup>
                    </select>
                    <Icon
                      name="chevron-down"
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77727f]"
                    />
                  </span>
                </label>
                {selectedCustom && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#f0edff] px-2.5 py-1.5">
                    <span className="truncate text-[11px] font-semibold text-[#604fc6]">
                      {selectedCustom.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveCustomType(selectedCustom.name)}
                      aria-label={`Remove ${selectedCustom.name}`}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[#8a2432] transition hover:bg-[#f6c9cf]"
                    >
                      <Icon name="close" className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <label className="block">
                <span className="sr-only">Project location</span>
                <span className="relative block">
                  <Icon
                    name="globe"
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#6d58db]"
                  />
                  <select
                    value={customLocation ? "custom" : locationId}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === ADD_LOCATION) {
                        setAddingLocation(true);
                        setResearchError("");
                        return;
                      }
                      if (value === "custom") return; // AI-found row selected again
                      onLocationChangeCustom?.();
                      onLocationChange(value as LocationId);
                    }}
                    className="h-11 w-full appearance-none rounded-xl border border-[#dedbe4] bg-white pl-10 pr-9 text-sm font-semibold text-[#403c47] outline-none transition focus:border-[#7661e8] focus:ring-4 focus:ring-[#7661e8]/10"
                  >
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.city}, {location.country}
                      </option>
                    ))}
                    {customLocation && (
                      <option value="custom">
                        {customLocation.country} (AI-found)
                      </option>
                    )}
                    <optgroup label="Not in the list?">
                      <option value={ADD_LOCATION}>
                        Other country — AI research…
                      </option>
                    </optgroup>
                  </select>
                  <Icon
                    name="chevron-down"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77727f]"
                  />
                </span>
              </label>
              <label className="block">
                <span className="sr-only">Project city</span>
                <span className="relative block">
                  <Icon
                    name="globe"
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#6d58db]"
                  />
                  <select
                    value={customLocation ? (customLocation.city || "") : (cityName || selectedLocation.city)}
                    onChange={(event) => onCityChange(event.target.value)}
                    disabled={Boolean(customLocation)}
                    className="h-11 w-full appearance-none rounded-xl border border-[#dedbe4] bg-white pl-10 pr-9 text-sm font-semibold text-[#403c47] outline-none transition focus:border-[#7661e8] focus:ring-4 focus:ring-[#7661e8]/10 disabled:cursor-not-allowed disabled:bg-[#f1eff5] disabled:text-[#9a96a1]"
                  >
                    {(selectedLocation.cities ?? [{ name: selectedLocation.city, factor: 1 }]).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {Boolean(cityName) &&
                      !(selectedLocation.cities ?? []).some((c) => c.name === cityName) && (
                        <option value={cityName}>{cityName}</option>
                      )}
                    {customLocation && (
                      <option value={customLocation.city ?? ""}>
                        {customLocation.city} (AI-found)
                      </option>
                    )}
                  </select>
                  <Icon
                    name="chevron-down"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77727f]"
                  />
                </span>
              </label>
            </div>

            {addingCategory && (
              <div className="mt-3 rounded-xl border border-[#d9d5f3] bg-[#faf9ff] p-3">
                <p className="text-xs font-bold text-[#4d3cc0]">
                  Build a new category (AI research)
                </p>
                <p className="mt-0.5 text-[11px] text-[#8a8695]">
                  Type any project or business type — e.g. tyre shop, restaurant, gym, warehouse.
                </p>
                <input
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(event.target.value.slice(0, 60))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitCategoryResearch();
                    }
                  }}
                  placeholder="e.g. tyre shop, restaurant, gym"
                  className="mt-2 h-10 w-full rounded-lg border border-[#dedbe4] bg-white px-3 text-sm text-[#33303a] outline-none transition focus:border-[#7661e8] focus:ring-2 focus:ring-[#7661e8]/15"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void submitCategoryResearch()}
                    disabled={busyResearch === "category" || !newCategory.trim()}
                    className="flex-1 rounded-lg bg-[#6754e7] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#5946d3] disabled:cursor-not-allowed disabled:bg-[#c8c3d6]"
                  >
                    {busyResearch === "category" ? "Researching…" : "Research & use"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCategory(false);
                      setNewCategory("");
                      setResearchError("");
                    }}
                    className="rounded-lg border border-[#ddd9e3] bg-white px-3 py-2 text-xs font-bold text-[#5c5864] transition hover:bg-[#f7f6f8]"
                  >
                    Cancel
                  </button>
                </div>
                {researchError && (
                  <p className="mt-1.5 text-[11px] font-medium text-[#b42318]">
                    {researchError}
                  </p>
                )}
              </div>
            )}

            {addingLocation && (
              <div className="mt-3 rounded-xl border border-[#d9d5f3] bg-[#faf9ff] p-3">
                <p className="text-xs font-bold text-[#4d3cc0]">
                  Research another country or city (AI)
                </p>
                <p className="mt-0.5 text-[11px] text-[#8a8695]">
                  Type any country and, optionally, a city.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    value={newCountry}
                    onChange={(event) =>
                      setNewCountry(event.target.value.slice(0, 60))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitLocationResearch();
                      }
                    }}
                    placeholder="Country, e.g. Portugal"
                    className="h-10 w-full rounded-lg border border-[#dedbe4] bg-white px-3 text-sm text-[#33303a] outline-none transition focus:border-[#7661e8] focus:ring-2 focus:ring-[#7661e8]/15"
                  />
                  <input
                    value={newCity}
                    onChange={(event) =>
                      setNewCity(event.target.value.slice(0, 60))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitLocationResearch();
                      }
                    }}
                    placeholder="City (optional)"
                    className="h-10 w-full rounded-lg border border-[#dedbe4] bg-white px-3 text-sm text-[#33303a] outline-none transition focus:border-[#7661e8] focus:ring-2 focus:ring-[#7661e8]/15"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void submitLocationResearch()}
                    disabled={busyResearch === "location" || !newCountry.trim()}
                    className="flex-1 rounded-lg bg-[#6754e7] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#5946d3] disabled:cursor-not-allowed disabled:bg-[#c8c3d6]"
                  >
                    {busyResearch === "location" ? "Researching…" : "Research & use"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingLocation(false);
                      setNewCountry("");
                      setNewCity("");
                      setResearchError("");
                    }}
                    className="rounded-lg border border-[#ddd9e3] bg-white px-3 py-2 text-xs font-bold text-[#5c5864] transition hover:bg-[#f7f6f8]"
                  >
                    Cancel
                  </button>
                </div>
                {researchError && (
                  <p className="mt-1.5 text-[11px] font-medium text-[#b42318]">
                    {researchError}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onNewEstimate}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#ece9ef] px-4 py-3 text-sm font-bold text-[#3a3641] transition hover:bg-[#ddd8e2]"
              >
                <Icon name="plus" className="h-4 w-4" />
                New estimate
              </button>
              <button
                type="submit"
                disabled={!descriptionReady}
                className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6754e7] px-5 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(103,84,231,0.25)] transition hover:bg-[#5946d3] disabled:cursor-not-allowed disabled:bg-[#c8c3d6] disabled:shadow-none"
              >
                Analyze my project
                <Icon
                  name="arrow-right"
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] font-medium text-[#95919c]">
              {descriptionReady
                ? "Your history is saved only in your browser. Text is sent to an AI provider to generate answers; we do not store it."
                : "Add a few details above to continue."}
            </p>
          </form>
        )}

        {stage === "questions" && (
          <div className="rounded-[20px] border border-[#e8e5ed] bg-[#fcfbfd] p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#ede9ff] px-3 py-1 text-[11px] font-bold text-[#6652cc]">
                Quick question {questionStep + 1} of 2
              </span>
              <span className="text-xs font-medium text-[#8a8691]">
                {selectedCustom?.name ?? selectedCategory.shortName} ·{" "}
                {selectedLocation.city}
              </span>
            </div>

            {questionStep === 0 ? (
              <div className="mt-5">
                <h2 className="text-xl font-bold tracking-[-0.035em] text-[#24212b]">
                  How large is your project?
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-[#797581]">
                  This helps us estimate the team, time and overall investment.
                </p>
                <div className="mt-5 grid gap-2.5">
                  {projectSizes.map((size) => (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => onSizeChange(size.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition sm:p-4 ${
                        sizeId === size.id
                          ? "border-[#7460e4] bg-[#f4f1ff] shadow-[0_0_0_3px_rgba(116,96,228,0.08)]"
                          : "border-[#e3e0e7] bg-white hover:border-[#c9c3e8] hover:bg-[#fbfaff]"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                          sizeId === size.id
                            ? "bg-[#6d58df] text-white"
                            : "bg-[#f0eef3] text-[#77727f]"
                        }`}
                      >
                        {sizeId === size.id ? (
                          <Icon name="check" className="h-4 w-4" />
                        ) : (
                          <Icon name="layers" className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#37333f]">
                          {size.name}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-[#817d88]">
                          {size.example}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <h2 className="text-xl font-bold tracking-[-0.035em] text-[#24212b]">
                  What level of quality do you need?
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-[#797581]">
                  Pick the option that feels closest to your expectations.
                </p>
                <div className="mt-5 grid gap-2.5">
                  {qualityOptions.map((quality) => (
                    <button
                      key={quality.id}
                      type="button"
                      onClick={() => onQualityChange(quality.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition sm:p-4 ${
                        qualityId === quality.id
                          ? "border-[#7460e4] bg-[#f4f1ff] shadow-[0_0_0_3px_rgba(116,96,228,0.08)]"
                          : "border-[#e3e0e7] bg-white hover:border-[#c9c3e8] hover:bg-[#fbfaff]"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                          qualityId === quality.id
                            ? "bg-[#6d58df] text-white"
                            : "bg-[#f0eef3] text-[#77727f]"
                        }`}
                      >
                        <Icon name="sparkles" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#37333f]">
                          {quality.name}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-[#817d88]">
                          {quality.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl border border-[#ddd9e3] bg-white px-4 py-3 text-sm font-bold text-[#5c5864] transition hover:bg-[#f7f6f8]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onContinueQuestions}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6754e7] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_25px_rgba(103,84,231,0.22)] transition hover:bg-[#5946d3]"
              >
                {questionStep === 0 ? "Continue" : "Generate my estimate"}
                <Icon name="arrow-right" className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {stage === "complete" && estimate && (
          <div className="rounded-[20px] border border-[#dcd6fa] bg-gradient-to-br from-[#f7f4ff] via-white to-[#effbf7] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e5f6ed] text-[#198454] shadow-sm">
                <Icon name="check" className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1f8a58]">
                  Estimate complete
                </p>
                <h2 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-[#25212c]">
                  {formatCurrency(estimate.total, estimate.location)}
                </h2>
                <p className="mt-1 text-sm text-[#77727f]">
                  Typical investment for{" "}
                  {estimate.category.shortName.toLowerCase()} in{" "}
                  {estimate.location.city}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-[#e3dfec] rounded-2xl border border-[#e4e0eb] bg-white/80 py-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#98939e]">
                  Confidence
                </p>
                <p className="mt-1 text-sm font-bold text-[#37333f]">
                  {estimate.confidence}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#98939e]">
                  Timeline
                </p>
                <p className="mt-1 text-sm font-bold text-[#37333f]">
                  {estimate.durationMin}–{estimate.durationMax} wks
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#98939e]">
                  Range
                </p>
                <p className="mt-1 text-sm font-bold text-[#37333f]">
                  {formatCompactCurrency(estimate.low, estimate.location)}
                  –
                  {formatCompactCurrency(estimate.high, estimate.location)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onViewEstimate}
              className="group mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#211e29] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#34303d]"
            >
              View detailed estimate
              <Icon
                name="arrow-right"
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-2 pb-1 pt-4 text-[10px] font-semibold text-[#918c98]">
          <span className="flex items-center gap-1.5">
            <Icon name="lock" className="h-3.5 w-3.5" />
            Your history is saved only in your browser. Text is sent to an AI provider to generate answers; we do not store it.
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="calculator" className="h-3.5 w-3.5" />
            Transparent pricing
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="clock" className="h-3.5 w-3.5" />
            Takes under a minute
          </span>
        </div>
      </div>
    </>
  );
}
