/** Machine-readable Canonical Evidence registry for the implemented v5 slice. */

export const CANONICAL_REGISTRY_VERSION = "1.0.0";

const node = (key, canonicalName, canonicalEvidenceId, evidenceOrigin, periodType, unit, options = {}) => Object.freeze({
  key,
  canonicalName,
  canonicalEvidenceId,
  evidenceOrigin,
  periodType,
  unit,
  status: options.status ?? "Active",
  governingDocument: options.governingDocument ?? canonicalEvidenceId,
  governanceStatus: options.governanceStatus ?? (canonicalEvidenceId ? "Documented" : "ProvisionalDocumentGap"),
  notes: options.notes ?? null,
});

export const canonicalRegistryIssues = Object.freeze([
  Object.freeze({
    id: "DOC-CE-161-TITLE-CONFLICT",
    severity: "GovernanceReviewRequired",
    affectedIds: ["CE-161", "CE-162"],
    decision: "Use EN-101/EN-102 architecture ownership: CE-161 Average Accounts Receivable and CE-162 Receivables Turnover. Preserve the conflicting CE-161 source document without alteration.",
  }),
  Object.freeze({
    id: "DOC-CE-106-DEPENDENCY-ID-CONFLICT",
    severity: "DocumentationCorrectionRequired",
    affectedIds: ["CE-106", "CE-115", "CE-116"],
    decision: "Use CE-115 Preferred Equity and CE-116 Minority Interest, matching the later canonical files; do not use CE-107/CE-108 references printed in CE-106 section 7.",
  }),
  Object.freeze({
    id: "DOC-CANONICAL-COVERAGE-GAP",
    severity: "GovernanceBacklog",
    affectedIds: [],
    decision: "Calculations lacking an approved CE document retain stable calculation IDs and explicit ProvisionalDocumentGap status; the engine does not invent CE numbers.",
  }),
]);

export const canonicalEvidenceEntries = Object.freeze([
  node("marketCapitalization", "Market Capitalization", "CE-101", "Calculated", "PointInTime", "Currency"),
  node("sharePrice", "Share Price", "CE-102", "ExternalMarket", "PointInTime", "CurrencyPerShare"),
  node("sharesOutstanding", "Shares Outstanding", "CE-103", "Collected", "PointInTime", "Shares"),
  node("cashAndCashEquivalents", "Cash & Cash Equivalents", "CE-104", "Collected", "PointInTime", "Currency"),
  node("totalDebt", "Total Debt", "CE-105", "CollectedOrCalculated", "PointInTime", "Currency"),
  node("enterpriseValue", "Enterprise Value", "CE-106", "Calculated", "Mixed", "Currency"),
  node("revenue", "Revenue", "CE-107", "Collected", "Period", "Currency"),
  node("operatingIncome", "Operating Income", "CE-108", "Collected", "Period", "Currency"),
  node("endingShareholdersEquity", "Total Equity", "CE-114", "Collected", "PointInTime", "Currency"),
  node("preferredEquity", "Preferred Equity", "CE-115", "Collected", "PointInTime", "Currency"),
  node("minorityInterest", "Minority Interest", "CE-116", "Collected", "PointInTime", "Currency"),
  node("bookValue", "Book Value", "CE-117", "Calculated", "PointInTime", "Currency"),
  node("bookValuePerShare", "Book Value Per Share", "CE-118", "Calculated", "PointInTime", "CurrencyPerShare"),
  node("depreciation", "Depreciation", "CE-122", "Collected", "Period", "Currency"),
  node("amortization", "Amortization", "CE-123", "Collected", "Period", "Currency"),
  node("ebitda", "EBITDA", "CE-124", "Calculated", "Period", "Currency"),
  node("netIncome", "Net Income", "CE-126", "Collected", "Period", "Currency"),
  node("averageShareholdersEquity", "Average Total Equity", "CE-135", "Calculated", "PeriodAligned", "Currency"),
  node("averageTotalAssets", "Average Total Assets", "CE-136", "Calculated", "PeriodAligned", "Currency"),
  node("currentAssets", "Current Assets", "CE-138", "Collected", "PointInTime", "Currency"),
  node("currentLiabilities", "Current Liabilities", "CE-139", "Collected", "PointInTime", "Currency"),
  node("quickAssets", "Quick Assets", "CE-144", "Calculated", "PointInTime", "Currency"),
  node("endingInventory", "Inventory", "CE-145", "Collected", "PointInTime", "Currency"),
  node("prepaidExpenses", "Prepaid Expenses", "CE-146", "Collected", "PointInTime", "Currency"),
  node("quickRatio", "Quick Ratio", "CE-147", "Calculated", "PointInTime", "Ratio"),
  node("returnOnAssets", "Return on Assets", "CE-151", "Calculated", "PeriodAligned", "Percent"),
  node("returnOnEquity", "Return on Equity", "CE-152", "Calculated", "PeriodAligned", "Percent"),
  node("averageAccountsReceivable", "Average Accounts Receivable", "CE-161", "Calculated", "PeriodAligned", "Currency", { governanceStatus: "ArchitectureAssignedDocumentConflict", governingDocument: "EN-101/EN-102" }),
  node("receivablesTurnover", "Receivables Turnover", "CE-162", "Calculated", "PeriodAligned", "Ratio"),
  node("cashConversionCycle", "Cash Conversion Cycle", "CE-169", "Calculated", "Period", "Days", { governingDocument: "EN-102" }),
  node("financialLeverage", "Equity Multiplier", "CE-171", "Calculated", "PeriodAligned", "Ratio"),
]);

export const canonicalRegistry = Object.freeze(Object.fromEntries(
  canonicalEvidenceEntries.map((entry) => [entry.key, entry]),
));

export function canonicalFor(key) {
  return canonicalRegistry[key] ?? null;
}

export function canonicalRegistrySnapshot() {
  return {
    version: CANONICAL_REGISTRY_VERSION,
    entries: canonicalEvidenceEntries,
    issues: canonicalRegistryIssues,
  };
}
