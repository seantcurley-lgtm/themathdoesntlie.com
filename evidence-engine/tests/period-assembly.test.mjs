import assert from "node:assert/strict";
import test from "node:test";

import { metricPeriodCompatibility, requestedCalculationIds } from "../lib/calculation-registry.mjs";
import { evaluateInputs, microsoftFiscal2025 } from "../lib/evidence-engine.mjs";
import { replayStoredEvaluation } from "../lib/evaluation-replay.mjs";
import {
  PERIOD_ASSEMBLY_VERSION,
  assembleTtmEvidence,
  buildQuarterlyEvidenceAssembly,
  classifyReportingContext,
  detectSourceRepresentationChange,
  evaluateQuarterlyAssembly,
  overlayAmendmentEvidence,
  quarterlyGenerationOutcome,
  selectComparablePriorQuarterBalance,
  sourceRepresentationHashForAccessions,
} from "../lib/period-assembly.mjs";
import { createLongitudinalPublication, createSourceManifest } from "../lib/longitudinal-state.mjs";

const knownAt = "2025-11-01T00:00:00.000Z";

async function item(overrides = {}) {
  return {
    evidenceItemId: overrides.evidenceItemId ?? `e-${overrides.canonicalField ?? "revenue"}-${overrides.periodBasis ?? "FiscalYTD"}-${overrides.end}`,
    canonicalField: "revenue",
    value: 100,
    normalizedUnit: "USD millions",
    signConvention: "Reported",
    entityScope: "ConsolidatedEntity",
    taxonomy: "us-gaap",
    concept: "Revenues",
    periodBasis: "FiscalYTD",
    start: "2025-07-01",
    end: "2025-09-30",
    fiscalYear: 2026,
    fiscalQuarter: 1,
    accessionNumber: "q-current",
    form: "10-Q",
    filed: "2025-10-20",
    knownAt,
    ...overrides,
  };
}

test("exact contexts classify Q1/Q2/Q3 YTD, quarter-only, instant, and FY", () => {
  for (const [quarter, start] of [[1, "2025-07-01"], [2, "2025-07-01"], [3, "2025-07-01"]]) {
    const end = quarter === 1 ? "2025-09-30" : quarter === 2 ? "2025-12-31" : "2026-03-31";
    assert.equal(classifyReportingContext({ start, end, filingForm: "10-Q", reportDate: end, fiscalQuarter: quarter, fiscalYearStart: "2025-07-01" }).periodBasis, "FiscalYTD");
  }
  assert.equal(classifyReportingContext({ start: "2025-10-01", end: "2025-12-31", filingForm: "10-Q", reportDate: "2025-12-31", fiscalQuarter: 2, fiscalYearStart: "2025-07-01" }).periodBasis, "FiscalQuarter");
  assert.equal(classifyReportingContext({ end: "2025-12-31", filingForm: "10-Q", reportDate: "2025-12-31" }).periodBasis, "Instant");
  assert.equal(classifyReportingContext({ start: "2024-07-01", end: "2025-06-30", filingForm: "10-K", reportDate: "2025-06-30" }).periodBasis, "FiscalYear");
});

test("TTM arithmetic retains exact components and actual inclusive day count", async () => {
  const fiscalYear = await item({ evidenceItemId: "fy", periodBasis: "FiscalYear", value: 1_000, start: "2024-07-01", end: "2025-06-30", fiscalYear: 2025, fiscalQuarter: null, accessionNumber: "k" });
  const currentYtd = await item({ evidenceItemId: "cytd", value: 300 });
  const priorYearYtd = await item({ evidenceItemId: "pytd", value: 250, start: "2024-07-01", end: "2024-09-30", fiscalYear: 2025, accessionNumber: "q-prior" });
  const ttm = await assembleTtmEvidence({ canonicalField: "revenue", fiscalYear, currentYtd, priorYearYtd, resultKnownAt: knownAt });
  assert.equal(ttm.value, 1_050);
  assert.equal(ttm.start, "2024-10-01");
  assert.equal(ttm.end, "2025-09-30");
  assert.equal(ttm.actualInclusiveDays, 365);
  assert.deepEqual(ttm.componentEvidenceIds, ["fy", "cytd", "pytd"]);
});

