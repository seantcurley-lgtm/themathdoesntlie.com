#!/usr/bin/env node
/** Prospective-only scheduled Evidence Engine generation. No retrospective records are created. */
import { readFile } from "node:fs/promises";
import tickerDirectory from "../public/sec/company-tickers.json" with { type: "json" };
import { evaluateInputs } from "../lib/evidence-engine.mjs";
import { PERIOD_COMPATIBILITY_VERSION } from "../lib/calculation-registry.mjs";
import { currentVersionContext } from "../lib/evaluation-replay.mjs";
import { ACQUISITION_VERSION, SUPPORTED_QUARTERLY_FILING_FORMS, buildAcquisitionPackage, mergeSubmissionHistory, resolveTicker, selectComparablePriorQuarterlyFiling, selectLatestAnnualFiling, selectLatestQuarterlyFiling } from "../lib/sec-xbrl.mjs";
import { PERIOD_ASSEMBLY_VERSION, buildQuarterlyEvidenceAssembly, evaluateQuarterlyAssembly, quarterlyGenerationOutcome, sourceRepresentationHashForAccessions } from "../lib/period-assembly.mjs";
import { createLongitudinalPublication, createSourceManifest, detectProspectiveWork, normalizeSecurityId, reconcileGeneration, sha256Text, stableSerialize } from "../lib/longitudinal-state.mjs";

const endpoint = String(process.env.EVIDENCE_ENGINE_STATE_ENDPOINT ?? "").replace(/\/$/, "");
const token = process.env.EVIDENCE_ENGINE_PUBLICATION_TOKEN ?? "";
if (!/^https:\/\//.test(endpoint) || token.length < 32) {
  throw new Error("EVIDENCE_ENGINE_STATE_ENDPOINT (HTTPS) and a 32+ character EVIDENCE_ENGINE_PUBLICATION_TOKEN are required.");
}

const startedAt = new Date().toISOString();
const generationId = `eeg_${startedAt.replace(/\D/g, "")}_${process.env.GITHUB_RUN_ID ?? crypto.randomUUID()}`;
const userAgent = "TMDL Evidence Engine longitudinal monitor/1.0 themathdoesntlie.com";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastSecRequest = 0;

async function secFetch(url, accept = "application/json", attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const delay = Math.max(0, lastSecRequest + 125 - Date.now());
    if (delay) await wait(delay);
    lastSecRequest = Date.now();
    try {
      const response = await fetch(url, { headers: { Accept: accept, "User-Agent": userAgent }, signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return accept.includes("json") ? response.json() : response.text();
    } catch (error) {
      if (attempt === attempts) throw error;
      await wait(500 * 2 ** (attempt - 1));
    }
  }
}

async function service(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`State service ${response.status}: ${body.error ?? "unknown failure"}`);
  return body;
}

async function existingCursors() {
  const latest = new Map();
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await service(`/api/evaluations?${query}`);
    for (const record of page.records) if (!latest.has(record.securityId)) latest.set(record.securityId, {
      securityId: record.securityId,
      latestAnnualAccession: record.freshness.latestAnnualFilingAccession,
      latestQuarterlyAccession: record.freshness.latestQuarterlyFilingAccession,
      latestQuarterlySourceHash: record.freshness.latestQuarterlySourceHash,
      marketObservationId: record.freshness.marketObservationId,
      resultId: record.resultId,
    });
    cursor = page.nextCursor;
  } while (cursor);
  return latest;
}

async function resolveComparableHistory(submissions, cik, quarterlyFiling) {
  try {
    return { submissions, priorQuarterlyFiling: selectComparablePriorQuarterlyFiling(submissions, cik, quarterlyFiling) };
  } catch (initialError) {
    let extended = submissions;
    const files = [...(submissions?.filings?.files ?? [])]
      .filter((item) => item?.name)
      .sort((left, right) => String(right.filingTo ?? "").localeCompare(String(left.filingTo ?? "")));
    for (const file of files) {
      const payload = await secFetch(`https://data.sec.gov/submissions/${file.name}`);
      extended = mergeSubmissionHistory(extended, [payload]);
      try {
        return { submissions: extended, priorQuarterlyFiling: selectComparablePriorQuarterlyFiling(extended, cik, quarterlyFiling) };
      } catch {
        // Continue only until the exact comparable filing is resolved.
      }
    }
    throw initialError;
  }
}

