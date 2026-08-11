import Decimal from "decimal.js";
import {
  canonicalScoring,
  scoreEvaluation,
  SCORING_VERSION,
} from "./evidence-scoring.mjs";
import { ALIAS_REGISTRY_VERSION } from "./alias-registry.mjs";
import {
  CALCULATION_REGISTRY_VERSION,
  calculationRegistry,
  calculationEntries,
  planRequestedOutputs,
  requestedCalculationIds,
} from "./calculation-registry.mjs";
import {
  CANONICAL_REGISTRY_VERSION,
  canonicalRegistryIssues,
} from "./canonical-registry.mjs";

/**
 * TMDL Evidence Engine — browser-native evaluation core.
 *
 * This module intentionally contains no UI or network access. The same inputs
 * always produce the same ordered metrics, family states, and SHA-256
 * fingerprint in every standards-compliant JavaScript runtime.
 */

export const ENGINE_VERSION = "6.4.0-browser";
export const PUBLICATION_SCHEMA_VERSION = "2.0";

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -100,
  toExpPos: 100,
});

export const microsoftFiscal2025 = Object.freeze({
  companyName: "Microsoft Corporation",
  ticker: "MSFT",
  periodStart: "2024-07-01",
  periodEnd: "2025-06-30",
  accessionNumber: "0000950170-25-100235",
  filingDate: "2025-07-30",
  filingUrl:
    "https://www.sec.gov/Archives/edgar/data/789019/000095017025100235/msft-20250630.htm",
  marketUrl: "https://www.microsoft.com/en-us/investor/stock-lookup",
  marketObservationDate: "2025-06-30",
  reportingCurrency: "USD",
  unitScale: "Millions",
  revenue: 281724,
  costOfRevenue: 87831,
  beginningAccountsReceivable: 56924,
  endingAccountsReceivable: 69905,
  beginningInventory: 1246,
  endingInventory: 938,
  beginningAccountsPayable: 21996,
  endingAccountsPayable: 27724,
  currentAssets: 191131,
  currentLiabilities: 141218,
  grossProfit: 193893,
  operatingIncome: 128528,
  netIncome: 101832,
  beginningTotalAssets: 512163,
  endingTotalAssets: 619003,
  totalLiabilities: 275524,
  totalDebt: 43151,
  beginningShareholdersEquity: 268477,
  endingShareholdersEquity: 343479,
  prepaidExpenses: 0,
  preferredEquity: 0,
  minorityInterest: 0,
  operatingCashFlow: 136162,
  capitalExpenditures: 64551,
  sharePrice: 493.47,
  sharesOutstanding: 7434,
  dilutedEarningsPerShare: 13.64,
  cashAndCashEquivalents: 30242,
  depreciation: null,
  amortization: null,
  depreciationAmortizationCombined: 34153,
  interestExpense: 2385,
  inputEvidence: {
    prepaidExpenses: {
      field: "prepaidExpenses",
      label: "Prepaid expenses",
      status: "NotReported",
      confidence: "High",
      value: 0,
      method: "controlled-baseline-optional-zero",
      reason: "No separate prepaid-expense component is represented in the governed Microsoft reference dataset.",
      taxonomy: null,
      concept: null,
      start: null,
      end: "2025-06-30",
    },
    preferredEquity: {
      field: "preferredEquity",
      label: "Preferred equity",
      status: "NotReported",
      confidence: "High",
      value: 0,
      method: "controlled-baseline-optional-zero",
      reason: "No preferred-equity component is represented in the governed Microsoft reference dataset.",
      taxonomy: null,
      concept: null,
      start: null,
      end: "2025-06-30",
    },
    minorityInterest: {
      field: "minorityInterest",
      label: "Minority interest",
      status: "NotReported",
      confidence: "High",
      value: 0,
      method: "controlled-baseline-optional-zero",
      reason: "No minority-interest component is represented in the governed Microsoft reference dataset.",
      taxonomy: null,
      concept: null,
      start: null,
      end: "2025-06-30",
    },
    depreciationAmortizationCombined: {
      field: "depreciationAmortizationCombined",
      label: "Combined depreciation and amortization disclosure",
      status: "Review",
      confidence: "Review",
      value: 34153,
      method: "controlled-baseline-combined-disclosure",
      reason: "Retained as source evidence but prohibited as a CE-124 v1.0 substitute for separate Depreciation and Amortization.",
      taxonomy: "us-gaap",
      concept: "DepreciationDepletionAndAmortization",
      start: "2024-07-01",
      end: "2025-06-30",
    },
  },
  companyClassification: {
    sic: "7372",
    sicDescription: "Services-Prepackaged Software",
    source: "Controlled Microsoft baseline",
  },
});

