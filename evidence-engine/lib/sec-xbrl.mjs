/**
 * SEC EDGAR/XBRL acquisition and governed-input mapping.
 *
 * This module is transport-free: callers supply the SEC ticker directory,
 * submissions payload, and Company Facts payload. That keeps selection and
 * mapping rules deterministic and independently testable.
 */

import {
  EVIDENCE_RESOLUTION_VERSION,
  resolveReportingPeriodStartFromFiling,
  resolveMissingFilingEvidence,
} from "./evidence-resolution.mjs";
import {
  ALIAS_REGISTRY_VERSION,
  companyFactsDurationMappings,
  companyFactsInstantMappings,
  filingResolutionPolicies,
} from "./alias-registry.mjs";
import {
  continuityRecordForTicker,
  ENTITY_CONTINUITY_REGISTRY_VERSION,
} from "./entity-continuity-registry.mjs";

export const ACQUISITION_VERSION = "6.4.0-sec";
export const SUPPORTED_FILING_FORMS = Object.freeze(["10-K"]);

const MILLION = 1_000_000;

const labels = Object.freeze({
  periodStart: "Period start",
  revenue: "Revenue",
  costOfRevenue: "Cost of revenue",
  beginningAccountsReceivable: "Beginning accounts receivable",
  endingAccountsReceivable: "Ending accounts receivable",
  beginningInventory: "Beginning inventory",
  endingInventory: "Ending inventory",
  beginningAccountsPayable: "Beginning accounts payable",
  endingAccountsPayable: "Ending accounts payable",
  currentAssets: "Current assets",
  currentLiabilities: "Current liabilities",
  grossProfit: "Gross profit",
  operatingIncome: "Operating income / EBIT",
  netIncome: "Net income",
  beginningTotalAssets: "Beginning total assets",
  endingTotalAssets: "Ending total assets",
  totalLiabilities: "Total liabilities",
  totalDebt: "Total debt",
  beginningShareholdersEquity: "Beginning total equity",
  endingShareholdersEquity: "Ending total equity",
  prepaidExpenses: "Prepaid expenses",
  preferredEquity: "Preferred equity",
  minorityInterest: "Minority interest",
  operatingCashFlow: "Operating cash flow",
  capitalExpenditures: "Capital expenditures",
  depreciation: "Depreciation",
  amortization: "Amortization",
  depreciationAmortizationCombined: "Combined depreciation and amortization disclosure",
  cashAndCashEquivalents: "Cash and cash equivalents",
  interestExpense: "Interest expense",
  sharesOutstanding: "Shares outstanding",
  dilutedEarningsPerShare: "Diluted earnings per share",
  sharePrice: "Reference share price",
  marketObservationDate: "Market-price observation date",
  marketUrl: "Market-price evidence URL",
});

const durationMappings = companyFactsDurationMappings.map((mapping) => ({
  ...mapping,
  units: mapping.scale === "per-share" ? ["USD/shares", "USD / shares"] : ["USD"],
}));

const instantMappings = companyFactsInstantMappings;

