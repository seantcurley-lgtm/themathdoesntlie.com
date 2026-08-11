import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateInputs,
  microsoftFiscal2025,
  renderMarkdown,
  validateInputs,
} from "../lib/evidence-engine.mjs";
import {
  GENERAL_OPERATING_COMPANY_PROFILE,
  scoringRules,
} from "../lib/evidence-scoring.mjs";

const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );

test("Microsoft FY2025 produces the controlled canonical v6.4 baseline", async () => {
  const result = await evaluateInputs(microsoftFiscal2025);

  assert.equal(result.metrics.length, 29);
  assert.deepEqual(
    result.families.map((family) => family.status),
    ["Complete", "Complete", "Complete", "Complete", "Complete", "Partial"],
  );
  assert.equal(result.families.find((family) => family.family === "Leverage")?.metricCount, 5);
  assert.equal(
    result.fingerprint,
    "337e3991a9970b82105e3686ea45eebbf18fd2abd4b62f4bedfa02786fe2d5d3",
  );
  assert.equal(result.scoring.status, "Scored");
  assert.equal(result.scoring.overallScore, "83.70");
  assert.equal(result.scoring.maximumScore, "87.70");
  assert.equal(result.scoring.coveragePercent, "96.00");
  assert.equal(result.scoring.tier, "Tier A");
  assert.equal(result.scoring.rulesScored, 19);
  assert.equal(result.unavailableMetrics[0].id, "evToEbitda");
  assert.equal(result.reportingPeriod.actualDayCount, 365);
  assert.equal(result.calculationRegistryVersion, "1.0.0");

  const value = (id) => result.metrics.find((metric) => metric.id === id)?.value;
  near(value("dso"), 82.15946280757053);
  near(value("ccc"), -16.613407818973627);
  near(value("currentRatio"), 1.3534464445042416);
  near(value("grossMargin"), 68.8237423861652);
  near(value("freeCashFlow"), 71611);
  near(value("priceToEarnings"), 36.17815249266862);
  near(value("interestCoverage"), 53.89014675052411);
  near(value("returnOnAssets"), 18.004784443662557);
  near(value("returnOnEquity"), 33.28082411153743);
  near(value("financialLeverage"), 1.848443352136428);
});

test("missing governed interest expense preserves a partial leverage family", async () => {
  const result = await evaluateInputs({ ...microsoftFiscal2025, interestExpense: 0 });
  assert.equal(result.metrics.length, 28);
  assert.equal(result.families.find((family) => family.family === "Leverage")?.status, "Partial");
  assert.equal(
    result.families.find((family) => family.family === "Leverage")?.reason,
    "MissingGovernedInput",
  );
  assert.equal(result.scoring.status, "Scored");
  assert.equal(result.scoring.overallScore, "77.70");
  assert.equal(result.scoring.maximumScore, "87.70");
  assert.equal(result.scoring.coveragePercent, "90.00");
});

test("nonpositive equity is scored as observed adverse evidence instead of missing coverage", async () => {
  const result = await evaluateInputs({
    ...microsoftFiscal2025,
    beginningShareholdersEquity: -90_000,
    endingShareholdersEquity: -100_000,
  });
  const returnOnEquity = result.scoring.rules.find((rule) => rule.metricId === "returnOnEquity");
  const debtToEquity = result.scoring.rules.find((rule) => rule.metricId === "debtToEquity");

  assert.equal(returnOnEquity?.status, "Scored");
  assert.equal(returnOnEquity?.tierScore, "0.00");
  assert.equal(returnOnEquity?.matchedBand, "Nonpositive equity");
  assert.match(returnOnEquity?.rationale ?? "", /observed adverse evidence/i);
  assert.equal(debtToEquity?.status, "Scored");
  assert.equal(debtToEquity?.tierScore, "0.00");
  assert.equal(result.scoring.coveragePercent, "96.00");
  assert.equal(result.scoring.status, "Scored");
});

test("reported negative minority interest retains its sign and remains calculable", async () => {
  const result = await evaluateInputs({ ...microsoftFiscal2025, minorityInterest: -125 });
  assert.equal(result.inputs.minorityInterest, -125);
  assert.ok(Number.isFinite(Number(result.derived.enterpriseValue)));
});

test("identical inputs reproduce the fingerprint", async () => {
  const first = await evaluateInputs({ ...microsoftFiscal2025 });
  const second = await evaluateInputs({ ...microsoftFiscal2025 });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.metrics, second.metrics);
});