export const fieldGroups = [
  {
    id: "identity",
    title: "Company & reporting basis",
    description: "Identity, reporting period, units, and governed sources.",
    fields: [
      ["companyName", "Company name", "text"],
      ["ticker", "Ticker", "text"],
      ["periodStart", "Period start", "date"],
      ["periodEnd", "Period end", "date"],
      ["reportingCurrency", "Currency", "text"],
      ["unitScale", "Unit scale", "text"],
      ["accessionNumber", "Filing accession", "text"],
      ["filingDate", "Filing date", "date"],
      ["filingUrl", "SEC filing URL", "url"],
      ["marketUrl", "Market-price source URL", "url"],
      ["marketObservationDate", "Market-price observation date", "date"],
    ],
  },
  {
    id: "working-capital",
    title: "Working capital cycle",
    description: "Income-statement flows and beginning/ending operating balances.",
    fields: [
      ["revenue", "Revenue", "number"],
      ["costOfRevenue", "Cost of revenue", "number"],
      ["beginningAccountsReceivable", "Beginning accounts receivable", "number"],
      ["endingAccountsReceivable", "Ending accounts receivable", "number"],
      ["beginningInventory", "Beginning inventory", "number"],
      ["endingInventory", "Ending inventory", "number"],
      ["beginningAccountsPayable", "Beginning accounts payable", "number"],
      ["endingAccountsPayable", "Ending accounts payable", "number"],
    ],
  },
  {
    id: "statements",
    title: "Statements & capital structure",
    description: "Balance sheet, income statement, and cash-flow evidence.",
    fields: [
      ["currentAssets", "Current assets", "number"],
      ["currentLiabilities", "Current liabilities", "number"],
      ["grossProfit", "Gross profit", "number"],
      ["operatingIncome", "Operating income / EBIT", "number"],
      ["netIncome", "Net income", "number"],
      ["beginningTotalAssets", "Beginning total assets", "number"],
      ["endingTotalAssets", "Ending total assets", "number"],
      ["totalLiabilities", "Total liabilities", "number"],
      ["totalDebt", "Total debt", "number"],
      ["beginningShareholdersEquity", "Beginning total equity", "number"],
      ["endingShareholdersEquity", "Ending total equity", "number"],
      ["prepaidExpenses", "Prepaid expenses (0 only when not reported)", "number"],
      ["preferredEquity", "Preferred equity (0 only when not reported)", "number"],
      ["minorityInterest", "Minority interest (0 only when not reported)", "number"],
      ["operatingCashFlow", "Operating cash flow", "number"],
      ["capitalExpenditures", "Capital expenditures", "number"],
      ["depreciation", "Depreciation", "number"],
      ["amortization", "Amortization", "number"],
      ["depreciationAmortizationCombined", "Combined D&A disclosure (evidence only)", "number"],
      ["cashAndCashEquivalents", "Cash & cash equivalents", "number"],
      ["interestExpense", "Interest expense", "number"],
    ],
  },
  {
    id: "market",
    title: "Market evidence",
    description: "Dated market inputs used only by valuation measurements.",
    fields: [
      ["sharePrice", "Share price", "number"],
      ["sharesOutstanding", "Shares outstanding", "number"],
      ["dilutedEarningsPerShare", "Diluted earnings per share", "number"],
    ],
  },
];

export const metricDefinitions = Object.freeze(Object.fromEntries(
  calculationEntries
    .filter((definition) => definition.requestedOutput)
    .map((definition) => [definition.id, definition]),
));

const fieldLabels = new Map(
  fieldGroups.flatMap((group) => group.fields.map(([key, label]) => [key, label])),
);

