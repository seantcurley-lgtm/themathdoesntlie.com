import { readFile } from "node:fs/promises";

import tickerDirectory from "../public/sec/company-tickers.json" with { type: "json" };
import {
  CALCULATION_REGISTRY_VERSION,
  calculationRegistry,
  metricPeriodCompatibility,
  requestedCalculationIds,
} from "./calculation-registry.mjs";
import { SCORING_VERSION } from "./evidence-scoring.mjs";
import {
  buildQuarterlyEvidenceAssembly,
  evaluateQuarterlyAssembly,
  quarterlyGenerationOutcome,
  sourceRepresentationHashForAccessions,
} from "./period-assembly.mjs";
import { createSourceManifest, normalizeSecurityId, sha256Text, stableSerialize } from "./longitudinal-state.mjs";
import {
  buildAcquisitionPackage,
  mergeSubmissionHistory,
  resolveTicker,
  selectComparablePriorQuarterlyFiling,
  selectLatestAnnualFiling,
  selectLatestQuarterlyFiling,
} from "./sec-xbrl.mjs";

export const QUARTERLY_PREVIEW_LABEL = "LOCAL PREVIEW — NOT AN AUTHORITATIVE PUBLISHED STATE";
export const QUARTERLY_PREVIEW_VERSION = "1.0.0";

const USER_AGENT = "TMDL Evidence Engine local quarterly preview/1.0 themathdoesntlie.com";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function parseQuarterlyPreviewArguments(argv) {
  const options = { ticker: null, json: false, out: null, priorResult: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--out" || argument === "--prior-result") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path.`);
      if (argument === "--out") options.out = value;
      else options.priorResult = value;
      index += 1;
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (options.ticker) throw new Error("Supply exactly one ticker.");
    else options.ticker = argument.trim().toUpperCase();
  }
  if (!options.help && !options.ticker) throw new Error("A ticker is required.");
  if (options.ticker && !/^[A-Z][A-Z0-9.-]{0,9}$/.test(options.ticker)) throw new Error("Ticker format is invalid.");
  return options;
}

export function quarterlyPreviewHelp() {
  return [
    "Usage: npm run ee:preview-quarterly -- TICKER [--json] [--out PATH] [--prior-result PATH]",
    "",
    "Runs the production quarterly acquisition, assembly, calculation, and scoring modules locally.",
    "It never publishes an Evidence Result or writes authoritative state.",
  ].join("\n");
}

async function secFetch(url, accept = "application/json", attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: accept, "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`SEC request failed with HTTP ${response.status}: ${url}`);
      return accept.includes("json") ? response.json() : response.text();
    } catch (error) {
      if (attempt === attempts) throw error;
      await wait(500 * 2 ** (attempt - 1));
    }
  }
}

async function resolveComparableHistory(submissions, cik, quarterlyFiling) {
  try {
    return selectComparablePriorQuarterlyFiling(submissions, cik, quarterlyFiling);
  } catch (initialError) {
    let extended = submissions;
    const files = [...(submissions?.filings?.files ?? [])]
      .filter((item) => item?.name)
      .sort((left, right) => String(right.filingTo ?? "").localeCompare(String(left.filingTo ?? "")));
    for (const file of files) {
      const payload = await secFetch(`https://data.sec.gov/submissions/${file.name}`);
      extended = mergeSubmissionHistory(extended, [payload]);
      try {
        return selectComparablePriorQuarterlyFiling(extended, cik, quarterlyFiling);
      } catch {
        // Continue only until the exact comparable filing is resolved.
      }
    }
    throw initialError;
  }
}

export async function readPriorResultArtifact(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  const candidate = parsed?.record?.exactRecord ?? parsed?.exactRecord ?? parsed?.publication ?? parsed;
  if (!candidate?.resultId || !candidate?.evaluation) {
    throw new Error("The prior Result artifact does not contain an exact Evidence Result with resultId and evaluation.");
  }
  const recordHash = parsed?.record?.integrity?.recordHash ?? parsed?.record?.recordHash ?? parsed?.recordHash ?? null;
  if (!recordHash) throw new Error("The prior Result artifact has no exact-record SHA-256 for integrity verification.");
  if (await sha256Text(stableSerialize(candidate)) !== recordHash) {
    throw new Error("The prior Result artifact failed exact-record SHA-256 verification.");
  }
  if (!candidate.stateFingerprint || candidate.resultId !== `eer_${candidate.stateFingerprint}`) {
    throw new Error("The prior Result artifact has inconsistent Result identity.");
  }
  return candidate;
}

