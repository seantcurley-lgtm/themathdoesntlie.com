import assert from "node:assert/strict";
import test from "node:test";

import {
  applyEvidenceResolutionDecisions,
  EVIDENCE_RESOLUTION_VERSION,
  REVIEW_DECISION_ACTIONS,
  extractInlineXbrlFacts,
  resolveMissingFilingEvidence,
} from "../lib/evidence-resolution.mjs";
import { evaluateInputs } from "../lib/evidence-engine.mjs";

const filing = {
  form: "10-K",
  accessionNumber: "0000000001-25-000001",
  filingDate: "2025-10-31",
  reportDate: "2025-09-27",
  filingUrl: "https://www.sec.gov/Archives/edgar/data/1/filing.htm",
};

const durationContext = `
  <xbrli:context id="FY2025">
    <xbrli:entity><xbrli:identifier scheme="test">1</xbrli:identifier></xbrli:entity>
    <xbrli:period><xbrli:startDate>2024-09-29</xbrli:startDate><xbrli:endDate>2025-09-27</xbrli:endDate></xbrli:period>
  </xbrli:context>`;

function fixtureHtml(factMarkup = "") {
  return `<html><body>${durationContext}${factMarkup}</body></html>`;
}

function unresolvedInterest() {
  return {
    inputs: { interestExpense: null },
    evidence: {
      interestExpense: {
        field: "interestExpense",
        label: "Interest expense",
        status: "Missing",
        method: "standardized-concept-unavailable",
        reason: "Company Facts did not establish the field.",
      },
    },
  };
}

function reviewFixture(field, candidates, allowedDecisionActions) {
  return {
    [field]: null,
    inputEvidence: {
      [field]: {
        field,
        label: field,
        status: "ReviewRequired",
        method: "inline-xbrl-candidates",
      },
    },
    evidenceResolutionCases: [{
      field,
      label: field,
      outcome: "ReviewRequired",
      candidates,
      allowedDecisionActions,
    }],
  };
}

function candidate(id, value, overrides = {}) {
  return {
    id,
    taxonomy: "us-gaap",
    concept: id,
    qualifiedConcept: `us-gaap:${id}`,
    reportedValue: value * 1_000_000,
    normalizedValue: value,
    displayUnit: "USD millions",
    unitRef: "USD",
    start: null,
    end: filing.reportDate,
    filed: filing.filingDate,
    accessionNumber: filing.accessionNumber,
    form: filing.form,
    sourceUrl: filing.filingUrl,
    sourceLocation: `${filing.filingUrl}#${id}`,
    ...overrides,
  };
}

test("Inline XBRL parser reads governed numeric facts and contexts", () => {
  const facts = extractInlineXbrlFacts(
    fixtureHtml(
      '<ix:nonFraction id="ie1" name="us-gaap:InterestExpenseNonOperating" contextRef="FY2025" unitRef="USD" scale="6">1,250</ix:nonFraction>',
    ),
  );
  assert.equal(facts.length, 1);
  assert.equal(facts[0].sourceValue, 1_250_000_000);
  assert.equal(facts[0].start, "2024-09-29");
  assert.equal(facts[0].end, "2025-09-27");
});

test("an exact standard filing concept resolves after Company Facts is incomplete", () => {
  const { inputs, evidence } = unresolvedInterest();
  const result = resolveMissingFilingEvidence({
    html: fixtureHtml(
      '<ix:nonFraction id="ie1" name="us-gaap:InterestExpenseNonOperating" contextRef="FY2025" unitRef="USD" scale="6">1,250</ix:nonFraction>',
    ),
    filing,
    inputs,
    evidence,
  });

  assert.equal(inputs.interestExpense, 1_250);
  assert.equal(evidence.interestExpense.status, "Review");
  assert.equal(evidence.interestExpense.method, "inline-xbrl-reported");
  assert.equal(result.resolvedFromFiling, 1);
  assert.equal(result.cases[0].outcome, "MappedFallback");
  assert.equal(evidence.interestExpense.priorEvidence.status, "Missing");
});