export function labelForField(key) {
  return fieldLabels.get(key) ?? key;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateInputs(input) {
  const errors = {};
  const requiredText = [
    "companyName",
    "ticker",
    "periodStart",
    "periodEnd",
    "accessionNumber",
    "filingDate",
    "marketObservationDate",
    "reportingCurrency",
    "unitScale",
  ];
  requiredText.forEach((key) => {
    if (!String(input[key] ?? "").trim()) errors[key] = `${labelForField(key)} is required.`;
  });

  if (input.periodEnd && Number.isNaN(Date.parse(`${input.periodEnd}T00:00:00Z`)))
    errors.periodEnd = "Enter a valid period-end date.";
  if (input.periodStart && Number.isNaN(Date.parse(`${input.periodStart}T00:00:00Z`)))
    errors.periodStart = "Enter a valid period-start date.";
  if (input.periodStart && input.periodEnd && input.periodStart > input.periodEnd)
    errors.periodStart = "Period start must not follow period end.";
  if (input.filingDate && Number.isNaN(Date.parse(`${input.filingDate}T00:00:00Z`)))
    errors.filingDate = "Enter a valid filing date.";
  if (
    input.marketObservationDate &&
    Number.isNaN(Date.parse(`${input.marketObservationDate}T00:00:00Z`))
  )
    errors.marketObservationDate = "Enter a valid market-price observation date.";
  if (input.periodEnd && input.filingDate && input.filingDate < input.periodEnd)
    errors.filingDate = "Filing date cannot precede the reporting period end.";
  if (!isHttpsUrl(String(input.filingUrl ?? "")))
    errors.filingUrl = "Use an absolute HTTPS filing URL.";
  if (!isHttpsUrl(String(input.marketUrl ?? "")))
    errors.marketUrl = "Use an absolute HTTPS market-source URL.";

  const numericKeys = fieldGroups
    .flatMap((group) => group.fields)
    .filter(([, , type]) => type === "number")
    .map(([key]) => key);
  numericKeys.forEach((key) => {
    const value = input[key];
    const unavailable = value === null || value === undefined || value === "";
    if (!unavailable && (typeof value !== "number" || !Number.isFinite(value)))
      errors[key] = `${labelForField(key)} must be a finite number.`;
  });

  const positive = ["sharePrice", "sharesOutstanding"];
  positive.forEach((key) => {
    if (Number.isFinite(input[key]) && input[key] <= 0)
      errors[key] = `${labelForField(key)} must be greater than zero.`;
  });

  const nonNegative = [
    "beginningAccountsReceivable",
    "endingAccountsReceivable",
    "beginningInventory",
    "endingInventory",
    "beginningAccountsPayable",
    "endingAccountsPayable",
    "currentAssets",
    "currentLiabilities",
    "beginningTotalAssets",
    "endingTotalAssets",
    "totalLiabilities",
    "totalDebt",
    "prepaidExpenses",
    "preferredEquity",
    "depreciation",
    "amortization",
    "depreciationAmortizationCombined",
    "capitalExpenditures",
    "sharePrice",
    "cashAndCashEquivalents",
    "interestExpense",
  ];
  nonNegative.forEach((key) => {
    if (Number.isFinite(input[key]) && input[key] < 0)
      errors[key] = `${labelForField(key)} cannot be negative.`;
  });

  if (
    Number.isFinite(input.endingInventory) &&
    Number.isFinite(input.currentAssets) &&
    input.endingInventory > input.currentAssets
  ) {
    errors.endingInventory = "Ending inventory cannot exceed current assets.";
  }

  return errors;
}

function metric(id, value, input, derived, validation) {
  const definition = calculationRegistry[id];
  const exactValue = value instanceof Decimal ? value.toString() : new Decimal(value).toString();
  return {
    id,
    family: definition.family,
    name: definition.name,
    expression: definition.expression,
    canonicalEvidenceId: definition.canonicalEvidenceId,
    governanceReference: definition.governanceReference,
    governanceStatus: definition.governanceStatus,
    calculationId: definition.id,
    calculationVersion: definition.version,
    calculationRegistryVersion: CALCULATION_REGISTRY_VERSION,
    periodRule: definition.periodRule,
    validation,
    unit:
      definition.unit === "currency"
        ? `${input.reportingCurrency} ${input.unitScale}`
        : definition.unit,
    value: exactValue,
    lineage: definition.dependencies.map((key) => {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        const evidence = input.inputEvidence?.[key];
        return {
          key,
          label: labelForField(key),
          value: input[key],
          source: key === "sharePrice" ? "market" : key === "reportingPeriodDays" ? "parameter" : "filing",
          ...(evidence ? { evidence } : {}),
        };
      }
      return {
        key,
        label: calculationRegistry[key]?.name ?? labelForField(key),
        value: derived[key],
        source: "calculated",
        calculationId: calculationRegistry[key]?.id ?? null,
        calculationVersion: calculationRegistry[key]?.version ?? null,
      };
    }),
  };
}

function canonicalNumber(value) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(value))
    return "";
  return new Decimal(value).toString();
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Portable(value) {
  const source = new TextEncoder().encode(value);
  const bitLength = source.length * 8;
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(source);
  bytes[source.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1)
      words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((part) => part.toString(16).padStart(8, "0")).join("");
}

async function sha256(value) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256Portable(value);
}

