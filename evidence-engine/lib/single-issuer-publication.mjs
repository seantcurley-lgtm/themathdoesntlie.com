import { createLiveQuarterlyPreview } from "./quarterly-preview.mjs";
import {
  createLongitudinalPublication,
  detectProspectiveWork,
  sha256Text,
  stableSerialize,
} from "./longitudinal-state.mjs";

export const AUTHORITATIVE_WRITE_FLAG = "--confirm-authoritative-publication";
const REJECTED_TICKERS = new Set(["ALL", "ANY", "UNIVERSE", "MARKET", "*"]);

export class StateServiceError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = "StateServiceError";
    this.status = status;
    this.code = code;
  }
}

export function validateSingleTicker(ticker) {
  const normalized = typeof ticker === "string" ? ticker.trim().toUpperCase() : "";
  if (!normalized) throw new Error("Exactly one ticker is required.");
  if (REJECTED_TICKERS.has(normalized) || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(normalized)) {
    throw new Error("A single explicit ticker is required; lists, wildcards, and universe aliases are prohibited.");
  }
  return normalized;
}

export function parseSingleIssuerPublicationArguments(argv) {
  const options = { ticker: null, json: false, confirmed: false, help: false };
  for (const argument of argv) {
    if (argument === "--json") options.json = true;
    else if (argument === AUTHORITATIVE_WRITE_FLAG) options.confirmed = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (options.ticker) throw new Error("Supply exactly one ticker; bulk publication is prohibited.");
    else options.ticker = argument.trim().toUpperCase();
  }
  if (options.help) return options;
  options.ticker = validateSingleTicker(options.ticker);
  if (!options.confirmed) {
    throw new Error(`Authoritative publication requires the explicit ${AUTHORITATIVE_WRITE_FLAG} guard.`);
  }
  return options;
}

export function singleIssuerPublicationHelp() {
  return [
    `Usage: npm run ee:publish-single-issuer -- TICKER ${AUTHORITATIVE_WRITE_FLAG} [--json]`,
    "",
    "Acquires and evaluates exactly one issuer, then writes through the immutable authoritative state service.",
    "Requires EVIDENCE_ENGINE_STATE_ENDPOINT (HTTPS) and EVIDENCE_ENGINE_PUBLICATION_TOKEN (32+ characters).",
    "This is not the read-only quarterly preview command.",
  ].join("\n");
}

