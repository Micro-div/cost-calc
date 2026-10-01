"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CurrencySettingsModal } from "@/components/common/CurrencySettingsModal";
import { Toast } from "@/components/common/Toast";
import { CtaSection } from "@/components/home/CtaSection";
import { EstimateResultSection } from "@/components/home/EstimateResult";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ServicesSection } from "@/components/home/ServicesSection";
import { WhyCostCalc } from "@/components/home/WhyCostCalc";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { QuoteModal } from "@/components/quotation/QuoteModal";
import {
  categories,
  locations,
  projectSizes,
  qualityOptions,
} from "@/constants";
import {
  calculateEstimate,
  detectCategory,
  detectCurrencyFromLocale,
  detectLocation,
  scrollToSection,
} from "@/lib";
import type {
  CategoryId,
  CurrencyCode,
  EstimateItem,
  EstimateResult,
  Location,
  LocationId,
  ProjectSizeId,
  QualityId,
  SharedEstimate,
} from "@/types";

export default function Home() {
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId>("web");
  const [locationId, setLocationId] = useState<LocationId>("us");
  const [locationSelectedManually, setLocationSelectedManually] =
    useState(false);
  const [sizeId, setSizeId] = useState<ProjectSizeId>("medium");
  const [qualityId, setQualityId] = useState<QualityId>("standard");
  const [questionStep, setQuestionStep] = useState(0);
  const [stage, setStage] = useState<"describe" | "questions" | "complete">(
    "describe",
  );
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteItems, setQuoteItems] = useState<EstimateItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoCurrency, setAutoCurrency] = useState(true);
  const [manualCurrency, setManualCurrency] = useState<CurrencyCode>("USD");
  const [currencyOverride, setCurrencyOverride] = useState<CurrencyCode | null>(
    null,
  );

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? categories[0],
    [categoryId],
  );
  const selectedLocation = useMemo(
    () => locations.find((item) => item.id === locationId) ?? locations[0],
    [locationId],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  useEffect(() => {
    if (!window.location.hash.startsWith("#estimate=")) return;

    try {
      const raw = window.location.hash.replace("#estimate=", "");
      const shared = JSON.parse(decodeURIComponent(raw)) as SharedEstimate;
      const categoryIsValid = categories.some(
        (item) => item.id === shared.categoryId,
      );
      const locationIsValid = locations.some(
        (item) => item.id === shared.locationId,
      );
      const sizeIsValid = projectSizes.some(
        (item) => item.id === shared.sizeId,
      );
      const qualityIsValid = qualityOptions.some(
        (item) => item.id === shared.qualityId,
      );

      if (
        !shared.description ||
        !categoryIsValid ||
        !locationIsValid ||
        !sizeIsValid ||
        !qualityIsValid
      ) {
        return;
      }

      setDescription(shared.description);
      setCategoryId(shared.categoryId);
      setLocationId(shared.locationId);
      setSizeId(shared.sizeId);
      setQualityId(shared.qualityId);
      setEstimate(
        calculateEstimate(
          shared.description,
          shared.categoryId,
          shared.locationId,
          shared.sizeId,
          shared.qualityId,
          autoCurrency ? currencyOverride : manualCurrency,
        ),
      );
      setStage("complete");
      window.setTimeout(() => scrollToSection("estimate-result"), 200);
    } catch {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [currencyOverride]);

  const beginEstimate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (description.trim().length < 12) return;

    const detectedCategory = detectCategory(description);
    const selectedLocationId = locationSelectedManually
      ? locationId
      : detectLocation(description);
    setCategoryId(detectedCategory);
    setLocationId(selectedLocationId);
    setQuestionStep(0);
    setStage("questions");
    window.setTimeout(() => scrollToSection("estimator"), 30);
  };

  const continueQuestions = () => {
    if (questionStep === 0) {
      setQuestionStep(1);
      return;
    }

    const result = calculateEstimate(
      description,
      categoryId,
      locationId,
      sizeId,
      qualityId,
      autoCurrency ? currencyOverride : manualCurrency,
    );
    setEstimate(result);
    setStage("complete");
    window.setTimeout(() => scrollToSection("estimate-result"), 80);
  };

  const resetEstimate = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setDescription("");
    setCategoryId("web");
    setLocationId("us");
    setLocationSelectedManually(false);
    setSizeId("medium");
    setQualityId("standard");
    setQuestionStep(0);
    setStage("describe");
    setEstimate(null);
    window.setTimeout(() => scrollToSection("estimator"), 50);
  };

  const chooseCategory = (id: CategoryId) => {
    const category = categories.find((item) => item.id === id) ?? categories[0];
    setCategoryId(id);
    setStage("describe");
    if (!description.trim()) setDescription(category.example);
    window.setTimeout(() => scrollToSection("estimator"), 30);
  };

  const openQuotation = () => {
    if (!estimate) return;
    setQuoteItems(estimate.items.map((item) => ({ ...item })));
    setQuoteOpen(true);
  };

  const shareEstimate = async () => {
    if (!estimate) return;
    const payload: SharedEstimate = {
      description,
      categoryId,
      locationId,
      sizeId,
      qualityId,
    };
    const url = new URL(window.location.href);
    url.hash = `estimate=${encodeURIComponent(JSON.stringify(payload))}`;

    try {
      await navigator.clipboard.writeText(url.toString());
      notify("Shareable estimate link copied");
    } catch {
      window.prompt("Copy your estimate link:", url.toString());
    }
  };

  const saveEstimate = () => {
    if (!estimate) return;
    localStorage.setItem(
      "costcalc-latest-estimate",
      JSON.stringify({ ...estimate, savedAt: new Date().toISOString() }),
    );
    notify("Estimate saved on this device");
  };

  const activeStep = stage === "describe" ? 0 : stage === "questions" ? 1 : 2;
  const descriptionReady = description.trim().length >= 12;

  const effectiveCurrency: CurrencyCode = autoCurrency
    ? (currencyOverride ?? detectCurrencyFromLocale())
    : manualCurrency;

  const getLocationWithCurrency = (loc: Location): Location =>
    ({
      ...loc,
      currency: effectiveCurrency,
    }) as Location;

  return (
    <main
      id="top"
      className="min-h-screen overflow-x-hidden bg-[#f8f8fb] text-[#1d1b24]"
    >
      <Header
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onEstimateClick={() => scrollToSection("estimator")}
      />

      <Hero
        stage={stage}
        activeStep={activeStep}
        description={description}
        categoryId={categoryId}
        locationId={locationId}
        sizeId={sizeId}
        qualityId={qualityId}
        questionStep={questionStep}
        estimate={estimate}
        descriptionReady={descriptionReady}
        selectedCategory={selectedCategory}
        selectedLocation={selectedLocation}
        onDescriptionChange={setDescription}
        onCategoryChange={setCategoryId}
        onLocationChange={(id) => {
          setLocationId(id);
          setLocationSelectedManually(true);
          setCurrencyOverride(null);
        }}
        onSizeChange={setSizeId}
        onQualityChange={setQualityId}
        onSubmitDescription={beginEstimate}
        onBack={() => {
          if (questionStep === 0) {
            setStage("describe");
          } else {
            setQuestionStep(0);
          }
        }}
        onContinueQuestions={continueQuestions}
        onViewEstimate={() => scrollToSection("estimate-result")}
      />

      {estimate && (
        <EstimateResultSection
          estimate={estimate}
          onSave={saveEstimate}
          onShare={shareEstimate}
          onOpenQuotation={openQuotation}
        />
      )}

      <ServicesSection onChooseCategory={chooseCategory} />

      <HowItWorks />

      <WhyCostCalc onEstimateClick={() => scrollToSection("estimator")} />

      <CtaSection onEstimateClick={() => scrollToSection("estimator")} />

      <Footer />

      {quoteOpen && estimate && (
        <QuoteModal
          estimate={estimate}
          items={quoteItems}
          onChange={setQuoteItems}
          onClose={() => setQuoteOpen(false)}
          notify={notify}
        />
      )}

      {settingsOpen && (
        <CurrencySettingsModal
          autoCurrency={autoCurrency}
          manualCurrency={manualCurrency}
          currencyOverride={currencyOverride}
          effectiveCurrency={effectiveCurrency}
          onAutoCurrencyChange={setAutoCurrency}
          onManualCurrencyChange={setManualCurrency}
          onCurrencyOverrideChange={setCurrencyOverride}
          onClose={() => setSettingsOpen(false)}
          onReset={() => {
            setAutoCurrency(true);
            setCurrencyOverride(null);
          }}
        />
      )}

      <Toast message={toast} />
    </main>
  );
}
