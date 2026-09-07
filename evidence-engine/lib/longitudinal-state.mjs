/** Authoritative, immutable Evidence Engine longitudinal publication primitives. */

export const LONGITUDINAL_STATE_SCHEMA_VERSION = "1.1";
export const SOURCE_MANIFEST_SCHEMA_VERSION = "1.1";
export const GENERATION_MANIFEST_SCHEMA_VERSION = "1.0";
export const NO_AUTHORITATIVE_STATE = "NoAuthoritativeStateBeforeTimestamp";
const SUPPORTED_EVENT_TYPES = new Set([
  "AnnualFilingAccepted",
  "QuarterlyFilingAccepted",
  "QuarterlyAmendmentAccepted",
  "ScheduledMarketObservation",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Text(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyBearerAuthorization(authorization, configuredSecret) {
  if (typeof configuredSecret !== "string" || configuredSecret.length < 32) return false;
  const supplied = typeof authorization === "string" ? authorization.replace(/^Bearer\s+/i, "") : "";
  return Boolean(supplied) && (await sha256Text(supplied)) === (await sha256Text(configuredSecret));
}

export function normalizeSecurityId(cik) {
  const digits = String(cik ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 10) throw new Error("A valid SEC CIK is required for securityId.");
  return `sec-cik:${digits.padStart(10, "0")}`;
}

function requiredIso(value, field) {
  if (typeof value !== "string" || !value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO date or timestamp.`);
  }
  return new Date(value).toISOString();
}

function datesFromEvidence(evaluation) {
  const evidence = Object.values(evaluation?.inputs?.inputEvidence ?? {});
  return evidence.flatMap((item) => [
    item,
    ...(Array.isArray(item?.componentEvidence) ? item.componentEvidence : []),
  ]).flatMap((item) => [item?.filed, item?.start, item?.end, item?.originalKnownAt]).filter(Boolean).sort();
}

export async function createSourceManifest({ evaluation, securityId, acquiredAt, marketSource = {} }) {
  const normalizedSecurityId = normalizeSecurityId(securityId);
  const rawEvidence = Object.values(evaluation?.inputs?.inputEvidence ?? {});
  const atomicEvidence = rawEvidence.flatMap((item) => [
    item,
    ...(Array.isArray(item?.componentEvidence) ? item.componentEvidence : []),
  ]);
  const filingEvidence = atomicEvidence.map((item) => ({
    evidenceItemId: item?.evidenceItemId ?? null,
    field: item?.field ?? null,
    canonicalField: item?.canonicalField ?? item?.field ?? null,
    status: item?.status ?? null,
    evidenceStatus: item?.evidenceStatus ?? null,
    periodBasis: item?.periodBasis ?? null,
    fiscalYear: item?.fiscalYear ?? null,
    fiscalQuarter: item?.fiscalQuarter ?? null,
    taxonomy: item?.taxonomy ?? null,
    concept: item?.concept ?? null,
    normalizedUnit: item?.normalizedUnit ?? null,
    start: item?.start ?? null,
    end: item?.end ?? null,
    filed: item?.filed ?? null,
    knownAt: item?.knownAt ?? null,
    accessionNumber: item?.accessionNumber ?? null,
    form: item?.form ?? null,
    sourceRole: item?.sourceRole ?? null,
    amendsAccessionNumber: item?.amendsAccessionNumber ?? null,
    sourceManifestReference: item?.sourceManifestReference ?? null,
    transformationId: item?.transformationId ?? null,
    transformationVersion: item?.transformationVersion ?? null,
    componentEvidenceIds: item?.componentEvidenceIds ?? [],
    carriedFromResultId: item?.carriedFromResultId ?? null,
    carriedFromEvidenceId: item?.carriedFromEvidenceId ?? null,
    sourceLocation: item?.sourceLocation ?? null,
    reviewDecision: item?.reviewDecision ?? null,
  }));
  const evidenceByAccession = new Map();
  for (const item of filingEvidence.filter((record) => record.accessionNumber)) {
    const group = evidenceByAccession.get(item.accessionNumber) ?? [];
    group.push(item);
    evidenceByAccession.set(item.accessionNumber, group);
  }
  const groupedSecSources = await Promise.all([...evidenceByAccession.entries()].sort(([left], [right]) => left.localeCompare(right)).map(async ([accessionNumber, items]) => {
    const representative = items.find((item) => item.form) ?? {};
    const current = accessionNumber === evaluation?.inputs?.accessionNumber;
    return {
      sourceType: "SEC Filing",
      authority: "U.S. Securities and Exchange Commission",
      authoritativeIdentity: `sec-accession:${accessionNumber}`,
      accessionNumber,
      form: representative.form ?? null,
      sourceRole: representative.sourceRole ?? (current ? "CurrentFiling" : "ContributingFiling"),
      amendsAccessionNumber: representative.amendsAccessionNumber ?? null,
      filedAt: items.map((item) => item.filed).filter(Boolean).sort().at(-1) ?? null,
      reportingPeriods: [...new Set(items.flatMap((item) => [item.start, item.end]).filter(Boolean))].sort(),
      acquiredAt,
      immutableReference: current ? evaluation?.inputs?.filingUrl ?? null : items.find((item) => item.sourceLocation)?.sourceLocation ?? null,
      contentHash: await sha256Text(stableSerialize(items)),
      evidenceItems: items,
    };
  }));
  const fallbackAccession = evaluation?.inputs?.accessionNumber ?? null;
  const secSources = groupedSecSources.length ? groupedSecSources : [{
    sourceType: "SEC Filing",
    authority: "U.S. Securities and Exchange Commission",
    authoritativeIdentity: fallbackAccession ? `sec-accession:${fallbackAccession}` : null,
    accessionNumber: fallbackAccession,
    form: evaluation?.inputs?.inputEvidence
      ? Object.values(evaluation.inputs.inputEvidence).find((item) => item?.form)?.form ?? "10-K"
      : "10-K",
    sourceRole: "CurrentFiling",
    filedAt: evaluation?.inputs?.filingDate ?? null,
    reportingPeriods: [evaluation?.periodStart, evaluation?.periodEnd].filter(Boolean),
    acquiredAt,
    immutableReference: evaluation?.inputs?.filingUrl ?? null,
    contentHash: await sha256Text(stableSerialize(filingEvidence)),
    evidenceItems: filingEvidence,
  }];
  for (const declared of evaluation?.inputs?.authoritySources ?? []) {
    if (!declared?.accessionNumber || secSources.some((source) => source.accessionNumber === declared.accessionNumber)) continue;
    secSources.push({
      sourceType: "SEC Filing",
      authority: "U.S. Securities and Exchange Commission",
      authoritativeIdentity: `sec-accession:${declared.accessionNumber}`,
      accessionNumber: declared.accessionNumber,
      form: declared.form,
      sourceRole: declared.sourceRole ?? "ContributingFiling",
      amendsAccessionNumber: declared.amendsAccessionNumber ?? null,
      filedAt: declared.filingDate ?? null,
      reportingPeriods: [declared.reportDate].filter(Boolean),
      acquiredAt,
      immutableReference: declared.filingUrl ?? null,
      contentHash: await sha256Text(stableSerialize(declared)),
      evidenceItems: [],
    });
  }
  secSources.sort((left, right) => String(left.authoritativeIdentity).localeCompare(String(right.authoritativeIdentity)));
  const marketIdentity = {
    provider: marketSource.provider ?? "Unspecified",
    observationDate: evaluation?.inputs?.marketObservationDate ?? null,
    acquiredAt: marketSource.acquiredAt ?? acquiredAt,
    immutableReference: marketSource.immutableReference ?? evaluation?.inputs?.marketUrl ?? null,
    price: evaluation?.inputs?.sharePrice ?? null,
  };
  const marketContentHash = marketSource.contentHash ?? await sha256Text(stableSerialize(marketIdentity));
  const manifest = {
    schemaVersion: SOURCE_MANIFEST_SCHEMA_VERSION,
    securityId: normalizedSecurityId,
    acquiredAt: requiredIso(acquiredAt, "acquiredAt"),
    sources: [
      ...secSources,
      ...(evaluation?.periodAssembly?.carriedMetricIds?.length ? [{
        sourceType: "Prior Evidence Result",
        authority: "TMDL Evidence Engine",
        authoritativeIdentity: evaluation.metrics?.find((metric) => metric.authorityStatus === "CarriedForward")?.carriedFromResultId ?? null,
        acquiredAt,
        immutableReference: null,
        contentHash: await sha256Text(stableSerialize(evaluation.metrics?.filter((metric) => metric.authorityStatus === "CarriedForward") ?? [])),
      }] : []),
      {
        sourceType: "Market Price",
        authority: marketIdentity.provider,
        authoritativeIdentity: `${marketIdentity.provider}:${evaluation?.ticker}:${marketIdentity.observationDate}`,
        publishedAt: marketIdentity.observationDate,
        acquiredAt: marketIdentity.acquiredAt,
        immutableReference: marketIdentity.immutableReference,
        contentHash: marketContentHash,
      },
    ],
    evidenceItems: filingEvidence,
    governedResolutions: filingEvidence.filter((item) => item.reviewDecision).map((item) => ({
      field: item.field,
      decision: item.reviewDecision,
    })),
  };
  const manifestHash = await sha256Text(stableSerialize(manifest));
  return { ...manifest, manifestId: `esm_${manifestHash}`, manifestHash };
}

export async function createLongitudinalPublication({
  evaluation,
  securityId,
  knownAt,
  publishedAt,
  sourceMaxPublishedAt,
  eventType,
  supersedesResultId = /** @type {string | null} */ (null),
  sourceManifest,
}) {
  const normalizedSecurityId = normalizeSecurityId(securityId);
  const known = requiredIso(knownAt, "knownAt");
  const published = requiredIso(publishedAt, "publishedAt");
  const sourceMax = requiredIso(sourceMaxPublishedAt, "sourceMaxPublishedAt");
  if (!SUPPORTED_EVENT_TYPES.has(eventType)) throw new Error("Unsupported longitudinal eventType.");
  if (Date.parse(known) < Date.parse(sourceMax)) throw new Error("knownAt cannot precede sourceMaxPublishedAt.");
  if (Date.parse(published) < Date.parse(known)) throw new Error("publishedAt cannot precede knownAt.");
  if (sourceManifest?.securityId !== normalizedSecurityId || !sourceManifest?.manifestHash) {
    throw new Error("A matching immutable source manifest is required.");
  }
  const secSources = sourceManifest.sources?.filter?.((source) => source?.sourceType === "SEC Filing") ?? [];
  if (!secSources.length || secSources.some((source) => !["10-K", "10-Q", "10-Q/A"].includes(source?.form))) {
    throw new Error("Every authoritative SEC source must be a supported Form 10-K, 10-Q, or 10-Q/A.");
  }
  for (const amendment of secSources.filter((source) => source.form === "10-Q/A")) {
    if (!amendment.amendsAccessionNumber || !secSources.some((source) => source.form === "10-Q" && source.accessionNumber === amendment.amendsAccessionNumber)) {
      throw new Error("Every 10-Q/A source requires its exact original 10-Q source and amendment relationship.");
    }
  }
  const unsignedManifest = { ...sourceManifest };
  delete unsignedManifest.manifestId;
  delete unsignedManifest.manifestHash;
  const verifiedManifestHash = await sha256Text(stableSerialize(unsignedManifest));
  if (verifiedManifestHash !== sourceManifest.manifestHash || sourceManifest.manifestId !== `esm_${verifiedManifestHash}`) {
    throw new Error("Source manifest hash verification failed.");
  }
  const versionBundle = {
    engineVersion: evaluation.engineVersion,
    publicationSchemaVersion: evaluation.schemaVersion,
    canonicalRegistryVersion: evaluation.canonicalRegistryVersion,
    calculationRegistryVersion: evaluation.calculationRegistryVersion,
    aliasRegistryVersion: evaluation.aliasRegistryVersion,
    evidenceResolutionVersion: evaluation.evidenceResolutionVersion ?? null,
    periodAssemblyVersion: evaluation.periodAssemblyVersion ?? null,
    periodCompatibilityVersion: evaluation.periodCompatibilityVersion ?? null,
    scoringVersion: evaluation.scoringVersion ?? evaluation.scoring?.scoringVersion ?? null,
    acquisitionVersion: evaluation.inputs?.acquisition?.version ?? null,
  };
  const evidenceDates = datesFromEvidence(evaluation);
  const annualSources = secSources.filter((source) => source.form === "10-K");
  const quarterlySources = secSources.filter((source) => ["10-Q", "10-Q/A"].includes(source.form));
  const marketManifestSource = sourceManifest.sources?.find?.((source) => source?.sourceType === "Market Price") ?? null;
  const latestAnnual = annualSources.sort((left, right) => String(right.filedAt ?? "").localeCompare(String(left.filedAt ?? "")))[0] ?? null;
  const latestQuarterly = quarterlySources.sort((left, right) => String(right.filedAt ?? "").localeCompare(String(left.filedAt ?? "")))[0] ?? null;
  const carriedMetrics = evaluation.metrics?.filter((metric) => metric.authorityStatus === "CarriedForward") ?? [];
  const freshness = {
    latestAnnualFilingFiledDate: latestAnnual?.filedAt ?? (evaluation.reportingPeriod?.periodType === "FiscalYear" ? evaluation.inputs?.filingDate ?? null : null),
    latestAnnualFilingAccession: latestAnnual?.accessionNumber ?? (evaluation.reportingPeriod?.periodType === "FiscalYear" ? evaluation.inputs?.accessionNumber ?? null : null),
    latestQuarterlyFilingFiledDate: latestQuarterly?.filedAt ?? null,
    latestQuarterlyFilingAccession: latestQuarterly?.accessionNumber ?? null,
    latestQuarterlyFilingForm: latestQuarterly?.form ?? null,
    latestQuarterlySourceHash: evaluation.inputs?.acquisition?.quarterlySourceHash ?? latestQuarterly?.contentHash ?? null,
    latestSupportedFilingFiledDate: (latestQuarterly ?? latestAnnual)?.filedAt ?? evaluation.inputs?.filingDate ?? null,
    latestSupportedFilingAccession: (latestQuarterly ?? latestAnnual)?.accessionNumber ?? evaluation.inputs?.accessionNumber ?? null,
    marketObservationDate: evaluation.inputs?.marketObservationDate ?? null,
    marketObservationId: marketManifestSource?.authoritativeIdentity ?? marketManifestSource?.contentHash ?? null,
    oldestContributingEvidenceDate: evidenceDates[0] ?? null,
    sourceMaxPublishedAt: sourceMax,
    carriedEvidence: carriedMetrics.map((metric) => ({
      metricId: metric.id,
      carriedFromResultId: metric.carriedFromResultId,
      originalEvidencePeriod: metric.originalEvidencePeriod,
      originalFreshness: metric.originalFreshness,
    })),
    cadenceClass: evaluation.reportingPeriod?.periodType === "FiscalYear" ? "AnnualFilingAndWeeklyMarket" : "QuarterlyFilingAndWeeklyMarket",
    staleEvidenceFamilies: null,
    freshnessClassification: null,
  };
  // generatedAt is an execution trace, not authority. The authoritative clocks
  // are knownAt, sourceMaxPublishedAt, and publishedAt.
  const authoritativeEvaluation = { ...evaluation };
  delete authoritativeEvaluation.generatedAt;
  const identity = {
    schemaVersion: LONGITUDINAL_STATE_SCHEMA_VERSION,
    securityId: normalizedSecurityId,
    tickerAtState: evaluation.ticker,
    knownAt: known,
    sourceMaxPublishedAt: sourceMax,
    eventType,
    supersedesResultId,
    scoring: evaluation.scoring,
    versionBundle,
    sourceManifestId: sourceManifest.manifestId,
    sourceManifestHash: sourceManifest.manifestHash,
    freshness,
    evaluation: authoritativeEvaluation,
  };
  const stateFingerprint = await sha256Text(stableSerialize(identity));
  const resultId = `eer_${stateFingerprint}`;
  const publication = {
    ...identity,
    evaluation,
    resultId,
    stateFingerprint,
    publishedAt: published,
    coverage: {
      kind: "WeightedScoreability",
      weightedScoreabilityPercent: evaluation.scoring?.coveragePercent ?? null,
      includesFreshness: false,
    },
    sourceManifest,
  };
  const recordJson = stableSerialize(publication);
  const recordHash = await sha256Text(recordJson);
  return { publication, recordJson, stateFingerprint, recordHash };
}

export function selectAuthoritativeState(records, { securityId, timestamp }) {
  const normalizedSecurityId = normalizeSecurityId(securityId);
  const asOf = requiredIso(timestamp, "timestamp");
  const record = records
    .filter((item) => item.securityId === normalizedSecurityId && item.knownAt <= asOf)
    .sort((left, right) => right.knownAt.localeCompare(left.knownAt) || right.publishedAt.localeCompare(left.publishedAt))[0];
  return record
    ? { kind: "AuthoritativeState", asOf, securityId: normalizedSecurityId, record }
    : { kind: NO_AUTHORITATIVE_STATE, asOf, securityId: normalizedSecurityId };
}

export function detectAnnualWork({ securities, cursors, marketCadenceDue = false }) {
  const cursorMap = new Map(cursors.map((item) => [item.securityId, item]));
  return securities.map((item) => {
    const cursor = cursorMap.get(item.securityId);
    const filingChanged = item.latestAccession !== cursor?.latestAccession;
    const marketChanged = marketCadenceDue && item.marketObservationId !== cursor?.marketObservationId;
    return { ...item, action: filingChanged || marketChanged ? "Enqueue" : "NoChange", eventType: filingChanged ? "AnnualFilingAccepted" : marketChanged ? "ScheduledMarketObservation" : null };
  });
}

export function detectProspectiveWork({ securities, cursors, marketCadenceDue = false }) {
  const cursorMap = new Map(cursors.map((item) => [item.securityId, item]));
  return securities.map((item) => {
    const cursor = cursorMap.get(item.securityId);
    const annualChanged = item.latestAnnualAccession !== cursor?.latestAnnualAccession;
    // A newly governing 10-K intentionally clears the active-quarter cursor.
    // That disappearance is annual authority, not a new quarterly event.
    const quarterlyChanged = Boolean(item.latestQuarterlyAccession) &&
      item.latestQuarterlyAccession !== cursor?.latestQuarterlyAccession;
    const sameQuarterlyAccession = Boolean(
      item.latestQuarterlyAccession && item.latestQuarterlyAccession === cursor?.latestQuarterlyAccession,
    );
    const sourceMutation = sameQuarterlyAccession && Boolean(
      item.latestQuarterlySourceHash &&
      cursor?.latestQuarterlySourceHash &&
      item.latestQuarterlySourceHash !== cursor.latestQuarterlySourceHash,
    );
    const marketChanged = marketCadenceDue && item.marketObservationId !== cursor?.marketObservationId;
    const reasons = [
      ...(annualChanged ? ["AnnualFilingChanged"] : []),
      ...(quarterlyChanged ? [item.latestQuarterlyForm === "10-Q/A" ? "QuarterlyAmendmentChanged" : "QuarterlyFilingChanged"] : []),
      ...(marketChanged ? ["MarketObservationChanged"] : []),
    ];
    if (sourceMutation) {
      return { ...item, action: "ReviewRequired", eventType: null, reasons: ["SameAccessionSourceMutation"] };
    }
    const eventType = quarterlyChanged
      ? item.latestQuarterlyForm === "10-Q/A" ? "QuarterlyAmendmentAccepted" : "QuarterlyFilingAccepted"
      : annualChanged
        ? "AnnualFilingAccepted"
        : marketChanged
          ? "ScheduledMarketObservation"
          : null;
    return { ...item, action: eventType ? "Enqueue" : "NoChange", eventType, reasons };
  });
}

export function reconcileGeneration({ generationId, universeIdentity, universeHash, codeVersion, methodologyVersions, startedAt, completedAt, marketObservation, sourceManifestIds, events }) {
  const byOutcome = (outcome) => events.filter((event) => event.outcome === outcome);
  return {
    schemaVersion: GENERATION_MANIFEST_SCHEMA_VERSION,
    generationId,
    universeIdentity,
    universeHash,
    codeVersion,
    methodologyVersions,
    startedAt,
    completedAt,
    marketObservation,
    sourceManifestIds: [...new Set(sourceManifestIds)].sort(),
    succeededCount: byOutcome("Created").length + byOutcome("Reused").length,
    withheldCount: byOutcome("Withheld").length,
    excludedCount: byOutcome("Excluded").length,
    failedCount: byOutcome("Failed").length,
    resultIdsCreated: byOutcome("Created").map((event) => event.resultId),
    resultIdsReused: byOutcome("Reused").map((event) => event.resultId),
    failureEvents: byOutcome("Failed"),
  };
}
