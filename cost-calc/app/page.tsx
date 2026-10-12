"use client";

<<<<<<< HEAD:app/page.tsx
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
=======
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
>>>>>>> origin/main:cost-calc/app/page.tsx
import { GeneratingOverlay } from "@/components/common/GeneratingOverlay";
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
import { ShareModal } from "@/components/share/ShareModal";
import {
  categories,
  locations,
  projectSizes,
  qualityOptions,
} from "@/constants";
import {
  calculateEstimate,
  detectLocation,
  formatCurrency,
  scrollToSection,
} from "@/lib";
<<<<<<< HEAD:app/page.tsx
import ChatBot from "@/components/chatbot/ChatBot";
import { researchCategory, researchLocation } from "@/lib/chatbot/research";
import { matchSupportedCountry } from "@/lib/chatbot/fallback";
import type { CustomLocation, CustomCategory } from "@/lib/chatbot/types";
=======
import { fetchAiAnalysis, getCachedAiAnalysis } from "@/lib/aiAnalysis";
import { analyzeProject, analyzeProjectWithAi } from "@/lib/analyzeProject";
>>>>>>> origin/main:cost-calc/app/page.tsx
import type {
  CategoryId,
  CurrencyCode,
  CustomProjectType,
  EstimateItem,
  EstimateResult,
  LocationId,
  ProjectSizeId,
  QualityId,
  SharedEstimate,
} from "@/types";

interface HistoryEntry {
  id: string;
  type: "estimate" | "draft";
  title: string;
  savedAt: string;
  data: EstimateResult | { items: EstimateItem[]; businessName: string; customerName: string };
}

const HISTORY_KEY = "costcalc-history";
const CUSTOM_PROJECT_TYPES_KEY = "customProjectTypes";