test("revenue changes propagate only through dependent calculations", async () => {
  const baseline = await evaluateInputs(microsoftFiscal2025);
  const changed = await evaluateInputs({ ...microsoftFiscal2025, revenue: 300000 });
  const byId = (result, id) => result.metrics.find((metric) => metric.id === id)?.value;

  assert.notEqual(byId(changed, "dso"), byId(baseline, "dso"));
  assert.notEqual(byId(changed, "grossMargin"), byId(baseline, "grossMargin"));
  assert.notEqual(byId(changed, "priceToSales"), byId(baseline, "priceToSales"));
  assert.equal(byId(changed, "currentRatio"), byId(baseline, "currentRatio"));
  assert.notEqual(changed.fingerprint, baseline.fingerprint);
});

test("a zero denominator withholds only dependent measurements", async () => {
  const invalid = { ...microsoftFiscal2025, revenue: 0 };
  assert.equal(validateInputs(invalid).revenue, undefined);
  const result = await evaluateInputs(invalid);
  assert.equal(result.metrics.some((metric) => metric.id === "dso"), false);
  assert.equal(result.metrics.some((metric) => metric.id === "currentRatio"), true);
  assert.equal(
    result.unavailableMetrics.find((metric) => metric.id === "dso")?.reason,
    "ZeroDenominator",
  );
});

test("specialized-company gaps publish partial and unavailable families", async () => {
  const specialized = {
    ...microsoftFiscal2025,
    companyName: "Realty Income Corporation",
    ticker: "O",
    companyClassification: {
      sic: "6798",
      sicDescription: "Real Estate Investment Trusts",
      source: "SEC Submissions",
    },
    costOfRevenue: null,
    beginningInventory: null,
    endingInventory: null,
    beginningAccountsPayable: null,
    endingAccountsPayable: null,
    currentAssets: null,
    currentLiabilities: null,
    grossProfit: null,
    operatingIncome: null,
    totalDebt: null,
    capitalExpenditures: null,
  };
  const result = await evaluateInputs(specialized);
  assert.equal(result.metrics.length, 12);
  assert.equal(result.families.find((family) => family.family === "Liquidity")?.status, "Unavailable");
  assert.equal(result.families.find((family) => family.family === "Profitability")?.status, "Partial");
  assert.equal(result.unavailableMetrics.length, 18);
  assert.equal(result.scoring.status, "NotApplicable");
  assert.equal(result.scoring.overallScore, null);
  assert.match(result.scoring.classification.reason, /specialized scoring profile/i);
  assert.match(renderMarkdown(result), /## Unavailable measurements/);
});

test("scoring policy is complete, weighted to 100, and point-auditable", async () => {
  assert.equal(scoringRules.length, 20);
  assert.equal(
    scoringRules.reduce((total, rule) => total + rule.weight, 0),
    GENERAL_OPERATING_COMPANY_PROFILE.totalWeight,
  );
  const result = await evaluateInputs(microsoftFiscal2025);
  assert.equal(result.scoring.rules.length, 20);
  assert.equal(
    result.scoring.rules.reduce((total, rule) => total + Number(rule.awardedPoints), 0),
    Number(result.scoring.earnedPoints),
  );
  assert.ok(result.scoring.rules.every((rule) => rule.policy && rule.rationale));
});

test("missing SEC industry classification withholds the operating-company score", async () => {
  const result = await evaluateInputs({
    ...microsoftFiscal2025,
    companyClassification: undefined,
  });
  assert.equal(result.scoring.status, "Unclassified");
  assert.equal(result.scoring.overallScore, null);
  assert.match(result.scoring.classification.reason, /SIC classification is required/i);
});

test("published Markdown preserves status, measurements, and source links", async () => {
  const report = renderMarkdown(await evaluateInputs(microsoftFiscal2025));
  assert.match(report, /\| Leverage \| Complete \| 5 \|/);
  assert.match(report, /\| Leverage \| Interest Coverage \|/);
  assert.match(report, /\| Efficiency \| Days Sales Outstanding \|/);
  assert.match(report, /## Governed score/);
  assert.match(report, /Conservative score: \*\*83\.70 \/ 100\*\*/);
  assert.match(report, /Canonical registry: 1\.0\.0/);
  assert.match(report, /CE-151 \| returnOnAssets@1\.0\.0/);
  assert.match(report, /### Point audit/);
  assert.match(report, /https:\/\/www\.sec\.gov\/Archives/);
  assert.match(report, /not a ranking, price target, or investment recommendation/i);
});
