/**
 * Executable source-alias registry.
 *
 * This is the single production owner of SEC taxonomy aliases used by both
 * Company Facts mapping and Inline XBRL evidence resolution.  Registry data is
 * intentionally serializable; compiled regular expressions are derived below.
 */

export const ALIAS_REGISTRY_VERSION = "1.2.0";

const entries = [
  ["revenue", "duration", ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], ["revenue", "netsales"], { excludedPatterns: ["deferred", "remaining", "segment"] }],
  ["costOfRevenue", "duration", ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold", "CostOfSales", "CostOfServices"], ["^costof(revenue|sales|goods(andservices)?sold|services)$"], { absolute: true, excludedPatterns: ["costsandexpenses", "operatingexpenses", "sellinggeneral", "researchanddevelopment"] }],
  ["grossProfit", "duration", ["GrossProfit"], ["grossprofit"]],
  ["operatingIncome", "duration", ["OperatingIncomeLoss"], ["^operatingincome(loss)?$", "^operatingprofit(loss)?$", "^incomefromoperations$", "^operatingearnings$"], { excludedPatterns: ["nonoperating", "segment"] }],
  ["netIncome", "duration", ["NetIncomeLoss", "ProfitLoss"], ["netincome", "^profitloss$"], { excludedPatterns: ["noncontrolling", "pershare"] }],
  ["operatingCashFlow", "duration", ["NetCashProvidedByUsedInOperatingActivities"], ["cash.*operatingactivities"]],
  ["capitalExpenditures", "duration", ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"], ["payments.*acquire.*(property|productiveassets)", "capitalexpenditures"], { absolute: true }],
  ["depreciation", "duration", ["Depreciation", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment"], ["^depreciation$", "depreciation.*propertyplant"], { absolute: true, confidence: "Review", rationale: "Confirm the fact is depreciation only and excludes amortization." }],
  ["amortization", "duration", ["AmortizationOfIntangibleAssets", "FiniteLivedIntangibleAssetsAmortizationExpense"], ["amortization.*intangible", "intangibleassetsamortization"], { absolute: true, confidence: "Review", rationale: "Confirm the fact is amortization expense for the governed reporting period." }],
  ["depreciationAmortizationCombined", "duration", ["DepreciationDepletionAndAmortization"], ["depreciation.*amortization"], { absolute: true, confidence: "Review", rationale: "Retained as evidence only. CE-124 v1.0 prohibits using a combined disclosure as canonical EBITDA input." }],
  ["interestExpense", "duration", ["InterestExpenseNonOperating", "InterestExpenseNonoperating", "InterestAndDebtExpense", "InterestExpense", "InterestExpenseOperating"], ["interest.*expense", "interest.*financingcost", "financecost", "borrowingcost"], { absolute: true, confidence: "Review", excludedPatterns: ["interestincome", "otherincomeexpense", "nonoperatingincomeexpense", "increase.*interestexpense", "sensitivity"], rationale: "Interest presentation varies by issuer. Net or combined other-income facts require semantic review." }],
  ["dilutedEarningsPerShare", "duration", ["EarningsPerShareDiluted"], ["earningspersharediluted", "diluted.*pershare"], { scale: "per-share" }],
  ["beginningAccountsReceivable", "beginning", ["AccountsReceivableNetCurrent", "AccountsReceivableNet"], ["accountsreceivable.*net", "tradereceivable"]],
  ["endingAccountsReceivable", "ending", ["AccountsReceivableNetCurrent", "AccountsReceivableNet"], ["accountsreceivable.*net", "tradereceivable"]],
  ["beginningInventory", "beginning", ["InventoryNet", "InventoryNetCurrent"], ["inventory.*net", "^inventory$"]],
  ["endingInventory", "ending", ["InventoryNet", "InventoryNetCurrent"], ["inventory.*net", "^inventory$"]],
  ["beginningAccountsPayable", "beginning", ["AccountsPayableCurrent", "AccountsPayableTradeCurrent"], ["accountspayable", "tradepayable"]],
  ["endingAccountsPayable", "ending", ["AccountsPayableCurrent", "AccountsPayableTradeCurrent"], ["accountspayable", "tradepayable"]],
  ["currentAssets", "ending", ["AssetsCurrent"], ["currentassets"]],
  ["currentLiabilities", "ending", ["LiabilitiesCurrent"], ["currentliabilities"]],
  ["beginningTotalAssets", "beginning", ["Assets"], ["totalassets", "^assets$"]],
  ["endingTotalAssets", "ending", ["Assets"], ["totalassets", "^assets$"]],
  ["totalLiabilities", "ending", ["Liabilities"], ["totalliabilities", "^liabilities$"]],
  ["beginningShareholdersEquity", "beginning", ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], ["stockholders.*equity", "shareholders.*equity"]],
  ["endingShareholdersEquity", "ending", ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], ["stockholders.*equity", "shareholders.*equity"]],
  ["prepaidExpenses", "ending", ["PrepaidExpenseCurrent", "PrepaidExpensesCurrent", "PrepaidExpenseAndOtherAssetsCurrent"], ["prepaid.*expense"], { optionalIfNotReported: true, reviewConcepts: ["PrepaidExpenseAndOtherAssetsCurrent"], reviewRationale: "This standard concept combines prepaid expenses with other current assets. It is retained as a conservative quick-assets deduction and remains visibly tagged for review." }],
  ["preferredEquity", "ending", ["PreferredStocksIncludingAdditionalPaidInCapitalParOrStatedValue", "PreferredStockValue"], ["preferred.*(stock|equity).*value"], { optionalIfNotReported: true, confidence: "Review" }],
  ["minorityInterest", "ending", ["MinorityInterest", "NoncontrollingInterestInConsolidatedEntity"], ["minorityinterest", "noncontrollinginterest"], { optionalIfNotReported: true, confidence: "Review" }],
  ["cashAndCashEquivalents", "ending", ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"], ["cash.*equivalents"], { excludedPatterns: ["cashflow"] }],
  ["totalDebt", "ending", ["LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities", "LongTermDebtAndFinanceLeaseObligations", "LongTermDebtAndCapitalLeaseObligations", "LongTermDebt"], ["totaldebt", "longtermdebt", "borrowings"], { confidence: "Review", excludedPatterns: ["maturities", "proceeds", "payments", "interest"], rationale: "Confirm that the candidate includes the intended current and noncurrent debt scope." }],
  ["sharesOutstanding", "cover", ["EntityCommonStockSharesOutstanding"], ["commonstocksharesoutstanding", "sharesoutstanding"], { taxonomy: "dei", scale: "shares" }],
];

export const aliasRegistryEntries = Object.freeze(entries.map(([field, periodMode, concepts, candidatePatterns, options = {}]) => Object.freeze({
  field,
  periodMode,
  concepts: Object.freeze(concepts),
  candidatePatterns: Object.freeze(candidatePatterns),
  excludedPatterns: Object.freeze(options.excludedPatterns ?? []),
  taxonomy: options.taxonomy ?? "us-gaap",
  scale: options.scale ?? "millions",
  absolute: options.absolute ?? false,
  confidence: options.confidence ?? "High",
  rationale: options.rationale ?? null,
  reviewConcepts: Object.freeze(options.reviewConcepts ?? []),
  reviewRationale: options.reviewRationale ?? null,
  optionalIfNotReported: options.optionalIfNotReported ?? false,
})));

const compile = (pattern) => new RegExp(pattern, "i");

export const filingResolutionPolicies = Object.freeze(Object.fromEntries(
  aliasRegistryEntries.map((entry) => [entry.field, Object.freeze({
    ...entry,
    candidatePatterns: entry.candidatePatterns.map(compile),
    excludedPatterns: entry.excludedPatterns.map(compile),
  })]),
));

export const companyFactsDurationMappings = Object.freeze(
  aliasRegistryEntries.filter((entry) => entry.periodMode === "duration"),
);

export const companyFactsInstantMappings = Object.freeze(
  aliasRegistryEntries.filter((entry) => entry.periodMode === "ending" && ![
    "totalDebt",
  ].includes(entry.field)),
);

export function aliasRegistrySnapshot() {
  return {
    version: ALIAS_REGISTRY_VERSION,
    entries: aliasRegistryEntries.map((entry) => ({ ...entry })),
  };
}