export default function Home() {
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId>("web");
  const [locationId, setLocationId] = useState<LocationId>("us");
  const [cityName, setCityName] = useState("");
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
  const [shareOpen, setShareOpen] = useState(false);
  const [quoteItems, setQuoteItems] = useState<EstimateItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [currencyOverride, setCurrencyOverride] = useState<CurrencyCode | null>(
    null,
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customLocation, setCustomLocation] = useState<CustomLocation | null>(null);
  const [customCategory, setCustomCategory] = useState<CustomCategory | null>(null);
  const [categorySelectedManually, setCategorySelectedManually] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingRun, setPendingRun] = useState(false);
  const [customProjectTypes, setCustomProjectTypes] = useState<CustomProjectType[]>(
    [],
  );
  const [selectedCustom, setSelectedCustom] =
    useState<CustomProjectType | null>(null);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState("");
  const [categoryManual, setCategoryManual] = useState(false);
  const [autoCategory, setAutoCategory] = useState<string | null>(null);
  // Guards against stale AI responses: only the newest request may apply.
  const aiRequestRef = useRef(0);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? categories[0],
    [categoryId],
  );
  const selectedLocation = useMemo(() => {
    const found = locations.find((item) => item.id === locationId) ?? locations[0];
    return cityName ? { ...found, city: cityName } : found;
  }, [locationId, cityName]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const notifyError = (message: string) => {
    setErrorToast(message);
    window.setTimeout(() => setErrorToast(""), 4000);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryEntry[];
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch {
      // ignore corrupted history
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_PROJECT_TYPES_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setCustomProjectTypes(
        parsed.filter((item): item is CustomProjectType => {
          if (typeof item !== "object" || item === null) return false;
          const candidate = item as Record<string, unknown>;
          return (
            typeof candidate.name === "string" &&
            typeof candidate.type === "string" &&
            Array.isArray(candidate.features)
          );
        }),
      );
    } catch {
      // ignore corrupted storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("costcalc-latest-estimate");
    } catch {
      // ignore
    }
  }, []);

  // While typing, auto-select the detected category in the dropdown.
  // Once the user picks a category manually, stop overriding it.
  // The rule-based pass stays instant; after the same debounce an optional
  // AI pass (POST /api/analyze, server-side Groq) refines the analysis input
  // (category, features, complexity, subject, heading, confidence). It is
  // cached by normalized text, so repeat input never calls the API twice;
  // any failure/timeout/stale response silently falls back to rule-based.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const text = description.trim();
      if (text.length < 8) {
        setAutoCategory(null);
        return;
      }
      const analysis = analyzeProject(text);
      if (!categoryManual) {
        setCategoryId(analysis.categoryId as CategoryId);
        setAutoCategory(analysis.category);
      }
      const requestId = ++aiRequestRef.current;
      void fetchAiAnalysis(text).then((ai) => {
        if (!ai || requestId !== aiRequestRef.current || categoryManual) return;
        const refined = analyzeProjectWithAi(text, ai);
        setCategoryId(refined.categoryId as CategoryId);
        setAutoCategory(refined.category);
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [description, categoryManual]);

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
          currencyOverride,
        ),
      );
      setStage("complete");
      window.setTimeout(() => scrollToSection("estimate-result"), 200);
    } catch {
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyOverride]);

  const persistCustomProjectTypes = (next: CustomProjectType[]) => {
    setCustomProjectTypes(next);
    try {
      localStorage.setItem(CUSTOM_PROJECT_TYPES_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable
    }
  };

  const saveCustomProjectType = (type: CustomProjectType) => {
    persistCustomProjectTypes([
      ...customProjectTypes.filter(
        (item) => item.name.toLowerCase() !== type.name.toLowerCase(),
      ),
      type,
    ]);
  };

  const removeCustomProjectType = (name: string) => {
    persistCustomProjectTypes(
      customProjectTypes.filter((item) => item.name !== name),
    );
    if (selectedCustom?.name === name) setSelectedCustom(null);
  };

  const selectCustomType = (name: string) => {
    const custom = customProjectTypes.find((item) => item.name === name);
    if (!custom) return;
    setSelectedCustom(custom);
    setCategoryId(custom.type);
    setCategorySelectedManually(true);
    if (!description.trim()) {
      setDescription(`${custom.name}: ${custom.features.join(", ")}`);
    }
  };

  // Ask the AI to read the description the same way the chat does. Returns null
  // when AI is unavailable, so the caller falls back to the local detector.
  const parseProjectWithAI = async (text: string) => {
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });
      if (!r.ok) return null;
      const d = (await r.json()) as {
        project?: {
          title?: string;
          description?: string;
          category?: string;
          customCategoryName?: string;
          complexity?: string;
          quality?: string;
          country?: string;
        };
      };
      return d.project ?? null;
    } catch {
      return null;
    }
  };

  // "Analyze my project": understand the idea (AI when possible), research any
  // custom category / country exactly like the chat, then move to the questions.
  const beginEstimate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (description.trim().length < 12) return;

