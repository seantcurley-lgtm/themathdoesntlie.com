import fs from "node:fs/promises";
import XLSX from "xlsx";
import tickerDirectory from "../public/sec/company-tickers.json" with { type: "json" };
import { evaluateInputs } from "../lib/evidence-engine.mjs";
import { buildAcquisitionPackage, resolveTicker, selectLatestAnnualFiling } from "../lib/sec-xbrl.mjs";

const sourceWorkbook = process.argv[2];
if (!sourceWorkbook) throw new Error("Pass the Release 6.1 verification workbook path.");

const workbook = XLSX.readFile(sourceWorkbook, { cellDates: true });
const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets.Ranking, { header: 1, defval: null });
const headerIndex = rawRows.findIndex((row) => row[0] === "Rank" && row[1] === "Ticker");
if (headerIndex < 0) throw new Error("Ranking header was not found.");
const headers = rawRows[headerIndex];
const priorRows = rawRows.slice(headerIndex + 1)
  .filter((row) => row[1])
  .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));

const requestHeaders = {
  Accept: "application/json",
  "User-Agent": "TMDL Evidence Engine S&P 500 verification/6.2 maeveo123@gmail.com",
};

let nextRequestAt = 0;
let requestChain = Promise.resolve();
async function throttle() {
  const run = requestChain.then(async () => {
    const wait = Math.max(0, nextRequestAt - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    nextRequestAt = Date.now() + 140;
  });
  requestChain = run.catch(() => {});
  return run;
}

async function get(url, accept = "application/json") {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await throttle();
    try {
      const response = await fetch(url, {
        headers: { ...requestHeaders, Accept: accept },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
      return accept === "application/json" ? response.json() : response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

async function runOne(prior) {
  const started = Date.now();
  const ticker = String(prior.Ticker).trim().toUpperCase();
  const base = {
    ticker,
    company: prior.Company,
    sector: prior.Sector,
    subIndustry: prior["Sub-industry"],
  };
  try {
    const tickerRecord = resolveTicker(tickerDirectory, ticker);
    const [submissions, companyFacts] = await Promise.all([
      get(`https://data.sec.gov/submissions/CIK${tickerRecord.cik}.json`),
      get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${tickerRecord.cik}.json`),
    ]);
    const filing = selectLatestAnnualFiling(submissions, tickerRecord.cik);
    let inlineFilingHtml = null;
    let inlineFilingError = null;
    try {
      inlineFilingHtml = await get(filing.filingUrl, "text/html");
    } catch (error) {
      inlineFilingError = error.message;
    }
    const acquisition = buildAcquisitionPackage({
      tickerRecord,
      submissions,
      companyFacts,
      inlineFilingHtml,
      inlineFilingError,
    });
    const evaluation = await evaluateInputs({
      ...acquisition.inputs,
      sharePrice: 1,
      marketObservationDate: acquisition.inputs.periodEnd,
      marketUrl: "https://example.invalid/verification-only-neutral-market-input",
    });
    const status = evaluation.scoring.status;
    return {
      ...base,
      result: status === "Scored" ? "Score" : "No score",
      reason: status,
      coveragePercent: evaluation.scoring.coveragePercent,
      metrics: evaluation.metrics.length,
      sic: evaluation.scoring.classification.sic,
      sicDescription: evaluation.scoring.classification.sicDescription,
      filingPeriodEnd: acquisition.inputs.periodEnd,
      filingPeriodStart: acquisition.inputs.periodStart,
      inlineFiling: inlineFilingError ? "Collection warning" : "Acquired",
      elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
      technicalDetail: inlineFilingError,
    };
  } catch (error) {
    return {
      ...base,
      result: "No score",
      reason: "TechnicalFailure",
      coveragePercent: null,
      metrics: null,
      sic: null,
      sicDescription: null,
      filingPeriodEnd: null,
      filingPeriodStart: null,
      inlineFiling: null,
      elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
      technicalDetail: error.message,
    };
  }
}

const queue = [...priorRows];
const results = [];
async function worker() {
  while (queue.length) {
    const prior = queue.shift();
    const result = await runOne(prior);
    results.push(result);
    console.log(`${results.length}/${priorRows.length} ${result.ticker} ${result.result} ${result.reason} ${result.coveragePercent ?? "-"}`);
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));
const reasonOrder = { Scored: 0, InsufficientCoverage: 1, NotApplicable: 2, Unclassified: 3, TechnicalFailure: 4 };
results.sort((left, right) =>
  (reasonOrder[left.reason] ?? 9) - (reasonOrder[right.reason] ?? 9)
  || (right.coveragePercent ?? -1) - (left.coveragePercent ?? -1)
  || left.ticker.localeCompare(right.ticker));

const summary = results.reduce((acc, row) => {
  acc[row.reason] = (acc[row.reason] ?? 0) + 1;
  return acc;
}, {});
await fs.mkdir("verification-output", { recursive: true });
await fs.writeFile("verification-output/sp500-release-6.2-census.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  release: "6.2.0",
  methodology: "Scoreability test with neutral $1 market input; numeric scores are intentionally not reported.",
  constituentSecurities: results.length,
  summary,
  results,
}, null, 2));
console.log("SUMMARY", JSON.stringify(summary));