function cleanTicker(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function validateTicker(value) {
  const ticker = cleanTicker(value);
  if (!ticker) throw new Error("Enter a ticker symbol.");
  if (!/^[A-Z0-9.-]{1,10}$/.test(ticker))
    throw new Error("Ticker symbols may contain letters, numbers, periods, and hyphens only.");
  return ticker;
}

export function resolveTicker(tickerDirectory, requestedTicker) {
  const ticker = validateTicker(requestedTicker);
  const source = tickerDirectory?.records ?? tickerDirectory;
  const records = Array.isArray(source) ? source : Object.values(source ?? {});
  const match = records.find(
    (record) => cleanTicker(record?.ticker).replace("-", ".") === ticker.replace("-", "."),
  );
  const continuity = continuityRecordForTicker(ticker);
  if (!match && !continuity) throw new Error(`No SEC company record was found for ${ticker}.`);
  if (continuity) {
    const matchedDirectoryCik = match ? String(match.cik_str).padStart(10, "0") : null;
    if (continuity.directoryCik && matchedDirectoryCik !== continuity.directoryCik) {
      throw new Error(`The governed entity-continuity record for ${ticker} does not match the current SEC directory.`);
    }
    return {
      ticker,
      cik: continuity.analysisCik,
      title: String(match?.title ?? continuity.title),
      directoryCik: matchedDirectoryCik,
      continuity: {
        registryVersion: ENTITY_CONTINUITY_REGISTRY_VERSION,
        mode: continuity.mode,
        analysisCik: continuity.analysisCik,
        directoryCik: continuity.directoryCik,
        effectiveDate: continuity.effectiveDate,
        rationale: continuity.rationale,
        sourceUrls: continuity.sourceUrls,
      },
    };
  }
  return {
    ticker,
    cik: String(match.cik_str).padStart(10, "0"),
    title: String(match.title ?? ticker),
    directoryCik: String(match.cik_str).padStart(10, "0"),
    continuity: null,
  };
}

function rowsFromRecent(recent) {
  const keys = Object.keys(recent ?? {});
  const length = Math.max(0, ...keys.map((key) => recent[key]?.length ?? 0));
  return Array.from({ length }, (_, index) =>
    Object.fromEntries(keys.map((key) => [key, recent[key]?.[index]])),
  );
}

export function selectLatestAnnualFiling(submissions, cik) {
  const rows = rowsFromRecent(submissions?.filings?.recent);
  const filing = rows
    .filter((row) => row.form === "10-K" && row.accessionNumber && row.reportDate)
    .sort((left, right) =>
      String(right.filingDate ?? "").localeCompare(String(left.filingDate ?? "")),
    )[0];
  if (!filing) throw new Error("No supported 10-K filing was found in the current SEC submission history.");
  const accessionCompact = String(filing.accessionNumber).replaceAll("-", "");
  const cikCompact = String(Number(cik));
  const primaryDocument = String(filing.primaryDocument ?? "");
  const filingUrl = primaryDocument
    ? `https://www.sec.gov/Archives/edgar/data/${cikCompact}/${accessionCompact}/${primaryDocument}`
    : `https://www.sec.gov/Archives/edgar/data/${cikCompact}/${accessionCompact}/`;
  return {
    form: "10-K",
    accessionNumber: String(filing.accessionNumber),
    filingDate: String(filing.filingDate),
    reportDate: String(filing.reportDate),
    primaryDocument,
    filingUrl,
  };
}

function conceptUnitFacts(companyFacts, taxonomy, concept, units) {
  const conceptRecord = companyFacts?.facts?.[taxonomy]?.[concept];
  if (!conceptRecord?.units) return [];
  const preferredUnits = units?.length ? units : Object.keys(conceptRecord.units);
  return preferredUnits.flatMap((unit) =>
    (conceptRecord.units[unit] ?? []).map((fact) => ({
      ...fact,
      unit,
      taxonomy,
      concept,
      conceptLabel: conceptRecord.label ?? concept,
    })),
  );
}

function dateDistanceInDays(start, end) {
  if (!start || !end) return Number.POSITIVE_INFINITY;
  return Math.abs((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function selectDurationFact(companyFacts, mapping, filing) {
  for (const concept of mapping.concepts) {
    const candidates = conceptUnitFacts(
      companyFacts,
      "us-gaap",
      concept,
      mapping.units ?? ["USD"],
    )
      .filter(
        (fact) =>
          fact.accn === filing.accessionNumber &&
          fact.form === filing.form &&
          fact.end === filing.reportDate &&
          fact.start,
      )
      .map((fact) => ({ ...fact, durationDays: dateDistanceInDays(fact.start, fact.end) }))
      .filter((fact) => fact.durationDays >= 300 && fact.durationDays <= 400)
      .sort((left, right) => {
        const fyDelta = Number(right.fp === "FY") - Number(left.fp === "FY");
        if (fyDelta) return fyDelta;
        return Math.abs(left.durationDays - 365) - Math.abs(right.durationDays - 365);
      });
    if (candidates[0]) return candidates[0];
  }
  return null;
}

function selectInstantFact(companyFacts, mapping, filing, mode = "ending") {
  for (const concept of mapping.concepts) {
    const candidates = conceptUnitFacts(companyFacts, "us-gaap", concept, ["USD"])
      .filter(
        (fact) =>
          fact.accn === filing.accessionNumber &&
          fact.form === filing.form &&
          !fact.start,
      )
      .filter((fact) =>
        mode === "ending" ? fact.end === filing.reportDate : fact.end < filing.reportDate,
      )
      .sort((left, right) => String(right.end).localeCompare(String(left.end)));
    if (candidates[0]) return candidates[0];
  }
  return null;
}

function selectSharesOutstanding(companyFacts, filing) {
  const candidates = conceptUnitFacts(
    companyFacts,
    "dei",
    "EntityCommonStockSharesOutstanding",
    ["shares"],
  )
    .filter((fact) => fact.accn === filing.accessionNumber && !fact.start)
    .filter((fact) => fact.end >= filing.reportDate && fact.end <= filing.filingDate)
    .sort((left, right) => String(right.end).localeCompare(String(left.end)));
  return candidates[0] ?? null;
}

function scaledValue(fact, scale = "millions") {
  const number = Number(fact?.val);
  if (!Number.isFinite(number)) return null;
  if (scale === "per-share") return number;
  return number / MILLION;
}

function evidenceFromFact(field, fact, mapping, value, method = "reported") {
  const reviewConcept = mapping.reviewConcepts?.includes(fact.concept);
  const confidence = reviewConcept ? "Review" : mapping.confidence;
  return {
    field,
    label: labels[field] ?? field,
    status: confidence === "Review" ? "Review" : "Mapped",
    confidence,
    value,
    displayUnit: mapping.scale === "per-share" ? "USD/share" : "USD millions",
    taxonomy: fact.taxonomy,
    concept: fact.concept,
    conceptLabel: fact.conceptLabel,
    reportedUnit: fact.unit,
    reportedValue: fact.val,
    start: fact.start ?? null,
    end: fact.end,
    filed: fact.filed,
    accessionNumber: fact.accn,
    form: fact.form,
    method,
    reason: reviewConcept
      ? mapping.reviewRationale
      : mapping.rationale ?? mapping.reason ?? null,
  };
}

function missingEvidence(field, reason) {
  return {
    field,
    label: labels[field] ?? field,
    status: "Missing",
    confidence: "None",
    value: null,
    displayUnit: "USD millions",
    taxonomy: null,
    concept: null,
    conceptLabel: null,
    reportedUnit: null,
    reportedValue: null,
    start: null,
    end: null,
    filed: null,
    accessionNumber: null,
    form: null,
    method: "unresolved",
    reason,
  };
}

function derivedEvidence(field, value, dependencies, reason) {
  return {
    field,
    label: labels[field] ?? field,
    status: "Derived",
    confidence: "Review",
    value,
    displayUnit: "USD millions",
    taxonomy: null,
    concept: null,
    conceptLabel: null,
    reportedUnit: null,
    reportedValue: null,
    start: null,
    end: null,
    filed: null,
    accessionNumber: null,
    form: null,
    method: "derived",
    dependencies,
    reason,
  };
}

function explicitOptionalZeroEvidence(field, fact, reason) {
  return {
    field,
    label: labels[field] ?? field,
    status: "NotReported",
    confidence: "High",
    value: 0,
    displayUnit: "USD millions",
    taxonomy: fact.taxonomy,
    concept: fact.concept,
    conceptLabel: fact.conceptLabel,
    reportedUnit: fact.unit,
    reportedValue: fact.val,
    start: null,
    end: fact.end,
    filed: fact.filed,
    accessionNumber: fact.accn,
    form: fact.form,
    method: "explicit-standardized-zero-component",
    reason,
  };
}

function periodParameterEvidence(field, value, sourceEvidence, reason) {
  return {
    field,
    label: labels[field] ?? field,
    status: "Derived",
    confidence: "High",
    value,
    displayUnit: null,
    taxonomy: sourceEvidence?.taxonomy ?? null,
    concept: sourceEvidence?.concept ?? null,
    conceptLabel: sourceEvidence?.conceptLabel ?? null,
    reportedUnit: null,
    reportedValue: null,
    start: value,
    end: sourceEvidence?.end ?? null,
    filed: sourceEvidence?.filed ?? null,
    accessionNumber: sourceEvidence?.accessionNumber ?? null,
    form: sourceEvidence?.form ?? null,
    method: "reported-duration-context",
    dependencies: sourceEvidence?.field ? [sourceEvidence.field] : [],
    reason,
  };
}

function mapReportedFacts(companyFacts, filing) {
  const inputs = {};
  const evidence = {};

  for (const mapping of durationMappings) {
    const fact = selectDurationFact(companyFacts, mapping, filing);
    const value = fact ? scaledValue(fact, mapping.scale) : null;
    if (fact && value !== null) {
      const mappedValue = mapping.absolute ? Math.abs(value) : value;
      inputs[mapping.field] = mappedValue;
      evidence[mapping.field] = evidenceFromFact(
        mapping.field,
        fact,
        mapping,
        mappedValue,
      );
    } else {
      inputs[mapping.field] = null;
      evidence[mapping.field] = missingEvidence(
        mapping.field,
        `No supported standardized concept matched the selected ${filing.form} annual context.`,
      );
    }
  }

  const periodSource = evidence.revenue?.start
    ? evidence.revenue
    : Object.values(evidence).find((item) => item?.start && item?.end === filing.reportDate);
  inputs.periodStart = periodSource?.start ?? null;
  evidence.periodStart = inputs.periodStart
    ? periodParameterEvidence(
        "periodStart",
        inputs.periodStart,
        periodSource,
        "Resolved from the selected annual duration context; reporting-period days are calculated inclusively by the engine.",
      )
    : missingEvidence(
        "periodStart",
        "No eligible annual duration context supplied a governed reporting-period start date.",
      );

  for (const mapping of instantMappings) {
    const endingFact = selectInstantFact(companyFacts, mapping, filing, "ending");
    const endingValue = endingFact ? scaledValue(endingFact) : null;
    if (endingFact && endingValue !== null) {
      inputs[mapping.field] = endingValue;
      evidence[mapping.field] = evidenceFromFact(
        mapping.field,
        endingFact,
        mapping,
        endingValue,
      );
    } else {
      inputs[mapping.field] = null;
      evidence[mapping.field] = missingEvidence(
        mapping.field,
        `No supported standardized instant concept matched the ${filing.reportDate} reporting date.`,
      );
    }

    if (mapping.field.startsWith("ending")) {
      const beginningField = mapping.field.replace("ending", "beginning");
      const beginningFact = endingFact
        ? selectInstantFact(
            companyFacts,
            { ...mapping, concepts: [endingFact.concept] },
            filing,
            "beginning",
          )
        : null;
      const beginningValue = beginningFact ? scaledValue(beginningFact) : null;
      if (beginningFact && beginningValue !== null) {
        inputs[beginningField] = beginningValue;
        evidence[beginningField] = evidenceFromFact(
          beginningField,
          beginningFact,
          mapping,
          beginningValue,
        );
      } else {
        inputs[beginningField] = null;
        evidence[beginningField] = missingEvidence(
          beginningField,
          "The selected filing did not expose a comparable prior-period instant fact for this concept.",
        );
      }
    }
  }

  const sharesFact = selectSharesOutstanding(companyFacts, filing);
  const sharesValue = sharesFact ? scaledValue(sharesFact) : null;
  if (sharesFact && sharesValue !== null) {
    inputs.sharesOutstanding = sharesValue;
    evidence.sharesOutstanding = evidenceFromFact(
      "sharesOutstanding",
      sharesFact,
      { confidence: "High" },
      sharesValue,
    );
    evidence.sharesOutstanding.displayUnit = "millions of shares";
  } else {
    inputs.sharesOutstanding = null;
    evidence.sharesOutstanding = missingEvidence(
      "sharesOutstanding",
      "No DEI EntityCommonStockSharesOutstanding fact matched the selected filing.",
    );
  }

  return { inputs, evidence };
}

function applyGovernedDerivations(inputs, evidence, companyFacts, filing) {
  if (!inputs.grossProfit && inputs.revenue && inputs.costOfRevenue) {
    inputs.grossProfit = inputs.revenue - inputs.costOfRevenue;
    evidence.grossProfit = derivedEvidence(
      "grossProfit",
      inputs.grossProfit,
      ["revenue", "costOfRevenue"],
      "No GrossProfit fact matched; derived as revenue minus cost of revenue.",
    );
  }

  if (!inputs.totalLiabilities && inputs.endingTotalAssets && inputs.endingShareholdersEquity) {
    inputs.totalLiabilities = inputs.endingTotalAssets - inputs.endingShareholdersEquity;
    evidence.totalLiabilities = derivedEvidence(
      "totalLiabilities",
      inputs.totalLiabilities,
      ["endingTotalAssets", "endingShareholdersEquity"],
      "No Liabilities fact matched; derived as ending total assets minus ending total equity.",
    );
  }

  const debtComponentSets = [
    ["LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],
    ["LongTermDebtCurrent", "LongTermDebtNoncurrent"],
    ["OtherLongTermDebtCurrent", "OtherLongTermDebtNoncurrent"],
    ["ShortTermBorrowings", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],
    ["ShortTermBorrowings", "LongTermDebtNoncurrent"],
  ];
  let debtComponents = null;
  for (const concepts of debtComponentSets) {
    const facts = concepts.map((concept) =>
      selectInstantFact(
        companyFacts,
        { concepts: [concept] },
        filing,
        "ending",
      ),
    );
    if (facts.every(Boolean)) {
      debtComponents = facts;
      break;
    }
  }

  if (debtComponents) {
    const values = debtComponents.map((fact) => scaledValue(fact));
    inputs.totalDebt = values.reduce((sum, value) => sum + value, 0);
    evidence.totalDebt = derivedEvidence(
      "totalDebt",
      inputs.totalDebt,
      debtComponents.map((fact) => `us-gaap:${fact.concept}`),
      "Composed from a governed, same-date current/noncurrent interest-bearing debt component set under CE-105; the selected concepts are preserved for review and replay.",
    );
  } else {
    const directMapping = filingResolutionPolicies.totalDebt;
    const directFact = selectInstantFact(companyFacts, directMapping, filing, "ending");
    const directValue = directFact ? scaledValue(directFact) : null;
    if (directFact && directValue !== null) {
      inputs.totalDebt = directValue;
      evidence.totalDebt = evidenceFromFact(
        "totalDebt",
        directFact,
        directMapping,
        directValue,
      );
    } else {
      inputs.totalDebt = null;
      evidence.totalDebt = missingEvidence(
        "totalDebt",
        "No supported direct or current/noncurrent debt concept set matched the selected filing.",
      );
    }
  }
}

function selectExplicitZeroPreferredShares(companyFacts, filing) {
  for (const concept of ["PreferredStockSharesOutstanding", "PreferredStockSharesIssued"]) {
    const candidates = conceptUnitFacts(companyFacts, "us-gaap", concept, ["shares"])
      .filter(
        (fact) =>
          fact.accn === filing.accessionNumber &&
          fact.form === filing.form &&
          !fact.start &&
          fact.end === filing.reportDate &&
          Number(fact.val) === 0,
      )
      .sort((left, right) => String(right.filed ?? "").localeCompare(String(left.filed ?? "")));
    if (candidates[0]) return candidates[0];
  }
  return null;
}

function applyExplicitOptionalZeroEvidence(inputs, evidence, companyFacts, filing) {
  if (inputs.preferredEquity === null) {
    const zeroShares = selectExplicitZeroPreferredShares(companyFacts, filing);
    if (zeroShares) {
      inputs.preferredEquity = 0;
      evidence.preferredEquity = explicitOptionalZeroEvidence(
        "preferredEquity",
        zeroShares,
        `The selected annual filing explicitly reports zero ${zeroShares.concept === "PreferredStockSharesIssued" ? "issued" : "outstanding"} preferred shares. Preferred equity is therefore governed as zero without relying on an unavailable filing fallback.`,
      );
    }
  }
}

function manualEvidence(field, reason) {
  return {
    field,
    label: labels[field] ?? field,
    status: "Manual",
    confidence: "Manual",
    value: field === "sharePrice" ? 0 : "",
    displayUnit: field === "sharePrice" ? "USD/share" : null,
    taxonomy: null,
    concept: null,
    conceptLabel: null,
    reportedUnit: null,
    reportedValue: null,
    start: null,
    end: null,
    filed: null,
    accessionNumber: null,
    form: null,
    method: "manual",
    reason,
  };
}

function applyOptionalNotReportedDefaults(inputs, evidence, resolution) {
  for (const policy of Object.values(filingResolutionPolicies)) {
    if (!policy.optionalIfNotReported || inputs[policy.field] !== null) continue;
    const record = evidence[policy.field];
    if (record?.status !== "Missing" || record?.method !== "source-hierarchy-exhausted") continue;
    inputs[policy.field] = 0;
    evidence[policy.field] = {
      ...record,
      status: "NotReported",
      confidence: "High",
      value: 0,
      method: "source-hierarchy-exhausted-optional-zero",
      reason: "The governed SEC source hierarchy was exhausted and no separate reported component was found. The controlling CE definition permits zero only in this not-reported state.",
    };
    const resolutionCase = resolution.cases.find((item) => item.field === policy.field);
    if (resolutionCase) {
      resolutionCase.outcome = "NotReportedOptionalZero";
      resolutionCase.reason = evidence[policy.field].reason;
    }
  }
}

export function buildAcquisitionPackage({
  tickerRecord,
  submissions,
  companyFacts,
  inlineFilingHtml = null,
  inlineFilingError = null,
}) {
  const filing = selectLatestAnnualFiling(submissions, tickerRecord.cik);
  const sic = String(submissions?.sic ?? "").trim();
  const normalizedSic = /^\d{1,4}$/.test(sic) ? sic.padStart(4, "0") : "";
  const { inputs, evidence } = mapReportedFacts(companyFacts, filing);
  applyGovernedDerivations(inputs, evidence, companyFacts, filing);
  applyExplicitOptionalZeroEvidence(inputs, evidence, companyFacts, filing);
  const resolution = resolveMissingFilingEvidence({
    html: inlineFilingHtml,
    filing,
    inputs,
    evidence,
    collectionError: inlineFilingError,
  });
  if (!inputs.periodStart && inlineFilingHtml) {
    const periodResolution = resolveReportingPeriodStartFromFiling(inlineFilingHtml, filing);
    if (periodResolution) {
      inputs.periodStart = periodResolution.start;
      const representative = periodResolution.representative;
      evidence.periodStart = {
        field: "periodStart",
        label: labels.periodStart,
        status: "Derived",
        confidence: "High",
        value: periodResolution.start,
        displayUnit: null,
        taxonomy: representative.taxonomy,
        concept: representative.concept,
        conceptLabel: representative.concept,
        reportedUnit: null,
        reportedValue: null,
        start: periodResolution.start,
        end: filing.reportDate,
        filed: filing.filingDate,
        accessionNumber: filing.accessionNumber,
        form: filing.form,
        method: "inline-xbrl-duration-context",
        dependencies: [],
        reason: `Resolved from the dominant eligible annual Inline XBRL duration context (${periodResolution.supportingFactCount} supporting facts; ${periodResolution.nonDimensionalFactCount} non-dimensional).`,
      };
      resolution.cases.push({
        field: "periodStart",
        policyVersion: EVIDENCE_RESOLUTION_VERSION,
        sourcePriorityExamined: ["SEC Company Facts", "Official Inline XBRL filing"],
        outcome: "MappedFallback",
        reason: evidence.periodStart.reason,
        candidates: [],
      });
      resolution.resolvedFromFiling += 1;
    }
  }
  applyOptionalNotReportedDefaults(inputs, evidence, resolution);

  const manual = {
    sharePrice: manualEvidence(
      "sharePrice",
      "The SEC filing APIs do not provide a governed market closing price; enter a dated price and evidence URL.",
    ),
    marketObservationDate: manualEvidence(
      "marketObservationDate",
      "Use the observation date associated with the entered reference price.",
    ),
    marketUrl: manualEvidence(
      "marketUrl",
      "Provide the exact page used to substantiate the entered reference price.",
    ),
  };
  Object.assign(evidence, manual);

  const mapping = Object.values(evidence);
  const summary = {
    mapped: mapping.filter((item) => item.status === "Mapped").length,
    derived: mapping.filter((item) => item.status === "Derived").length,
    review: mapping.filter((item) => item.status === "Review").length,
    reviewRequired: mapping.filter((item) => item.status === "ReviewRequired").length,
    missing: mapping.filter((item) => item.status === "Missing").length,
    collectionFailure: mapping.filter((item) => item.status === "CollectionFailure").length,
    notReported: mapping.filter((item) => item.status === "NotReported").length,
    resolvedFromFiling: resolution.resolvedFromFiling,
    blocking: 0,
    manual: mapping.filter((item) => item.status === "Manual").length,
    total: mapping.length,
  };

  const governedInputs = {
    companyName: String(companyFacts?.entityName ?? submissions?.name ?? tickerRecord.title),
    ticker: tickerRecord.ticker,
    periodEnd: filing.reportDate,
    periodStart: inputs.periodStart,
    accessionNumber: filing.accessionNumber,
    filingDate: filing.filingDate,
    filingUrl: filing.filingUrl,
    reportingCurrency: "USD",
    unitScale: "Millions",
    companyClassification: {
      sic: normalizedSic,
      sicDescription: String(submissions?.sicDescription ?? ""),
      source: "SEC Submissions",
    },
    ...inputs,
    sharePrice: 0,
    marketObservationDate: "",
    marketUrl: "",
    inputEvidence: evidence,
    evidenceResolutionCases: resolution.cases,
    evidenceResolutionVersion: EVIDENCE_RESOLUTION_VERSION,
    acquisition: {
      version: ACQUISITION_VERSION,
      source: "SEC EDGAR Submissions + Company Facts + official Inline XBRL filing",
      cik: tickerRecord.cik,
      acquiredAt: new Date().toISOString(),
      sic: normalizedSic,
      sicDescription: String(submissions?.sicDescription ?? ""),
      evidenceResolutionVersion: EVIDENCE_RESOLUTION_VERSION,
      aliasRegistryVersion: ALIAS_REGISTRY_VERSION,
      entityContinuityRegistryVersion: ENTITY_CONTINUITY_REGISTRY_VERSION,
      entityContinuity: tickerRecord.continuity ?? null,
      evidenceResolutionStatus: resolution.status,
      filingFactsExamined: resolution.factsExamined,
    },
  };

  const warnings = [
    "Evidence is resolved in order: SEC Company Facts, then the official Inline XBRL filing presentation and its filed statements and notes.",
    "Exact approved taxonomy concepts may be mapped automatically. Issuer extensions, dimensional facts, and competing candidates require a recorded human decision and are never silently substituted.",
    "All reported USD and share amounts are converted to millions. Per-share amounts remain unscaled.",
    "Review-tagged and derived fields should be checked against the linked filing before publication.",
    "Optional zero values are allowed only after the governed SEC source hierarchy records the component as NotReported; missing and collection-failure states remain unavailable.",
    "A dated market price and exact evidence URL must be supplied separately because EDGAR does not provide market prices.",
  ];
  if (summary.missing)
    warnings.unshift(
      `${summary.missing} standardized filing field${summary.missing === 1 ? " is" : "s are"} unresolved. The availability-aware engine will publish supported measurements and name each unavailable calculation.`,
    );
  if (summary.reviewRequired)
    warnings.unshift(
      `${summary.reviewRequired} field${summary.reviewRequired === 1 ? " has" : "s have"} official filing candidates that require governed review before acceptance.`,
    );
  if (summary.collectionFailure)
    warnings.unshift(
      `${summary.collectionFailure} unresolved field${summary.collectionFailure === 1 ? " could" : "s could"} not complete the official filing fallback because collection failed. These fields are not classified as missing evidence.`,
    );

  return {
    schemaVersion: "2.0",
    acquisitionVersion: ACQUISITION_VERSION,
    aliasRegistryVersion: ALIAS_REGISTRY_VERSION,
    acquiredAt: governedInputs.acquisition.acquiredAt,
    company: {
      name: governedInputs.companyName,
      ticker: tickerRecord.ticker,
      cik: tickerRecord.cik,
      directoryCik: tickerRecord.directoryCik ?? tickerRecord.cik,
      entityContinuity: tickerRecord.continuity ?? null,
      exchanges: submissions?.exchanges ?? [],
      sic: governedInputs.companyClassification.sic,
      sicDescription: governedInputs.companyClassification.sicDescription,
    },
    filing,
    inputs: governedInputs,
    mapping,
    summary,
    resolution,
    warnings,
  };
}
