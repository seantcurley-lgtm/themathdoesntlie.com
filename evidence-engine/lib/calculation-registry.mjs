import { canonicalFor } from "./canonical-registry.mjs";

export const CALCULATION_REGISTRY_VERSION = "1.0.0";

const calc = (id, name, family, unit, expression, dependencies, operation, options = {}) => Object.freeze({
  id,
  version: "1.0.0",
  outputKey: options.outputKey ?? id,
  name,
  family,
  unit,
  expression,
  dependencies: Object.freeze(dependencies),
  operation: Object.freeze(operation),
  requestedOutput: options.requestedOutput ?? false,
  denominator: options.denominator ?? null,
  periodRule: options.periodRule ?? "SameGovernedContext",
  canonicalEvidenceId: options.canonicalEvidenceId ?? canonicalFor(options.outputKey ?? id)?.canonicalEvidenceId ?? null,
  governanceReference: options.governanceReference ?? canonicalFor(options.outputKey ?? id)?.governingDocument ?? null,
  governanceStatus: options.governanceStatus ?? canonicalFor(options.outputKey ?? id)?.governanceStatus ?? "ProvisionalDocumentGap",
});

export const calculationEntries = Object.freeze([
  calc("averageAccountsReceivable", "Average Accounts Receivable", "Intermediate", "currency", "(Beginning accounts receivable + Ending accounts receivable) ÷ 2", ["beginningAccountsReceivable", "endingAccountsReceivable"], { type: "average" }, { outputKey: "averageAccountsReceivable", periodRule: "ConsecutiveBeginningEndingBalances" }),
  calc("receivablesTurnover", "Receivables Turnover", "Intermediate", "Ratio", "Revenue ÷ Average accounts receivable", ["revenue", "averageAccountsReceivable"], { type: "divide" }, { denominator: "averageAccountsReceivable" }),
  calc("averageInventory", "Average Inventory", "Intermediate", "currency", "(Beginning inventory + Ending inventory) ÷ 2", ["beginningInventory", "endingInventory"], { type: "average" }, { periodRule: "ConsecutiveBeginningEndingBalances" }),
  calc("inventoryTurnover", "Inventory Turnover", "Intermediate", "Ratio", "Cost of revenue ÷ Average inventory", ["costOfRevenue", "averageInventory"], { type: "divide" }, { denominator: "averageInventory" }),
  calc("averageAccountsPayable", "Average Accounts Payable", "Intermediate", "currency", "(Beginning accounts payable + Ending accounts payable) ÷ 2", ["beginningAccountsPayable", "endingAccountsPayable"], { type: "average" }, { periodRule: "ConsecutiveBeginningEndingBalances" }),
  calc("payablesTurnover", "Payables Turnover", "Intermediate", "Ratio", "Cost of revenue ÷ Average accounts payable", ["costOfRevenue", "averageAccountsPayable"], { type: "divide" }, { denominator: "averageAccountsPayable" }),
  calc("averageTotalAssets", "Average Total Assets", "Intermediate", "currency", "(Beginning total assets + Ending total assets) ÷ 2", ["beginningTotalAssets", "endingTotalAssets"], { type: "average" }, { periodRule: "ConsecutiveBeginningEndingBalances" }),
  calc("averageShareholdersEquity", "Average Total Equity", "Intermediate", "currency", "(Beginning total equity + Ending total equity) ÷ 2", ["beginningShareholdersEquity", "endingShareholdersEquity"], { type: "average" }, { periodRule: "ConsecutiveBeginningEndingBalances" }),
  calc("quickAssets", "Quick Assets", "Intermediate", "currency", "Current assets − Inventory − Prepaid expenses", ["currentAssets", "endingInventory", "prepaidExpenses"], { type: "subtract" }),
  calc("freeCashFlow", "Free Cash Flow", "Cash Flow", "currency", "Operating cash flow − Capital expenditures", ["operatingCashFlow", "capitalExpenditures"], { type: "subtract" }, { requestedOutput: true }),
  calc("marketCapitalization", "Market Capitalization", "Intermediate", "currency", "Share price × Shares outstanding", ["sharePrice", "sharesOutstanding"], { type: "multiply" }),
  calc("enterpriseValue", "Enterprise Value", "Intermediate", "currency", "Market capitalization + Total debt + Preferred equity + Minority interest − Cash & cash equivalents", ["marketCapitalization", "totalDebt", "preferredEquity", "minorityInterest", "cashAndCashEquivalents"], { type: "sumSubtractLast" }),
  calc("ebitda", "EBITDA", "Intermediate", "currency", "Operating income + Depreciation + Amortization", ["operatingIncome", "depreciation", "amortization"], { type: "add" }),
  calc("bookValue", "Book Value", "Intermediate", "currency", "Total equity − Preferred equity", ["endingShareholdersEquity", "preferredEquity"], { type: "subtract" }),
  calc("bookValuePerShare", "Book Value Per Share", "Intermediate", "CurrencyPerShare", "Book value ÷ Shares outstanding", ["bookValue", "sharesOutstanding"], { type: "divide" }, { denominator: "sharesOutstanding" }),

  calc("dso", "Days Sales Outstanding", "Efficiency", "Days", "Reporting period days ÷ Receivables turnover", ["reportingPeriodDays", "receivablesTurnover"], { type: "divide" }, { requestedOutput: true, denominator: "receivablesTurnover", periodRule: "ActualInclusiveReportingPeriod" }),
  calc("dio", "Days Inventory Outstanding", "Efficiency", "Days", "Reporting period days ÷ Inventory turnover", ["reportingPeriodDays", "inventoryTurnover"], { type: "divide" }, { requestedOutput: true, denominator: "inventoryTurnover", periodRule: "ActualInclusiveReportingPeriod" }),
  calc("dpo", "Days Payables Outstanding", "Efficiency", "Days", "Reporting period days ÷ Payables turnover", ["reportingPeriodDays", "payablesTurnover"], { type: "divide" }, { requestedOutput: true, denominator: "payablesTurnover", periodRule: "ActualInclusiveReportingPeriod" }),
  calc("ccc", "Cash Conversion Cycle", "Efficiency", "Days", "DSO + DIO − DPO", ["dso", "dio", "dpo"], { type: "sumSubtractLast" }, { requestedOutput: true, outputKey: "cashConversionCycle" }),
  calc("currentRatio", "Current Ratio", "Liquidity", "Ratio", "Current assets ÷ Current liabilities", ["currentAssets", "currentLiabilities"], { type: "divide" }, { requestedOutput: true, denominator: "currentLiabilities" }),
  calc("quickRatio", "Quick Ratio", "Liquidity", "Ratio", "Quick assets ÷ Current liabilities", ["quickAssets", "currentLiabilities"], { type: "divide" }, { requestedOutput: true, denominator: "currentLiabilities" }),
  calc("workingCapital", "Working Capital", "Liquidity", "currency", "Current assets − Current liabilities", ["currentAssets", "currentLiabilities"], { type: "subtract" }, { requestedOutput: true }),
  calc("grossMargin", "Gross Margin", "Profitability", "Percent", "Gross profit ÷ Revenue × 100", ["grossProfit", "revenue"], { type: "percent" }, { requestedOutput: true, denominator: "revenue" }),
  calc("operatingMargin", "Operating Margin", "Profitability", "Percent", "Operating income ÷ Revenue × 100", ["operatingIncome", "revenue"], { type: "percent" }, { requestedOutput: true, denominator: "revenue" }),
  calc("netProfitMargin", "Net Profit Margin", "Profitability", "Percent", "Net income ÷ Revenue × 100", ["netIncome", "revenue"], { type: "percent" }, { requestedOutput: true, denominator: "revenue" }),
  calc("returnOnAssets", "Return on Assets", "Profitability", "Percent", "Net income ÷ Average total assets × 100", ["netIncome", "averageTotalAssets"], { type: "percent" }, { requestedOutput: true, denominator: "averageTotalAssets", periodRule: "FlowToConsecutiveAverageBalance" }),
  calc("returnOnEquity", "Return on Equity", "Profitability", "Percent", "Net income ÷ Average total equity × 100", ["netIncome", "averageShareholdersEquity"], { type: "percent" }, { requestedOutput: true, denominator: "averageShareholdersEquity", periodRule: "FlowToConsecutiveAverageBalance" }),
  calc("debtToEquity", "Debt to Equity Ratio", "Leverage", "Ratio", "Total debt ÷ Ending total equity", ["totalDebt", "endingShareholdersEquity"], { type: "divide" }, { requestedOutput: true, denominator: "endingShareholdersEquity" }),
  calc("debtRatio", "Debt Ratio", "Leverage", "Ratio", "Total liabilities ÷ Ending total assets", ["totalLiabilities", "endingTotalAssets"], { type: "divide" }, { requestedOutput: true, denominator: "endingTotalAssets" }),
  calc("equityRatio", "Equity Ratio", "Leverage", "Ratio", "Ending total equity ÷ Ending total assets", ["endingShareholdersEquity", "endingTotalAssets"], { type: "divide" }, { requestedOutput: true, denominator: "endingTotalAssets" }),
  calc("financialLeverage", "Equity Multiplier", "Leverage", "Ratio", "Average total assets ÷ Average total equity", ["averageTotalAssets", "averageShareholdersEquity"], { type: "divide" }, { requestedOutput: true, denominator: "averageShareholdersEquity", periodRule: "ConsecutiveAverageBalances" }),
  calc("interestCoverage", "Interest Coverage", "Leverage", "Ratio", "Operating income ÷ Interest expense", ["operatingIncome", "interestExpense"], { type: "divide" }, { requestedOutput: true, denominator: "interestExpense" }),
  calc("operatingCashFlowRatio", "Operating Cash Flow Ratio", "Cash Flow", "Ratio", "Operating cash flow ÷ Current liabilities", ["operatingCashFlow", "currentLiabilities"], { type: "divide" }, { requestedOutput: true, denominator: "currentLiabilities" }),
  calc("freeCashFlowMargin", "Free Cash Flow Margin", "Cash Flow", "Percent", "Free cash flow ÷ Revenue × 100", ["freeCashFlow", "revenue"], { type: "percent" }, { requestedOutput: true, denominator: "revenue" }),
  calc("operatingCashFlowMargin", "Operating Cash Flow Margin", "Cash Flow", "Percent", "Operating cash flow ÷ Revenue × 100", ["operatingCashFlow", "revenue"], { type: "percent" }, { requestedOutput: true, denominator: "revenue" }),
  calc("cashConversionRatio", "Cash Conversion Ratio", "Cash Flow", "Ratio", "Operating cash flow ÷ Net income", ["operatingCashFlow", "netIncome"], { type: "divide" }, { requestedOutput: true, denominator: "netIncome" }),
  calc("priceToBook", "Price-to-Book", "Valuation", "Ratio", "Share price ÷ Book value per share", ["sharePrice", "bookValuePerShare"], { type: "divide" }, { requestedOutput: true, denominator: "bookValuePerShare", governanceReference: "ES-501" }),
  calc("priceToEarnings", "Price-to-Earnings", "Valuation", "Ratio", "Share price ÷ Diluted earnings per share", ["sharePrice", "dilutedEarningsPerShare"], { type: "divide" }, { requestedOutput: true, denominator: "dilutedEarningsPerShare", governanceReference: "ES-502" }),
  calc("priceToSales", "Price-to-Sales", "Valuation", "Ratio", "Market capitalization ÷ Revenue", ["marketCapitalization", "revenue"], { type: "divide" }, { requestedOutput: true, denominator: "revenue", governanceReference: "ES-505" }),
  calc("evToOperatingCashFlow", "Enterprise Value to Operating Cash Flow", "Valuation", "Ratio", "Enterprise value ÷ Operating cash flow", ["enterpriseValue", "operatingCashFlow"], { type: "divide" }, { requestedOutput: true, denominator: "operatingCashFlow" }),
  calc("evToFreeCashFlow", "Enterprise Value to Free Cash Flow", "Valuation", "Ratio", "Enterprise value ÷ Free cash flow", ["enterpriseValue", "freeCashFlow"], { type: "divide" }, { requestedOutput: true, denominator: "freeCashFlow" }),
  calc("evToEbitda", "Enterprise Value to EBITDA", "Valuation", "Ratio", "Enterprise value ÷ EBITDA", ["enterpriseValue", "ebitda"], { type: "divide" }, { requestedOutput: true, denominator: "ebitda" }),
  calc("evToEbit", "Enterprise Value to EBIT", "Valuation", "Ratio", "Enterprise value ÷ Operating income", ["enterpriseValue", "operatingIncome"], { type: "divide" }, { requestedOutput: true, denominator: "operatingIncome" }),
  calc("evToSales", "Enterprise Value to Sales", "Valuation", "Ratio", "Enterprise value ÷ Revenue", ["enterpriseValue", "revenue"], { type: "divide" }, { requestedOutput: true, denominator: "revenue" }),
]);

