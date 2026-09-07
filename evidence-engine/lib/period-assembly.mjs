import Decimal from "decimal.js";

import {
  companyFactsDurationMappings,
  companyFactsInstantMappings,
  filingResolutionPolicies,
} from "./alias-registry.mjs";
import {
  metricPeriodCompatibility,
  PERIOD_COMPATIBILITY_VERSION,
  requestedCalculationIds,
} from "./calculation-registry.mjs";
import { evaluateInputs } from "./evidence-engine.mjs";
import { SCORING_VERSION, scoreEvaluation } from "./evidence-scoring.mjs";
import { canonicalEvaluationIdentity } from "./evaluation-identity.mjs";
import { sha256Text, stableSerialize } from "./longitudinal-state.mjs";

export const PERIOD_ASSEMBLY_VERSION = "1.0.0";
export const PERIOD_BASES = Object.freeze([
  "Instant",
  "FiscalQuarter",
  "FiscalYTD",
  "FiscalYear",
  "TrailingTwelveMonths",
]);

const DAY = 86_400_000;
const MILLION = 1_000_000;
const FLOW_FIELDS = companyFactsDurationMappings
  .map((mapping) => mapping.field)
  .filter((field) => field !== "dilutedEarningsPerShare");
const NUMERIC_INPUT_FIELDS = Object.freeze([
  "revenue", "costOfRevenue", "beginningAccountsReceivable", "endingAccountsReceivable",
  "beginningInventory", "endingInventory", "beginningAccountsPayable", "endingAccountsPayable",
  "currentAssets", "currentLiabilities", "grossProfit", "operatingIncome", "netIncome",
  "beginningTotalAssets", "endingTotalAssets", "totalLiabilities", "totalDebt",
  "beginningShareholdersEquity", "endingShareholdersEquity", "prepaidExpenses",
  "preferredEquity", "minorityInterest", "operatingCashFlow", "capitalExpenditures",
  "depreciation", "amortization", "depreciationAmortizationCombined",
  "cashAndCashEquivalents", "interestExpense", "sharesOutstanding",
  "dilutedEarningsPerShare",
]);

function isoDate(value, field) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${field} must be an ISO date.`);
  }
  return value;
}

function isoTimestamp(value, field) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO timestamp.`);
  }
  return new Date(value).toISOString();
}

function inclusiveDays(start, end) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 1;
}

function nextDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
}

export function classifyReportingContext({
  start = null,
  end,
  filingForm,
  reportDate,
  fiscalQuarter = null,
  fiscalYearStart = null,
  derivedBasis = null,
}) {
  isoDate(end, "end");
  if (derivedBasis === "TrailingTwelveMonths") {
    if (!start) throw new Error("A TTM context requires an exact start date.");
    return { periodBasis: "TrailingTwelveMonths", actualInclusiveDays: inclusiveDays(start, end) };
  }
  if (!start) return { periodBasis: "Instant", actualInclusiveDays: 1 };
  isoDate(start, "start");
  const days = inclusiveDays(start, end);
  if (filingForm === "10-K" && end === reportDate && days >= 300 && days <= 400) {
    return { periodBasis: "FiscalYear", actualInclusiveDays: days };
  }
  if (!["10-Q", "10-Q/A"].includes(filingForm)) {
    return { periodBasis: "Ambiguous", actualInclusiveDays: days };
  }
  if (fiscalYearStart && start === fiscalYearStart) {
    return { periodBasis: "FiscalYTD", actualInclusiveDays: days };
  }
  if (fiscalQuarter === 1 && days >= 70 && days <= 120) {
    return { periodBasis: "FiscalYTD", actualInclusiveDays: days };
  }
  if (fiscalQuarter === 2 && days >= 150 && days <= 220) {
    return { periodBasis: "FiscalYTD", actualInclusiveDays: days };
  }
  if (fiscalQuarter === 3 && days >= 230 && days <= 310) {
    return { periodBasis: "FiscalYTD", actualInclusiveDays: days };
  }
  if (days >= 70 && days <= 120) {
    return { periodBasis: "FiscalQuarter", actualInclusiveDays: days };
  }
  return { periodBasis: "Ambiguous", actualInclusiveDays: days };
}

async function evidenceId(item) {
  return `eei_${await sha256Text(stableSerialize({
    canonicalField: item.canonicalField,
    value: item.value,
    normalizedUnit: item.normalizedUnit,
    start: item.start,
    end: item.end,
    accessionNumber: item.accessionNumber,
    concept: item.concept,
    periodBasis: item.periodBasis,
    transformationId: item.transformationId ?? null,
    componentEvidenceIds: item.componentEvidenceIds ?? [],
  }))}`;
}

async function finalizeEvidence(item) {
  return { ...item, evidenceItemId: item.evidenceItemId ?? await evidenceId(item) };
}

