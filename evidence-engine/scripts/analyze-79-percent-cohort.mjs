import fs from "node:fs/promises";
import tickerDirectory from "../public/sec/company-tickers.json" with { type: "json" };
import { evaluateInputs } from "../lib/evidence-engine.mjs";
import { buildAcquisitionPackage, resolveTicker, selectLatestAnnualFiling } from "../lib/sec-xbrl.mjs";

const tickers = ["AOS", "BIIB", "CTVA", "EL", "INCY", "JNJ", "KLAC", "PPG", "TAP", "UPS", "XYZ"];
const headers = { Accept: "application/json", "User-Agent": "TMDL Evidence Engine 79-percent cohort analysis/6.2 maeveo123@gmail.com" };

async function get(url, accept = "application/json") {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { ...headers, Accept: accept }, signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
      return accept === "application/json" ? response.json() : response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

async function analyze(ticker) {
  const tickerRecord = resolveTicker(tickerDirectory, ticker);
  const [submissions, companyFacts] = await Promise.all([
    get(`https://data.sec.gov/submissions/CIK${tickerRecord.cik}.json`),
    get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${tickerRecord.cik}.json`),
  ]);
  const filing = selectLatestAnnualFiling(submissions, tickerRecord.cik);
  let html = null;
  let inlineFilingError = null;
  try { html = await get(filing.filingUrl, "text/html"); } catch (error) { inlineFilingError = error.message; }
  const acquisition = buildAcquisitionPackage({ tickerRecord, submissions, companyFacts, inlineFilingHtml: html, inlineFilingError });
  const evaluation = await evaluateInputs({ ...acquisition.inputs, sharePrice: 1, marketObservationDate: acquisition.inputs.periodEnd, marketUrl: "https://example.invalid/verification-only-neutral-market-input" });
  const unavailableRules = evaluation.scoring.rules.filter((rule) => rule.status === "Unavailable");
  const unavailableMetrics = new Map(evaluation.unavailableMetrics.map((metric) => [metric.id, metric]));
  const inputKeys = [...new Set(unavailableRules.flatMap((rule) => unavailableMetrics.get(rule.metricId)?.missingInputs ?? []))];
  return {
    ticker,
    entityName: companyFacts.entityName ?? submissions.name,
    filing,
    coveragePercent: evaluation.scoring.coveragePercent,
    missingWeight: (100 - Number(evaluation.scoring.coveragePercent)).toFixed(2),
    unavailableRules: unavailableRules.map((rule) => ({
      metricId: rule.metricId,
      family: rule.family,
      ruleName: rule.name,
      weight: rule.weight,
      rationale: rule.rationale,
      unavailableMetric: unavailableMetrics.get(rule.metricId) ?? null,
    })),
    governedInputs: Object.fromEntries(inputKeys.map((key) => [key, {
      value: acquisition.inputs[key] ?? null,
      evidence: acquisition.inputs.inputEvidence?.[key] ?? null,
    }])),
    acquisitionSummary: acquisition.summary,
    inlineFilingError,
  };
}

const results = [];
for (const ticker of tickers) {
  const result = await analyze(ticker);
  results.push(result);
  console.log(ticker, result.unavailableRules.map((rule) => `${rule.metricId}:${rule.weight}`).join(", "));
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await fs.mkdir("verification-output", { recursive: true });
await fs.writeFile("verification-output/sp500-release-6.2-79-percent-analysis.json", JSON.stringify({ generatedAt: new Date().toISOString(), engineRelease: "6.2.0", tickers, results }, null, 2));