<<<<<<< HEAD:app/page.tsx
    const categoryIsManual = categorySelectedManually || Boolean(selectedCustom);
    const locationIsManual = locationSelectedManually;
    const willUseAI = !categoryIsManual || !locationIsManual;

    let nextCategoryId = categoryId;
    let nextCustomCategory: CustomCategory | null = customCategory;
    let nextLocationId = locationId;
    let nextCustomLocation: CustomLocation | null = customLocation;
    let nextSizeId = sizeId;
    let nextQualityId = qualityId;

    if (willUseAI) setIsAnalyzing(true);
    try {
      const parsed = willUseAI ? await parseProjectWithAI(description) : null;

      // ---- category (built-in, or built by AI) ----
      if (!categoryIsManual) {
        const aiCat = parsed?.category;
        const customName = parsed?.customCategoryName;
        const isBuiltIn = Boolean(aiCat && categories.some((c) => c.id === aiCat));
        if (customName && !isBuiltIn) {
          // Not one of the 8 built-ins (e.g. a tyre shop) -> build it with AI.
          nextCustomCategory = await researchCategory(customName, description);
        } else if (isBuiltIn) {
          nextCategoryId = aiCat as CategoryId;
          nextCustomCategory = null;
        } else {
          nextCategoryId = detectCategory(description);
          nextCustomCategory = null;
        }
      }

      // ---- location (built-in, or researched country/city) ----
      if (!locationIsManual) {
        const aiCountry = parsed?.country;
        const supported = locations.map((l) => ({ id: l.id, country: l.country }));
        if (aiCountry) {
          const matched = matchSupportedCountry(aiCountry, supported);
          if (matched) {
            nextLocationId = matched as LocationId;
            nextCustomLocation = null;
          } else {
            const loc = await researchLocation(aiCountry);
            if (loc) {
              nextCustomLocation = loc;
            } else {
              nextLocationId = detectLocation(description);
              nextCustomLocation = null;
            }
          }
        } else {
          nextLocationId = detectLocation(description);
          nextCustomLocation = null;
        }
      }

      // ---- size / quality guessed by the AI (user can still change them) ----
      if (parsed?.complexity && ["small", "medium", "large"].includes(parsed.complexity)) {
        nextSizeId = parsed.complexity as ProjectSizeId;
      }
      if (parsed?.quality && qualityOptions.some((q) => q.id === parsed.quality)) {
        nextQualityId = parsed.quality as QualityId;
      }

      setCategoryId(nextCategoryId);
      setCustomCategory(nextCustomCategory);
      setLocationId(nextLocationId);
      setCustomLocation(nextCustomLocation);
      setCityName("");
      setSizeId(nextSizeId);
      setQualityId(nextQualityId);
      setQuestionStep(0);
      setStage("questions");
      setLoadedDraftId(null);
      window.setTimeout(() => scrollToSection("estimator"), 30);
    } finally {
      if (willUseAI) setIsAnalyzing(false);
    }
=======
    const detectedCategory = selectedCustom
      ? categoryId
      : (analyzeProject(description).categoryId as CategoryId);
    const selectedLocationId = locationSelectedManually
      ? locationId
      : detectLocation(description);
    setCategoryId(detectedCategory);
    setLocationId(selectedLocationId);
    setQuestionStep(0);
    setStage("questions");
    setLoadedDraftId(null);
    window.setTimeout(() => scrollToSection("estimator"), 30);