export async function evaluateInputs(rawInput) {
  const input = {
    ...rawInput,
    ticker: String(rawInput.ticker ?? "").trim().toUpperCase(),
    endingTotalAssets: rawInput.endingTotalAssets ?? rawInput.totalAssets ?? null,
    endingShareholdersEquity:
      rawInput.endingShareholdersEquity ?? rawInput.shareholdersEquity ?? null,
  };
  const errors = validateInputs(input);
  if (Object.keys(errors).length) {
    const error = new Error("The evaluation contains governed input errors.");
    error.fieldErrors = errors;
    throw error;
  }

  const startTime = Date.parse(`${input.periodStart}T00:00:00Z`);
  const endTime = Date.parse(`${input.periodEnd}T00:00:00Z`);
  const reportingPeriodDays = Math.floor((endTime - startTime) / 86_400_000) + 1;
  if (!Number.isInteger(reportingPeriodDays) || reportingPeriodDays <= 0) {
    const error = new Error("The reporting period could not be resolved.");
    error.fieldErrors = { periodStart: "Invalid reporting-period day count." };
    throw error;
  }

  input.reportingPeriodDays = reportingPeriodDays;
  input.reportingPeriod = {
    periodId: `${input.ticker}-${input.periodStart}-${input.periodEnd}`,
    periodType: "FiscalYear",
    startDate: input.periodStart,
    endDate: input.periodEnd,
    actualDayCount: reportingPeriodDays,
    countingConvention: "actual_inclusive",
    calendarVersion: input.reportingCalendarVersion ?? "1.0.0",
    resolutionSource: input.acquisition ? "SEC annual duration context" : "Governed input dates",
    validationState: "Valid",
  };

  const plan = planRequestedOutputs();
  if (plan.status !== "Ready") {
    throw new Error(`The calculation registry is invalid: ${plan.missingRegistryNodes.join(", ")}`);
  }

  const hasNumber = (key) => typeof input[key] === "number" && Number.isFinite(input[key]);
  const values = new Map(
    Object.entries(input)
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
      .map(([key, value]) => [key, new Decimal(value)]),
  );
  const nodeStates = new Map();

  const evaluateOperation = (definition, dependencies) => {
    const operation = definition.operation.type;
    if (operation === "average")
      return dependencies.reduce((sum, value) => sum.plus(value), new Decimal(0)).dividedBy(dependencies.length);
    if (operation === "add")
      return dependencies.reduce((sum, value) => sum.plus(value), new Decimal(0));
    if (operation === "subtract")
      return dependencies.slice(1).reduce((value, subtractor) => value.minus(subtractor), dependencies[0]);
    if (operation === "multiply")
      return dependencies.reduce((product, value) => product.times(value), new Decimal(1));
    if (operation === "divide")
      return dependencies[0].dividedBy(dependencies[1]);
    if (operation === "percent")
      return dependencies[0].dividedBy(dependencies[1]).times(100);
    if (operation === "sumSubtractLast") {
      const additions = dependencies.slice(0, -1).reduce(
        (sum, value) => sum.plus(value),
        new Decimal(0),
      );
      return additions.minus(dependencies.at(-1));
    }
    throw new Error(`Unknown registered operation ${operation} for ${definition.id}.`);
  };

  for (const id of plan.orderedIds) {
    const definition = calculationRegistry[id];
    const missingInputs = definition.dependencies.filter((key) => !values.has(key));
    if (missingInputs.length) {
      const upstreamBlocked = missingInputs
        .map((key) => nodeStates.get(key))
        .find((state) => state?.status === "Unavailable");
      const combinedDisclosureOnly =
        id === "ebitda" &&
        hasNumber("depreciationAmortizationCombined") &&
        (!hasNumber("depreciation") || !hasNumber("amortization"));
      const beginningBalanceUnavailable =
        definition.periodRule === "ConsecutiveBeginningEndingBalances" &&
        missingInputs.some((key) => key.startsWith("beginning"));
      const expandedMissingInputs = upstreamBlocked?.missingInputs?.length
        ? upstreamBlocked.missingInputs
        : missingInputs;
      const reason = upstreamBlocked?.reason ?? (
        combinedDisclosureOnly
          ? "CombinedDisclosureNotPermitted"
          : beginningBalanceUnavailable
            ? "BeginningBalanceUnavailable"
            : "MissingGovernedInput"
      );
      nodeStates.set(id, {
        status: "Unavailable",
        reason,
        missingInputs: expandedMissingInputs,
        detail: upstreamBlocked?.detail ?? (combinedDisclosureOnly
          ? "CE-124 v1.0 requires separate Depreciation and Amortization. A combined D&A disclosure is retained as evidence but cannot be substituted."
          : beginningBalanceUnavailable
            ? "Blocked by dependency — an eligible beginning balance is unavailable."
            : `Unavailable because ${missingInputs.map((key) => calculationRegistry[key]?.name ?? labelForField(key)).join(", ")} ${missingInputs.length === 1 ? "is" : "are"} not available.`),
        validation: {
          status: "Blocked",
          outcomes: expandedMissingInputs.map((key) => ({
            code: key.startsWith("beginning")
              ? "BeginningBalanceUnavailable"
              : "DependencyUnavailable",
            status: "Fail",
            dependency: key,
          })),
        },
      });
      continue;
    }

    const dependencyValues = definition.dependencies.map((key) => values.get(key));
    const denominator = definition.denominator
      ? values.get(definition.denominator)
      : null;
    if (denominator?.isZero()) {
      nodeStates.set(id, {
        status: "Unavailable",
        reason: "ZeroDenominator",
        missingInputs: [],
        detail: `Unavailable because ${calculationRegistry[definition.denominator]?.name ?? labelForField(definition.denominator)} is zero.`,
        validation: {
          status: "Blocked",
          outcomes: [{
            code: "ZeroDenominator",
            status: "Fail",
            dependency: definition.denominator,
          }],
        },
      });
      continue;
    }

    const value = evaluateOperation(definition, dependencyValues);
    if (!value.isFinite()) {
      nodeStates.set(id, {
        status: "Unavailable",
        reason: "NonFiniteResult",
        missingInputs: [],
        detail: "The registered calculation did not produce a finite value.",
        validation: {
          status: "Blocked",
          outcomes: [{ code: "FiniteResult", status: "Fail" }],
        },
      });
      continue;
    }

    values.set(id, value);
    const expectedBeginningDate = new Date(startTime - 86_400_000).toISOString().slice(0, 10);
    const beginningDependencies = definition.dependencies.filter((key) => key.startsWith("beginning"));
    const upstreamPeriodNotice = definition.dependencies.some((key) =>
      nodeStates.get(key)?.validation?.outcomes?.some(
        (outcome) => outcome.code === "PeriodRule" && outcome.status === "Notice",
      ),
    );
    const beginningDates = beginningDependencies.map(
      (key) => input.inputEvidence?.[key]?.end ?? null,
    );
    const periodOutcome = definition.periodRule === "ActualInclusiveReportingPeriod"
      ? {
          code: "PeriodRule",
          status: "Pass",
          rule: definition.periodRule,
          actualDayCount: reportingPeriodDays,
        }
      : beginningDependencies.length
        ? beginningDates.every((date) => date === expectedBeginningDate)
          ? { code: "PeriodRule", status: "Pass", rule: definition.periodRule }
          : {
              code: "PeriodRule",
              status: "Notice",
              rule: definition.periodRule,
              reason: "Beginning-balance values are present, but source date lineage is unavailable for independent adjacency verification.",
            }
        : upstreamPeriodNotice
          ? {
              code: "PeriodRule",
              status: "Notice",
              rule: definition.periodRule,
              reason: "An upstream average-balance period relationship carries an adjacency notice.",
            }
          : { code: "PeriodRule", status: "Pass", rule: definition.periodRule };
    const validationNotice =
      definition.governanceStatus !== "Documented" || periodOutcome.status === "Notice";
    nodeStates.set(id, {
      status: "Valid",
      reason: null,
      missingInputs: [],
      detail: null,
      validation: {
        status: validationNotice ? "ValidWithGovernanceNotice" : "Valid",
        outcomes: [
          { code: "DependenciesAvailable", status: "Pass" },
          { code: "DeterministicOperation", status: "Pass" },
          periodOutcome,
          ...(definition.governanceStatus === "Documented"
            ? []
            : [{
                code: "GovernanceDocumentCoverage",
                status: "Notice",
                governanceStatus: definition.governanceStatus,
              }]),
        ],
      },
    });
  }

  const derived = Object.fromEntries(
    plan.orderedIds
      .filter((id) => values.has(id))
      .map((id) => [id, values.get(id).toString()]),
  );
  const metrics = [];
  const unavailableMetrics = [];
  for (const id of requestedCalculationIds) {
    const definition = calculationRegistry[id];
    const state = nodeStates.get(id);
    if (state?.status === "Valid") {
      metrics.push(metric(id, values.get(id), input, derived, state.validation));
    } else {
      unavailableMetrics.push({
        id,
        family: definition.family,
        name: definition.name,
        canonicalEvidenceId: definition.canonicalEvidenceId,
        governanceReference: definition.governanceReference,
        calculationId: definition.id,
        calculationVersion: definition.version,
        reason: state?.reason ?? "MissingGovernedInput",
        missingInputs: state?.missingInputs ?? definition.dependencies,
        detail: state?.detail ?? "The registered calculation is unavailable.",
        validation: state?.validation ?? {
          status: "Blocked",
          outcomes: [{ code: "DependencyUnavailable", status: "Fail" }],
        },
      });
    }
  }

  const familyNames = [
    "Efficiency",
    "Liquidity",
    "Profitability",
    "Leverage",
    "Cash Flow",
    "Valuation",
  ];
  const families = familyNames.map((family) => {
    const expected = Object.values(metricDefinitions).filter(
      (definition) => definition.family === family,
    ).length;
    const available = metrics.filter((item) => item.family === family).length;
    const unavailable = unavailableMetrics.filter((item) => item.family === family);
    const status = available === expected ? "Complete" : available === 0 ? "Unavailable" : "Partial";
    return {
      family,
      status,
      reason: status === "Complete" ? null : "MissingGovernedInput",
      detail:
        status === "Complete"
          ? null
          : `${available} of ${expected} measurements available. Unavailable: ${unavailable.map((item) => item.name).join(", ")}.`,
      metricCount: available,
      expectedMetricCount: expected,
    };
  });

  const sources = [
    {
      sourceType: "SEC Filing",
      identifier: input.accessionNumber,
      observationDate: input.filingDate,
      uri: input.filingUrl,
    },
    {
      sourceType: "Market Price",
      identifier: `${input.ticker} ${input.sharePrice}`,
      observationDate: input.marketObservationDate ?? input.periodEnd,
      uri: input.marketUrl,
    },
  ];

  const scoring = scoreEvaluation({ metrics, unavailableMetrics, inputs: input });
  const canonicalInputEvidence = Object.entries(input.inputEvidence ?? {})
    .filter(([key]) => !["sharePrice", "marketObservationDate", "marketUrl"].includes(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, evidence]) =>
      [
        key,
        evidence.status,
        evidence.method,
        evidence.taxonomy,
        evidence.concept,
        evidence.reportedUnit,
        evidence.reportedValue,
        evidence.start,
        evidence.end,
        evidence.accessionNumber,
        evidence.sourceLocation,
        evidence.resolutionVersion,
        evidence.reviewDecision?.decision,
        evidence.reviewDecision?.reviewer,
        evidence.reviewDecision?.reviewedAt,
        evidence.reviewDecision?.rationale,
        evidence.reviewDecision?.selectedCandidateId,
        [...(evidence.reviewDecision?.selectedCandidateIds ?? [])].sort().join(","),
        evidence.reviewDecision?.aggregationMethod,
        [...(evidence.reviewDecision?.candidateRecordsExamined ?? [])].sort().join(","),
        evidence.reviewDecision?.supportingSourceLocation,
        [...(evidence.reviewDecision?.supportingSourceLocations ?? [])].sort().join(","),
        evidence.reviewDecision?.reviewPolicyVersion,
        canonicalNumber(input[key]),
      ]
        .map((part) => part ?? "")
        .join(":"),
    )
    .join(",");

  const validation = {
    status: unavailableMetrics.length ? "ValidWithUnavailableCalculations" : "Valid",
    outcomes: [
      {
        code: "ReportingPeriodResolved",
        status: "Pass",
        actualDayCount: reportingPeriodDays,
        countingConvention: "actual_inclusive",
      },
      {
        code: "CalculationPlanResolved",
        status: "Pass",
        requestedNodeCount: requestedCalculationIds.length,
        executionNodeCount: plan.orderedIds.length,
      },
      {
        code: "RegistryIntegrity",
        status: "Pass",
        registryVersion: CALCULATION_REGISTRY_VERSION,
      },
      ...(unavailableMetrics.length
        ? [{
            code: "UnavailableCalculations",
            status: "Notice",
            count: unavailableMetrics.length,
          }]
        : []),
    ],
  };

  const canonical = [
    ENGINE_VERSION,
    PUBLICATION_SCHEMA_VERSION,
    CANONICAL_REGISTRY_VERSION,
    CALCULATION_REGISTRY_VERSION,
    ALIAS_REGISTRY_VERSION,
    input.acquisition?.version ?? "manual-input",
    input.evidenceResolutionVersion ?? "no-evidence-resolution-policy",
    input.companyName,
    input.periodStart,
    input.periodEnd,
    reportingPeriodDays,
    input.accessionNumber,
    input.filingUrl,
    `${input.ticker}:${input.periodEnd}:${canonicalNumber(input.sharePrice)}:${input.marketUrl}`,
    canonicalInputEvidence,
    families.map((family) => `${family.family}:${family.status}`).join(","),
    unavailableMetrics
      .map((item) => `${item.id}:${item.calculationVersion}:${item.reason}:${item.missingInputs.join(",")}`)
      .join(";"),
    canonicalScoring(scoring),
    ...metrics.map(
      (item) =>
        `${item.calculationId}@${item.calculationVersion}:${item.canonicalEvidenceId ?? "no-ce"}:${item.value}:${item.unit}`,
    ),
  ].join("|");

  return {
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    canonicalRegistryVersion: CANONICAL_REGISTRY_VERSION,
    calculationRegistryVersion: CALCULATION_REGISTRY_VERSION,
    aliasRegistryVersion: ALIAS_REGISTRY_VERSION,
    evidenceResolutionVersion: input.evidenceResolutionVersion ?? null,
    scoringVersion: SCORING_VERSION,
    generatedAt: new Date().toISOString(),
    companyName: input.companyName,
    ticker: input.ticker,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    reportingCurrency: input.reportingCurrency,
    unitScale: input.unitScale,
    reportingPeriod: input.reportingPeriod,
    executionPlan: {
      status: plan.status,
      requestedNodeCount: plan.requestedIds.length,
      executionNodeCount: plan.orderedIds.length,
      requestedIds: plan.requestedIds,
      orderedIds: plan.orderedIds,
      calculationRegistryVersion: plan.registryVersion,
    },
    validation,
    governanceIssues: canonicalRegistryIssues,
    sources,
    families,
    metrics,
    unavailableMetrics,
    derived,
    scoring,
    fingerprint: await sha256(canonical),
    inputs: input,
  };
}

