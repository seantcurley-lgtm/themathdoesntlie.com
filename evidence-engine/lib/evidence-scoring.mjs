import Decimal from "decimal.js";

/**
 * TMDL General Operating Company scoring policy.
 *
 * The scoring layer consumes the governed measurements produced by the engine.
 * It never fetches data, estimates a missing measurement, or changes a filing
 * value. Every point is produced by a versioned rule below.
 */

export const SCORING_VERSION = "1.1.0";

const requirement = (key, label) => ({ key, operator: "gt", value: 0, label });

const higher = (metricId, family, name, weight, thresholds, fallbackScore = 0, requirements = [], options = {}) => ({
  metricId,
  family,
  name,
  weight,
  direction: "higher",
  thresholds,
  fallbackScore,
  requirements,
  ...options,
});

const lower = (
  metricId,
  family,
  name,
  weight,
  thresholds,
  fallbackScore = 20,
  requirements = [],
  positiveValueRequired = false,
  options = {},
) => ({
  metricId,
  family,
  name,
  weight,
  direction: "lower",
  thresholds,
  fallbackScore,
  requirements,
  positiveValueRequired,
  ...options,
});

const H = (minimum, score) => ({ minimum, score, label: `≥ ${minimum}` });
const L = (maximum, score) => ({ maximum, score, label: `≤ ${maximum}` });

export const scoringRules = Object.freeze([
  lower(
    "dso",
    "Efficiency",
    "Receivables efficiency",
    4,
    [L(45, 100), L(60, 80), L(75, 60), L(90, 40)],
    20,
    [requirement("revenue", "positive revenue")],
  ),
  lower(
    "ccc",
    "Efficiency",
    "Cash-cycle efficiency",
    6,
    [L(0, 100), L(30, 80), L(60, 60), L(90, 40)],
    20,
    [
      requirement("revenue", "positive revenue"),
      requirement("costOfRevenue", "positive cost of revenue"),
    ],
  ),
  higher(
    "currentRatio",
    "Liquidity",
    "Current-liability coverage",
    7.5,
    [H(1.5, 100), H(1.2, 80), H(1, 60), H(0.75, 40)],
    20,
    [requirement("currentLiabilities", "positive current liabilities")],
  ),
  higher(
    "quickRatio",
    "Liquidity",
    "Liquid-asset coverage",
    7.5,
    [H(1, 100), H(0.8, 80), H(0.6, 60), H(0.4, 40)],
    20,
    [requirement("currentLiabilities", "positive current liabilities")],
  ),
  higher(
    "grossMargin",
    "Profitability",
    "Gross-margin strength",
    4,
    [H(50, 100), H(35, 80), H(20, 60), H(10, 40), H(0, 20)],
    0,
    [requirement("revenue", "positive revenue")],
  ),
  higher(
    "operatingMargin",
    "Profitability",
    "Operating-margin strength",
    6,
    [H(25, 100), H(15, 80), H(8, 60), H(0, 40)],
    0,
    [requirement("revenue", "positive revenue")],
  ),
  higher(
    "netProfitMargin",
    "Profitability",
    "Net-margin strength",
    5,
    [H(20, 100), H(12, 80), H(6, 60), H(0, 40)],
    0,
    [requirement("revenue", "positive revenue")],
  ),
  higher(
    "returnOnAssets",
    "Profitability",
    "Asset-return strength",
    4,
    [H(15, 100), H(8, 80), H(4, 60), H(0, 40)],
    0,
    [requirement("endingTotalAssets", "positive ending total assets")],
  ),
  higher(
    "returnOnEquity",
    "Profitability",
    "Equity-return strength",
    6,
    [H(25, 100), H(15, 80), H(8, 60), H(0, 40)],
    0,
    [requirement("endingShareholdersEquity", "positive ending total equity")],
    { knownAdverseRequirementKeys: ["endingShareholdersEquity"] },
  ),
  lower(
    "debtToEquity",
    "Leverage",
    "Debt-to-equity restraint",
    4,
    [L(0.5, 100), L(1, 80), L(1.5, 60), L(2.5, 40)],
    20,
    [requirement("endingShareholdersEquity", "positive ending total equity")],
    false,
    { knownAdverseRequirementKeys: ["endingShareholdersEquity"] },
  ),
  lower(
    "debtRatio",
    "Leverage",
    "Liability-to-asset restraint",
    5,
    [L(0.35, 100), L(0.5, 80), L(0.65, 60), L(0.8, 40)],
    20,
    [requirement("endingTotalAssets", "positive ending total assets")],
  ),
  higher(
    "interestCoverage",
    "Leverage",
    "Interest-service capacity",
    6,
    [H(10, 100), H(5, 80), H(3, 60), H(1.5, 40), H(1, 20)],
    0,
    [requirement("interestExpense", "positive interest expense")],
  ),
  higher(
    "freeCashFlowMargin",
    "Cash Flow",
    "Free-cash-flow margin",
    8,
    [H(20, 100), H(12, 80), H(6, 60), H(0, 40)],
    0,
    [requirement("revenue", "positive revenue")],
  ),
  higher(
    "operatingCashFlowMargin",
    "Cash Flow",
    "Operating-cash-flow margin",
    6,
    [H(25, 100), H(15, 80), H(8, 60), H(0, 40)],
    0,
    [requirement("revenue", "positive revenue")],
  ),
  higher(
    "cashConversionRatio",
    "Cash Flow",
    "Earnings-to-cash conversion",
    6,
    [H(1.2, 100), H(1, 80), H(0.8, 60), H(0.5, 40), H(0, 20)],
    0,
    [requirement("netIncome", "positive net income")],
  ),
  lower(
    "priceToEarnings",
    "Valuation",
    "Price-to-earnings discipline",
    4,
    [L(15, 100), L(22, 80), L(30, 60), L(40, 40)],
    20,
    [],
    true,
  ),
  lower(
    "evToEbitda",
    "Valuation",
    "EV-to-EBITDA discipline",
    4,
    [L(8, 100), L(12, 80), L(16, 60), L(22, 40)],
    20,
    [],
    true,
  ),
  lower(
    "evToOperatingCashFlow",
    "Valuation",
    "EV-to-operating-cash-flow discipline",
    3,
    [L(10, 100), L(15, 80), L(20, 60), L(30, 40)],
    20,
    [],
    true,
  ),
  lower(
    "evToFreeCashFlow",
    "Valuation",
    "EV-to-free-cash-flow discipline",
    2,
    [L(15, 100), L(22, 80), L(30, 60), L(45, 40)],
    20,
    [],
    true,
  ),
  lower(
    "priceToSales",
    "Valuation",
    "Price-to-sales discipline",
    2,
    [L(2, 100), L(4, 80), L(7, 60), L(12, 40)],
    20,
    [],
    true,
  ),
]);