test("issuer extensions become ReviewRequired and a governed decision preserves the audit record", () => {
  const { inputs, evidence } = unresolvedInterest();
  const resolution = resolveMissingFilingEvidence({
    html: fixtureHtml(
      '<ix:nonFraction id="custom-ie" name="fixture:InterestAndFinancingCosts" contextRef="FY2025" unitRef="USD" scale="6">975</ix:nonFraction>',
    ),
    filing,
    inputs,
    evidence,
  });
  inputs.inputEvidence = evidence;
  inputs.evidenceResolutionCases = resolution.cases;

  assert.equal(evidence.interestExpense.status, "ReviewRequired");
  const candidate = resolution.cases[0].candidates[0];
  const applied = applyEvidenceResolutionDecisions(inputs, [
    {
      field: "interestExpense",
      selectedCandidateId: candidate.id,
      reviewer: "AB",
      reviewedAt: "2026-08-05T12:00:00.000Z",
      rationale: "The note labels this as the consolidated annual financing cost.",
    },
  ]);

  assert.deepEqual(applied.errors, []);
  assert.equal(applied.inputs.interestExpense, 975);
  assert.equal(applied.inputs.inputEvidence.interestExpense.status, "Review");
  assert.equal(
    applied.inputs.inputEvidence.interestExpense.reviewDecision.reviewPolicyVersion,
    EVIDENCE_RESOLUTION_VERSION,
  );
  assert.equal(applied.inputs.inputEvidence.interestExpense.priorEvidence.status, "ReviewRequired");
  assert.deepEqual(
    applied.inputs.inputEvidence.interestExpense.reviewDecision.candidateRecordsExamined,
    [candidate.id],
  );
});

test("missing evidence and collection failure remain distinct classifications", () => {
  const missing = unresolvedInterest();
  const missingResult = resolveMissingFilingEvidence({
    html: fixtureHtml(),
    filing,
    inputs: missing.inputs,
    evidence: missing.evidence,
  });
  assert.equal(missing.evidence.interestExpense.status, "Missing");
  assert.equal(missingResult.cases[0].outcome, "MissingEvidence");

  const failed = unresolvedInterest();
  const failedResult = resolveMissingFilingEvidence({
    html: null,
    filing,
    inputs: failed.inputs,
    evidence: failed.evidence,
    collectionError: "Official filing returned HTTP 403.",
  });
  assert.equal(failed.evidence.interestExpense.status, "CollectionFailure");
  assert.equal(failedResult.cases[0].outcome, "CollectionFailure");
});

test("nonoperating income cannot become an Operating Income candidate", () => {
  const inputs = { operatingIncome: null };
  const evidence = {
    operatingIncome: {
      field: "operatingIncome",
      label: "Operating income / EBIT",
      status: "Missing",
      method: "standardized-concept-unavailable",
      reason: "Company Facts did not establish the field.",
    },
  };
  const result = resolveMissingFilingEvidence({
    html: fixtureHtml(
      '<ix:nonFraction id="noi" name="us-gaap:OtherNonoperatingIncomeExpense" contextRef="FY2025" unitRef="USD" scale="6">125</ix:nonFraction>',
    ),
    filing,
    inputs,
    evidence,
  });

  assert.equal(inputs.operatingIncome, null);
  assert.equal(evidence.operatingIncome.status, "Missing");
  assert.equal(result.cases[0].outcome, "MissingEvidence");
  assert.deepEqual(result.cases[0].candidates, []);
});

test("issuer-reported Operating Profit remains reviewable but is not auto-accepted", () => {
  const inputs = { operatingIncome: null };
  const evidence = {
    operatingIncome: {
      field: "operatingIncome",
      label: "Operating income / EBIT",
      status: "Missing",
      method: "standardized-concept-unavailable",
      reason: "Company Facts did not establish the field.",
    },
  };
  const result = resolveMissingFilingEvidence({
    html: fixtureHtml(
      '<ix:nonFraction id="op" name="fixture:OperatingProfit" contextRef="FY2025" unitRef="USD" scale="6">500</ix:nonFraction>',
    ),
    filing,
    inputs,
    evidence,
  });

  assert.equal(inputs.operatingIncome, null);
  assert.equal(evidence.operatingIncome.status, "ReviewRequired");
  assert.equal(result.cases[0].candidates[0].concept, "OperatingProfit");
});

test("review rationale is governed fingerprint content", async () => {
  const { inputs, evidence } = unresolvedInterest();
  const resolution = resolveMissingFilingEvidence({
    html: fixtureHtml(
      '<ix:nonFraction id="custom-ie" name="fixture:InterestAndFinancingCosts" contextRef="FY2025" unitRef="USD" scale="6">975</ix:nonFraction>',
    ),
    filing,
    inputs,
    evidence,
  });
  const base = {
    companyName: "Fixture Corporation",
    ticker: "TEST",
    periodStart: "2024-09-29",
    periodEnd: filing.reportDate,
    accessionNumber: filing.accessionNumber,
    filingDate: filing.filingDate,
    filingUrl: filing.filingUrl,
    reportingCurrency: "USD",
    unitScale: "Millions",
    sharePrice: 10,
    marketObservationDate: "2025-09-27",
    marketUrl: "https://example.com/market",
    inputEvidence: evidence,
    evidenceResolutionCases: resolution.cases,
    evidenceResolutionVersion: EVIDENCE_RESOLUTION_VERSION,
  };
  const candidate = resolution.cases[0].candidates[0];
  const decide = (rationale) => applyEvidenceResolutionDecisions(base, [{
    field: "interestExpense",
    selectedCandidateId: candidate.id,
    reviewer: "AB",
    reviewedAt: "2026-08-05T12:00:00.000Z",
    rationale,
  }]).inputs;

  const first = await evaluateInputs(decide("Consolidated annual financing cost."));
  const second = await evaluateInputs(decide("Consolidated annual interest and financing cost."));
  assert.notEqual(first.fingerprint, second.fingerprint);
});