export function formatMetric(metricItem, compact = false) {
  const options = metricItem.unit === "Percent"
    ? { minimumFractionDigits: compact ? 1 : 2, maximumFractionDigits: 2 }
    : metricItem.unit === "Days" || metricItem.unit === "Ratio"
      ? { minimumFractionDigits: compact ? 1 : 2, maximumFractionDigits: 4 }
      : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
  return new Intl.NumberFormat("en-US", options).format(
    new Decimal(metricItem.value).toNumber(),
  );
}

export function renderMarkdown(result) {
  const acquisition = result.inputs?.acquisition;
  const inputEvidence = result.inputs?.inputEvidence;
  const evidenceRows = inputEvidence ? Object.values(inputEvidence) : [];
  const resolutionDecisions = result.inputs?.resolutionDecisions ?? [];
  const safeCell = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
  const lines = [
    `# ${result.companyName} Evidence Evaluation`,
    "",
    `- Ticker: ${result.ticker}`,
    `- Reporting period: ${result.periodStart} through ${result.periodEnd} (${result.reportingPeriod.actualDayCount} actual inclusive days)`,
    `- Reporting basis: ${result.reportingCurrency} ${result.unitScale}`,
    `- Engine: ${result.engineVersion}`,
    `- Canonical registry: ${result.canonicalRegistryVersion}`,
    `- Calculation registry: ${result.calculationRegistryVersion}`,
    `- Alias registry: ${result.aliasRegistryVersion}`,
    `- Publication schema: ${result.schemaVersion}`,
    `- Scoring policy: ${result.scoring?.profileName ?? "Not available"} ${result.scoring?.scoringVersion ?? ""}`,
    `- Fingerprint: \`${result.fingerprint}\``,
    "",
    "## Governed score",
    "",
    ...(result.scoring?.status === "Scored"
      ? [
          `- Conservative score: **${result.scoring.overallScore} / 100** (${result.scoring.tier})`,
          `- Score range with unavailable rules: ${result.scoring.overallScore}–${result.scoring.maximumScore}`,
          `- Scoring coverage: ${result.scoring.coveragePercent}% (${result.scoring.rulesScored} of ${result.scoring.rulesTotal} rules)`,
          `- Profile applicability: SEC SIC ${result.scoring.classification.sic} ${result.scoring.classification.sicDescription}`,
          "",
          "| Family | Conservative score | Maximum score | Coverage | Rules |",
          "|---|---:|---:|---:|---:|",
          ...result.scoring.families.map(
            (family) =>
              `| ${family.family} | ${family.score} | ${family.maximumScore} | ${family.coveragePercent}% | ${family.rulesScored}/${family.rulesTotal} |`,
          ),
          "",
          "### Point audit",
          "",
          "| Family | Rule | Observed | Band | Weight | Rule score | Awarded | Status |",
          "|---|---|---:|---|---:|---:|---:|---|",
          ...result.scoring.rules.map(
            (row) =>
              `| ${safeCell(row.family)} | ${safeCell(row.name)} | ${safeCell(row.observedValue)} | ${safeCell(row.matchedBand)} | ${row.weight} | ${safeCell(row.tierScore)} | ${row.awardedPoints} | ${row.status} |`,
          ),
          "",
        ]
      : [
          `- Status: **${result.scoring?.status ?? "Unavailable"}**`,
          `- Reason: ${result.scoring?.classification?.reason ?? "No scoring profile is available."}`,
          ...(result.scoring?.status === "InsufficientCoverage"
            ? [
                `- Scoring coverage: ${result.scoring.coveragePercent}%`,
                `- Conservative points: ${result.scoring.earnedPoints}; maximum with unavailable rules: ${result.scoring.maximumScore}`,
              ]
            : []),
          "",
        ]),
    `> ${result.scoring?.profileNote ?? "Scoring is a versioned research policy."}`,
    "",
    "## Family status",
    "",
    "| Family | Status | Measurements | Detail |",
    "|---|---|---:|---|",
    ...result.families.map(
      (family) =>
        `| ${family.family} | ${family.status} | ${family.metricCount} | ${family.detail ?? ""} |`,
    ),
    "",
    "## Evidence measurements",
    "",
    "| Family | Measurement | CE / governance | Calculation | Value | Unit | Formula | Validation |",
    "|---|---|---|---|---:|---|---|---|",
    ...result.metrics.map(
      (item) =>
        `| ${item.family} | ${item.name} | ${item.canonicalEvidenceId ?? item.governanceReference ?? "Document gap"} | ${item.calculationId}@${item.calculationVersion} | ${formatMetric(item)} | ${item.unit} | ${item.expression} | ${item.validation.status} |`,
    ),
    "",
    ...(result.unavailableMetrics?.length
      ? [
          "## Unavailable measurements",
          "",
          "| Family | Measurement | Reason | Missing inputs or dependencies |",
          "|---|---|---|---|",
          ...result.unavailableMetrics.map(
            (item) =>
              `| ${safeCell(item.family)} | ${safeCell(item.name)} | ${safeCell(item.reason)} | ${safeCell(item.missingInputs.map((key) => calculationRegistry[key]?.name ?? labelForField(key)).join(", "))} |`,
          ),
          "",
        ]
      : []),
    ...(acquisition
      ? [
          "## Acquisition record",
          "",
          `- Acquisition version: ${acquisition.version}`,
          `- Source: ${acquisition.source}`,
          `- CIK: ${acquisition.cik}`,
          `- Acquired at: ${acquisition.acquiredAt}`,
          `- Evidence-resolution policy: ${result.evidenceResolutionVersion ?? "Not applied"}`,
          "",
          "| Input | Status | Value | Concept or method | Period | Review note |",
          "|---|---|---:|---|---|---|",
          ...evidenceRows.map((item) =>
            `| ${safeCell(item.label ?? item.field)} | ${safeCell(item.status)} | ${safeCell(item.value)} | ${safeCell(item.concept ? `${item.taxonomy}:${item.concept}` : item.method)} | ${safeCell(item.start ? `${item.start} → ${item.end}` : item.end)} | ${safeCell(item.reason)} |`,
          ),
          "",
          ...(resolutionDecisions.length
            ? [
                "### Governed evidence-resolution decisions",
                "",
                "| Input | Decision | Reviewer | Reviewed at | Selected candidate(s) | Rationale | Source location(s) | Policy |",
                "|---|---|---|---|---|---|---|---|",
                ...resolutionDecisions.map((decision) =>
                  `| ${safeCell(decision.field)} | ${safeCell(decision.aggregationMethod ? `${decision.decision} (${decision.aggregationMethod})` : decision.decision)} | ${safeCell(decision.reviewer)} | ${safeCell(decision.reviewedAt)} | ${safeCell((decision.selectedCandidateIds?.length ? decision.selectedCandidateIds : [decision.selectedCandidateId].filter(Boolean)).join(", ") || "None — all rejected")} | ${safeCell(decision.rationale)} | ${safeCell((decision.supportingSourceLocations?.length ? decision.supportingSourceLocations : [decision.supportingSourceLocation].filter(Boolean)).join(", "))} | ${safeCell(decision.reviewPolicyVersion)} |`,
                ),
                "",
              ]
            : []),
        ]
      : []),
    "## Sources",
    "",
    ...result.sources.map(
      (source) =>
        `- [${source.sourceType}: ${source.identifier}](${source.uri}) — ${source.observationDate}`,
    ),
    "",
    "> This transparent rules-based score is a research aid, not a ranking, price target, or investment recommendation.",
    "",
  ];
  return lines.join("\n");
}