test("52/53-week-compatible calendars retain their actual TTM day count", async () => {
  const fiscalYear = await item({ evidenceItemId: "fy53", periodBasis: "FiscalYear", value: 1_000, start: "2023-10-02", end: "2024-09-29", fiscalYear: 2024, fiscalQuarter: null, accessionNumber: "k53" });
  const currentYtd = await item({ evidenceItemId: "cytd53", value: 260, start: "2024-09-30", end: "2024-12-29", fiscalYear: 2025, accessionNumber: "q53" });
  const priorYearYtd = await item({ evidenceItemId: "pytd53", value: 240, start: "2023-10-02", end: "2023-12-31", fiscalYear: 2024, accessionNumber: "pq53" });
  const ttm = await assembleTtmEvidence({ canonicalField: "revenue", fiscalYear, currentYtd, priorYearYtd, resultKnownAt: knownAt });
  assert.equal(ttm.actualInclusiveDays, 364);
  assert.equal(ttm.value, 1_020);
});

test("TTM fails closed for missing, overlapping, late, or incompatible components", async () => {
  const fiscalYear = await item({ evidenceItemId: "fy", periodBasis: "FiscalYear", start: "2024-07-01", end: "2025-06-30", fiscalYear: 2025, fiscalQuarter: null, accessionNumber: "k" });
  const currentYtd = await item({ evidenceItemId: "cytd" });
  const priorYearYtd = await item({ evidenceItemId: "pytd", start: "2024-07-01", end: "2024-09-30", fiscalYear: 2025, accessionNumber: "pq" });
  await assert.rejects(() => assembleTtmEvidence({ canonicalField: "revenue", fiscalYear, currentYtd: null, priorYearYtd, resultKnownAt: knownAt }), /canonical field/);
  await assert.rejects(() => assembleTtmEvidence({ canonicalField: "revenue", fiscalYear: { ...fiscalYear, end: "2025-07-01" }, currentYtd, priorYearYtd, resultKnownAt: knownAt }), /gap or overlap/);
  await assert.rejects(() => assembleTtmEvidence({ canonicalField: "revenue", fiscalYear, currentYtd: { ...currentYtd, knownAt: "2025-12-01T00:00:00Z" }, priorYearYtd, resultKnownAt: knownAt }), /not known/);
  await assert.rejects(() => assembleTtmEvidence({ canonicalField: "revenue", fiscalYear, currentYtd, priorYearYtd: { ...priorYearYtd, end: "2024-08-31" }, resultKnownAt: knownAt }), /calendars are incompatible/);
});

test("comparable prior-quarter balances require exact fiscal and concept compatibility", async () => {
  const current = await item({ canonicalField: "endingTotalAssets", evidenceItemId: "assets-current", periodBasis: "Instant", start: null, end: "2025-09-30", fiscalYear: 2026, fiscalQuarter: 1, concept: "Assets" });
  const prior = await item({ canonicalField: "endingTotalAssets", evidenceItemId: "assets-prior", periodBasis: "Instant", start: null, end: "2024-09-30", fiscalYear: 2025, fiscalQuarter: 1, concept: "Assets" });
  assert.equal(selectComparablePriorQuarterBalance({ current, candidates: [prior] }).evidenceItemId, "assets-prior");
  assert.throws(() => selectComparablePriorQuarterBalance({ current, candidates: [{ ...prior, concept: "AssetsOther" }] }), /Exactly one/);
});

