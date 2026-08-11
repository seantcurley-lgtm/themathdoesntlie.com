/**
 * Governed exceptions for ticker/CIK continuity gaps in the SEC ticker directory.
 *
 * These records do not merge unrelated issuers. They identify either an established
 * issuer omitted from the current directory or a legal successor whose latest
 * annual filing remains under its directly linked predecessor CIK.
 */

export const ENTITY_CONTINUITY_REGISTRY_VERSION = "1.0.0";

export const entityContinuityRecords = Object.freeze({
  AEP: Object.freeze({
    ticker: "AEP",
    analysisCik: "0000004904",
    directoryCik: null,
    title: "American Electric Power Company, Inc.",
    mode: "TickerDirectoryFallback",
    effectiveDate: "2026-08-05",
    rationale: "The current SEC ticker directory omits AEP, while SEC issuer history remains available under CIK 0000004904.",
    sourceUrls: Object.freeze([
      "https://data.sec.gov/submissions/CIK0000004904.json",
      "https://www.sec.gov/files/company_tickers.json",
    ]),
  }),
  XOM: Object.freeze({
    ticker: "XOM",
    analysisCik: "0000034088",
    directoryCik: "0002115436",
    title: "ExxonMobil Holdings Corp",
    mode: "PredecessorAnnualFiling",
    effectiveDate: "2026-07-01",
    rationale: "The successor holding-company CIK has no 2025 Form 10-K; its SEC submission history links to the predecessor issuer's filings under CIK 0000034088.",
    sourceUrls: Object.freeze([
      "https://data.sec.gov/submissions/CIK0002115436.json",
      "https://data.sec.gov/submissions/CIK0000034088.json",
    ]),
  }),
});

export function continuityRecordForTicker(ticker) {
  return entityContinuityRecords[String(ticker ?? "").trim().toUpperCase()] ?? null;
}

export function entityContinuitySnapshot() {
  return {
    version: ENTITY_CONTINUITY_REGISTRY_VERSION,
    records: Object.values(entityContinuityRecords).map((record) => ({ ...record })),
  };
}