function requireKnown(item, resultKnownAt) {
  const known = isoTimestamp(item.knownAt, `${item.canonicalField}.knownAt`);
  if (known > resultKnownAt) throw new Error(`${item.canonicalField} was not known by the Result knownAt.`);
}

function intervalContains(outer, inner) {
  return outer.start <= inner.start && outer.end >= inner.end;
}

export async function assembleTtmEvidence({
  canonicalField,
  fiscalYear,
  currentYtd,
  priorYearYtd,
  resultKnownAt,
}) {
  const knownAt = isoTimestamp(resultKnownAt, "resultKnownAt");
  const components = [fiscalYear, currentYtd, priorYearYtd];
  for (const item of components) {
    if (!item || item.canonicalField !== canonicalField) throw new Error("TTM components must share the canonical field.");
    if (!item.evidenceItemId || !item.accessionNumber) throw new Error("TTM components require stable evidence and accession identities.");
    requireKnown(item, knownAt);
  }
  if (fiscalYear.periodBasis !== "FiscalYear" || currentYtd.periodBasis !== "FiscalYTD" || priorYearYtd.periodBasis !== "FiscalYTD") {
    throw new Error("TTM requires one fiscal-year and two fiscal-YTD components.");
  }
  for (const key of ["normalizedUnit", "signConvention", "entityScope", "concept"]) {
    if (new Set(components.map((item) => item[key])).size !== 1) {
      throw new Error(`TTM ${key} is incompatible across components.`);
    }
  }
  if (currentYtd.fiscalQuarter !== priorYearYtd.fiscalQuarter) throw new Error("TTM fiscal ordinals are incompatible.");
  if (fiscalYear.fiscalYear !== priorYearYtd.fiscalYear || currentYtd.fiscalYear !== fiscalYear.fiscalYear + 1) {
    throw new Error("TTM fiscal-year identities are incompatible.");
  }
  if (nextDate(fiscalYear.end) !== currentYtd.start) throw new Error("TTM components contain an unexplained gap or overlap at the fiscal-year boundary.");
  if (!intervalContains(fiscalYear, priorYearYtd) || priorYearYtd.start !== fiscalYear.start) {
    throw new Error("The comparable prior-year YTD period must be contained at the start of the fiscal year.");
  }
  const currentDays = inclusiveDays(currentYtd.start, currentYtd.end);
  const priorDays = inclusiveDays(priorYearYtd.start, priorYearYtd.end);
  if (Math.abs(currentDays - priorDays) > 7) throw new Error("The current and comparable YTD fiscal calendars are incompatible.");
  const start = nextDate(priorYearYtd.end);
  const end = currentYtd.end;
  const value = new Decimal(fiscalYear.value).plus(currentYtd.value).minus(priorYearYtd.value);
  if (!value.isFinite()) throw new Error("TTM arithmetic did not produce a finite value.");
  return finalizeEvidence({
    canonicalField,
    value: value.toNumber(),
    normalizedUnit: fiscalYear.normalizedUnit,
    signConvention: fiscalYear.signConvention,
    entityScope: fiscalYear.entityScope,
    periodBasis: "TrailingTwelveMonths",
    start,
    end,
    actualInclusiveDays: inclusiveDays(start, end),
    fiscalYear: currentYtd.fiscalYear,
    fiscalQuarter: currentYtd.fiscalQuarter,
    evidenceStatus: "transformed",
    status: "Derived",
    method: "fiscal-year-plus-current-ytd-minus-prior-ytd",
    concept: fiscalYear.concept,
    taxonomy: fiscalYear.taxonomy,
    reportedUnit: fiscalYear.reportedUnit,
    accessionNumber: currentYtd.accessionNumber,
    form: currentYtd.form,
    filed: currentYtd.filed,
    knownAt,
    sourceManifestReference: null,
    transformationId: "TTM-FY-PLUS-CYTD-MINUS-PYTD",
    transformationVersion: PERIOD_ASSEMBLY_VERSION,
    componentEvidenceIds: components.map((item) => item.evidenceItemId),
    components: components.map((item) => ({
      evidenceItemId: item.evidenceItemId,
      operation: item === priorYearYtd ? "Subtract" : "Add",
      value: item.value,
    })),
    componentEvidence: components,
  });
}

export function selectComparablePriorQuarterBalance({ current, candidates }) {
  if (!current || current.periodBasis !== "Instant" || !current.fiscalQuarter) {
    throw new Error("A current quarter-end instant with a fiscal ordinal is required.");
  }
  const balanceIdentity = (field) => String(field).replace(/^(beginning|ending)/, "");
  const matches = candidates.filter((item) =>
    item.periodBasis === "Instant" &&
    balanceIdentity(item.canonicalField) === balanceIdentity(current.canonicalField) &&
    item.normalizedUnit === current.normalizedUnit &&
    item.entityScope === current.entityScope &&
    item.concept === current.concept &&
    item.fiscalQuarter === current.fiscalQuarter &&
    item.fiscalYear === current.fiscalYear - 1,
  );
  if (matches.length !== 1) throw new Error("Exactly one compatible prior-year quarter-end balance is required.");
  const distance = Math.abs(inclusiveDays(matches[0].end, current.end));
  if (distance < 350 || distance > 380) throw new Error("Comparable quarter-end balance dates are incompatible.");
  return matches[0];
}