test("optional canonical evidence can reject all false candidates and record governed zero", () => {
  const candidates = [candidate("BusinessAcquisitionsMinorityInterest", 440)];
  const inputs = reviewFixture("minorityInterest", candidates, [
    REVIEW_DECISION_ACTIONS.ACCEPT_CANDIDATE,
    REVIEW_DECISION_ACTIONS.REJECT_ALL_NOT_REPORTED_ZERO,
  ]);
  const result = applyEvidenceResolutionDecisions(inputs, [{
    field: "minorityInterest",
    action: REVIEW_DECISION_ACTIONS.REJECT_ALL_NOT_REPORTED_ZERO,
    reviewer: "QA",
    reviewedAt: "2026-08-08T12:00:00.000Z",
    rationale: "The candidate is an acquisition disclosure, not a separately reported EV component.",
  }]);

  assert.deepEqual(result.errors, []);
  assert.equal(result.inputs.minorityInterest, 0);
  assert.equal(result.inputs.inputEvidence.minorityInterest.status, "NotReported");
  assert.equal(result.inputs.resolutionDecisions[0].decision, "RejectedAllNotReportedZero");
  assert.deepEqual(result.inputs.resolutionDecisions[0].candidateRecordsExamined, [candidates[0].id]);
  assert.deepEqual(result.inputs.resolutionDecisions[0].selectedCandidateIds, []);
});

test("required evidence cannot be converted to zero by rejection", () => {
  const candidates = [candidate("InterestAndFinancingCosts", 975, { start: "2024-09-29" })];
  const inputs = reviewFixture("interestExpense", candidates, [
    REVIEW_DECISION_ACTIONS.ACCEPT_CANDIDATE,
  ]);
  const result = applyEvidenceResolutionDecisions(inputs, [{
    field: "interestExpense",
    action: REVIEW_DECISION_ACTIONS.REJECT_ALL_NOT_REPORTED_ZERO,
    reviewer: "QA",
    reviewedAt: "2026-08-08T12:00:00.000Z",
    rationale: "Attempted invalid zero decision.",
  }]);

  assert.equal(result.inputs.interestExpense, null);
  assert.match(result.errors[0].reason, /not permitted/);
});

test("share classes cannot be aggregated before CE-103 multi-class governance exists", () => {
  const candidates = [
    candidate("ClassACommonStock", 40, { displayUnit: "millions of shares", unitRef: "shares" }),
    candidate("ClassBCommonStock", 12, { displayUnit: "millions of shares", unitRef: "shares" }),
  ];
  const inputs = reviewFixture("sharesOutstanding", candidates, [
    REVIEW_DECISION_ACTIONS.ACCEPT_CANDIDATE,
    REVIEW_DECISION_ACTIONS.AGGREGATE_CANDIDATES,
  ]);
  const result = applyEvidenceResolutionDecisions(inputs, [{
    field: "sharesOutstanding",
    action: REVIEW_DECISION_ACTIONS.AGGREGATE_CANDIDATES,
    selectedCandidateIds: candidates.map((item) => item.id),
    reviewer: "QA",
    reviewedAt: "2026-08-08T12:00:00.000Z",
    rationale: "The two non-overlapping share classes compose total shares outstanding.",
  }]);

  assert.equal(result.inputs.sharesOutstanding, null);
  assert.match(result.errors[0].reason, /not permitted/);
});

test("aggregation remains prohibited for non-additive governed fields", () => {
  const candidates = [candidate("PreferredStockA", 10), candidate("PreferredStockB", 5)];
  const inputs = reviewFixture("preferredEquity", candidates, [
    REVIEW_DECISION_ACTIONS.ACCEPT_CANDIDATE,
    REVIEW_DECISION_ACTIONS.REJECT_ALL_NOT_REPORTED_ZERO,
  ]);
  const result = applyEvidenceResolutionDecisions(inputs, [{
    field: "preferredEquity",
    action: REVIEW_DECISION_ACTIONS.AGGREGATE_CANDIDATES,
    selectedCandidateIds: candidates.map((item) => item.id),
    reviewer: "QA",
    reviewedAt: "2026-08-08T12:00:00.000Z",
    rationale: "Attempted invalid aggregation.",
  }]);

  assert.match(result.errors[0].reason, /not permitted/);
});
