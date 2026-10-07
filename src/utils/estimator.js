// =====================================================================
// PRICE CONFIG — ALL VALUES IN USD (placeholder values, edit freely)
// =====================================================================
// PROJECT TYPES: keywords -> match words, basePrice (USD), baseWeeks
const PROJECT_TYPES = [
  { key: "ecommerce", label: "E-commerce", keywords: ["ecommerce", "e-commerce", "online store", "shop", "store", "shopping"], basePrice: 4500, baseWeeks: 6 },
  { key: "business", label: "Business Website", keywords: ["business", "company", "corporate", "business website"], basePrice: 1800, baseWeeks: 3 },
  { key: "portfolio", label: "Portfolio", keywords: ["portfolio", "showcase", "personal site", "resume"], basePrice: 1200, baseWeeks: 2 },
  { key: "landing", label: "Landing Page", keywords: ["landing", "landing page", "one page", "single page", "promo"], basePrice: 900, baseWeeks: 1 },
  { key: "booking", label: "Booking / Hotel", keywords: ["booking", "hotel", "reservation", "appointment", "travel"], basePrice: 3800, baseWeeks: 5 },
  { key: "webapp", label: "Web App / SaaS", keywords: ["web app", "saas", "software", "platform", "web application"], basePrice: 8000, baseWeeks: 10 },
  { key: "mobile", label: "Mobile App", keywords: ["mobile app", "android", "ios", "app", "application mobile"], basePrice: 9000, baseWeeks: 12 },
  { key: "dashboard", label: "Dashboard", keywords: ["dashboard", "admin panel", "analytics", "backoffice", "admin"], basePrice: 3500, baseWeeks: 5 },
  { key: "blog", label: "Blog", keywords: ["blog", "news", "magazine", "articles", "publication"], basePrice: 1000, baseWeeks: 2 },
  { key: "other", label: "Other", keywords: [], basePrice: 2000, baseWeeks: 3 },
];

// FEATURES: keywords -> match words, extraPrice (USD), extraWeeks
const FEATURES = [
  { key: "payment", label: "Payment", keywords: ["payment", "payments", "checkout", "stripe", "paypal", "billing"], extraPrice: 1500, extraWeeks: 2 },
  { key: "admin", label: "Admin Dashboard", keywords: ["admin dashboard", "admin panel", "backoffice", "cms", "admin area"], extraPrice: 2200, extraWeeks: 3 },
  { key: "login", label: "Login / Auth", keywords: ["login", "log in", "signup", "sign up", "auth", "authentication", "user accounts"], extraPrice: 900, extraWeeks: 1 },
  { key: "multilang", label: "Multi-language", keywords: ["multi language", "multilingual", "multi-language", "translations", "i18n", "languages"], extraPrice: 1100, extraWeeks: 2 },
  { key: "inventory", label: "Inventory", keywords: ["inventory", "stock", "product management", "warehouse"], extraPrice: 1600, extraWeeks: 2 },
  { key: "blog", label: "Blog", keywords: ["blog", "articles", "news", "posts"], extraPrice: 700, extraWeeks: 1 },
  { key: "chat", label: "Live Chat", keywords: ["live chat", "chat", "chatbot", "messaging", "support chat"], extraPrice: 600, extraWeeks: 1 },
  { key: "seo", label: "SEO", keywords: ["seo", "search engine", "optimization", "ranking"], extraPrice: 500, extraWeeks: 1 },
  { key: "mobileapp", label: "Mobile App", keywords: ["mobile app", "ios", "android", "native app"], extraPrice: 5000, extraWeeks: 6 },
  { key: "design", label: "Custom Design", keywords: ["custom design", "custom ui", "bespoke design", "ux design", "ui design"], extraPrice: 1300, extraWeeks: 2 },
  { key: "api", label: "API Integration", keywords: ["api", "integration", "api integration", "third party", "webhook", "endpoint"], extraPrice: 1400, extraWeeks: 2 },
];
// =====================================================================

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Small edit-distance so typos like "ecomerce" or "langauge" still match.
function distance(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function keywordMatches(text, keywords) {
  const words = text.split(" ");
  for (const kw of keywords) {
    const kwNorm = normalize(kw);
    if (!kwNorm) continue;
    if (text.includes(kwNorm)) return true;
    // word-level fuzzy match for typos/case
    const kwWords = kwNorm.split(" ");
    if (kwWords.length === 1) {
      for (const w of words) {
        const maxDist = kwNorm.length <= 4 ? 1 : 2;
        if (w.startsWith(kwNorm.slice(0, 3)) && distance(w, kwNorm) <= maxDist) return true;
      }
    }
  }
  return false;
}

function extractSubject(text) {
  const raw = String(text || "").trim();
  const m = raw.match(/\bfor\s+([a-z0-9][a-z0-9\s'-]{1,60})/i);
  if (m) {
    const subject = m[1].split(/[,.;]|\bwith\b|\band\b/i)[0].trim();
    if (subject) return subject.charAt(0).toUpperCase() + subject.slice(1);
  }
  const words = raw.split(/\s+/).filter((w) => /^[A-Z][a-zA-Z]+$/.test(w));
  if (words.length) return words.slice(0, 3).join(" ");
  return "Your Project";
}

function analyzeProject(text) {
  const norm = normalize(text);

  let type = PROJECT_TYPES.find((t) => t.key === "other");
  let typeScore = 0;
  for (const t of PROJECT_TYPES) {
    if (t.key === "other") continue;
    if (keywordMatches(norm, t.keywords)) {
      const score = t.keywords.reduce(
        (s, kw) => (norm.includes(normalize(kw)) ? s + normalize(kw).length : s),
        0
      );
      if (score > typeScore) {
        typeScore = score;
        type = t;
      }
    }
  }

  const features = FEATURES.filter((f) => keywordMatches(norm, f.keywords));

  const featurePrice = features.reduce((s, f) => s + f.extraPrice, 0);
  const featureWeeks = features.reduce((s, f) => s + f.extraWeeks, 0);
  const totalUSD = type.basePrice + featurePrice;
  const weeks = type.baseWeeks + featureWeeks;

  const minUSD = Math.round(totalUSD * 0.85);
  const maxUSD = Math.round(totalUSD * 1.2);

  const matches = (typeScore > 0 ? 1 : 0) + features.length;
  const confidence = Math.min(0.95, Math.round((0.35 + matches * 0.15) * 100) / 100);

  const subject = extractSubject(text);
  const heading = `${type.label} for ${subject}`;

  const breakdown = [
    { label: `Base: ${type.label}`, usd: type.basePrice, weeks: type.baseWeeks },
    ...features.map((f) => ({ label: f.label, usd: f.extraPrice, weeks: f.extraWeeks })),
  ];

  return {
    type: type.label,
    features: features.map((f) => f.label),
    subject,
    heading,
    totalUSD,
    minUSD,
    maxUSD,
    weeks,
    confidence,
    breakdown,
  };
}

export { PROJECT_TYPES, FEATURES, analyzeProject };
export default analyzeProject;