export const GENERAL_OPERATING_COMPANY_PROFILE = Object.freeze({
  id: "general-operating-company-v1",
  name: "General Operating Company",
  version: SCORING_VERSION,
  totalWeight: 100,
  minimumCoveragePercent: 80,
  excludedSicRanges: [
    { minimum: 4900, maximum: 4999, label: "regulated utilities" },
    { minimum: 6000, maximum: 6999, label: "finance, insurance, and real estate" },
  ],
  bands: [
    { minimum: 80, tier: "Tier A" },
    { minimum: 65, tier: "Tier B" },
    { minimum: 50, tier: "Tier C" },
    { minimum: 35, tier: "Tier D" },
    { minimum: 0, tier: "Tier E" },
  ],
  rules: scoringRules,
  policyNote:
    "Thresholds are versioned TMDL policy for non-financial operating companies. They are not universal market benchmarks or investment recommendations.",
});

function decimalString(value, places = 2) {
  return new Decimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_EVEN).toFixed(places);
}

function classificationFor(input) {
  const classification = input.companyClassification ?? {};
  const rawSic = String(classification.sic ?? input.acquisition?.sic ?? "").trim();
  const sic = /^\d{4}$/.test(rawSic) ? Number(rawSic) : null;
  const sicDescription = String(
    classification.sicDescription ?? input.acquisition?.sicDescription ?? "",
  ).trim();

  if (sic === null) {
    return {
      status: "Unclassified",
      sic: null,
      sicDescription,
      reason:
        "A four-digit SEC SIC classification is required before the General Operating Company profile can be applied.",
    };
  }

  const excluded = GENERAL_OPERATING_COMPANY_PROFILE.excludedSicRanges.find(
    (range) => sic >= range.minimum && sic <= range.maximum,
  );
  if (excluded) {
    return {
      status: "NotApplicable",
      sic: String(sic).padStart(4, "0"),
      sicDescription,
      reason: `SEC SIC ${String(sic).padStart(4, "0")} is within ${excluded.label}; a specialized scoring profile is required.`,
    };
  }

  return {
    status: "Eligible",
    sic: String(sic).padStart(4, "0"),
    sicDescription,
    reason: "SEC SIC falls within the supported non-financial operating-company boundary.",
  };
}