export async function buildResolvedQuarterlyPreview({
  ticker,
  company,
  tickerRecord,
  securityId,
  annualAcquisition,
  companyFacts,
  quarterlyFiling,
  priorQuarterlyFiling,
  market,
  marketReference,
  previewKnownAt,
  priorAnnualPublication = null,
}) {
  const accessions = quarterlyFiling.form === "10-Q/A"
    ? [quarterlyFiling.accessionNumber, quarterlyFiling.amendsAccessionNumber]
    : [quarterlyFiling.accessionNumber];
  const quarterlySourceHash = await sourceRepresentationHashForAccessions(companyFacts, accessions);
  const assembly = await buildQuarterlyEvidenceAssembly({
    annualAcquisition,
    companyFacts,
    quarterlyFiling,
    priorQuarterlyFiling,
    securityId,
    knownAt: previewKnownAt,
    quarterlySourceHash,
  });
  const outcome = quarterlyGenerationOutcome(assembly);
  let evaluation = null;
  let sourceManifest = null;
  if (outcome.outcome === "Eligible") {
    const result = await evaluateQuarterlyAssembly({
      assembly,
      priorAnnualPublication,
      sharePrice: market.price,
      marketObservationDate: String(market.lastQuoteRefresh).slice(0, 10),
      marketUrl: marketReference,
    });
    evaluation = result.evaluation;
    sourceManifest = await createSourceManifest({
      evaluation,
      securityId,
      acquiredAt: previewKnownAt,
      marketSource: {
        provider: market.provider,
        acquiredAt: market.lastQuoteRefresh,
        immutableReference: marketReference,
        contentHash: await sha256Text(stableSerialize(market)),
      },
    });
  }
  return {
    preview: {
      label: QUARTERLY_PREVIEW_LABEL,
      version: QUARTERLY_PREVIEW_VERSION,
      status: outcome.outcome === "Eligible" ? "EvaluatedNotPublished" : "WithheldNotPublished",
      previewKnownAt,
      publicationAttempted: false,
      authoritativeStateWritten: false,
    },
    identity: {
      ticker,
      company,
      cik: tickerRecord.cik,
      securityId,
    },
    filings: {
      annual: annualAcquisition.filing,
      quarterly: quarterlyFiling,
      comparablePriorQuarter: priorQuarterlyFiling,
    },
    marketObservation: {
      identity: `${market.provider}:${ticker}:${String(market.lastQuoteRefresh).slice(0, 10)}`,
      provider: market.provider,
      price: market.price,
      observedAt: market.lastQuoteRefresh,
      reference: marketReference,
    },
    versions: {
      periodAssemblyVersion: assembly.version,
      periodCompatibilityVersion: assembly.compatibilityVersion,
      calculationRegistryVersion: CALCULATION_REGISTRY_VERSION,
      scoringVersion: SCORING_VERSION,
    },
    outcome,
    assembly,
    evaluation,
    sourceManifest,
    integrity: {
      status: "LocalPreviewNotPublished",
      evaluationFingerprint: evaluation?.fingerprint ?? null,
      authoritativeRecordHash: null,
    },
  };
}

export function resolveMarketReference({
  market,
  ticker,
  revision,
  repository = "themathdoesntlie/themathdoesntlie.com",
  priorPublication = null,
}) {
  const normalizedTicker = String(ticker).toUpperCase();
  const observationDate = String(market?.lastQuoteRefresh ?? "").slice(0, 10);
  const observationId = `${market?.provider}:${normalizedTicker}:${observationDate}`;
  const priorEvaluation = priorPublication?.evaluation;
  const priorReference = priorEvaluation?.inputs?.marketUrl;
  const sameGovernedObservation = priorPublication?.freshness?.marketObservationId === observationId
    && priorEvaluation?.ticker === normalizedTicker
    && priorEvaluation?.inputs?.marketObservationDate === observationDate
    && priorEvaluation?.inputs?.sharePrice === market?.price;
  if (sameGovernedObservation && typeof priorReference === "string" && priorReference.length > 0) {
    return priorReference;
  }
  return `https://github.com/${repository}/blob/${revision}/covered-call-lab/market-data.json`;
}