export function overlayAmendmentEvidence({ originalItems, amendmentItems, originalAccession, amendment }) {
  if (amendment.form !== "10-Q/A" || amendment.accessionNumber === originalAccession || amendment.amendsAccessionNumber !== originalAccession) {
    throw new Error("A distinct, unambiguous 10-Q/A relationship is required.");
  }
  const byField = new Map(originalItems.map((item) => [item.canonicalField, item]));
  for (const item of amendmentItems) {
    if (item.accessionNumber !== amendment.accessionNumber) throw new Error("Amendment evidence must use the amendment accession.");
    byField.set(item.canonicalField, { ...item, sourceRole: "AmendmentOverlay", amendsAccessionNumber: originalAccession });
  }
  return [...byField.values()];
}

export function detectSourceRepresentationChange(previous, current) {
  if (!previous || previous.accessionNumber !== current.accessionNumber) return { status: "NewSource" };
  if (previous.contentHash === current.contentHash) return { status: "Unchanged" };
  return { status: "ReviewRequired", reason: "SameAccessionSourceMutation" };
}

export async function sourceRepresentationHashForAccessions(companyFacts, accessionNumbers) {
  const accepted = new Set(accessionNumbers.filter(Boolean));
  const rows = [];
  for (const [taxonomy, concepts] of Object.entries(companyFacts?.facts ?? {})) {
    for (const [concept, record] of Object.entries(concepts ?? {})) {
      for (const [unit, facts] of Object.entries(record?.units ?? {})) {
        for (const fact of facts) {
          if (accepted.has(fact.accn)) rows.push({ taxonomy, concept, unit, ...fact });
        }
      }
    }
  }
  return sha256Text(stableSerialize(rows.sort((left, right) => stableSerialize(left).localeCompare(stableSerialize(right)))));
}

function allConceptFacts(companyFacts, taxonomy, concept) {
  const units = companyFacts?.facts?.[taxonomy]?.[concept]?.units ?? {};
  return Object.entries(units).flatMap(([unit, facts]) => facts.map((fact) => ({ ...fact, unit, taxonomy, concept })));
}

function scaledValue(fact, mapping) {
  const numeric = Number(fact?.val);
  if (!Number.isFinite(numeric)) return null;
  const value = mapping.absolute ? Math.abs(numeric) : numeric;
  return mapping.scale === "per-share" ? value : value / MILLION;
}

function fiscalQuarterOf(fact) {
  const match = /^Q([1-3])$/.exec(String(fact?.fp ?? ""));
  return match ? Number(match[1]) : null;
}

function isFiscalYtdFact(fact, quarter) {
  if (!fact.start || fiscalQuarterOf(fact) !== quarter) return false;
  return classifyReportingContext({
    start: fact.start,
    end: fact.end,
    filingForm: fact.form,
    reportDate: fact.end,
    fiscalQuarter: quarter,
  }).periodBasis === "FiscalYTD";
}

function unitAllowed(mapping, fact) {
  if (mapping.scale === "per-share") return ["USD/shares", "USD / shares"].includes(fact.unit);
  if (mapping.scale === "shares") return fact.unit === "shares";
  return fact.unit === "USD";
}

function factForAccession(facts, accession, predicate) {
  const matches = facts.filter((fact) => fact.accn === accession && predicate(fact));
  const identities = new Set(matches.map((fact) => stableSerialize({
    val: fact.val,
    unit: fact.unit,
    start: fact.start ?? null,
    end: fact.end,
    form: fact.form,
    concept: fact.concept,
  })));
  if (identities.size > 1) {
    const detail = matches.map((fact) => ({
      concept: fact.concept,
      unit: fact.unit,
      value: fact.val,
      start: fact.start ?? null,
      end: fact.end,
      form: fact.form,
      fiscalPeriod: fact.fp ?? null,
    }));
    throw new Error(`Conflicting same-accession facts share an otherwise eligible governed context: accession ${accession}, candidates ${stableSerialize(detail)}.`);
  }
  return matches.sort((left, right) => String(right.filed ?? "").localeCompare(String(left.filed ?? "")))[0] ?? null;
}