function scoreTier(score) {
  const numeric = new Decimal(score);
  return GENERAL_OPERATING_COMPANY_PROFILE.bands.find(
    (band) => numeric.greaterThanOrEqualTo(band.minimum),
  )?.tier ?? "Tier E";
}

function checkRequirements(rule, input) {
  for (const item of rule.requirements) {
    const value = input[item.key];
    const valid = typeof value === "number" && Number.isFinite(value) && value > item.value;
    if (!valid) return item;
  }
  return null;
}

function findBand(rule, value) {
  if (rule.direction === "higher") {
    return rule.thresholds.find((threshold) => value.greaterThanOrEqualTo(threshold.minimum));
  }
  return rule.thresholds.find((threshold) => value.lessThanOrEqualTo(threshold.maximum));
}

function policyText(rule) {
  const bands = rule.thresholds.map((threshold) => `${threshold.label} → ${threshold.score}`).join("; ");
  const fallbackBoundary = rule.direction === "higher"
    ? `< ${rule.thresholds.at(-1).minimum}`
    : `> ${rule.thresholds.at(-1).maximum}`;
  return `${bands}; ${fallbackBoundary} → ${rule.fallbackScore}`;
}

function scoreRule(rule, metricMap, unavailableMetricMap, input) {
  const metric = metricMap.get(rule.metricId);
  const base = {
    metricId: rule.metricId,
    family: rule.family,
    name: rule.name,
    weight: decimalString(rule.weight),
    maximumPoints: decimalString(rule.weight),
    policy: policyText(rule),
  };

  if (!metric) {
    const unavailable = unavailableMetricMap.get(rule.metricId);
    const missing = unavailable?.missingInputs?.length
      ? ` Missing governed inputs: ${unavailable.missingInputs.join(", ")}.`
      : "";
    return {
      ...base,
      status: "Unavailable",
      observedValue: null,
      unit: null,
      tierScore: null,
      awardedPoints: "0.00",
      matchedBand: null,
      rationale: unavailable
        ? `${unavailable.detail}${missing}`
        : "The governed engine did not produce this measurement.",
    };
  }

  const requirementFailure = checkRequirements(rule, input);
  const value = new Decimal(metric.value);
  const knownAdverseRequirement = requirementFailure &&
    rule.knownAdverseRequirementKeys?.includes(requirementFailure.key) &&
    typeof input[requirementFailure.key] === "number" &&
    Number.isFinite(input[requirementFailure.key]) &&
    input[requirementFailure.key] <= requirementFailure.value;
  if (knownAdverseRequirement) {
    return {
      ...base,
      status: "Scored",
      observedValue: metric.value,
      unit: metric.unit,
      tierScore: "0.00",
      awardedPoints: "0.00",
      matchedBand: "Nonpositive equity",
      rationale: "Ending total equity is nonpositive. This is observed adverse evidence rather than missing evidence, so the rule receives zero points and remains part of scoring coverage.",
    };
  }
  if (requirementFailure || (rule.positiveValueRequired && value.lessThanOrEqualTo(0))) {
    return {
      ...base,
      status: "Unavailable",
      observedValue: metric.value,
      unit: metric.unit,
      tierScore: null,
      awardedPoints: "0.00",
      matchedBand: null,
      rationale:
        requirementFailure
          ? `${requirementFailure.label} is required for a meaningful score.`
          : "A positive measurement is required for this valuation or leverage rule.",
    };
  }

  const band = findBand(rule, value);
  const tierScore = band?.score ?? rule.fallbackScore;
  const matchedBand = band?.label ?? (
    rule.direction === "higher"
      ? `< ${rule.thresholds.at(-1).minimum}`
      : `> ${rule.thresholds.at(-1).maximum}`
  );
  const awardedPoints = new Decimal(rule.weight).times(tierScore).dividedBy(100);
  return {
    ...base,
    status: "Scored",
    observedValue: metric.value,
    unit: metric.unit,
    tierScore: decimalString(tierScore),
    awardedPoints: decimalString(awardedPoints),
    matchedBand,
    rationale: `${matchedBand} receives ${tierScore} of 100 rule points.`,
  };
}