export async function createLiveQuarterlyPreview({ ticker, priorAnnualPublication = null, now = () => new Date(), revision = process.env.GITHUB_SHA ?? "working-tree" }) {
  const tickerRecord = resolveTicker(tickerDirectory, ticker);
  const normalizedTicker = tickerRecord.ticker.toUpperCase();
  const securityId = normalizeSecurityId(tickerRecord.cik);
  const marketPath = new URL("../../covered-call-lab/market-data.json", import.meta.url);
  const marketSnapshot = JSON.parse(await readFile(marketPath, "utf8"));
  const market = marketSnapshot.securities.find((item) => item.ticker?.toUpperCase() === normalizedTicker);
  if (!market?.price || !market?.lastQuoteRefresh || !market?.provider) {
    throw new Error(`No governed market observation is available for ${normalizedTicker}.`);
  }
  const cik = tickerRecord.cik;
  const submissions = await secFetch(`https://data.sec.gov/submissions/CIK${cik}.json`);
  const annualFiling = selectLatestAnnualFiling(submissions, cik);
  const quarterlyFiling = selectLatestQuarterlyFiling(submissions, cik);
  if (quarterlyFiling.reportDate <= annualFiling.reportDate) {
    throw new Error(`No supported 10-Q later than the governing ${annualFiling.reportDate} 10-K is available for ${normalizedTicker}.`);
  }
  const priorQuarterlyFiling = await resolveComparableHistory(submissions, cik, quarterlyFiling);
  const [companyFacts, inlineFilingHtml] = await Promise.all([
    secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`),
    secFetch(annualFiling.filingUrl, "text/html"),
  ]);
  const previewKnownAt = now().toISOString();
  const annualAcquisition = buildAcquisitionPackage({ tickerRecord, submissions, companyFacts, inlineFilingHtml });
  if (annualAcquisition.summary.reviewRequired || annualAcquisition.summary.collectionFailure) {
    throw new Error(`Governed annual acquisition was withheld: ${JSON.stringify(annualAcquisition.summary)}`);
  }
  const repository = process.env.GITHUB_REPOSITORY ?? "themathdoesntlie/themathdoesntlie.com";
  const marketReference = resolveMarketReference({
    market,
    ticker: normalizedTicker,
    revision,
    repository,
    priorPublication: priorAnnualPublication,
  });
  return buildResolvedQuarterlyPreview({
    ticker: normalizedTicker,
    company: submissions.name ?? tickerRecord.title ?? normalizedTicker,
    tickerRecord,
    securityId,
    annualAcquisition,
    companyFacts,
    quarterlyFiling,
    priorQuarterlyFiling,
    market,
    marketReference,
    previewKnownAt,
    priorAnnualPublication,
  });
}

function collectMetricEvidence(metricId, evaluation, visited = new Set()) {
  if (visited.has(metricId)) return [];
  visited.add(metricId);
  const definition = calculationRegistry[metricId];
  if (!definition) return [];
  const evidence = [];
  for (const dependency of definition.dependencies) {
    const direct = evaluation.inputs?.inputEvidence?.[dependency];
    if (direct) evidence.push(direct);
    else if (calculationRegistry[dependency]) evidence.push(...collectMetricEvidence(dependency, evaluation, visited));
    else if (dependency === "sharePrice") evidence.push({ periodBasis: "MarketObservation", end: evaluation.inputs?.marketObservationDate, form: "Market", accessionNumber: null });
  }
  return evidence;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function metricInspectionRows(preview) {
  const evaluation = preview.evaluation;
  return requestedCalculationIds.map((metricId) => {
    const compatibility = metricPeriodCompatibility[metricId] ?? { classification: "D", requiredBasis: "MethodologyAuthorityRequired" };
    const metric = evaluation?.metrics?.find((item) => item.id === metricId) ?? null;
    const unavailable = evaluation?.unavailableMetrics?.find((item) => item.id === metricId) ?? null;
    const rule = evaluation?.scoring?.rules?.find((item) => item.metricId === metricId) ?? null;
    const selectedEvidence = metric?.authorityStatus === "CarriedForward"
      ? metric.lineage?.flatMap((item) => item.evidence ? [item.evidence] : []) ?? []
      : evaluation ? collectMetricEvidence(metricId, evaluation) : [];
    const evidence = selectedEvidence.flatMap((item) => [item, ...(item.componentEvidence ?? [])]);
    const transformations = unique(evidence.map((item) => item.transformationId ?? (item.periodBasis === "TrailingTwelveMonths" ? item.method : null)));
    const forms = unique(evidence.map((item) => item.form));
    const accessions = unique(evidence.map((item) => item.accessionNumber));
    const periods = unique(evidence.map((item) => item.periodBasis));
    const ends = unique(evidence.map((item) => item.end));
    const status = metric?.authorityStatus === "CarriedForward"
      ? "CarriedForward"
      : metric
        ? rule?.status ?? "Available"
        : "Unavailable";
    return {
      metricId,
      name: calculationRegistry[metricId]?.name ?? metricId,
      classification: compatibility.classification,
      requiredBasis: compatibility.requiredBasis,
      value: metric?.value ?? null,
      unit: metric?.unit ?? null,
      status,
      reason: metricId === "priceToEarnings" && !metric
        ? "NoAuthoritativeAnnualCarrySource"
        : unavailable?.reason ?? unavailable?.detail ?? null,
      evidencePeriodBasis: periods,
      evidencePeriodEnd: ends,
      sourceForms: forms,
      sourceAccessions: accessions,
      transformations,
      carriedFromResultId: metric?.carriedFromResultId ?? null,
    };
  });
}

function formatFiling(label, filing) {
  return `${label}: ${filing.form} | period ${filing.reportDate} | filed ${filing.filingDate} | ${filing.accessionNumber}`;
}

function displayValue(row) {
  if (row.value === null) return "—";
  return `${row.value}${row.unit ? ` ${row.unit}` : ""}`;
}

function compact(values) {
  return values.length ? values.join(",") : "—";
}

function table(rows) {
  const headings = ["Metric", "Class", "Status", "Value", "Basis / end", "Source", "Transformation / reason"];
  const cells = rows.map((row) => [
    row.name,
    row.classification,
    row.status,
    displayValue(row),
    `${compact(row.evidencePeriodBasis)} / ${compact(row.evidencePeriodEnd)}`,
    `${compact(row.sourceForms)} ${compact(row.sourceAccessions)}`,
    row.transformations.length ? row.transformations.join(",") : row.carriedFromResultId ? `from ${row.carriedFromResultId}` : row.reason ?? "—",
  ]);
  const widths = headings.map((heading, index) => Math.min(42, Math.max(heading.length, ...cells.map((row) => String(row[index]).length))));
  const render = (row) => row.map((value, index) => String(value).slice(0, widths[index]).padEnd(widths[index])).join(" | ");
  return [render(headings), widths.map((width) => "-".repeat(width)).join("-|-"), ...cells.map(render)].join("\n");
}

export function renderMetricInspectionTable(rows) {
  return table(rows);
}

export function renderQuarterlyPreview(preview) {
  const evaluation = preview.evaluation;
  const score = evaluation?.scoring;
  const metricRows = metricInspectionRows(preview);
  const priceToEarnings = metricRows.find((row) => row.metricId === "priceToEarnings");
  const lines = [
    QUARTERLY_PREVIEW_LABEL,
    "",
    `Identity: ${preview.identity.ticker} | ${preview.identity.company} | CIK ${preview.identity.cik} | ${preview.identity.securityId}`,
    formatFiling("Annual authority", preview.filings.annual),
    formatFiling("Quarterly authority", preview.filings.quarterly),
    formatFiling("Comparable quarter", preview.filings.comparablePriorQuarter),
    `Preview known at: ${preview.preview.previewKnownAt}`,
    `Market: ${preview.marketObservation.identity} | ${preview.marketObservation.price} | ${preview.marketObservation.observedAt}`,
    `Versions: assembly ${preview.versions.periodAssemblyVersion} | compatibility ${preview.versions.periodCompatibilityVersion} | calculations ${preview.versions.calculationRegistryVersion} | scoring ${preview.versions.scoringVersion}`,
    `Result: ${score?.status ?? preview.outcome.reason} | score ${score?.overallScore ?? "Unavailable"} | coverage ${score?.coveragePercent ?? "0.00"}%`,
    `Fingerprint: ${evaluation?.fingerprint ?? "Unavailable"}`,
    `Integrity: ${preview.integrity.status}; publication attempted=${preview.preview.publicationAttempted}`,
    "",
    "Governed metric inspection",
    renderMetricInspectionTable(metricRows),
    "",
    priceToEarnings?.status === "CarriedForward"
      ? `P/E authority: CarriedForward | carriedFromResultId=${priceToEarnings.carriedFromResultId}`
      : `P/E authority: Unavailable | ${priceToEarnings?.reason ?? "NoAuthoritativeAnnualCarrySource"}`,
    "",
    "TTM evidence drill-down",
  ];
  const transformed = preview.assembly.evidenceItems.filter((item) => item.periodBasis === "TrailingTwelveMonths" && item.componentEvidence?.length);
  if (!transformed.length) lines.push("No governed TTM evidence was assembled.");
  for (const item of transformed) {
    lines.push(`${item.canonicalField}: ${item.value} | ${item.start} → ${item.end} | ${item.actualInclusiveDays} days | ${item.transformationId}@${item.transformationVersion}`);
    for (const component of item.componentEvidence) {
      lines.push(`  - ${component.periodBasis}: ${component.value} | ${component.start} → ${component.end} | ${component.form} ${component.accessionNumber} | ${component.evidenceItemId}`);
    }
  }
  const failures = [
    ...preview.assembly.failures.map((failure) => `${failure.field}: ${failure.reason}${failure.detail ? ` — ${failure.detail}` : ""}`),
    ...metricRows.filter((row) => row.status === "Unavailable").map((row) => `${row.name}: ${row.reason ?? "Unavailable"}`),
  ];
  lines.push("", "Withheld / unavailable evidence");
  lines.push(...(failures.length ? unique(failures).map((failure) => `- ${failure}`) : ["None."]));
  return lines.join("\n");
}

export function serializeQuarterlyPreview(preview) {
  return `${JSON.stringify({ ...preview, metricInspection: metricInspectionRows(preview) }, null, 2)}\n`;
}
