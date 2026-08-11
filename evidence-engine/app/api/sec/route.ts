import tickerDirectory from "@/public/sec/company-tickers.json";
import {
  buildAcquisitionPackage,
  resolveTicker,
  selectLatestAnnualFiling,
  validateTicker,
} from "@/lib/sec-xbrl.mjs";

const SEC_USER_AGENT =
  "TMDL Evidence Engine Workbench/6.1 evidence-engine-workbench.solar-maple-1068.chatgpt.site";

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

async function fetchSecJson(url: string, label: string, maxAgeMs: number) {
  const cached = memoryCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": SEC_USER_AGENT,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }
  const value = await response.json();
  memoryCache.set(url, { expiresAt: Date.now() + maxAgeMs, value });
  return value;
}

async function fetchSecText(url: string, label: string, maxAgeMs: number) {
  const cached = memoryCache.get(url);
  if (cached && cached.expiresAt > Date.now() && typeof cached.value === "string") {
    return cached.value;
  }

  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": SEC_USER_AGENT,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 12_000_000) {
    throw new Error(`${label} exceeded the 12 MB governed-processing limit.`);
  }
  const value = await response.text();
  if (value.length > 12_000_000) {
    throw new Error(`${label} exceeded the 12 MB governed-processing limit.`);
  }
  memoryCache.set(url, { expiresAt: Date.now() + maxAgeMs, value });
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  let ticker: string;
  try {
    ticker = validateTicker(requestUrl.searchParams.get("ticker"));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Enter a valid ticker symbol." },
      { status: 400 },
    );
  }

  try {
    const tickerRecord = resolveTicker(tickerDirectory, ticker);
    const submissionsUrl = `https://data.sec.gov/submissions/CIK${tickerRecord.cik}.json`;
    const companyFactsUrl =
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${tickerRecord.cik}.json`;
    const [submissions, companyFacts] = await Promise.all([
      fetchSecJson(submissionsUrl, "SEC submission history", 15 * 60 * 1000),
      fetchSecJson(companyFactsUrl, "SEC Company Facts", 15 * 60 * 1000),
    ]);
    const filing = selectLatestAnnualFiling(submissions, tickerRecord.cik);
    let inlineFilingHtml: string | null = null;
    let inlineFilingError: string | null = null;
    try {
      inlineFilingHtml = await fetchSecText(
        filing.filingUrl,
        "Official Inline XBRL filing",
        15 * 60 * 1000,
      );
    } catch (filingError) {
      inlineFilingError = filingError instanceof Error
        ? filingError.message
        : "Official Inline XBRL filing collection failed.";
    }
    const acquisition = buildAcquisitionPackage({
      tickerRecord,
      submissions,
      companyFacts,
      inlineFilingHtml,
      inlineFilingError,
    });
    acquisition.transport = {
      mode: "hybrid-same-origin-sec-data",
      submissionsUrl,
      companyFactsUrl,
      filingUrl: filing.filingUrl,
      filingFallback: inlineFilingError ? "collection-failure" : "acquired",
    };
    acquisition.inputs.acquisition = {
      ...acquisition.inputs.acquisition,
      transport: "hybrid-same-origin-sec-data",
    };
    return Response.json(acquisition, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEC evidence acquisition failed.";
    const status = /No SEC company record|No supported 10-K/.test(message) ? 404 : 502;
    return Response.json(
      {
        error: message,
        guidance:
          status === 404
            ? "Confirm the ticker and that the company has a current Form 10-K."
            : "The SEC issuer-data service may be temporarily unavailable. Wait briefly and try again.",
      },
      { status },
    );
  }
}