const marketPath = new URL("../../covered-call-lab/market-data.json", import.meta.url);
const marketSnapshot = JSON.parse(await readFile(marketPath, "utf8"));
const marketByTicker = new Map(marketSnapshot.securities.filter((item) => item.price && item.lastQuoteRefresh).map((item) => [item.ticker, item]));
const repository = process.env.GITHUB_REPOSITORY ?? "themathdoesntlie/themathdoesntlie.com";
const revision = process.env.GITHUB_SHA ?? "working-tree";
const universeIdentity = "EE supported U.S. issuers present in the governed shared market snapshot";
const universeRows = [...marketByTicker.values()].filter((item) => item.sector !== "ETF").sort((a, b) => a.ticker.localeCompare(b.ticker));
const universeHash = await sha256Text(stableSerialize(universeRows.map((item) => ({ ticker: item.ticker, name: item.name }))));
const cursors = await existingCursors();
const detected = [];
const events = [];

for (const market of universeRows) {
  let resolvedSecurityId = null;
  try {
    const tickerRecord = resolveTicker(tickerDirectory, market.ticker);
    const securityId = normalizeSecurityId(tickerRecord.cik);
    resolvedSecurityId = securityId;
    const submissions = await secFetch(`https://data.sec.gov/submissions/CIK${tickerRecord.cik}.json`);
    const annualFiling = selectLatestAnnualFiling(submissions, tickerRecord.cik);
    let quarterlyFiling = null;
    try {
      const candidate = selectLatestQuarterlyFiling(submissions, tickerRecord.cik);
      if (candidate.reportDate > annualFiling.reportDate) quarterlyFiling = candidate;
    } catch (error) {
      const recentForms = submissions?.filings?.recent?.form ?? [];
      if (recentForms.some((form) => SUPPORTED_QUARTERLY_FILING_FORMS.includes(form))) throw error;
      quarterlyFiling = null;
    }
    let companyFacts = null;
    let latestQuarterlySourceHash = null;
    if (quarterlyFiling) {
      companyFacts = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${tickerRecord.cik}.json`);
      latestQuarterlySourceHash = await sourceRepresentationHashForAccessions(
        companyFacts,
        quarterlyFiling.form === "10-Q/A"
          ? [quarterlyFiling.accessionNumber, quarterlyFiling.amendsAccessionNumber]
          : [quarterlyFiling.accessionNumber],
      );
    }
    const observationDate = String(market.lastQuoteRefresh).slice(0, 10);
    detected.push({
      securityId,
      tickerRecord,
      submissions,
      annualFiling,
      quarterlyFiling,
      companyFacts,
      market,
      latestAnnualAccession: annualFiling.accessionNumber,
      latestQuarterlyAccession: quarterlyFiling?.accessionNumber ?? null,
      latestQuarterlyForm: quarterlyFiling?.form ?? null,
      latestQuarterlySourceHash,
      marketObservationId: `${market.provider}:${market.ticker}:${observationDate}`,
    });
  } catch (error) {
    events.push({ occurredAt: new Date().toISOString(), securityId: resolvedSecurityId, ticker: market.ticker, outcome: "Failed", stage: "LatestSupportedFilingDetection", error: error instanceof Error ? error.message : String(error) });
  }
}

// Friday UTC is the one declared weekly valuation generation. New supported filing
// evidence is evaluated on every weekday run using the governed market snapshot.
const marketCadenceDue = new Date(startedAt).getUTCDay() === 5;
const work = detectProspectiveWork({ securities: detected, cursors: [...cursors.values()], marketCadenceDue });

for (const item of work) {
  if (item.action === "NoChange") {
    events.push({ occurredAt: new Date().toISOString(), securityId: item.securityId, ticker: item.market.ticker, outcome: "Excluded", reason: "Supported filing accessions, source representation, and declared market observation are unchanged." });
    continue;
  }
  if (item.action === "ReviewRequired") {
    events.push({ occurredAt: new Date().toISOString(), securityId: item.securityId, ticker: item.market.ticker, outcome: "Withheld", reason: "SameAccessionSourceMutation", reviewRequired: true });
    continue;
  }
  try {
    const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${item.tickerRecord.cik}.json`;
    const [companyFacts, inlineFilingHtml] = await Promise.all([
      item.companyFacts ? Promise.resolve(item.companyFacts) : secFetch(factsUrl),
      secFetch(item.annualFiling.filingUrl, "text/html"),
    ]);
    const acquiredAt = new Date().toISOString();
    const acquisition = buildAcquisitionPackage({ tickerRecord: item.tickerRecord, submissions: item.submissions, companyFacts, inlineFilingHtml });
    if (acquisition.summary.reviewRequired || acquisition.summary.collectionFailure) {
      events.push({ occurredAt: acquiredAt, securityId: item.securityId, ticker: item.market.ticker, outcome: "Withheld", reason: "Unresolved governed review or SEC collection failure.", summary: acquisition.summary });
      continue;
    }
    const observationDate = String(item.market.lastQuoteRefresh).slice(0, 10);
    const marketReference = `https://github.com/${repository}/blob/${revision}/covered-call-lab/market-data.json`;
    let evaluation;
    if (item.quarterlyFiling) {
      const history = await resolveComparableHistory(item.submissions, item.tickerRecord.cik, item.quarterlyFiling);
      const priorQuarterlyFiling = history.priorQuarterlyFiling;
      const assembly = await buildQuarterlyEvidenceAssembly({
        annualAcquisition: acquisition,
        companyFacts,
        quarterlyFiling: item.quarterlyFiling,
        priorQuarterlyFiling,
        securityId: item.securityId,
        knownAt: acquiredAt,
        quarterlySourceHash: item.latestQuarterlySourceHash,
      });
      const outcome = quarterlyGenerationOutcome(assembly);
      if (outcome.outcome === "Withheld") {
        events.push({ occurredAt: acquiredAt, securityId: item.securityId, ticker: item.market.ticker, ...outcome, summary: { acceptedEvidenceCount: assembly.acceptedEvidenceCount, failures: assembly.failures } });
        continue;
      }
      let priorAnnualPublication = null;
      const priorResultId = cursors.get(item.securityId)?.resultId;
      if (priorResultId) {
        const priorResponse = await service(`/api/evaluations?id=${encodeURIComponent(priorResultId)}`);
        priorAnnualPublication = priorResponse.record?.exactRecord ?? null;
      }
      const quarterly = await evaluateQuarterlyAssembly({ assembly, priorAnnualPublication, sharePrice: item.market.price, marketObservationDate: observationDate, marketUrl: marketReference });
      evaluation = quarterly.evaluation;
    } else {
      evaluation = await evaluateInputs({ ...acquisition.inputs, sharePrice: item.market.price, marketObservationDate: observationDate, marketUrl: marketReference });
    }
    const activeFiling = item.quarterlyFiling ?? item.annualFiling;
    const sourceMaxPublishedAt = [new Date(`${activeFiling.filingDate}T00:00:00.000Z`).toISOString(), new Date(item.market.lastQuoteRefresh).toISOString()].sort().at(-1);
    const knownAt = [acquiredAt, sourceMaxPublishedAt].sort().at(-1);
    const sourceManifest = await createSourceManifest({ evaluation, securityId: item.securityId, acquiredAt: knownAt, marketSource: { provider: item.market.provider, acquiredAt: item.market.lastQuoteRefresh, immutableReference: marketReference, contentHash: await sha256Text(stableSerialize(item.market)) } });
    const built = await createLongitudinalPublication({ evaluation, securityId: item.securityId, knownAt, publishedAt: new Date().toISOString(), sourceMaxPublishedAt, eventType: item.eventType, supersedesResultId: cursors.get(item.securityId)?.resultId ?? null, sourceManifest });
    const response = await service("/api/evaluations", { method: "POST", body: JSON.stringify(built) });
    events.push({ occurredAt: new Date().toISOString(), securityId: item.securityId, ticker: item.market.ticker, outcome: response.created ? "Created" : "Reused", resultId: response.record.resultId, sourceManifestId: sourceManifest.manifestId });
  } catch (error) {
    events.push({ occurredAt: new Date().toISOString(), securityId: item.securityId, ticker: item.market.ticker, outcome: "Failed", stage: "EvaluationPublication", error: error instanceof Error ? error.message : String(error) });
  }
}

const completedAt = new Date().toISOString();
const manifest = reconcileGeneration({
  generationId, universeIdentity, universeHash, codeVersion: revision,
  methodologyVersions: { ...currentVersionContext(), acquisitionVersion: ACQUISITION_VERSION, periodAssemblyVersion: PERIOD_ASSEMBLY_VERSION, periodCompatibilityVersion: PERIOD_COMPATIBILITY_VERSION },
  startedAt, completedAt,
  marketObservation: { cadence: "WeeklyFridayUTCPlusFreshObservationForNewSupportedFiling", snapshotGeneratedAt: marketSnapshot.meta.generatedAt, provider: marketSnapshot.meta.provider, snapshotHash: await sha256Text(stableSerialize(marketSnapshot)) },
  sourceManifestIds: events.map((event) => event.sourceManifestId).filter(Boolean), events,
});
await service("/api/evaluations/generations", { method: "POST", body: JSON.stringify({ manifest, events }) });
console.log(JSON.stringify({ generationId, succeeded: manifest.succeededCount, reused: manifest.resultIdsReused.length, withheld: manifest.withheldCount, excluded: manifest.excludedCount, failed: manifest.failedCount }));
if (manifest.failedCount) process.exitCode = 1;
