import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAcquisitionPackage,
  resolveTicker,
  selectLatestAnnualFiling,
} from "../lib/sec-xbrl.mjs";
import { resolveReportingPeriodStartFromFiling } from "../lib/evidence-resolution.mjs";
import { evaluateInputs, renderMarkdown } from "../lib/evidence-engine.mjs";

const accession = "0000000001-25-000001";

function fact(val, end, extra = {}) {
  return {
    val,
    end,
    accn: accession,
    form: "10-K",
    filed: "2025-10-31",
    fy: 2025,
    fp: "FY",
    ...extra,
  };
}

function addConcept(target, taxonomy, concept, unit, facts) {
  target.facts[taxonomy] ??= {};
  target.facts[taxonomy][concept] = {
    label: concept,
    units: { [unit]: facts },
  };
}

function companyFactsFixture() {
  const target = { entityName: "Fixture Corporation", facts: { "us-gaap": {}, dei: {} } };
  const duration = { start: "2024-09-29" };
  addConcept(target, "us-gaap", "Revenues", "USD", [fact(100_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "CostOfRevenue", "USD", [fact(60_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "GrossProfit", "USD", [fact(40_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "OperatingIncomeLoss", "USD", [fact(20_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "NetIncomeLoss", "USD", [fact(15_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "NetCashProvidedByUsedInOperatingActivities", "USD", [fact(24_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "PaymentsToAcquirePropertyPlantAndEquipment", "USD", [fact(5_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "DepreciationDepletionAndAmortization", "USD", [fact(4_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "InterestExpenseNonOperating", "USD", [fact(1_000_000_000, "2025-09-27", duration)]);
  addConcept(target, "us-gaap", "EarningsPerShareDiluted", "USD/shares", [fact(15, "2025-09-27", duration)]);

  const instants = [
    ["AccountsReceivableNetCurrent", 12_000_000_000, 10_000_000_000],
    ["InventoryNet", 5_000_000_000, 4_000_000_000],
    ["AccountsPayableCurrent", 9_000_000_000, 8_000_000_000],
    ["AssetsCurrent", 50_000_000_000, 45_000_000_000],
    ["LiabilitiesCurrent", 25_000_000_000, 23_000_000_000],
    ["Assets", 150_000_000_000, 140_000_000_000],
    ["Liabilities", 70_000_000_000, 65_000_000_000],
    ["StockholdersEquity", 80_000_000_000, 75_000_000_000],
    ["CashAndCashEquivalentsAtCarryingValue", 20_000_000_000, 18_000_000_000],
    ["LongTermDebtCurrent", 2_000_000_000, 2_500_000_000],
    ["LongTermDebtNoncurrent", 8_000_000_000, 9_000_000_000],
  ];
  for (const [concept, current, prior] of instants) {
    addConcept(target, "us-gaap", concept, "USD", [
      fact(current, "2025-09-27"),
      fact(prior, "2024-09-28"),
    ]);
  }
  addConcept(target, "dei", "EntityCommonStockSharesOutstanding", "shares", [
    fact(1_000_000_000, "2025-10-17"),
  ]);
  return target;
}

const submissions = {
  name: "Fixture Corporation",
  sic: "3571",
  sicDescription: "Electronic Computers",
  exchanges: ["Nasdaq"],
  filings: {
    recent: {
      accessionNumber: [accession, "0000000001-24-000001"],
      filingDate: ["2025-10-31", "2024-11-01"],
      reportDate: ["2025-09-27", "2024-09-28"],
      form: ["10-K", "10-K"],
      primaryDocument: ["fixture-20250927.htm", "fixture-20240928.htm"],
    },
  },
};

test("ticker lookup normalizes SEC directory records", () => {
  const record = resolveTicker(
    { 0: { cik_str: 1, ticker: "TEST", title: "Fixture Corporation" } },
    "test",
  );
  assert.deepEqual(record, {
    ticker: "TEST",
    cik: "0000000001",
    title: "Fixture Corporation",
    directoryCik: "0000000001",
    continuity: null,
  });
});

test("governed entity continuity resolves an omitted ticker and successor annual filing CIK", () => {
  const aep = resolveTicker({ records: [] }, "AEP");
  assert.equal(aep.cik, "0000004904");
  assert.equal(aep.continuity.mode, "TickerDirectoryFallback");

  const xom = resolveTicker({ records: [{ cik_str: 2115436, ticker: "XOM", title: "ExxonMobil Holdings Corp" }] }, "XOM");
  assert.equal(xom.cik, "0000034088");
  assert.equal(xom.directoryCik, "0002115436");
  assert.equal(xom.continuity.mode, "PredecessorAnnualFiling");
});

test("reporting-period start resolves from the dominant annual Inline XBRL context", () => {
  const html = `<html><body>
    <xbrli:context id="annual"><xbrli:entity><xbrli:identifier scheme="test">1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
    <ix:nonFraction id="r1" name="custom:ReportedRevenue" contextRef="annual" unitRef="USD">100</ix:nonFraction>
    <ix:nonFraction id="r2" name="custom:ReportedIncome" contextRef="annual" unitRef="USD">20</ix:nonFraction>
  </body></html>`;
  const resolved = resolveReportingPeriodStartFromFiling(html, { reportDate: "2025-12-31" });
  assert.equal(resolved.start, "2025-01-01");
  assert.equal(resolved.supportingFactCount, 2);
});

test("latest supported annual filing is selected deterministically", () => {
  const filing = selectLatestAnnualFiling(submissions, "0000000001");
  assert.equal(filing.accessionNumber, accession);
  assert.equal(filing.reportDate, "2025-09-27");
  assert.equal(
    filing.filingUrl,
    "https://www.sec.gov/Archives/edgar/data/1/000000000125000001/fixture-20250927.htm",
  );
});

test("Company Facts map into a governed engine dataset with provenance", async () => {
  const result = buildAcquisitionPackage({
    tickerRecord: { ticker: "TEST", cik: "0000000001", title: "Fixture Corporation" },
    submissions,
    companyFacts: companyFactsFixture(),
  });

  assert.equal(result.inputs.revenue, 100_000);
  assert.equal(result.inputs.beginningAccountsReceivable, 10_000);
  assert.equal(result.inputs.endingAccountsReceivable, 12_000);
  assert.equal(result.inputs.periodStart, "2024-09-29");
  assert.equal(result.inputs.beginningTotalAssets, 140_000);
  assert.equal(result.inputs.endingTotalAssets, 150_000);
  assert.equal(result.inputs.beginningShareholdersEquity, 75_000);
  assert.equal(result.inputs.endingShareholdersEquity, 80_000);
  assert.equal(result.inputs.totalDebt, 10_000);
  assert.equal(result.inputs.sharesOutstanding, 1_000);
  assert.equal(result.inputs.interestExpense, 1_000);
  assert.equal(result.inputs.companyClassification.sic, "3571");
  assert.equal(result.inputs.companyClassification.sicDescription, "Electronic Computers");
  assert.equal(result.summary.missing, 0);
  assert.equal(result.summary.blocking, 0);
  assert.equal(result.summary.manual, 3);
  assert.equal(result.inputs.sharePrice, 0);
  assert.equal(
    result.inputs.inputEvidence.revenue.concept,
    "Revenues",
  );
  assert.match(result.warnings.join(" "), /market price/i);

  const evaluation = await evaluateInputs({
    ...result.inputs,
    sharePrice: 125,
    marketObservationDate: "2025-09-27",
    marketUrl: "https://example.com/market-evidence",
  });
  const markdown = renderMarkdown(evaluation);
  assert.match(markdown, /## Acquisition record/);
  assert.match(markdown, /us-gaap:Revenues/);

  const changedEvidence = {
    ...(result.inputs.inputEvidence),
    revenue: {
      ...result.inputs.inputEvidence.revenue,
      concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
    },
  };
  const changedProvenance = await evaluateInputs({
    ...result.inputs,
    inputEvidence: changedEvidence,
    sharePrice: 125,
    marketObservationDate: "2025-09-27",
    marketUrl: "https://example.com/market-evidence",
  });
  assert.notEqual(changedProvenance.fingerprint, evaluation.fingerprint);
});

test("optional components become governed zero only after the full source hierarchy is exhausted", async () => {
  const result = buildAcquisitionPackage({
    tickerRecord: { ticker: "TEST", cik: "0000000001", title: "Fixture Corporation" },
    submissions,
    companyFacts: companyFactsFixture(),
    inlineFilingHtml: "<html><body>No separately reported optional component.</body></html>",
  });

  for (const field of ["prepaidExpenses", "preferredEquity", "minorityInterest"]) {
    assert.equal(result.inputs[field], 0);
    assert.equal(result.inputs.inputEvidence[field].status, "NotReported");
    assert.equal(
      result.inputs.inputEvidence[field].method,
      "source-hierarchy-exhausted-optional-zero",
    );
  }
  assert.equal(result.inputs.depreciation, null);
  assert.equal(result.inputs.amortization, null);
  assert.equal(result.inputs.depreciationAmortizationCombined, 4_000);

  const evaluation = await evaluateInputs({
    ...result.inputs,
    sharePrice: 125,
    marketObservationDate: "2025-09-27",
    marketUrl: "https://example.com/market-evidence",
  });
  assert.equal(
    evaluation.unavailableMetrics.find((metric) => metric.id === "evToEbitda")?.reason,
    "CombinedDisclosureNotPermitted",
  );
});

test("inclusive current-maturity debt concept maps with review confidence", () => {
  const companyFacts = companyFactsFixture();
  delete companyFacts.facts["us-gaap"].LongTermDebtCurrent;
  delete companyFacts.facts["us-gaap"].LongTermDebtNoncurrent;
  addConcept(
    companyFacts,
    "us-gaap",
    "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities",
    "USD",
    [fact(43_941_000_000, "2025-09-27")],
  );
  const result = buildAcquisitionPackage({
    tickerRecord: { ticker: "KO", cik: "0000021344", title: "The Coca-Cola Company" },
    submissions,
    companyFacts,
  });
  assert.equal(result.inputs.totalDebt, 43_941);
  assert.equal(result.inputs.inputEvidence.totalDebt.status, "Review");
  assert.equal(
    result.inputs.inputEvidence.totalDebt.concept,
    "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities",
  );
});

test("CE-105 composes other current and noncurrent interest-bearing debt", () => {
  const companyFacts = companyFactsFixture();
  delete companyFacts.facts["us-gaap"].LongTermDebtCurrent;
  delete companyFacts.facts["us-gaap"].LongTermDebtNoncurrent;
  addConcept(companyFacts, "us-gaap", "OtherLongTermDebtCurrent", "USD", [
    fact(1_573_000_000, "2025-09-27"),
  ]);
  addConcept(companyFacts, "us-gaap", "OtherLongTermDebtNoncurrent", "USD", [
    fact(5_716_000_000, "2025-09-27"),
  ]);

  const result = buildAcquisitionPackage({
    tickerRecord: { ticker: "TEST", cik: "0000000001", title: "Fixture Corporation" },
    submissions,
    companyFacts,
  });

  assert.equal(result.inputs.totalDebt, 7_289);
  assert.equal(result.inputs.inputEvidence.totalDebt.status, "Derived");
  assert.deepEqual(result.inputs.inputEvidence.totalDebt.dependencies, [
    "us-gaap:OtherLongTermDebtCurrent",
    "us-gaap:OtherLongTermDebtNoncurrent",
  ]);
});

test("reported Cost of Services is a governed CE-164 alias", () => {
  const companyFacts = companyFactsFixture();
  delete companyFacts.facts["us-gaap"].CostOfRevenue;
  addConcept(companyFacts, "us-gaap", "CostOfServices", "USD", [
    fact(61_000_000_000, "2025-09-27", { start: "2024-09-29" }),
  ]);

  const result = buildAcquisitionPackage({
    tickerRecord: { ticker: "TEST", cik: "0000000001", title: "Fixture Corporation" },
    submissions,
    companyFacts,
  });

  assert.equal(result.inputs.costOfRevenue, 61_000);
  assert.equal(result.inputs.inputEvidence.costOfRevenue.concept, "CostOfServices");
  assert.equal(result.inputs.grossProfit, 40_000);
});

test("current standardized aliases recover interest and conservative prepaid evidence", () => {
  const companyFacts = companyFactsFixture();
  delete companyFacts.facts["us-gaap"].InterestExpenseNonOperating;
  addConcept(
    companyFacts,
    "us-gaap",
    "InterestExpenseNonoperating",
    "USD",
    [fact(2_274_000_000, "2025-09-27", { start: "2024-09-29" })],
  );
  addConcept(
    companyFacts,
    "us-gaap",
    "PrepaidExpenseAndOtherAssetsCurrent",
    "USD",
    [fact(6_900_000_000, "2025-09-27")],
  );

  const result = buildAcquisitionPackage({
    tickerRecord: { ticker: "AMZN", cik: "0001018724", title: "AMAZON COM INC" },
    submissions,
    companyFacts,
    inlineFilingError: "Official filing fallback returned HTTP 403.",
  });

  assert.equal(result.inputs.interestExpense, 2_274);
  assert.equal(result.inputs.inputEvidence.interestExpense.concept, "InterestExpenseNonoperating");
  assert.equal(result.inputs.prepaidExpenses, 6_900);
  assert.equal(result.inputs.inputEvidence.prepaidExpenses.status, "Review");
  assert.match(result.inputs.inputEvidence.prepaidExpenses.reason, /conservative quick-assets deduction/i);
});

test("explicit zero preferred shares govern preferred equity without filing fallback", async () => {
  const companyFacts = companyFactsFixture();
  addConcept(
    companyFacts,
    "us-gaap",
    "PrepaidExpenseAndOtherAssetsCurrent",
    "USD",
    [fact(1_000_000_000, "2025-09-27")],
  );
  addConcept(
    companyFacts,
    "us-gaap",
    "PreferredStockSharesOutstanding",
    "shares",
    [fact(0, "2025-09-27")],
  );

  const result = buildAcquisitionPackage({
    tickerRecord: { ticker: "SBUX", cik: "0000829224", title: "Starbucks Corporation" },
    submissions,
    companyFacts,
    inlineFilingError: "Official filing fallback returned HTTP 403.",
  });

  assert.equal(result.inputs.preferredEquity, 0);
  assert.equal(result.inputs.inputEvidence.preferredEquity.status, "NotReported");
  assert.equal(
    result.inputs.inputEvidence.preferredEquity.method,
    "explicit-standardized-zero-component",
  );
  assert.equal(result.inputs.inputEvidence.preferredEquity.reportedValue, 0);

  const evaluation = await evaluateInputs({
    ...result.inputs,
    sharePrice: 125,
    marketObservationDate: "2025-09-27",
    marketUrl: "https://example.com/market-evidence",
  });
  assert.equal(evaluation.scoring.status, "Scored");
  assert.ok(Number(evaluation.scoring.coveragePercent) >= 80);
});

test("unresolved standardized facts remain null and do not block partial evaluation", () => {
  const companyFacts = companyFactsFixture();
  delete companyFacts.facts["us-gaap"].InventoryNet;
  const result = buildAcquisitionPackage({
    tickerRecord: { ticker: "O", cik: "0000726728", title: "Realty Income Corporation" },
    submissions,
    companyFacts,
    inlineFilingHtml: "<html><body>No eligible inventory fact is reported.</body></html>",
  });
  assert.equal(result.inputs.endingInventory, null);
  assert.equal(result.inputs.beginningInventory, null);
  assert.equal(result.summary.blocking, 0);
  assert.equal(result.inputs.inputEvidence.endingInventory.status, "Missing");
});