test("partial 10-Q/A overlays only supplied fields and preserves the original relationship", () => {
  const originalItems = [{ canonicalField: "revenue", value: 10, accessionNumber: "q1" }, { canonicalField: "netIncome", value: 2, accessionNumber: "q1" }];
  const amendmentItems = [{ canonicalField: "revenue", value: 11, accessionNumber: "qa1" }];
  const overlaid = overlayAmendmentEvidence({ originalItems, amendmentItems, originalAccession: "q1", amendment: { form: "10-Q/A", accessionNumber: "qa1", amendsAccessionNumber: "q1" } });
  assert.equal(overlaid.find((entry) => entry.canonicalField === "revenue").value, 11);
  assert.equal(overlaid.find((entry) => entry.canonicalField === "netIncome").value, 2);
  assert.throws(() => overlayAmendmentEvidence({ originalItems, amendmentItems, originalAccession: "q1", amendment: { form: "10-Q/A", accessionNumber: "qa1", amendsAccessionNumber: "other" } }), /unambiguous/);
});

test("same-accession duplicates are stable and material source mutation requires review", async () => {
  const facts = { facts: { "us-gaap": { Revenues: { units: { USD: [{ accn: "a", val: 1, start: "2025-01-01", end: "2025-03-31" }, { accn: "a", val: 1, start: "2025-01-01", end: "2025-03-31" }] } } } } };
  const first = await sourceRepresentationHashForAccessions(facts, ["a"]);
  const second = await sourceRepresentationHashForAccessions(structuredClone(facts), ["a"]);
  assert.deepEqual(detectSourceRepresentationChange({ accessionNumber: "a", contentHash: first }, { accessionNumber: "a", contentHash: second }), { status: "Unchanged" });
  const changed = structuredClone(facts);
  changed.facts["us-gaap"].Revenues.units.USD[0].val = 2;
  const changedHash = await sourceRepresentationHashForAccessions(changed, ["a"]);
  assert.equal(detectSourceRepresentationChange({ accessionNumber: "a", contentHash: first }, { accessionNumber: "a", contentHash: changedHash }).status, "ReviewRequired");
});

test("all 30 governed outputs have explicit A/B/C compatibility and P/E is annual carry", () => {
  assert.deepEqual(Object.keys(metricPeriodCompatibility).sort(), [...requestedCalculationIds].sort());
  assert.equal(metricPeriodCompatibility.priceToEarnings.classification, "C");
  assert.equal(Object.values(metricPeriodCompatibility).filter((entry) => entry.classification === "D").length, 0);
});

test("raw Company Facts assemble TTM flows and comparable quarter-end balances without annual substitution", async () => {
  const companyFacts = { facts: { "us-gaap": {}, dei: {} } };
  const add = (taxonomy, concept, unit, facts) => {
    companyFacts.facts[taxonomy][concept] = { units: { [unit]: facts } };
  };
  add("us-gaap", "Revenues", "USD", [
    { val: 1_000_000_000, start: "2024-07-01", end: "2025-06-30", accn: "k", form: "10-K", filed: "2025-08-01", fy: 2025, fp: "FY" },
    { val: 300_000_000, start: "2025-07-01", end: "2025-09-30", accn: "q", form: "10-Q", filed: "2025-10-20", fy: 2026, fp: "Q1" },
    { val: 250_000_000, start: "2024-07-01", end: "2024-09-30", accn: "pq", form: "10-Q", filed: "2024-10-20", fy: 2025, fp: "Q1" },
  ]);
  add("us-gaap", "AccountsReceivableNetCurrent", "USD", [
    { val: 120_000_000, end: "2025-09-30", accn: "q", form: "10-Q", filed: "2025-10-20", fy: 2026, fp: "Q1" },
    { val: 100_000_000, end: "2024-09-30", accn: "pq", form: "10-Q", filed: "2024-10-20", fy: 2025, fp: "Q1" },
  ]);
  add("us-gaap", "AssetsCurrent", "USD", [
    { val: 500_000_000, end: "2025-09-30", accn: "q", form: "10-Q", filed: "2025-10-20", fy: 2026, fp: "Q1" },
  ]);
  add("dei", "EntityCommonStockSharesOutstanding", "shares", [
    { val: 10_000_000, end: "2025-10-10", accn: "q", form: "10-Q", filed: "2025-10-20", fy: 2026, fp: "Q1" },
  ]);
  const annualAcquisition = {
    filing: { form: "10-K", accessionNumber: "k", reportDate: "2025-06-30", filingDate: "2025-08-01", filingUrl: "https://sec.example/k" },
    inputs: { ...microsoftFiscal2025, accessionNumber: "k", periodStart: "2024-07-01", periodEnd: "2025-06-30", acquisition: { version: "fixture" } },
  };
  const quarterlyFiling = { form: "10-Q", accessionNumber: "q", reportDate: "2025-09-30", filingDate: "2025-10-20", filingUrl: "https://sec.example/q" };
  const priorQuarterlyFiling = { form: "10-Q", accessionNumber: "pq", reportDate: "2024-09-30", filingDate: "2024-10-20", filingUrl: "https://sec.example/pq" };
  const assembly = await buildQuarterlyEvidenceAssembly({ annualAcquisition, companyFacts, quarterlyFiling, priorQuarterlyFiling, securityId: "sec-cik:0000789019", knownAt });
  assert.equal(assembly.inputs.revenue, 1_050);
  assert.equal(assembly.inputs.currentAssets, 500);
  assert.equal(assembly.inputs.endingAccountsReceivable, 120);
  assert.equal(assembly.inputs.beginningAccountsReceivable, 100);
  assert.equal(assembly.inputs.sharesOutstanding, 10);
  assert.equal(assembly.inputs.dilutedEarningsPerShare, null);
  assert.equal(assembly.inputs.inputEvidence.revenue.periodBasis, "TrailingTwelveMonths");
  assert.equal(assembly.inputs.inputEvidence.beginningAccountsReceivable.end, "2024-09-30");
});