export function validatePublicationEnvironment({ endpoint, token }) {
  const rawEndpoint = String(endpoint ?? "").trim();
  const credential = typeof token === "string" ? token : "";
  if (!rawEndpoint) throw new Error("EVIDENCE_ENGINE_STATE_ENDPOINT is required before acquisition or publication.");
  let parsed;
  try {
    parsed = new URL(rawEndpoint);
  } catch {
    throw new Error("EVIDENCE_ENGINE_STATE_ENDPOINT must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname || parsed.search || parsed.hash) {
    throw new Error("EVIDENCE_ENGINE_STATE_ENDPOINT must be a credential-free HTTPS URL.");
  }
  if (!credential) throw new Error("EVIDENCE_ENGINE_PUBLICATION_TOKEN is required.");
  if (credential.length < 32) throw new Error("EVIDENCE_ENGINE_PUBLICATION_TOKEN must contain at least 32 characters.");
  return { endpoint: rawEndpoint.replace(/\/+$/, ""), endpointHost: parsed.host, token: credential };
}

export function validateCodeRevision(revision) {
  const normalized = String(revision ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error("An exact 40-character GITHUB_SHA code revision is required for immutable source identity.");
  }
  return normalized;
}

function stateService({ endpoint, token, fetchImpl }) {
  const safeMessage = (value) => String(value).split(token).join("[REDACTED]");
  return async (path, options = {}) => {
    let response;
    try {
      response = await fetchImpl(`${endpoint}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
      });
    } catch (error) {
      throw new StateServiceError(`Authoritative state service request failed: ${safeMessage(error instanceof Error ? error.message : error)}`);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (!response.ok) {
      throw new StateServiceError(
        `Authoritative state service returned HTTP ${response.status}: ${safeMessage(body.error ?? "unknown failure")}`,
        { status: response.status, code: body.code ?? null },
      );
    }
    return body;
  };
}

function cursorFromRecord(record) {
  if (!record) return null;
  return {
    securityId: record.securityId,
    latestAnnualAccession: record.freshness?.latestAnnualFilingAccession ?? null,
    latestQuarterlyAccession: record.freshness?.latestQuarterlyFilingAccession ?? null,
    latestQuarterlySourceHash: record.freshness?.latestQuarterlySourceHash ?? null,
    marketObservationId: record.freshness?.marketObservationId ?? null,
    resultId: record.resultId,
  };
}

function candidateAuthority(preview) {
  const quarterly = preview.filings?.quarterly ?? null;
  return {
    securityId: preview.identity.securityId,
    latestAnnualAccession: preview.filings?.annual?.accessionNumber ?? null,
    latestQuarterlyAccession: quarterly?.accessionNumber ?? null,
    latestQuarterlyForm: quarterly?.form ?? null,
    latestQuarterlySourceHash: preview.evaluation?.inputs?.acquisition?.quarterlySourceHash ?? null,
    marketObservationId: preview.marketObservation.identity,
  };
}

function sameAuthority(existing, preview) {
  if (!existing?.exactRecord) return false;
  const record = existing.exactRecord;
  const current = candidateAuthority(preview);
  return record.securityId === current.securityId
    && record.evaluation?.fingerprint === preview.evaluation?.fingerprint
    && record.freshness?.latestAnnualFilingAccession === current.latestAnnualAccession
    && (record.freshness?.latestQuarterlyFilingAccession ?? null) === current.latestQuarterlyAccession
    && (record.freshness?.latestQuarterlySourceHash ?? null) === current.latestQuarterlySourceHash
    && record.freshness?.marketObservationId === current.marketObservationId;
}

function maximumIso(...values) {
  return values.filter(Boolean).map((value) => new Date(value).toISOString()).sort().at(-1);
}

function publicationRequest(built, ticker, periodEnd) {
  return {
    publication: built.publication,
    recordJson: built.recordJson,
    stateFingerprint: built.stateFingerprint,
    recordHash: built.recordHash,
    label: `${ticker} ${periodEnd} controlled single-issuer qualification`,
  };
}

async function verifiedExistingRequest(existing, ticker) {
  const publication = existing.exactRecord;
  const recordJson = stableSerialize(publication);
  const recordHash = existing.recordHash;
  if (!recordHash || await sha256Text(recordJson) !== recordHash) {
    throw new StateServiceError("The existing exact Result failed local record-hash verification.", { code: "IntegrityConflict" });
  }
  return publicationRequest({ publication, recordJson, stateFingerprint: publication.stateFingerprint, recordHash }, ticker, publication.evaluation.periodEnd);
}

export function qualificationSummary({ request, endpointHost, disposition, codeRevision }) {
  const publication = request.publication;
  const evaluation = publication.evaluation;
  const secSources = publication.sourceManifest.sources.filter((source) => source.sourceType === "SEC Filing");
  const annual = secSources.find((source) => source.form === "10-K") ?? null;
  const quarterly = [...secSources].reverse().find((source) => source.form === "10-Q" || source.form === "10-Q/A") ?? null;
  return {
    ticker: publication.tickerAtState,
    company: evaluation.companyName,
    cik: publication.securityId.replace("sec-cik:", ""),
    securityId: publication.securityId,
    annualAccession: annual?.accessionNumber ?? null,
    quarterlyAccession: quarterly?.accessionNumber ?? null,
    reportingPeriod: evaluation.periodEnd,
    marketObservation: publication.freshness.marketObservationId,
    scoringStatus: evaluation.scoring?.status ?? "Unavailable",
    coveragePercent: evaluation.scoring?.coveragePercent ?? null,
    score: evaluation.scoring?.overallScore ?? null,
    stateFingerprint: request.stateFingerprint,
    endpointHost,
    eventType: publication.eventType,
    disposition,
    codeRevision,
  };
}

export function renderPrePublicationSummary(summary) {
  return [
    "AUTHORITATIVE SINGLE-ISSUER PUBLICATION — WRITE AUTHORIZED",
    `Identity: ${summary.ticker} | ${summary.company} | ${summary.securityId}`,
    `Filings: annual ${summary.annualAccession ?? "None"} | quarterly ${summary.quarterlyAccession ?? "None"}`,
    `Reporting period: ${summary.reportingPeriod}`,
    `Market observation: ${summary.marketObservation ?? "Unavailable"}`,
    `Scoreability: ${summary.scoringStatus} | coverage ${summary.coveragePercent ?? "Unavailable"}% | score ${summary.score ?? "Unavailable"}`,
    `Fingerprint: ${summary.stateFingerprint}`,
    `Endpoint host: ${summary.endpointHost}`,
    `Event: ${summary.eventType} | intended disposition ${summary.disposition}`,
    `Code revision: ${summary.codeRevision}`,
  ].join("\n");
}

export function qualificationResult({ response, request, endpointHost, codeRevision }) {
  const publication = request.publication;
  const record = response.record ?? {};
  return {
    publicationStatus: response.created ? "Created" : "Reused",
    created: Boolean(response.created),
    resultId: record.resultId ?? publication.resultId,
    securityId: record.securityId ?? publication.securityId,
    knownAt: record.knownAt ?? publication.knownAt,
    publishedAt: record.publishedAt ?? publication.publishedAt,
    eventType: record.eventType ?? publication.eventType,
    stateFingerprint: record.stateFingerprint ?? request.stateFingerprint,
    recordHash: record.recordHash ?? request.recordHash,
    sourceManifestId: record.sourceManifestId ?? publication.sourceManifestId,
    sourceManifestHash: publication.sourceManifestHash,
    supersedesResultId: record.supersedesResultId ?? publication.supersedesResultId ?? null,
    endpointHost,
    codeRevision,
  };
}

export function renderQualificationResult(result) {
  return [
    `Publication: ${result.publicationStatus}`,
    `Result ID: ${result.resultId}`,
    `Security: ${result.securityId}`,
    `Authority: knownAt ${result.knownAt} | publishedAt ${result.publishedAt} | ${result.eventType}`,
    `Fingerprint: ${result.stateFingerprint}`,
    `Exact record hash: ${result.recordHash}`,
    `Source manifest: ${result.sourceManifestId} | ${result.sourceManifestHash}`,
    `Supersedes: ${result.supersedesResultId ?? "None"}`,
    `Endpoint host: ${result.endpointHost}`,
    `Code revision: ${result.codeRevision}`,
  ].join("\n");
}

export async function publishSingleIssuer({
  ticker,
  endpoint,
  token,
  confirmed,
  fetchImpl = globalThis.fetch,
  acquire = createLiveQuarterlyPreview,
  now = () => new Date(),
  onPrepared = () => {},
  revision = process.env.GITHUB_SHA,
}) {
  if (!confirmed) throw new Error(`Authoritative publication requires the explicit ${AUTHORITATIVE_WRITE_FLAG} guard.`);
  const normalizedTicker = validateSingleTicker(ticker);
  const environment = validatePublicationEnvironment({ endpoint, token });
  const codeRevision = validateCodeRevision(revision);
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  const service = stateService({ ...environment, fetchImpl });
  const page = await service(`/api/evaluations?ticker=${encodeURIComponent(normalizedTicker)}&limit=1`);
  const current = page.records?.[0] ?? null;
  let existing = null;
  if (current?.resultId) {
    const exact = await service(`/api/evaluations?id=${encodeURIComponent(current.resultId)}`);
    existing = { exactRecord: exact.record?.exactRecord, recordHash: exact.record?.integrity?.recordHash ?? exact.record?.recordHash };
  }
  const preview = await acquire({ ticker: normalizedTicker, priorAnnualPublication: existing?.exactRecord ?? null, revision: codeRevision });
  if (preview.outcome?.outcome !== "Eligible" || !preview.evaluation || !preview.sourceManifest) {
    throw new Error(`Single-issuer evidence is not publication-eligible: ${preview.outcome?.reason ?? "Unavailable"}`);
  }
  const cursor = cursorFromRecord(current);
  const work = detectProspectiveWork({
    securities: [candidateAuthority(preview)],
    cursors: cursor ? [cursor] : [],
    marketCadenceDue: false,
  })[0];
  if (work.action === "ReviewRequired") throw new Error(`Publication withheld for governed review: ${work.reasons.join(", ")}`);
  let request;
  let disposition;
  if (work.action === "NoChange") {
    if (!sameAuthority(existing, preview)) {
      throw new StateServiceError("Current authority reports no source change, but the acquired evaluation does not exactly match the existing Result.", { code: "IntegrityConflict" });
    }
    request = await verifiedExistingRequest(existing, normalizedTicker);
    disposition = "ReusedExactAuthoritativeInput";
  } else {
    const activeFiling = preview.filings.quarterly ?? preview.filings.annual;
    const sourceMaxPublishedAt = maximumIso(`${activeFiling.filingDate}T00:00:00.000Z`, preview.marketObservation.observedAt);
    const knownAt = maximumIso(preview.preview.previewKnownAt, sourceMaxPublishedAt);
    const publishedAt = maximumIso(now().toISOString(), knownAt);
    const built = await createLongitudinalPublication({
      evaluation: preview.evaluation,
      securityId: preview.identity.securityId,
      knownAt,
      publishedAt,
      sourceMaxPublishedAt,
      eventType: work.eventType,
      supersedesResultId: current?.resultId ?? null,
      sourceManifest: preview.sourceManifest,
    });
    request = publicationRequest(built, normalizedTicker, preview.evaluation.periodEnd);
    disposition = "CreateNewAuthoritativeState";
  }
  const summary = qualificationSummary({ request, endpointHost: environment.endpointHost, disposition, codeRevision });
  await onPrepared(summary);
  const response = await service("/api/evaluations", { method: "POST", body: JSON.stringify(request) });
  return { summary, result: qualificationResult({ response, request, endpointHost: environment.endpointHost, codeRevision }) };
}
