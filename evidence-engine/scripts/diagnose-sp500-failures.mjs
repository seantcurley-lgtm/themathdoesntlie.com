import fs from "node:fs/promises";
import tickerDirectory from "../public/sec/company-tickers.json" with { type: "json" };
import { evaluateInputs } from "../lib/evidence-engine.mjs";
import { buildAcquisitionPackage, resolveTicker, selectLatestAnnualFiling } from "../lib/sec-xbrl.mjs";

const tickers = ["CLX"];
const headers = { Accept: "application/json", "User-Agent": "TMDL Evidence Engine failure diagnosis/6.1" };
async function get(url, accept = "application/json") {
  const response = await fetch(url, { headers: { ...headers, Accept: accept }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return accept === "application/json" ? response.json() : response.text();
}
async function diagnose(ticker) {
  const row = { ticker };
  let tickerRecord;
  try { tickerRecord = resolveTicker(tickerDirectory, ticker); }
  catch (error) { return { ...row, stage: "TickerDirectory", error: error.message }; }
  row.cik = tickerRecord.cik;
  try {
    const [submissions, companyFacts] = await Promise.all([
      get(`https://data.sec.gov/submissions/CIK${tickerRecord.cik}.json`),
      get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${tickerRecord.cik}.json`),
    ]);
    row.entityName = companyFacts.entityName ?? submissions.name;
    row.sic = String(submissions.sic ?? "");
    row.annualForms = (submissions.filings?.recent?.form ?? []).map((form, index) => ({
      form, filingDate: submissions.filings.recent.filingDate?.[index], reportDate: submissions.filings.recent.reportDate?.[index], accessionNumber: submissions.filings.recent.accessionNumber?.[index],
    })).filter((item) => /10-K/.test(item.form)).slice(0, 8);
    let filing;
    try { filing = selectLatestAnnualFiling(submissions, tickerRecord.cik); }
    catch (error) { return { ...row, stage: "FilingSelection", error: error.message }; }
    row.filing = filing;
    let html = null, inlineFilingError = null;
    try { html = await get(filing.filingUrl, "text/html"); } catch (error) { inlineFilingError = error.message; }
    const acquisition = buildAcquisitionPackage({ tickerRecord, submissions, companyFacts, inlineFilingHtml: html, inlineFilingError });
    row.acquisitionSummary = acquisition.summary;
    row.periodStart = acquisition.inputs.periodStart;
    row.periodEnd = acquisition.inputs.periodEnd;
    try {
      const evaluation = await evaluateInputs({ ...acquisition.inputs, sharePrice: 1, marketObservationDate: acquisition.inputs.periodEnd, marketUrl: "https://example.invalid/verification-only-neutral-market-input" });
      return { ...row, stage: "Completed", status: evaluation.scoring.status, coveragePercent: evaluation.scoring.coveragePercent };
    } catch (error) {
      const fields = Object.keys(error.fieldErrors ?? {});
      return { ...row, stage: "InputValidation", error: error.message, fieldErrors: error.fieldErrors ?? null,
        inputValues: Object.fromEntries(fields.map((field) => [field, acquisition.inputs[field]])),
        evidence: Object.fromEntries(fields.map((field) => [field, acquisition.inputs.inputEvidence?.[field] ?? null])) };
    }
  } catch (error) { return { ...row, stage: "Acquisition", error: error.message }; }
}
const results = [];
for (const ticker of tickers) { const result = await diagnose(ticker); results.push(result); console.log(ticker, result.stage, JSON.stringify(result.fieldErrors ?? result.error ?? result.status)); }
await fs.mkdir("verification-output", { recursive: true });
await fs.writeFile("verification-output/sp500-technical-failure-diagnostics.json", JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