async function observedEvidence({ field, fact, mapping, filing, securityId, knownAt, periodBasis, sourceRole, fiscalYear = null, fiscalQuarter = null }) {
  const value = scaledValue(fact, mapping);
  if (value === null) return null;
  return finalizeEvidence({
    canonicalField: field,
    field,
    value,
    normalizedUnit: mapping.scale === "per-share" ? "USD/share" : "USD millions",
    signConvention: mapping.absolute ? "Absolute" : "Reported",
    entityScope: "ConsolidatedEntity",
    periodBasis,
    start: fact.start ?? null,
    end: fact.end,
    actualInclusiveDays: fact.start ? inclusiveDays(fact.start, fact.end) : 1,
    fiscalYear: fiscalYear ?? Number(fact.fy),
    fiscalQuarter: fiscalQuarter ?? fiscalQuarterOf(fact),
    evidenceStatus: sourceRole === "RestatedComparative" ? "restated-comparative" : "observed",
    status: mapping.confidence === "Review" ? "Review" : "Mapped",
    confidence: mapping.confidence,
    method: "sec-company-facts-exact-accession",
    taxonomy: fact.taxonomy,
    concept: fact.concept,
    reportedUnit: fact.unit,
    reportedValue: fact.val,
    accessionNumber: fact.accn,
    form: fact.form,
    filed: fact.filed ?? filing.filingDate,
    knownAt,
    securityId,
    sourceRole,
    amendsAccessionNumber: filing.form === "10-Q/A" && fact.accn === filing.accessionNumber
      ? filing.amendsAccessionNumber ?? null
      : null,
    sourceManifestReference: `sec-accession:${fact.accn}`,
    sourceLocation: filing.filingUrl,
    transformationId: null,
    transformationVersion: null,
    componentEvidenceIds: [],
  });
}

function accessionsFor(filing) {
  return filing.form === "10-Q/A"
    ? [filing.accessionNumber, filing.amendsAccessionNumber]
    : [filing.accessionNumber];
}

function selectCurrentFact(facts, filing, predicate) {
  for (const accession of accessionsFor(filing)) {
    const selected = factForAccession(facts, accession, predicate);
    if (selected) return { fact: selected, sourceRole: accession === filing.accessionNumber && filing.form === "10-Q/A" ? "AmendmentOverlay" : "CurrentQuarter" };
  }
  return null;
}

function selectedTtmFacts(companyFacts, mapping, annualFiling, quarterlyFiling, priorQuarterlyFiling) {
  for (const concept of mapping.concepts) {
    const facts = allConceptFacts(companyFacts, mapping.taxonomy ?? "us-gaap", concept).filter((fact) => unitAllowed(mapping, fact));
    const annual = factForAccession(facts, annualFiling.accessionNumber, (fact) =>
      fact.form === "10-K" && fact.end === annualFiling.reportDate && fact.start && inclusiveDays(fact.start, fact.end) >= 300 && inclusiveDays(fact.start, fact.end) <= 400,
    );
    const current = selectCurrentFact(facts, quarterlyFiling, (fact) => {
      if (!fact.start || fact.end !== quarterlyFiling.reportDate) return false;
      const classification = classifyReportingContext({ start: fact.start, end: fact.end, filingForm: fact.form, reportDate: quarterlyFiling.reportDate, fiscalQuarter: fiscalQuarterOf(fact) });
      return classification.periodBasis === "FiscalYTD";
    });
    if (!annual || !current) continue;
    const quarter = fiscalQuarterOf(current.fact);
    let prior = null;
    let priorRole = "ComparablePriorQuarter";
    for (const accession of accessionsFor(quarterlyFiling)) {
      prior = factForAccession(facts, accession, (fact) =>
        fact.end === priorQuarterlyFiling.reportDate && isFiscalYtdFact(fact, quarter),
      );
      if (prior) {
        priorRole = "RestatedComparative";
        break;
      }
    }
    prior ??= factForAccession(facts, priorQuarterlyFiling.accessionNumber, (fact) =>
      fact.end === priorQuarterlyFiling.reportDate && isFiscalYtdFact(fact, quarter),
    );
    if (prior) return { annual, current, prior, priorRole };
  }
  return null;
}

function selectedInstantFact(companyFacts, mapping, filing) {
  for (const concept of mapping.concepts) {
    const facts = allConceptFacts(companyFacts, mapping.taxonomy ?? "us-gaap", concept).filter((fact) => unitAllowed(mapping, fact));
    const selected = selectCurrentFact(facts, filing, (fact) => !fact.start && fact.end === filing.reportDate);
    if (selected) return { ...selected, mapping: { ...mapping, concept } };
  }
  return null;
}

function selectedCoverFact(companyFacts, mapping, filing) {
  for (const concept of mapping.concepts) {
    const facts = allConceptFacts(companyFacts, mapping.taxonomy ?? "us-gaap", concept).filter((fact) => unitAllowed(mapping, fact));
    const selected = selectCurrentFact(facts, filing, (fact) =>
      !fact.start && fact.end >= filing.reportDate && fact.end <= filing.filingDate,
    );
    if (selected) return { ...selected, mapping: { ...mapping, concept } };
  }
  return null;
}

