import assert from "node:assert/strict";
import test from "node:test";

import {
  calculationEntries,
  planRequestedOutputs,
  requestedCalculationIds,
} from "../lib/calculation-registry.mjs";
import {
  canonicalEvidenceEntries,
  canonicalRegistryIssues,
} from "../lib/canonical-registry.mjs";
import { aliasRegistryEntries } from "../lib/alias-registry.mjs";
import { evaluateInputs, microsoftFiscal2025 } from "../lib/evidence-engine.mjs";

const metricValue = (result, id) => Number(result.metrics.find((metric) => metric.id === id)?.value);
const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("registries are unique, acyclic, and cover exactly 30 requested outputs", () => {
  assert.equal(new Set(calculationEntries.map((entry) => entry.id)).size, calculationEntries.length);
  assert.equal(new Set(canonicalEvidenceEntries.map((entry) => entry.key)).size, canonicalEvidenceEntries.length);
  assert.equal(new Set(aliasRegistryEntries.map((entry) => entry.field)).size, aliasRegistryEntries.length);
  assert.equal(requestedCalculationIds.length, 30);
  const plan = planRequestedOutputs();
  assert.equal(plan.status, "Ready");
  assert.equal(plan.missingRegistryNodes.length, 0);
  assert.equal(plan.orderedIds.length, calculationEntries.length);
});

test("actual inclusive reporting days govern every days-based metric", async () => {
  const result = await evaluateInputs({
    ...microsoftFiscal2025,
    periodStart: "2024-09-29",
    periodEnd: "2025-09-27",
    filingDate: "2025-10-31",
  });
  assert.equal(result.reportingPeriod.actualDayCount, 364);
  const expectedDso = ((56_924 + 69_905) / 2 / 281_724) * 364;
  near(metricValue(result, "dso"), expectedDso);
  assert.equal(result.metrics.find((metric) => metric.id === "dso")?.periodRule, "ActualInclusiveReportingPeriod");
});

test("CE-144 and CE-147 subtract separately reported prepaid expenses", async () => {
  const result = await evaluateInputs({ ...microsoftFiscal2025, prepaidExpenses: 1_000 });
  near(metricValue(result, "quickRatio"), (191_131 - 938 - 1_000) / 141_218);
  assert.equal(result.metrics.find((metric) => metric.id === "quickRatio")?.canonicalEvidenceId, "CE-147");
});

test("CE-151, CE-152, and CE-171 use consecutive average balances", async () => {
  const result = await evaluateInputs({
    ...microsoftFiscal2025,
    netIncome: 20,
    beginningTotalAssets: 80,
    endingTotalAssets: 120,
    beginningShareholdersEquity: 40,
    endingShareholdersEquity: 60,
  });
  near(metricValue(result, "returnOnAssets"), 20);
  near(metricValue(result, "returnOnEquity"), 40);
  near(metricValue(result, "financialLeverage"), 2);
});

test("CE-117 book value and CE-106 enterprise value include senior interests", async () => {
  const result = await evaluateInputs({
    ...microsoftFiscal2025,
    endingShareholdersEquity: 1_000,
    preferredEquity: 100,
    minorityInterest: 50,
    sharesOutstanding: 100,
    sharePrice: 20,
    totalDebt: 300,
    cashAndCashEquivalents: 200,
  });
  near(Number(result.derived.bookValue), 900);
  near(Number(result.derived.enterpriseValue), 2_250);
  near(metricValue(result, "priceToBook"), 20 / 9);
});

test("CE-124 rejects a combined D&A disclosure and accepts separate inputs", async () => {
  const blocked = await evaluateInputs(microsoftFiscal2025);
  assert.equal(blocked.metrics.some((metric) => metric.id === "evToEbitda"), false);
  assert.equal(blocked.derived.depreciationAmortizationCombined, undefined);
  const complete = await evaluateInputs({
    ...microsoftFiscal2025,
    depreciation: 30_000,
    amortization: 4_153,
  });
  assert.equal(complete.metrics.some((metric) => metric.id === "evToEbitda"), true);
  near(Number(complete.derived.ebitda), 128_528 + 30_000 + 4_153);
});

test("published metrics carry CE, calculation, and structured validation metadata", async () => {
  const result = await evaluateInputs(microsoftFiscal2025);
  const roa = result.metrics.find((metric) => metric.id === "returnOnAssets");
  assert.equal(roa.canonicalEvidenceId, "CE-151");
  assert.equal(roa.calculationId, "returnOnAssets");
  assert.equal(roa.calculationVersion, "1.0.0");
  assert.equal(roa.validation.status, "ValidWithGovernanceNotice");
  assert.ok(roa.validation.outcomes.some((outcome) => outcome.code === "PeriodRule"));
  assert.ok(canonicalRegistryIssues.some((issue) => issue.id === "DOC-CE-161-TITLE-CONFLICT"));
});
