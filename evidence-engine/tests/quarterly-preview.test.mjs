import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { evaluateInputs, microsoftFiscal2025 } from "../lib/evidence-engine.mjs";
import { createLongitudinalPublication, createSourceManifest, sha256Text, stableSerialize } from "../lib/longitudinal-state.mjs";
import {
  buildResolvedQuarterlyPreview,
  metricInspectionRows,
  parseQuarterlyPreviewArguments,
  readPriorResultArtifact,
  renderMetricInspectionTable,
  renderQuarterlyPreview,
  serializeQuarterlyPreview,
} from "../lib/quarterly-preview.mjs";

const knownAt = "2026-08-01T00:00:00.000Z";

function addFact(companyFacts, taxonomy, concept, unit, facts) {
  companyFacts.facts[taxonomy][concept] = { units: { [unit]: facts } };
}

function resolvedFixture() {
  const companyFacts = { facts: { "us-gaap": {}, dei: {} } };
  addFact(companyFacts, "us-gaap", "Revenues", "USD", [
    { val: 100_000_000_000, start: "2024-09-29", end: "2025-09-27", accn: "annual", form: "10-K", filed: "2025-10-31", fy: 2025, fp: "FY" },
    { val: 90_000_000_000, start: "2025-09-28", end: "2026-06-27", accn: "quarter", form: "10-Q", filed: "2026-07-31", fy: 2026, fp: "Q3" },
    { val: 80_000_000_000, start: "2024-09-29", end: "2025-06-28", accn: "prior-quarter", form: "10-Q", filed: "2025-08-01", fy: 2025, fp: "Q3" },
    { val: 25_000_000_000, start: "2025-03-30", end: "2025-06-28", accn: "quarter", form: "10-Q", filed: "2026-07-31", fy: 2026, fp: "Q3" },
    { val: 80_000_000_000, start: "2024-09-29", end: "2025-06-28", accn: "quarter", form: "10-Q", filed: "2026-07-31", fy: 2026, fp: "Q3" },
  ]);
  addFact(companyFacts, "us-gaap", "AssetsCurrent", "USD", [
    { val: 150_000_000_000, end: "2026-06-27", accn: "quarter", form: "10-Q", filed: "2026-07-31", fy: 2026, fp: "Q3" },
  ]);
  addFact(companyFacts, "dei", "EntityCommonStockSharesOutstanding", "shares", [
    { val: 15_000_000_000, end: "2026-07-17", accn: "quarter", form: "10-Q", filed: "2026-07-31", fy: 2026, fp: "Q3" },
  ]);
  return {
    ticker: "AAPL",
    company: "Apple Inc.",
    tickerRecord: { ticker: "AAPL", cik: "0000320193", title: "Apple Inc." },
    securityId: "sec-cik:0000320193",
    annualAcquisition: {
      filing: { form: "10-K", accessionNumber: "annual", reportDate: "2025-09-27", filingDate: "2025-10-31", filingUrl: "https://sec.example/annual" },
      inputs: { ...microsoftFiscal2025, ticker: "AAPL", companyName: "Apple Inc.", accessionNumber: "annual", periodStart: "2024-09-29", periodEnd: "2025-09-27", acquisition: { version: "fixture" } },
    },
    companyFacts,
    quarterlyFiling: { form: "10-Q", accessionNumber: "quarter", reportDate: "2026-06-27", filingDate: "2026-07-31", filingUrl: "https://sec.example/quarter" },
    priorQuarterlyFiling: { form: "10-Q", accessionNumber: "prior-quarter", reportDate: "2025-06-28", filingDate: "2025-08-01", filingUrl: "https://sec.example/prior-quarter" },
    market: { ticker: "AAPL", price: 200, provider: "Fixture", lastQuoteRefresh: "2026-07-31T20:00:00.000Z" },
    marketReference: "https://market.example/snapshot",
    previewKnownAt: knownAt,
  };
}

async function annualPublication() {
  const evaluation = await evaluateInputs(microsoftFiscal2025);
  const sourceManifest = await createSourceManifest({ evaluation, securityId: "0000320193", acquiredAt: "2025-10-31T20:00:00Z", marketSource: { provider: "Fixture", acquiredAt: "2025-10-31T20:00:00Z" } });
  return (await createLongitudinalPublication({ evaluation, securityId: "0000320193", knownAt: "2025-10-31T20:00:00Z", publishedAt: "2025-10-31T20:01:00Z", sourceMaxPublishedAt: "2025-10-31T00:00:00Z", eventType: "AnnualFilingAccepted", sourceManifest })).publication;
}

test("ticker and preview options parse without requiring CIK or authority configuration", () => {
  assert.deepEqual(parseQuarterlyPreviewArguments(["aapl", "--json", "--out", "preview.json", "--prior-result", "annual.json"]), {
    ticker: "AAPL", json: true, out: "preview.json", priorResult: "annual.json", help: false,
  });
  assert.throws(() => parseQuarterlyPreviewArguments([]), /ticker is required/i);
  assert.throws(() => parseQuarterlyPreviewArguments(["AAPL", "MSFT"]), /exactly one ticker/i);
  assert.throws(() => parseQuarterlyPreviewArguments(["AAPL", "--publish"]), /Unknown option/);
});