function selectedPriorInstantFact(companyFacts, mapping, priorFiling) {
  for (const concept of mapping.concepts) {
    const facts = allConceptFacts(companyFacts, mapping.taxonomy ?? "us-gaap", concept).filter((fact) => unitAllowed(mapping, fact));
    const selected = factForAccession(facts, priorFiling.accessionNumber, (fact) => !fact.start && fact.end === priorFiling.reportDate);
    if (selected) return { fact: selected, sourceRole: "ComparablePriorQuarter", mapping: { ...mapping, concept } };
  }
  return null;
}

function missingEvidence(field, reason, periodBasis) {
  return {
    field,
    canonicalField: field,
    evidenceItemId: null,
    value: null,
    status: "Missing",
    confidence: "None",
    evidenceStatus: "withheld",
    periodBasis,
    method: "quarterly-period-assembly-withheld",
    reason,
    start: null,
    end: null,
    accessionNumber: null,
    form: null,
  };
}


async function derivedEvidence({ field, value, dependencies, periodBasis, knownAt, end, transformationId }) {
  return finalizeEvidence({
    canonicalField: field,
    field,
    value,
    normalizedUnit: "USD millions",
    signConvention: "Reported",
    entityScope: "ConsolidatedEntity",
    periodBasis,
    start: periodBasis === "TrailingTwelveMonths" ? dependencies[0]?.start ?? null : null,
    end,
    actualInclusiveDays: periodBasis === "TrailingTwelveMonths" ? inclusiveDays(dependencies[0].start, end) : 1,
    fiscalYear: dependencies[0]?.fiscalYear ?? null,
    fiscalQuarter: dependencies[0]?.fiscalQuarter ?? null,
    evidenceStatus: "derived",
    status: "Derived",
    confidence: "High",
    method: transformationId,
    taxonomy: null,
    concept: null,
    reportedUnit: null,
    reportedValue: null,
    accessionNumber: dependencies[0]?.accessionNumber ?? null,
    form: dependencies[0]?.form ?? null,
    filed: dependencies.map((item) => item?.filed).filter(Boolean).sort().at(-1) ?? null,
    knownAt,
    sourceRole: "Derived",
    sourceManifestReference: null,
    transformationId,
    transformationVersion: PERIOD_ASSEMBLY_VERSION,
    componentEvidenceIds: dependencies.map((item) => item.evidenceItemId),
    componentEvidence: dependencies,
  });
}