async function annualPublication() {
  const evaluation = await evaluateInputs(microsoftFiscal2025);
  const sourceManifest = await createSourceManifest({ evaluation, securityId: "789019", acquiredAt: "2025-07-30T20:00:00Z", marketSource: { provider: "Fixture", acquiredAt: "2025-07-30T20:00:00Z" } });
  return (await createLongitudinalPublication({ evaluation, securityId: "789019", knownAt: "2025-07-30T20:00:00Z", publishedAt: "2025-07-30T20:01:00Z", sourceMaxPublishedAt: "2025-07-30T00:00:00Z", eventType: "AnnualFilingAccepted", sourceManifest })).publication;
}

function quarterlyAssembly(accessionNumber = "quarterly-1") {
  return {
    version: PERIOD_ASSEMBLY_VERSION,
    status: "Assembled",
    failures: [],
    acceptedEvidenceCount: 1,
    inputs: {
      ...microsoftFiscal2025,
      periodStart: "2024-10-01",
      periodEnd: "2025-09-30",
      accessionNumber,
      filingDate: "2025-10-20",
      filingUrl: `https://www.sec.gov/Archives/${accessionNumber}.htm`,
      reportingPeriodType: "TrailingTwelveMonths",
      reportingPeriodResolutionSource: "Governed quarterly period assembly",
      periodAssemblyVersion: PERIOD_ASSEMBLY_VERSION,
      dilutedEarningsPerShare: null,
      inputEvidence: {
        ...microsoftFiscal2025.inputEvidence,
        dilutedEarningsPerShare: { field: "dilutedEarningsPerShare", status: "Missing", method: "annual-carry-required", periodBasis: "FiscalYear" },
        revenue: {
          field: "revenue", canonicalField: "revenue", evidenceItemId: `ttm-${accessionNumber}`, status: "Derived", evidenceStatus: "transformed", method: "fixture-ttm", value: microsoftFiscal2025.revenue, periodBasis: "TrailingTwelveMonths", start: "2024-10-01", end: "2025-09-30", filed: "2025-10-20", accessionNumber, form: "10-Q", knownAt,
          componentEvidence: [
            { field: "revenue", canonicalField: "revenue", evidenceItemId: "fy-revenue", status: "Mapped", evidenceStatus: "observed", periodBasis: "FiscalYear", start: "2024-07-01", end: "2025-06-30", filed: "2025-07-30", accessionNumber: microsoftFiscal2025.accessionNumber, form: "10-K", knownAt },
            { field: "revenue", canonicalField: "revenue", evidenceItemId: `cytd-${accessionNumber}`, status: "Mapped", evidenceStatus: "observed", periodBasis: "FiscalYTD", start: "2025-07-01", end: "2025-09-30", filed: "2025-10-20", accessionNumber, form: "10-Q", knownAt },
            { field: "revenue", canonicalField: "revenue", evidenceItemId: "pytd-revenue", status: "Mapped", evidenceStatus: "observed", periodBasis: "FiscalYTD", start: "2024-07-01", end: "2024-09-30", filed: "2024-10-20", accessionNumber: "prior-quarter", form: "10-Q", knownAt },
          ],
        },
        currentAssets: { field: "currentAssets", canonicalField: "currentAssets", evidenceItemId: `e-${accessionNumber}`, status: "Mapped", evidenceStatus: "observed", method: "fixture", value: microsoftFiscal2025.currentAssets, periodBasis: "Instant", end: "2025-09-30", filed: "2025-10-20", accessionNumber, form: "10-Q", knownAt },
      },
    },
  };
}