test("preview invokes production quarterly assembly and is deterministic for fixed inputs", async () => {
  const first = await buildResolvedQuarterlyPreview(resolvedFixture());
  const second = await buildResolvedQuarterlyPreview(resolvedFixture());
  assert.equal(first.assembly.version, "1.0.0");
  assert.equal(first.evaluation.periodAssemblyVersion, "1.0.0");
  assert.equal(first.assembly.inputs.revenue, 110_000);
  assert.equal(first.assembly.inputs.inputEvidence.revenue.periodBasis, "TrailingTwelveMonths");
  assert.equal(first.evaluation.fingerprint, second.evaluation.fingerprint);
  assert.equal(first.preview.authoritativeStateWritten, false);
});

test("human rendering includes A/B/C inspection, transformed TTM detail, and unavailable P/E", async () => {
  const preview = await buildResolvedQuarterlyPreview(resolvedFixture());
  const rendered = renderQuarterlyPreview(preview);
  assert.match(rendered, /LOCAL PREVIEW — NOT AN AUTHORITATIVE PUBLISHED STATE/);
  assert.match(rendered, /Current Ratio\s+\| A/);
  assert.match(rendered, /Gross Margin\s+\| B/);
  assert.match(rendered, /Price-to-Earnings\s+\| C\s+\| Unavailable/);
  assert.match(rendered, /NoAuthoritativeAnnualCarrySource/);
  assert.match(rendered, /revenue: 110000 .* TTM-FY-PLUS-CYTD-MINUS-PYTD@1\.0\.0/);
  assert.match(rendered, /FiscalYear: 100000/);
  assert.match(rendered, /FiscalYTD: 90000/);
  assert.match(rendered, /FiscalYTD: 80000/);
});

test("metric table renderer supports explicit Class D withheld authority", () => {
  const rendered = renderMetricInspectionTable([{
    name: "Future metric", classification: "D", status: "Unavailable", value: null, unit: null,
    evidencePeriodBasis: [], evidencePeriodEnd: [], sourceForms: [], sourceAccessions: [], transformations: [],
    reason: "MethodologyAuthorityRequired", carriedFromResultId: null,
  }]);
  assert.match(rendered, /Future metric\s+\| D\s+\| Unavailable/);
  assert.match(rendered, /MethodologyAuthorityRequired/);
});

test("exact prior annual Result enables legitimate carried P/E lineage", async () => {
  const priorAnnualPublication = await annualPublication();
  const preview = await buildResolvedQuarterlyPreview({ ...resolvedFixture(), priorAnnualPublication });
  const row = metricInspectionRows(preview).find((item) => item.metricId === "priceToEarnings");
  assert.equal(row.status, "CarriedForward");
  assert.equal(row.carriedFromResultId, priorAnnualPublication.resultId);
  assert.match(renderQuarterlyPreview(preview), new RegExp(`carriedFromResultId=${priorAnnualPublication.resultId}`));
});

test("prior Result file input requires and verifies exact-record integrity", async () => {
  const publication = await annualPublication();
  const recordHash = await sha256Text(stableSerialize(publication));
  const path = join(tmpdir(), `ee-quarterly-prior-${randomUUID()}.json`);
  try {
    await writeFile(path, JSON.stringify({ record: { exactRecord: publication, integrity: { recordHash } } }));
    assert.equal((await readPriorResultArtifact(path)).resultId, publication.resultId);
    await writeFile(path, JSON.stringify({ record: { exactRecord: { ...publication, tickerAtState: "ALTERED" }, integrity: { recordHash } } }));
    await assert.rejects(() => readPriorResultArtifact(path), /SHA-256 verification/);
  } finally {
    await unlink(path).catch(() => {});
  }
});

test("JSON mode preserves production evaluation, evidence, provenance, and preview safety labels", async () => {
  const preview = await buildResolvedQuarterlyPreview(resolvedFixture());
  const parsed = JSON.parse(serializeQuarterlyPreview(preview));
  assert.equal(parsed.preview.publicationAttempted, false);
  assert.equal(parsed.integrity.authoritativeRecordHash, null);
  assert.equal(parsed.evaluation.fingerprint, preview.evaluation.fingerprint);
  assert.ok(parsed.sourceManifest.evidenceItems.some((item) => item.transformationId === "TTM-FY-PLUS-CYTD-MINUS-PYTD"));
  assert.ok(parsed.sourceManifest.sources.filter((source) => source.sourceType === "SEC Filing").every((source) => source.immutableReference));
  assert.ok(parsed.metricInspection.some((item) => item.classification === "C"));
});

test("withheld and failed evidence reasons remain visible", async () => {
  const preview = await buildResolvedQuarterlyPreview(resolvedFixture());
  assert.ok(preview.assembly.failures.length > 0);
  const rendered = renderQuarterlyPreview(preview);
  assert.match(rendered, /Withheld \/ unavailable evidence/);
  assert.match(rendered, /MissingTtmComponents/);
});

test("preview implementation has no publication service or authoritative write path", async () => {
  const library = await readFile(new URL("../lib/quarterly-preview.mjs", import.meta.url), "utf8");
  const cli = await readFile(new URL("../scripts/preview-quarterly.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(library, /createLongitudinalPublication|publication-store|\/api\/evaluations|method:\s*["']POST/);
  assert.doesNotMatch(cli, /createLongitudinalPublication|publication-store|\/api\/evaluations|method:\s*["']POST/);
});