export const calculationRegistry = Object.freeze(Object.fromEntries(
  calculationEntries.map((entry) => [entry.id, entry]),
));

export const requestedCalculationIds = Object.freeze([
  "dso", "dio", "dpo", "ccc",
  "currentRatio", "quickRatio", "workingCapital",
  "grossMargin", "operatingMargin", "netProfitMargin", "returnOnAssets", "returnOnEquity",
  "debtToEquity", "debtRatio", "equityRatio", "financialLeverage", "interestCoverage",
  "operatingCashFlowRatio", "freeCashFlow", "freeCashFlowMargin", "operatingCashFlowMargin", "cashConversionRatio",
  "priceToBook", "priceToEarnings", "priceToSales", "evToOperatingCashFlow",
  "evToFreeCashFlow", "evToEbitda", "evToEbit", "evToSales",
]);

export function planRequestedOutputs(requestedIds = requestedCalculationIds) {
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  const missing = [];

  const visit = (id) => {
    if (visited.has(id)) return;
    const definition = calculationRegistry[id];
    if (!definition) {
      missing.push(id);
      return;
    }
    if (visiting.has(id)) throw new Error(`Calculation registry cycle detected at ${id}.`);
    visiting.add(id);
    for (const dependency of definition.dependencies) {
      if (calculationRegistry[dependency]) visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(id);
  };

  requestedIds.forEach(visit);
  return Object.freeze({
    registryVersion: CALCULATION_REGISTRY_VERSION,
    requestedIds: Object.freeze([...requestedIds]),
    orderedIds: Object.freeze(ordered),
    missingRegistryNodes: Object.freeze([...new Set(missing)]),
    status: missing.length ? "InvalidRegistry" : "Ready",
  });
}

export function calculationRegistrySnapshot() {
  return {
    version: CALCULATION_REGISTRY_VERSION,
    entries: calculationEntries,
  };
}