test("P/E and its scored rule carry exactly with annual provenance and continue coverage", async () => {
  const prior = await annualPublication();
  const result = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly(), priorAnnualPublication: prior, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-09-30", marketUrl: microsoftFiscal2025.marketUrl });
  const metric = result.evaluation.metrics.find((entry) => entry.id === "priceToEarnings");
  const rule = result.evaluation.scoring.rules.find((entry) => entry.metricId === "priceToEarnings");
  assert.equal(metric.value, prior.evaluation.metrics.find((entry) => entry.id === "priceToEarnings").value);
  assert.equal(metric.carriedFromResultId, prior.resultId);
  assert.equal(metric.originalEvidencePeriod.periodType, "FiscalYear");
  assert.equal(rule.authorityStatus, "CarriedForward");
  assert.equal(result.evaluation.scoring.coveragePercent, prior.evaluation.scoring.coveragePercent);
  assert.equal(result.evaluation.reportingPeriod.periodType, "TrailingTwelveMonths");
});

test("P/E fails closed when exact annual carry authority cannot be resolved", async () => {
  const result = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly(), priorAnnualPublication: null, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-09-30", marketUrl: microsoftFiscal2025.marketUrl });
  assert.ok(result.evaluation.unavailableMetrics.some((entry) => entry.id === "priceToEarnings"));
  assert.equal(result.evaluation.scoring.rules.find((entry) => entry.metricId === "priceToEarnings").status, "Unavailable");
});

test("carry-forward chains retain the original annual identity and age", async () => {
  const annual = await annualPublication();
  const first = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly("q1"), priorAnnualPublication: annual, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-09-30", marketUrl: microsoftFiscal2025.marketUrl });
  const firstPublication = { resultId: "quarter-result", evaluation: first.evaluation, sourceManifestId: "quarter-manifest", freshness: { latestQuarterlyFilingFiledDate: "2025-10-20" } };
  const second = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly("q2"), priorAnnualPublication: firstPublication, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-12-31", marketUrl: microsoftFiscal2025.marketUrl });
  const carried = second.evaluation.metrics.find((entry) => entry.id === "priceToEarnings");
  assert.equal(carried.carriedFromResultId, annual.resultId);
  assert.deepEqual(carried.originalFreshness, annual.freshness);
});

test("authority changes fingerprint even when the numerical score is unchanged", async () => {
  const prior = await annualPublication();
  const first = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly("q-a"), priorAnnualPublication: prior, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-09-30", marketUrl: microsoftFiscal2025.marketUrl });
  const second = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly("q-b"), priorAnnualPublication: prior, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-09-30", marketUrl: microsoftFiscal2025.marketUrl });
  assert.equal(first.evaluation.scoring.overallScore, second.evaluation.scoring.overallScore);
  assert.notEqual(first.evaluation.fingerprint, second.evaluation.fingerprint);
});