export async function buildQuarterlyEvidenceAssembly({
  annualAcquisition,
  companyFacts,
  quarterlyFiling,
  priorQuarterlyFiling,
  securityId,
  knownAt,
  quarterlySourceHash = null,
}) {
  const resultKnownAt = isoTimestamp(knownAt, "knownAt");
  const annualFiling = annualAcquisition.filing;
  if (annualFiling.form !== "10-K" || !["10-Q", "10-Q/A"].includes(quarterlyFiling.form)) {
    throw new Error("Quarterly assembly requires a governed 10-K and 10-Q/10-Q/A.");
  }
  if (annualFiling.reportDate >= quarterlyFiling.reportDate) throw new Error("Q4 remains governed by the 10-K; no later quarter is available to assemble.");
  const inputs = { ...annualAcquisition.inputs };
  for (const field of NUMERIC_INPUT_FIELDS) inputs[field] = null;
  const evidence = {};
  const failures = [];

  for (const mapping of companyFactsDurationMappings.filter((item) => FLOW_FIELDS.includes(item.field))) {
    const selected = selectedTtmFacts(companyFacts, mapping, annualFiling, quarterlyFiling, priorQuarterlyFiling);
    if (!selected) {
      evidence[mapping.field] = missingEvidence(mapping.field, "Eligible FY/current-YTD/prior-YTD components were not all available under one governed concept.", "TrailingTwelveMonths");
      failures.push({ field: mapping.field, reason: "MissingTtmComponents" });
      continue;
    }
    try {
      const annualItem = await observedEvidence({ field: mapping.field, fact: selected.annual, mapping, filing: annualFiling, securityId, knownAt: resultKnownAt, periodBasis: "FiscalYear", sourceRole: "AnnualComponent" });
      const currentItem = await observedEvidence({ field: mapping.field, fact: selected.current.fact, mapping, filing: quarterlyFiling, securityId, knownAt: resultKnownAt, periodBasis: "FiscalYTD", sourceRole: selected.current.sourceRole });
      const priorItem = await observedEvidence({ field: mapping.field, fact: selected.prior, mapping, filing: priorQuarterlyFiling, securityId, knownAt: resultKnownAt, periodBasis: "FiscalYTD", sourceRole: selected.priorRole, fiscalYear: Number(selected.current.fact.fy) - 1, fiscalQuarter: fiscalQuarterOf(selected.current.fact) });
      const ttm = await assembleTtmEvidence({ canonicalField: mapping.field, fiscalYear: annualItem, currentYtd: currentItem, priorYearYtd: priorItem, resultKnownAt });
      inputs[mapping.field] = ttm.value;
      evidence[mapping.field] = ttm;
    } catch (error) {
      evidence[mapping.field] = missingEvidence(mapping.field, error instanceof Error ? error.message : String(error), "TrailingTwelveMonths");
      failures.push({ field: mapping.field, reason: "IncompatibleTtmComponents", detail: evidence[mapping.field].reason });
    }
  }

  for (const mapping of companyFactsInstantMappings) {
    const selected = selectedInstantFact(companyFacts, mapping, quarterlyFiling);
    if (!selected) {
      evidence[mapping.field] = missingEvidence(mapping.field, "No exact accepted quarter-end Company Facts item was available.", "Instant");
      continue;
    }
    const current = await observedEvidence({ field: mapping.field, fact: selected.fact, mapping, filing: quarterlyFiling, securityId, knownAt: resultKnownAt, periodBasis: "Instant", sourceRole: selected.sourceRole });
    inputs[mapping.field] = current.value;
    evidence[mapping.field] = current;
    if (mapping.field.startsWith("ending")) {
      const beginningField = mapping.field.replace("ending", "beginning");
      const priorSelected = selectedPriorInstantFact(companyFacts, { ...mapping, field: beginningField, concepts: [selected.fact.concept] }, priorQuarterlyFiling);
      if (priorSelected) {
        const prior = await observedEvidence({ field: beginningField, fact: priorSelected.fact, mapping: { ...mapping, field: beginningField }, filing: priorQuarterlyFiling, securityId, knownAt: resultKnownAt, periodBasis: "Instant", sourceRole: priorSelected.sourceRole });
        try {
          selectComparablePriorQuarterBalance({ current, candidates: [prior] });
          inputs[beginningField] = prior.value;
          evidence[beginningField] = prior;
        } catch (error) {
          evidence[beginningField] = missingEvidence(beginningField, error instanceof Error ? error.message : String(error), "Instant");
        }
      } else {
        evidence[beginningField] = missingEvidence(beginningField, "No exact comparable prior-year quarter-end balance was available.", "Instant");
      }
    }
  }

  if (inputs.grossProfit === null && inputs.revenue !== null && inputs.costOfRevenue !== null) {
    inputs.grossProfit = new Decimal(inputs.revenue).minus(inputs.costOfRevenue).toNumber();
    evidence.grossProfit = await derivedEvidence({ field: "grossProfit", value: inputs.grossProfit, dependencies: [evidence.revenue, evidence.costOfRevenue], periodBasis: "TrailingTwelveMonths", knownAt: resultKnownAt, end: quarterlyFiling.reportDate, transformationId: "GROSS-PROFIT-REVENUE-MINUS-COST" });
  }
  if (inputs.totalLiabilities === null && inputs.endingTotalAssets !== null && inputs.endingShareholdersEquity !== null) {
    inputs.totalLiabilities = new Decimal(inputs.endingTotalAssets).minus(inputs.endingShareholdersEquity).toNumber();
    evidence.totalLiabilities = await derivedEvidence({ field: "totalLiabilities", value: inputs.totalLiabilities, dependencies: [evidence.endingTotalAssets, evidence.endingShareholdersEquity], periodBasis: "Instant", knownAt: resultKnownAt, end: quarterlyFiling.reportDate, transformationId: "LIABILITIES-ASSETS-MINUS-EQUITY" });
  }

  const debtMapping = filingResolutionPolicies.totalDebt;
  const selectedDebt = selectedInstantFact(companyFacts, debtMapping, quarterlyFiling);
  if (selectedDebt) {
    const item = await observedEvidence({ field: "totalDebt", fact: selectedDebt.fact, mapping: debtMapping, filing: quarterlyFiling, securityId, knownAt: resultKnownAt, periodBasis: "Instant", sourceRole: selectedDebt.sourceRole });
    inputs.totalDebt = item.value;
    evidence.totalDebt = item;
  } else {
    const componentSets = [
      ["LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],
      ["LongTermDebtCurrent", "LongTermDebtNoncurrent"],
      ["OtherLongTermDebtCurrent", "OtherLongTermDebtNoncurrent"],
      ["ShortTermBorrowings", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],
      ["ShortTermBorrowings", "LongTermDebtNoncurrent"],
    ];
    let components = null;
    for (const concepts of componentSets) {
      const selected = concepts.map((concept) => selectedInstantFact(companyFacts, { ...debtMapping, concepts: [concept], scale: "millions", absolute: false }, quarterlyFiling));
      if (selected.every(Boolean)) {
        components = await Promise.all(selected.map((item, index) => observedEvidence({ field: `totalDebtComponent${index + 1}`, fact: item.fact, mapping: { ...debtMapping, scale: "millions", absolute: false }, filing: quarterlyFiling, securityId, knownAt: resultKnownAt, periodBasis: "Instant", sourceRole: item.sourceRole })));
        break;
      }
    }
    if (components) {
      inputs.totalDebt = components.reduce((sum, item) => sum.plus(item.value), new Decimal(0)).toNumber();
      evidence.totalDebt = await derivedEvidence({ field: "totalDebt", value: inputs.totalDebt, dependencies: components, periodBasis: "Instant", knownAt: resultKnownAt, end: quarterlyFiling.reportDate, transformationId: "TOTAL-DEBT-GOVERNED-COMPONENT-SUM" });
    } else {
      evidence.totalDebt = missingEvidence("totalDebt", "No governed direct or component quarter-end total-debt evidence was available.", "Instant");
    }
  }

  const sharesMapping = filingResolutionPolicies.sharesOutstanding;
  const selectedShares = selectedCoverFact(companyFacts, sharesMapping, quarterlyFiling);
  if (selectedShares) {
    const item = await observedEvidence({ field: "sharesOutstanding", fact: selectedShares.fact, mapping: sharesMapping, filing: quarterlyFiling, securityId, knownAt: resultKnownAt, periodBasis: "Instant", sourceRole: selectedShares.sourceRole });
    inputs.sharesOutstanding = item.value;
    evidence.sharesOutstanding = item;
  } else {
    evidence.sharesOutstanding = missingEvidence("sharesOutstanding", "No exact accepted quarter-end shares fact was available.", "Instant");
  }

  inputs.dilutedEarningsPerShare = null;
  evidence.dilutedEarningsPerShare = missingEvidence("dilutedEarningsPerShare", "Quarterly diluted EPS is not additive; P/E requires exact annual carry-forward authority.", "FiscalYear");
  inputs.periodStart = nextDate(priorQuarterlyFiling.reportDate);
  inputs.periodEnd = quarterlyFiling.reportDate;
  inputs.accessionNumber = quarterlyFiling.accessionNumber;
  inputs.filingDate = quarterlyFiling.filingDate;
  inputs.filingUrl = quarterlyFiling.filingUrl;
  inputs.inputEvidence = evidence;
  inputs.reportingPeriodType = "TrailingTwelveMonths";
  inputs.reportingPeriodResolutionSource = "Governed quarterly period assembly";
  inputs.periodAssemblyVersion = PERIOD_ASSEMBLY_VERSION;
  inputs.authoritySources = [
    ...(quarterlyFiling.originalFiling ? [{ ...quarterlyFiling.originalFiling, sourceRole: "Original" }] : []),
    quarterlyFiling,
  ];
  inputs.acquisition = {
    ...inputs.acquisition,
    acquiredAt: resultKnownAt,
    periodAssemblyVersion: PERIOD_ASSEMBLY_VERSION,
    quarterlyAccessionNumber: quarterlyFiling.accessionNumber,
    annualComponentAccessionNumber: annualFiling.accessionNumber,
    comparableQuarterAccessionNumber: priorQuarterlyFiling.accessionNumber,
    quarterlySourceHash,
  };

  const acceptedEvidenceCount = Object.values(evidence).filter((item) => item.evidenceItemId).length;
  return {
    version: PERIOD_ASSEMBLY_VERSION,
    compatibilityVersion: PERIOD_COMPATIBILITY_VERSION,
    inputs,
    evidenceItems: Object.values(evidence),
    acceptedEvidenceCount,
    failures,
    status: acceptedEvidenceCount ? "Assembled" : "WithheldNoSupportedEvidence",
    sources: [annualFiling, quarterlyFiling, priorQuarterlyFiling],
  };
}

function carriedPriceToEarnings(priorPublication) {
  const prior = priorPublication?.evaluation;
  const resultId = priorPublication?.resultId;
  const metric = prior?.metrics?.find((item) => item.id === "priceToEarnings");
  const rule = prior?.scoring?.rules?.find((item) => item.metricId === "priceToEarnings");
  const annual = prior?.reportingPeriod?.periodType === "FiscalYear" || (
    metric?.authorityStatus === "CarriedForward" && metric?.originalEvidencePeriod?.periodType === "FiscalYear"
  );
  if (
    !resultId || !metric || !rule || rule.status !== "Scored" || !annual ||
    prior?.scoring?.scoringVersion !== SCORING_VERSION ||
    prior?.scoring?.profileId !== "general-operating-company-v1"
  ) return null;
  const evidenceIds = metric.lineage?.flatMap((item) => item.evidence?.evidenceItemId ? [item.evidence.evidenceItemId] : []) ?? [];
  const provenance = {
    authorityStatus: "CarriedForward",
    carriedFromResultId: metric.carriedFromResultId ?? resultId,
    carriedFromEvidenceId: metric.carriedFromEvidenceId ?? evidenceIds[0] ?? `${resultId}:priceToEarnings`,
    originalEvidencePeriod: metric.originalEvidencePeriod ?? prior.reportingPeriod,
    originalSource: metric.originalSource ?? priorPublication.sourceManifestId ?? null,
    originalFreshness: metric.originalFreshness ?? priorPublication.freshness ?? null,
  };
  return {
    metric: { ...metric, ...provenance, evidenceStatus: "carried-forward" },
    rule: { ...rule, ...provenance },
  };
}

function updateFamilies(families, metrics, unavailableMetrics) {
  return families.map((family) => {
    const available = metrics.filter((metric) => metric.family === family.family).length;
    const unavailable = unavailableMetrics.filter((metric) => metric.family === family.family);
    const status = available === family.expectedMetricCount ? "Complete" : available ? "Partial" : "Unavailable";
    return {
      ...family,
      status,
      reason: status === "Complete" ? null : "MissingGovernedInput",
      detail: status === "Complete" ? null : `${available} of ${family.expectedMetricCount} measurements available. Unavailable: ${unavailable.map((item) => item.name).join(", ")}.`,
      metricCount: available,
    };
  });
}

export async function evaluateQuarterlyAssembly({
  assembly,
  priorAnnualPublication,
  sharePrice,
  marketObservationDate,
  marketUrl,
}) {
  if (assembly.status === "WithheldNoSupportedEvidence") return { status: assembly.status, evaluation: null };
  const base = await evaluateInputs({
    ...assembly.inputs,
    sharePrice,
    marketObservationDate,
    marketUrl,
  });
  const carried = carriedPriceToEarnings(priorAnnualPublication);
  return finalizeQuarterlyEvaluation({
    base,
    carried,
    periodAssembly: {
      version: assembly.version,
      status: assembly.status,
      failures: assembly.failures,
      metricCompatibility: metricPeriodCompatibility,
      carriedMetricIds: carried ? ["priceToEarnings"] : [],
    },
  });
}

async function finalizeQuarterlyEvaluation({ base, carried, periodAssembly }) {
  const scoring = scoreEvaluation({
    metrics: base.metrics,
    unavailableMetrics: base.unavailableMetrics,
    inputs: base.inputs,
    carriedRules: carried ? [carried.rule] : [],
  });
  const metrics = carried
    ? [...base.metrics, carried.metric].sort((left, right) => requestedCalculationIds.indexOf(left.id) - requestedCalculationIds.indexOf(right.id))
    : base.metrics;
  const unavailableMetrics = carried
    ? base.unavailableMetrics.filter((item) => item.id !== "priceToEarnings")
    : base.unavailableMetrics;
  const unavailableOutcomes = base.validation.outcomes.filter((outcome) => outcome.code !== "UnavailableCalculations");
  const evaluation = {
    ...base,
    metrics,
    unavailableMetrics,
    families: updateFamilies(base.families, metrics, unavailableMetrics),
    scoring,
    validation: {
      ...base.validation,
      status: unavailableMetrics.length ? "ValidWithUnavailableCalculations" : "Valid",
      outcomes: [
        ...unavailableOutcomes,
        ...(unavailableMetrics.length ? [{ code: "UnavailableCalculations", status: "Notice", count: unavailableMetrics.length }] : []),
        { code: "QuarterlyPeriodAssembly", status: "Pass", version: periodAssembly.version },
        ...(carried ? [{ code: "ExactAnnualCarryForward", status: "Pass", metricId: "priceToEarnings", carriedFromResultId: carried.metric.carriedFromResultId }] : []),
      ],
    },
    periodAssemblyVersion: PERIOD_ASSEMBLY_VERSION,
    periodCompatibilityVersion: PERIOD_COMPATIBILITY_VERSION,
    periodAssembly,
  };
  evaluation.fingerprint = await sha256Text(stableSerialize(canonicalEvaluationIdentity(evaluation)));
  return { status: "Evaluated", evaluation };
}

export async function replayQuarterlyEvaluation(snapshot) {
  if (snapshot?.periodAssemblyVersion !== PERIOD_ASSEMBLY_VERSION || !snapshot?.periodAssembly) {
    throw new Error("The quarterly period-assembly version is not available for replay.");
  }
  const metric = snapshot.metrics?.find((item) => item.id === "priceToEarnings" && item.authorityStatus === "CarriedForward") ?? null;
  const rule = snapshot.scoring?.rules?.find((item) => item.metricId === "priceToEarnings" && item.authorityStatus === "CarriedForward") ?? null;
  if (Boolean(metric) !== Boolean(rule)) throw new Error("Quarterly carry-forward authority is incomplete.");
  const base = await evaluateInputs(snapshot.inputs);
  return finalizeQuarterlyEvaluation({ base, carried: metric && rule ? { metric, rule } : null, periodAssembly: snapshot.periodAssembly });
}

export function quarterlyGenerationOutcome(assembly) {
  return assembly.acceptedEvidenceCount
    ? { outcome: "Eligible", reason: "GovernedQuarterlyEvidenceAccepted" }
    : { outcome: "Withheld", reason: "WithheldNoSupportedEvidence" };
}
