// tavily.ts — Tavily API integration for WCAG 2.2 research and accessibility guidelines.
// Used to ground Super (analysis) and Ultra (fixer) in authoritative W3C WCAG documentation.

export interface TavilyResult {
  query: string;
  url: string;
  title: string;
  content: string;
  latencyMs: number;
}

export async function searchWcag(wcagId: string, barrierName: string): Promise<TavilyResult | null> {
  const apiKey = process.env["TAVILY_API_KEY"];
  if (!apiKey) {
    return null;
  }

  const query = `WCAG 2.2 criterion ${wcagId} ${barrierName} understanding failure techniques`;
  const start = Date.now();

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 1,
        search_depth: "basic",
        include_domains: ["w3.org", "w3c.github.io", "webaim.org", "getstark.co"],
      }),
    });

    const latencyMs = Date.now() - start;
    if (!response.ok) return null;

    const data = (await response.json()) as {
      results?: Array<{ url: string; title: string; content: string }>;
    };

    const first = data.results?.[0];
    if (!first) return null;

    return {
      query,
      url: first.url,
      title: first.title,
      content: first.content,
      latencyMs,
    };
  } catch {
    return null;
  }
}
