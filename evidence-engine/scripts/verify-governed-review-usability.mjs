import fs from "node:fs/promises";
import tickerDirectory from "../public/sec/company-tickers.json" with { type: "json" };
import { evaluateInputs } from "../lib/evidence-engine.mjs";
import { applyEvidenceResolutionDecisions, REVIEW_DECISION_ACTIONS } from "../lib/evidence-resolution.mjs";
import { replayStoredEvaluation } from "../lib/evaluation-replay.mjs";
import { buildAcquisitionPackage, resolveTicker, selectLatestAnnualFiling } from "../lib/sec-xbrl.mjs";

const tickers = ["BIIB", "CTVA", "INCY", "JNJ", "KLAC", "PPG"];
const targetFields = { BIIB: "minorityInterest", CTVA: "preferredEquity", INCY: "capitalExpenditures", JNJ: "minorityInterest", KLAC: "minorityInterest", PPG: "preferredEquity" };
const headers = { Accept: "application/json", "User-Agent": "TMDL Evidence Engine governed-review usability verification/6.3 maeveo123@gmail.com" };

async function get(url, accept = "application/json") {
  const response = await fetch(url, { headers: { ...headers, Accept: accept }, signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return accept === "application/json" ? response.json() : response.text();
}

async function acquire(ticker) {
  const tickerRecord = resolveTicker(tickerDirectory, ticker);
  const [submissions, companyFacts] = await Promise.all([
    get(`https://data.sec.gov/submissions/CIK${tickerRecord.cik}.json`),
    get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${tickerRecord.cik}.json`),
  ]);
  const filing = selectLatestAnnualFiling(submissions, tickerRecord.cik);
  const html = await get(filing.filingUrl, "text/html");
  return buildAcquisitionPackage({ tickerRecord, submissions, companyFacts, inlineFilingHtml: html });
}

const results = [];
for (const ticker of tickers) {
  const acquisition = await acquire(ticker);
  const field = targetFields[ticker];
  const resolutionCase = acquisition.inputs.evidenceResolutionCases.find((item) => item.field === field);
  const baseInputs = { ...acquisition.inputs, sharePrice: 1, marketObservationDate: acquisition.inputs.periodEnd, marketUrl: "https://example.invalid/verification-only-neutral-market-input" };
  const before = await evaluateInputs(baseInputs);

  if (ticker === "INCY") {
    const candidate = resolutionCase?.candidates.find((item) => item.concept === "PaymentsToAcquireOtherProductiveAssets" && item.normalizedValue === 58.867);
    const decision = { field, action: REVIEW_DECISION_ACTIONS.ACCEPT_CANDIDATE, selectedCandidateId: candidate?.id, reviewer: "QA", reviewedAt: "2026-08-08T00:00:00.000Z", rationale: "The official filing explicitly labels the matching annual $58.9 million outflow as capital expenditures." };
    const applied = applyEvidenceResolutionDecisions(baseInputs, [decision]);
    const after = await evaluateInputs(applied.inputs);
    const replay = await replayStoredEvaluation(after);
    results.push({ ticker, field, capability: "AcceptSingleCandidate", supported: applied.errors.length === 0, errors: applied.errors, beforeCoverage: before.scoring.coveragePercent, afterCoverage: after.scoring.coveragePercent, fingerprintChanged: before.fingerprint !== after.fingerprint, resolutionDecision: after.inputs.resolutionDecisions.find((item) => item.field === field), replayStatus: replay.status, candidate: candidate ?? null });
  } else {
    const decision = { field, action: REVIEW_DECISION_ACTIONS.REJECT_ALL_NOT_REPORTED_ZERO, reviewer: "QA", reviewedAt: "2026-08-08T00:00:00.000Z", rationale: "Every candidate was examined and rejected because it does not represent a separately reported canonical EV component; the optional field is governed as zero." };
    const applied = applyEvidenceResolutionDecisions(baseInputs, [decision]);
    const after = await evaluateInputs(applied.inputs);
    const replay = await replayStoredEvaluation(after);
    results.push({ ticker, field, capability: "RejectAllAndGovernZero", supported: applied.errors.length === 0, errors: applied.errors, beforeCoverage: before.scoring.coveragePercent, afterCoverage: after.scoring.coveragePercent, fingerprintChanged: before.fingerprint !== after.fingerprint, resolutionDecision: after.inputs.resolutionDecisions.find((item) => item.field === field), replayStatus: replay.status, candidateCount: resolutionCase?.candidates.length ?? 0 });
  }
  console.log(ticker, results.at(-1).supported ? "SUPPORTED" : "NOT EXPRESSIBLE", results.at(-1).afterCoverage ?? results.at(-1).beforeCoverage);
}

await fs.mkdir("verification-output", { recursive: true });
await fs.writeFile("verification-output/release-6.3-governed-review-usability.json", JSON.stringify({ generatedAt: new Date().toISOString(), engineRelease: "6.3.0", engineFormulaChanges: false, summary: { cases: results.length, fullySupported: results.filter((item) => item.supported).length, notExpressible: results.filter((item) => !item.supported).length }, results }, null, 2));