>>>>>>> origin/main:cost-calc/app/page.tsx
  };

  // Manual "Other type — AI research" from the estimator's category dropdown.
  const handleResearchCategory = async (name: string): Promise<boolean> => {
    const clean = name.trim();
    if (!clean) return false;
    try {
      const cat = await researchCategory(clean, description);
      setCustomCategory(cat);
      setSelectedCustom(null);
      setCategorySelectedManually(true);
      notify(`${cat.name} researched`);
      return true;
    } catch {
      return false;
    }
  };

  // Manual "Other country — AI research" from the estimator's location dropdown.
  const handleResearchLocation = async (country: string, city: string): Promise<boolean> => {
    const clean = country.trim();
    if (!clean) return false;
    try {
      const supported = locations.map((l) => ({ id: l.id, country: l.country }));
      const matched = matchSupportedCountry(clean, supported);
      if (matched) {
        setLocationId(matched as LocationId);
        setCustomLocation(null);
        setCityName(city.trim());
        setLocationSelectedManually(true);
        setCurrencyOverride(null);
        notify(`${clean} selected`);
        return true;
      }
      const loc = await researchLocation(clean, city);
      if (!loc) return false;
      setCustomLocation(loc);
      setCityName("");
      setLocationSelectedManually(true);
      setCurrencyOverride(null);
      notify(`${loc.country} researched`);
      return true;
    } catch {
      return false;
    }
  };

  // Generate the estimate from the CURRENT committed state. Wrapped in
  // useCallback so both the estimator's "Continue" and the chatbot's
  // "Yes, estimate it" run it with the freshest values.
  const generateEstimate = useCallback(() => {
    setIsGenerating(true);

    window.setTimeout(() => {
      // Use the AI analysis (if it arrived in time) as the analysis input;
      // ALL prices, breakdown, scope, assumptions, timeline, taxes and
      // currency conversion are still computed by the static USD config.
      const aiAnalysis = getCachedAiAnalysis(description);
      const result = calculateEstimate(
        description,
        categoryId,
        locationId,
        sizeId,
        qualityId,
        currencyOverride,
<<<<<<< HEAD:app/page.tsx
        {
          location: customLocation ?? undefined,
          category: customCategory ?? undefined,
          city: cityName || undefined,
        },
=======
        aiAnalysis,
>>>>>>> origin/main:cost-calc/app/page.tsx
      );
      if (titleOverride) {
        result.projectTitle = titleOverride;
        setTitleOverride(null);
      }
      setEstimate(result);
      setStage("complete");
      setQuestionStep(1);
      setLoadedDraftId(null);
      setIsGenerating(false);

      // Nayi estimate generate hote hi auto-save draft mein
      const draftEntry: HistoryEntry = {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "draft",
        title: result.projectTitle,
        savedAt: new Date().toISOString(),
        data: result,
      };
      const updated = [draftEntry, ...history].slice(0, 50);
      setHistory(updated);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

      window.setTimeout(() => scrollToSection("estimate-result"), 80);
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, categoryId, locationId, cityName, sizeId, qualityId, currencyOverride, customLocation, customCategory, titleOverride, history]);

  // Estimator "Continue": step 0 asks the second question, step 1 runs.
  const continueQuestions = useCallback(() => {
    if (questionStep === 0) {
      setQuestionStep(1);
      return;
    }
    generateEstimate();
  }, [questionStep, generateEstimate]);

  // Chatbot "Yes, estimate it" → run on the NEXT render so the state set by
  // onApplyProject/onApplyCountry (description, category, country, size/quality)
  // is already committed and generateEstimate reads the fresh values. The chat
  // already collected the answers, so it runs directly (no question step gate).
  useEffect(() => {
    if (!pendingRun) return;
    setPendingRun(false);
    generateEstimate();
  }, [pendingRun, generateEstimate]);

  const resetEstimate = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setDescription("");
    setSelectedCustom(null);
    setTitleOverride(null);
    setCategoryManual(false);
    setAutoCategory(null);
    setCategoryId("web");
    setLocationId("us");
    setCityName("");
    setLocationSelectedManually(false);
    setCategorySelectedManually(false);
    setCustomLocation(null);
    setCustomCategory(null);
    setSizeId("medium");
    setQualityId("standard");
    setQuestionStep(0);
    setStage("describe");
    setEstimate(null);
    setLoadedDraftId(null);
    setShareOpen(false);
    window.setTimeout(() => scrollToSection("estimator"), 50);
  };

  const chooseCategory = (id: CategoryId) => {
    const category = categories.find((item) => item.id === id) ?? categories[0];
    setCategoryId(id);
    setSelectedCustom(null);
<<<<<<< HEAD:app/page.tsx
    setCustomCategory(null);
    setCategorySelectedManually(true);
=======
    setCategoryManual(true);
    setAutoCategory(null);
>>>>>>> origin/main:cost-calc/app/page.tsx
    setStage("describe");
    setLoadedDraftId(null);
    if (!description.trim()) setDescription(category.example);
    window.setTimeout(() => scrollToSection("estimator"), 30);
  };

  const openQuotation = () => {
    if (!estimate) return;
    setQuoteItems(estimate.items.map((item) => ({ ...item })));
    setLoadedDraftId(null);
    setQuoteOpen(true);
  };

  // Builds the link that rebuilds this estimate when someone opens it.
  const buildShareUrl = () => {
    const payload: SharedEstimate = {
      description,
      categoryId,
      locationId,
      sizeId,
      qualityId,
    };
    const url = new URL(window.location.href);
    url.hash = `estimate=${encodeURIComponent(JSON.stringify(payload))}`;
    return url.toString();
  };

  // The Share button now opens the share popup instead of only copying the link.
  const shareEstimate = () => {
    if (!estimate) return;
    setShareOpen(true);
  };

  const saveEstimate = () => {
    if (!estimate) return;
    const entry: HistoryEntry = {
      id: `est-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "estimate",
      title: estimate.projectTitle,
      savedAt: new Date().toISOString(),
      data: estimate,
    };
    // Estimate save karne par matching draft hat jaye
    const updated = [
      entry,
      ...history.filter(
        (e) => !(e.type === "draft" && e.title === estimate.projectTitle),
      ),
    ].slice(0, 50);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    notify("Estimate saved on this device");
  };

  const saveDraft = (businessName?: string, customerName?: string) => {
    if (!estimate) return;

    // Agar yeh draft history se load hua tha, toh save karte waqt
    // estimate ban jaye aur purana draft history se hat jaye
    if (loadedDraftId) {
      const estimateEntry: HistoryEntry = {
        id: `est-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "estimate",
        title: estimate.projectTitle,
        savedAt: new Date().toISOString(),
        data: {
          ...estimate,
          items: quoteItems,
        },
      };
      const updated = [
        estimateEntry,
        ...history.filter((e) => e.id !== loadedDraftId),
      ].slice(0, 50);
      setHistory(updated);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      setLoadedDraftId(null);
      notify("Draft converted to estimate and saved");
      return;
    }

    const entry: HistoryEntry = {
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "draft",
      title: estimate.projectTitle,
      savedAt: new Date().toISOString(),
      data: {
        items: quoteItems,
        businessName: businessName ?? "",
        customerName: customerName ?? "",
      },
    };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setLoadedDraftId(null);
    notify("Draft saved on this device");
  };

  // Older saved estimates may predate the analyzer-driven fields.
  // Re-run them through the current calculator so they never override
  // the new result format.
  const refreshEstimate = (est: EstimateResult): EstimateResult => {
    if (Array.isArray(est.scope) && Array.isArray(est.assumptions)) {
      return est;
    }
    return calculateEstimate(
      est.description,
      est.category?.id ?? "web",
      est.location?.id ?? "us",
      est.size?.id ?? "medium",
      est.quality?.id ?? "standard",
    );
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    if (entry.type === "estimate") {
      const est = refreshEstimate(entry.data as EstimateResult);
      setDescription(est.description);
      setCategoryId(est.category.id);
      setSelectedCustom(null);
      setLocationId(est.location.id);
      setCityName(est.location.city);
      setSizeId(est.size.id);
      setQualityId(est.quality.id);
      setEstimate(est);
      setStage("complete");
      setLoadedDraftId(null);
      window.setTimeout(() => scrollToSection("estimate-result"), 80);
    } else {
      const draftData = entry.data;
      // Auto-saved draft mein full EstimateResult hota hai
      if ("projectTitle" in draftData) {
        const est = refreshEstimate(draftData as EstimateResult);
        setDescription(est.description);
        setCategoryId(est.category.id);
        setLocationId(est.location.id);
        setCityName(est.location.city);
        setSizeId(est.size.id);
        setQualityId(est.quality.id);
        setEstimate(est);
        setStage("complete");
        setQuoteItems(est.items);
        setLoadedDraftId(entry.id);
        setQuoteOpen(true);
      } else {
        const draft = draftData as { items: EstimateItem[]; businessName: string; customerName: string };
        setQuoteItems(draft.items);
        setLoadedDraftId(entry.id);
        setQuoteOpen(true);
      }
    }
  };

  const deleteHistoryEntry = (id: string) => {
    const updated = history.filter((e) => e.id !== id);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const activeStep = stage === "describe" ? 0 : stage === "questions" ? 1 : 2;
  const descriptionReady = description.trim().length >= 12;

  return (
    <main
      id="top"
      className="min-h-screen overflow-x-hidden bg-[#f8f8fb] text-[#1d1b24]"
    >
      <Header
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onEstimateClick={resetEstimate}
        history={history}
        onLoadHistory={loadHistoryEntry}
        onDeleteHistory={deleteHistoryEntry}
        onClearHistory={clearHistory}
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
<<<<<<< HEAD:app/page.tsx
        onCategoryChange={(id) => {
          setCategoryId(id);
          setSelectedCustom(null);
          setCustomCategory(null);
          setCategorySelectedManually(true);
=======
        autoCategoryHint={categoryManual ? null : autoCategory}
        customDescription={customDescription}
        onCategoryChange={(id) => {
          setCategoryId(id);
          setSelectedCustom(null);
          setCategoryManual(true);
          setAutoCategory(null);
>>>>>>> origin/main:cost-calc/app/page.tsx
        }}
        customProjectTypes={customProjectTypes}
        selectedCustom={selectedCustom}
        onSelectCustomType={selectCustomType}
        onRemoveCustomType={removeCustomProjectType}
        onResearchCategory={handleResearchCategory}
        onResearchLocation={handleResearchLocation}
        onLocationChange={(id) => {
          setLocationId(id);
          setCityName("");
          setLocationSelectedManually(true);
          setCurrencyOverride(null);
        }}
        cityName={cityName}
        onCityChange={(name) => {
          setCityName(name);
          setLocationSelectedManually(true);
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
        isGenerating={isGenerating}
        customLocation={customLocation}
        customCategory={customCategory}
        onCategoryChangeCustom={() => setCustomCategory(null)}
        onLocationChangeCustom={() => setCustomLocation(null)}
        onViewEstimate={() => scrollToSection("estimate-result")}
        onNewEstimate={resetEstimate}
      />

      {estimate && (
        <EstimateResultSection
          estimate={estimate}
          onSave={saveEstimate}
          onShare={shareEstimate}
          onOpenQuotation={openQuotation}
          onNewEstimate={resetEstimate}
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
          onClose={() => {
            setQuoteOpen(false);
            setLoadedDraftId(null);
          }}
          notify={notify}
          onSaveDraft={saveDraft}
          isEditingDraft={loadedDraftId !== null}
        />
      )}

      {shareOpen && estimate && (
        <ShareModal
          estimate={estimate}
          shareUrl={buildShareUrl()}
          onClose={() => setShareOpen(false)}
          notify={notify}
          onDownloadPdf={openQuotation}
        />
      )}
      <Toast message={toast} />
      <Toast message={errorToast} error />

      <GeneratingOverlay showing={isGenerating || isAnalyzing} />

      <ChatBot
        supportedCountries={locations.map((l) => ({
          id: l.id,
          country: l.country,
          cities: l.cities.map((c) => c.name),
        }))}
        onApplyProject={(p) => {
          setDescription(p.description.slice(0, 500));
          setSizeId(p.complexity);
          if (p.qualityId) setQualityId(p.qualityId);
          setCustomCategory(p.customCategory ?? null);
          if (p.categoryId !== "auto" && !p.customCategory) {
            setCategoryId(p.categoryId as CategoryId);
          }
          setCategorySelectedManually(true);
        }}
        onApplyCountry={(c) => {
          if (c.locationId) {
            setLocationId(c.locationId as LocationId);
            setCustomLocation(null);
            setCityName(c.city ?? "");
            setLocationSelectedManually(true);
            setCurrencyOverride(null);
          } else if (c.custom) {
            setCustomLocation(c.custom);
            setCityName("");
            setLocationSelectedManually(true);
          }
        }}
        onRunEstimate={() => setPendingRun(true)}
        estimateSummary={
          estimate
            ? `${estimate.projectTitle}, ${estimate.category.name}, ${estimate.location.city}, ${estimate.location.country}, total ${formatCurrency(estimate.total, estimate.location)}, range ${formatCurrency(estimate.low, estimate.location)} to ${formatCurrency(estimate.high, estimate.location)}, ${estimate.durationMin}-${estimate.durationMax} weeks. Line items: ${estimate.items.slice(0, 5).map((i) => `${i.name} ${formatCurrency(i.quantity * i.rate, estimate.location)}`).join(", ")}`
            : undefined
        }
      />
    </main>
  );
}