function summarizeFamily(family, rows) {
  const familyRows = rows.filter((row) => row.family === family);
  const totalWeight = Decimal.sum(...familyRows.map((row) => row.maximumPoints));
  const scoredRows = familyRows.filter((row) => row.status === "Scored");
  const availableWeight = scoredRows.length
    ? Decimal.sum(...scoredRows.map((row) => row.maximumPoints))
    : new Decimal(0);
  const earnedPoints = familyRows.length
    ? Decimal.sum(...familyRows.map((row) => row.awardedPoints))
    : new Decimal(0);
  const unavailableWeight = totalWeight.minus(availableWeight);
  const conservativeScore = totalWeight.isZero()
    ? new Decimal(0)
    : earnedPoints.dividedBy(totalWeight).times(100);
  const maximumScore = totalWeight.isZero()
    ? new Decimal(0)
    : earnedPoints.plus(unavailableWeight).dividedBy(totalWeight).times(100);
  const coveragePercent = totalWeight.isZero()
    ? new Decimal(0)
    : availableWeight.dividedBy(totalWeight).times(100);

  return {
    family,
    status: availableWeight.equals(totalWeight)
      ? "Complete"
      : availableWeight.isZero()
        ? "Unavailable"
        : "Partial",
    score: decimalString(conservativeScore),
    maximumScore: decimalString(maximumScore),
    tier: scoreTier(conservativeScore),
    earnedPoints: decimalString(earnedPoints),
    totalWeight: decimalString(totalWeight),
    availableWeight: decimalString(availableWeight),
    coveragePercent: decimalString(coveragePercent),
    rulesScored: scoredRows.length,
    rulesTotal: familyRows.length,
  };
}

export function scoreEvaluation({ metrics, unavailableMetrics = [], inputs }) {
  const classification = classificationFor(inputs);
  const base = {
    scoringVersion: SCORING_VERSION,
    profileId: GENERAL_OPERATING_COMPANY_PROFILE.id,
    profileName: GENERAL_OPERATING_COMPANY_PROFILE.name,
    profileNote: GENERAL_OPERATING_COMPANY_PROFILE.policyNote,
    classification,
    minimumCoveragePercent: decimalString(
      GENERAL_OPERATING_COMPANY_PROFILE.minimumCoveragePercent,
    ),
  };

  if (classification.status !== "Eligible") {
    return {
      ...base,
      status: classification.status,
      overallScore: null,
      maximumScore: null,
      tier: null,
      coveragePercent: "0.00",
      earnedPoints: "0.00",
      totalWeight: "100.00",
      availableWeight: "0.00",
      rulesScored: 0,
      rulesTotal: scoringRules.length,
      families: [],
      rules: [],
    };
  }

  const metricMap = new Map(metrics.map((metric) => [metric.id, metric]));
  const unavailableMetricMap = new Map(unavailableMetrics.map((metric) => [metric.id, metric]));
  const rules = scoringRules.map((rule) => scoreRule(rule, metricMap, unavailableMetricMap, inputs));
  const availableRows = rules.filter((row) => row.status === "Scored");
  const availableWeight = availableRows.length
    ? Decimal.sum(...availableRows.map((row) => row.maximumPoints))
    : new Decimal(0);
  const earnedPoints = Decimal.sum(...rules.map((row) => row.awardedPoints));
  const totalWeight = new Decimal(GENERAL_OPERATING_COMPANY_PROFILE.totalWeight);
  const unavailableWeight = totalWeight.minus(availableWeight);
  const coveragePercent = availableWeight.dividedBy(totalWeight).times(100);
  const maximumScore = earnedPoints.plus(unavailableWeight);
  const coverageSufficient = coveragePercent.greaterThanOrEqualTo(
    GENERAL_OPERATING_COMPANY_PROFILE.minimumCoveragePercent,
  );
  const overallScore = coverageSufficient ? decimalString(earnedPoints) : null;
  const familyNames = [...new Set(scoringRules.map((rule) => rule.family))];

  return {
    ...base,
    status: coverageSufficient ? "Scored" : "InsufficientCoverage",
    overallScore,
    maximumScore: decimalString(maximumScore),
    tier: overallScore === null ? null : scoreTier(overallScore),
    coveragePercent: decimalString(coveragePercent),
    earnedPoints: decimalString(earnedPoints),
    totalWeight: decimalString(totalWeight),
    availableWeight: decimalString(availableWeight),
    rulesScored: availableRows.length,
    rulesTotal: rules.length,
    families: familyNames.map((family) => summarizeFamily(family, rules)),
    rules,
  };
}

export function canonicalScoring(score) {
  return [
    score.scoringVersion,
    score.profileId,
    score.classification.status,
    score.classification.sic ?? "",
    score.status,
    score.overallScore ?? "",
    score.maximumScore ?? "",
    score.coveragePercent,
    ...(score.rules ?? []).map(
      (row) =>
        `${row.metricId}:${row.status}:${row.observedValue ?? ""}:${row.tierScore ?? ""}:${row.awardedPoints}`,
    ),
  ].join("|");
}