test("unsupported quarterly evidence produces the explicit withheld outcome", () => {
  assert.deepEqual(quarterlyGenerationOutcome({ acceptedEvidenceCount: 0 }), { outcome: "Withheld", reason: "WithheldNoSupportedEvidence" });
});

test("quarterly publication preserves multi-source and carried-result authority", async () => {
  const prior = await annualPublication();
  const result = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly("q-publish"), priorAnnualPublication: prior, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-09-30", marketUrl: microsoftFiscal2025.marketUrl });
  const manifest = await createSourceManifest({ evaluation: result.evaluation, securityId: "789019", acquiredAt: knownAt, marketSource: { provider: "Fixture", acquiredAt: knownAt } });
  const secSources = manifest.sources.filter((source) => source.sourceType === "SEC Filing");
  assert.deepEqual(new Set(secSources.map((source) => source.form)), new Set(["10-K", "10-Q"]));
  assert.ok(manifest.sources.some((source) => source.sourceType === "Prior Evidence Result" && source.authoritativeIdentity === prior.resultId));
  const publication = await createLongitudinalPublication({ evaluation: result.evaluation, securityId: "789019", knownAt, publishedAt: "2025-11-01T00:01:00Z", sourceMaxPublishedAt: "2025-10-20T00:00:00Z", eventType: "QuarterlyFilingAccepted", supersedesResultId: prior.resultId, sourceManifest: manifest });
  assert.equal(publication.publication.freshness.latestQuarterlyFilingAccession, "q-publish");
  assert.equal(publication.publication.versionBundle.periodAssemblyVersion, PERIOD_ASSEMBLY_VERSION);
});

test("a quarterly mixed-vintage evaluation replays to its exact fingerprint", async () => {
  const prior = await annualPublication();
  const result = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly("q-replay"), priorAnnualPublication: prior, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-09-30", marketUrl: microsoftFiscal2025.marketUrl });
  const replay = await replayStoredEvaluation(result.evaluation);
  assert.equal(replay.status, "Reproduced");
  assert.equal(replay.comparison.fingerprintMatch, true);
});

test("a partial amendment remains an explicit source even when accepted slots come from the original", async () => {
  const prior = await annualPublication();
  const result = await evaluateQuarterlyAssembly({ assembly: quarterlyAssembly("q-original"), priorAnnualPublication: prior, sharePrice: microsoftFiscal2025.sharePrice, marketObservationDate: "2025-09-30", marketUrl: microsoftFiscal2025.marketUrl });
  result.evaluation.inputs.accessionNumber = "q-amendment";
  result.evaluation.inputs.filingDate = "2025-10-25";
  result.evaluation.inputs.filingUrl = "https://www.sec.gov/Archives/q-amendment.htm";
  result.evaluation.inputs.authoritySources = [
    { form: "10-Q", accessionNumber: "q-original", reportDate: "2025-09-30", filingDate: "2025-10-20", filingUrl: "https://www.sec.gov/Archives/q-original.htm", sourceRole: "Original" },
    { form: "10-Q/A", accessionNumber: "q-amendment", reportDate: "2025-09-30", filingDate: "2025-10-25", filingUrl: "https://www.sec.gov/Archives/q-amendment.htm", sourceRole: "Amendment", amendsAccessionNumber: "q-original" },
  ];
  const manifest = await createSourceManifest({ evaluation: result.evaluation, securityId: "789019", acquiredAt: knownAt, marketSource: { provider: "Fixture", acquiredAt: knownAt } });
  const amendment = manifest.sources.find((source) => source.form === "10-Q/A");
  assert.equal(amendment.amendsAccessionNumber, "q-original");
  assert.deepEqual(amendment.evidenceItems, []);
  await createLongitudinalPublication({ evaluation: result.evaluation, securityId: "789019", knownAt, publishedAt: "2025-11-01T00:01:00Z", sourceMaxPublishedAt: "2025-10-25T00:00:00Z", eventType: "QuarterlyAmendmentAccepted", supersedesResultId: prior.resultId, sourceManifest: manifest });
});
