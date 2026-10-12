// Lightweight web-search layer for the research route.
//
// Provider priority (first one configured wins):
//   1. Tavily   -> set TAVILY_API_KEY   (free tier, best quality)   [recommended]
//   2. Brave    -> set BRAVE_API_KEY
//   3. Bing     -> no key needed, HTML results are parsed
//   4. DuckDuckGo (fallback if Bing returns nothing)
// Set DISABLE_WEB_SCRAPE=1 to turn off the key-less HTML providers.
//
// Everything is best-effort: if search fails the research route still works
// from the model's own knowledge, so a network hiccup never breaks an estimate.

export type SearchResult = { title: string; url: string; snippet: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");

const stripTags = (s: string) =>
  decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function fetchText(url: string, ms = 8000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Bing wraps result links as /ck/a?...&u=a1<base64url-of-target>.
function bingDecode(href: string): string {
  const h = decodeEntities(href);
  const m = h.match(/[?&]u=a1([^&]+)/);
  if (h.includes("/ck/a") && m) {
    try {
      let b = m[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b.length % 4) b += "=";
      const url = Buffer.from(b, "base64").toString("utf8");
      if (/^https?:\/\//.test(url)) return url;
    } catch {
      /* fall through */
    }
  }
  return h.startsWith("//") ? `https:${h}` : h;
}

const isUsable = (url: string) =>
  /^https?:\/\//.test(url) &&
  !/^https?:\/\/(www\.)?bing\.com/i.test(url) &&
  !/^https?:\/\/www\.microsoft\.com\/…/i.test(url);

async function tavilySearch(query: string, limit: number, key: string): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query, max_results: limit, search_depth: "basic" }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results ?? [])
    .map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.content ?? "" }))
    .filter((r) => isUsable(r.url))
    .slice(0, limit);
}

async function braveSearch(query: string, limit: number, key: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`,
    { headers: { Accept: "application/json", "X-Subscription-Token": key } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
  return (data.web?.results ?? [])
    .map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.description ?? "" }))
    .filter((r) => isUsable(r.url))
    .slice(0, limit);
}

async function bingSearch(query: string, limit: number): Promise<SearchResult[]> {
  const html = await fetchText(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en&count=${limit + 3}`,
  );
  if (!html) return [];
  const out: SearchResult[] = [];
  const blocks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) ?? [];
  for (const block of blocks) {
    const a = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const url = bingDecode(a[1]);
    if (!isUsable(url)) continue;
    const p = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    out.push({ title: stripTags(a[2]), url, snippet: p ? stripTags(p[1]) : "" });
    if (out.length >= limit) break;
  }
  return out;
}

async function ddgSearch(query: string, limit: number): Promise<SearchResult[]> {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!html || !html.includes("result__a")) return [];
  const out: SearchResult[] = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    let url = decodeEntities(m[1]);
    const um = url.match(/[?&]uddg=([^&]+)/);
    if (um) url = decodeURIComponent(um[1]);
    if (isUsable(url)) out.push({ title: stripTags(m[2]), url, snippet: "" });
  }
  return out;
}

export function searchProvider(): "tavily" | "brave" | "bing" | "ddg" | "off" {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_API_KEY) return "brave";
  if (process.env.DISABLE_WEB_SCRAPE === "1") return "off";
  return "bing";
}

// Small in-process cache: research is already cached client-side, this just
// stops repeat server hits for the same query within a short window.
const cache = new Map<string, { ts: number; r: SearchResult[] }>();

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  const cacheKey = `${limit}:${query.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < 10 * 60_000) return hit.r;

  const provider = searchProvider();
  let results: SearchResult[] = [];
  try {
    if (provider === "tavily") results = await tavilySearch(query, limit, process.env.TAVILY_API_KEY as string);
    else if (provider === "brave") results = await braveSearch(query, limit, process.env.BRAVE_API_KEY as string);
    else if (provider === "bing") {
      results = await bingSearch(query, limit);
      if (!results.length) results = await ddgSearch(query, limit);
    } else if (provider === "ddg") {
      results = await ddgSearch(query, limit);
    }
  } catch {
    results = [];
  }

  if (cache.size > 200) cache.clear();
  cache.set(cacheKey, { ts: Date.now(), r: results });
  return results;
}

// Best-effort readable text of a page, used to give the model more than a snippet.
export async function pageText(url: string, ms = 6000): Promise<string> {
  const html = await fetchText(url, ms);
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1600);
}
