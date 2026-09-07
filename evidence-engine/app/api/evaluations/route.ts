import { env } from "cloudflare:workers";
import { and, desc, eq, gt, isNull, lt, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { evaluationRecords, securityAliases, sourceManifests } from "@/db/schema";
import { LONGITUDINAL_STATE_SCHEMA_VERSION, NO_AUTHORITATIVE_STATE, createLongitudinalPublication, normalizeSecurityId, sha256Text, stableSerialize, verifyBearerAuthorization } from "@/lib/longitudinal-state.mjs";

export const runtime = "edge";
const MAX_RECORD_BYTES = 2_000_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type Publication = Record<string, unknown> & {
  resultId: string; securityId: string; tickerAtState: string; knownAt: string; publishedAt: string;
  sourceMaxPublishedAt: string; eventType: string; supersedesResultId?: string | null;
  sourceManifestId: string; sourceManifestHash: string; sourceManifest: Record<string, unknown>;
  evaluation: Record<string, unknown>; versionBundle: Record<string, unknown>;
  freshness: Record<string, unknown>; coverage: Record<string, unknown>;
};

function textValue(value: unknown, field: string, max = 512) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  if (value.length > max) throw new Error(`${field} is too long.`);
  return value.trim();
}

function isoValue(value: unknown, field: string) {
  const result = textValue(value, field, 80);
  if (Number.isNaN(Date.parse(result))) throw new Error(`${field} must be an ISO date or timestamp.`);
  return result;
}

async function authorized(request: Request) {
  const configured = (env as unknown as Record<string, unknown>).EVIDENCE_ENGINE_PUBLICATION_TOKEN;
  return verifyBearerAuthorization(request.headers.get("authorization"), configured);
}

function unauthorized() {
  return Response.json({ error: "Controlled Evidence Engine state access requires job authorization." }, { status: 403 });
}

function summary(row: typeof evaluationRecords.$inferSelect) {
  let exactFreshness: Record<string, unknown> | null = null;
  try {
    const exact = JSON.parse(row.recordJson) as Record<string, unknown>;
    exactFreshness = exact.freshness && typeof exact.freshness === "object"
      ? exact.freshness as Record<string, unknown>
      : null;
  } catch {
    exactFreshness = null;
  }
  return {
    resultId: row.id, securityId: row.securityId, tickerAtState: row.ticker,
    knownAt: row.knownAt, publishedAt: row.publishedAt, sourceMaxPublishedAt: row.sourceMaxPublishedAt,
    eventType: row.eventType, supersedesResultId: row.supersedesResultId,
    sourceManifestId: row.sourceManifestId, stateFingerprint: row.stateFingerprint, recordHash: row.recordHash,
    scoringStatus: row.scoringStatus, score: row.overallScore,
    coverage: { kind: "WeightedScoreability", weightedScoreabilityPercent: row.coveragePercent, includesFreshness: false },
    freshness: { latestAnnualFilingFiledDate: row.filingDate, latestAnnualFilingAccession: row.accessionNumber, marketObservationDate: row.marketObservationDate, marketObservationId: row.marketObservationId, oldestContributingEvidenceDate: row.oldestEvidenceDate, sourceMaxPublishedAt: row.sourceMaxPublishedAt, ...(exactFreshness ?? {}) },
    versions: { engineVersion: row.engineVersion, publicationSchemaVersion: row.publicationSchemaVersion, canonicalRegistryVersion: row.canonicalRegistryVersion, calculationRegistryVersion: row.calculationRegistryVersion, aliasRegistryVersion: row.aliasRegistryVersion, scoringVersion: row.scoringVersion },
    companyName: row.companyName, periodStart: row.periodStart, periodEnd: row.periodEnd,
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Evaluation state request failed.";
  const missing = message.includes("no such table") || message.includes("no column named") || message.includes("has no column named");
  return Response.json({ error: missing ? "The authoritative state migration has not been applied." : message }, { status: missing ? 503 : 400 });
}

async function exactRecord(id: string) {
  const db = getDb();
  const [row] = await db.select().from(evaluationRecords).where(eq(evaluationRecords.id, id)).limit(1);
  if (!row) return Response.json({ error: "Evidence Result not found." }, { status: 404 });
  const hash = await sha256Text(row.recordJson);
  if (hash !== row.recordHash) return Response.json({ error: "Immutable Evidence Result integrity verification failed.", code: "IntegrityConflict" }, { status: 500 });
  return Response.json({ record: { ...summary(row), exactRecord: JSON.parse(row.recordJson), integrity: { status: "Verified", algorithm: "SHA-256", recordHash: hash } } });
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return unauthorized();
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    if (id) return exactRecord(id);
    const asOf = url.searchParams.get("asOf")?.trim();
    const securityParam = url.searchParams.get("securityId")?.trim();
    const ticker = url.searchParams.get("ticker")?.trim().toUpperCase();
    const db = getDb();
    if (asOf) {
      const timestamp = isoValue(asOf, "asOf");
      let securityId = securityParam ? normalizeSecurityId(securityParam) : null;
      if (!securityId && ticker) {
        const aliases = await db.select().from(securityAliases).where(and(eq(securityAliases.ticker, ticker), lte(securityAliases.validFrom, timestamp), or(isNull(securityAliases.validTo), gt(securityAliases.validTo, timestamp)))).limit(2);
        if (new Set(aliases.map((item) => item.securityId)).size === 1) securityId = aliases[0].securityId;
      }
      if (!securityId) return Response.json({ kind: NO_AUTHORITATIVE_STATE, asOf: timestamp, securityId: null });
      const [row] = await db.select().from(evaluationRecords).where(and(eq(evaluationRecords.securityId, securityId), lte(evaluationRecords.knownAt, timestamp))).orderBy(desc(evaluationRecords.knownAt), desc(evaluationRecords.publishedAt)).limit(1);
      if (!row) return Response.json({ kind: NO_AUTHORITATIVE_STATE, asOf: timestamp, securityId });
      return Response.json({ kind: "AuthoritativeState", asOf: timestamp, securityId, record: summary(row) });
    }
    const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    const cursor = url.searchParams.get("cursor")?.trim();
    const baseWhere = securityParam ? eq(evaluationRecords.securityId, normalizeSecurityId(securityParam)) : ticker ? eq(evaluationRecords.ticker, ticker) : undefined;
    const separator = cursor?.indexOf("|") ?? -1;
    const cursorPublishedAt = separator > 0 ? cursor?.slice(0, separator) : null;
    const cursorId = separator > 0 ? cursor?.slice(separator + 1) : null;
    const cursorWhere = cursorPublishedAt && cursorId ? or(lt(evaluationRecords.publishedAt, cursorPublishedAt), and(eq(evaluationRecords.publishedAt, cursorPublishedAt), lt(evaluationRecords.id, cursorId))) : undefined;
    const where = baseWhere && cursorWhere ? and(baseWhere, cursorWhere) : baseWhere ?? cursorWhere;
    const rows = await db.select().from(evaluationRecords).where(where).orderBy(desc(evaluationRecords.publishedAt), desc(evaluationRecords.id)).limit(limit + 1);
    const page = rows.slice(0, limit);
    return Response.json({ records: page.map(summary), count: page.length, nextCursor: rows.length > limit ? `${page.at(-1)?.publishedAt}|${page.at(-1)?.id}` : null, immutable: true, recordSchemaVersion: LONGITUDINAL_STATE_SCHEMA_VERSION });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return unauthorized();
  try {
    const body = await request.text();
    if (!body || new TextEncoder().encode(body).byteLength > MAX_RECORD_BYTES) return Response.json({ error: `Publication must be between 1 and ${MAX_RECORD_BYTES} bytes.` }, { status: 413 });
    const payload = JSON.parse(body) as { publication?: Publication; recordJson?: string; stateFingerprint?: string; recordHash?: string; label?: string };
    const publication = payload.publication;
    if (!publication || typeof publication !== "object") throw new Error("publication is required.");
    const recordJson = textValue(payload.recordJson, "recordJson", MAX_RECORD_BYTES);
    if (recordJson !== stableSerialize(publication)) throw new Error("recordJson is not the canonical exact serialization of publication.");
    const recordHash = textValue(payload.recordHash, "recordHash", 64);
    if (await sha256Text(recordJson) !== recordHash) return Response.json({ error: "Exact-record hash does not match recordJson.", code: "IntegrityConflict" }, { status: 409 });
    const stateFingerprint = textValue(payload.stateFingerprint, "stateFingerprint", 64);
    if (publication.stateFingerprint !== stateFingerprint) throw new Error("Publication stateFingerprint mismatch.");
    if (publication.resultId !== `eer_${stateFingerprint}`) throw new Error("resultId must be derived from stateFingerprint.");
    const securityId = normalizeSecurityId(publication.securityId);
    const evaluation = publication.evaluation;
    const sourceManifest = publication.sourceManifest;
    if (sourceManifest?.manifestId !== publication.sourceManifestId || sourceManifest?.manifestHash !== publication.sourceManifestHash) throw new Error("Source manifest identity mismatch.");
    const manifestJson = stableSerialize(sourceManifest);
    const unsignedManifest = { ...sourceManifest }; delete unsignedManifest.manifestId; delete unsignedManifest.manifestHash;
    if (await sha256Text(stableSerialize(unsignedManifest)) !== publication.sourceManifestHash) throw new Error("Source manifest hash verification failed.");
    const rebuilt = await createLongitudinalPublication({ evaluation, securityId, knownAt: publication.knownAt, publishedAt: publication.publishedAt, sourceMaxPublishedAt: publication.sourceMaxPublishedAt, eventType: publication.eventType, supersedesResultId: publication.supersedesResultId ?? null, sourceManifest });
    if (rebuilt.stateFingerprint !== stateFingerprint || rebuilt.recordHash !== recordHash) return Response.json({ error: "Authoritative state identity verification failed.", code: "IntegrityConflict" }, { status: 409 });
    const db = getDb();
    const [existing] = await db.select().from(evaluationRecords).where(eq(evaluationRecords.stateFingerprint, stateFingerprint)).limit(1);
    if (existing) {
      if (existing.recordHash !== recordHash) return Response.json({ error: "stateFingerprint already exists with a different exact-record hash.", code: "IntegrityConflict" }, { status: 409 });
      return Response.json({ record: summary(existing), created: false });
    }
    await db.insert(sourceManifests).values({ id: publication.sourceManifestId, securityId, manifestHash: publication.sourceManifestHash, acquiredAt: isoValue(sourceManifest.acquiredAt, "sourceManifest.acquiredAt"), manifestJson }).onConflictDoNothing({ target: sourceManifests.manifestHash });
    const scoring = evaluation.scoring as Record<string, unknown> | undefined;
    const versions = publication.versionBundle;
    const freshness = publication.freshness;
    const manifestSources = Array.isArray(sourceManifest.sources) ? sourceManifest.sources as Array<Record<string, unknown>> : [];
    const marketManifestSource = manifestSources.find((source) => source.sourceType === "Market Price");
    const marketObservationId = marketManifestSource ? String(marketManifestSource.authoritativeIdentity ?? marketManifestSource.contentHash ?? "") || null : null;
    const values = {
      id: textValue(publication.resultId, "resultId", 80), recordSchemaVersion: LONGITUDINAL_STATE_SCHEMA_VERSION, recordKind: "authoritative-evaluation", sourceRecordId: null,
      securityId, knownAt: isoValue(publication.knownAt, "knownAt"), publishedAt: isoValue(publication.publishedAt, "publishedAt"), sourceMaxPublishedAt: isoValue(publication.sourceMaxPublishedAt, "sourceMaxPublishedAt"), eventType: textValue(publication.eventType, "eventType", 80), supersedesResultId: publication.supersedesResultId ?? null, sourceManifestId: publication.sourceManifestId, stateFingerprint,
      label: typeof payload.label === "string" ? payload.label.slice(0, 160) : `${publication.tickerAtState} ${evaluation.periodEnd}`,
      companyName: textValue(evaluation.companyName, "evaluation.companyName", 200), ticker: textValue(publication.tickerAtState, "tickerAtState", 20).toUpperCase(), periodStart: textValue(evaluation.periodStart, "evaluation.periodStart", 20), periodEnd: textValue(evaluation.periodEnd, "evaluation.periodEnd", 20), savedAt: publication.publishedAt,
      fingerprint: textValue(evaluation.fingerprint, "evaluation.fingerprint", 64), recordHash,
      engineVersion: textValue(versions.engineVersion, "engineVersion", 80), publicationSchemaVersion: textValue(versions.publicationSchemaVersion, "publicationSchemaVersion", 32), canonicalRegistryVersion: textValue(versions.canonicalRegistryVersion, "canonicalRegistryVersion", 80), calculationRegistryVersion: textValue(versions.calculationRegistryVersion, "calculationRegistryVersion", 80), aliasRegistryVersion: textValue(versions.aliasRegistryVersion, "aliasRegistryVersion", 80), scoringVersion: textValue(versions.scoringVersion, "scoringVersion", 80),
      scoringStatus: String(scoring?.status ?? "Unavailable"), overallScore: scoring?.overallScore == null ? null : String(scoring.overallScore), coveragePercent: scoring?.coveragePercent == null ? null : String(scoring.coveragePercent), tier: scoring?.tier == null ? null : String(scoring.tier), filingDate: freshness.latestAnnualFilingFiledDate == null ? null : String(freshness.latestAnnualFilingFiledDate), accessionNumber: evaluation.inputs && typeof evaluation.inputs === "object" ? String((evaluation.inputs as Record<string, unknown>).accessionNumber ?? "") || null : null, marketObservationDate: freshness.marketObservationDate == null ? null : String(freshness.marketObservationDate), marketObservationId, oldestEvidenceDate: freshness.oldestContributingEvidenceDate == null ? null : String(freshness.oldestContributingEvidenceDate),
      metricCount: Array.isArray(evaluation.metrics) ? evaluation.metrics.length : 0, unavailableMetricCount: Array.isArray(evaluation.unavailableMetrics) ? evaluation.unavailableMetrics.length : 0, recordJson,
    };
    // Establish the idempotent lookup identity before the authoritative row.
    // If the final insert fails, the alias can only resolve to an explicit
    // no-state result; the inverse ordering could strand an unresolvable Result.
    await db.insert(securityAliases).values({ id: `esa_${await sha256Text(`${securityId}|${publication.tickerAtState}|${publication.knownAt}`)}`, securityId, ticker: publication.tickerAtState.toUpperCase(), validFrom: publication.knownAt, validTo: null }).onConflictDoNothing();
    let inserted;
    try {
      inserted = await db.insert(evaluationRecords).values(values).returning();
    } catch (insertError) {
      const [raced] = await db.select().from(evaluationRecords).where(eq(evaluationRecords.stateFingerprint, stateFingerprint)).limit(1);
      if (!raced) throw insertError;
      if (raced.recordHash !== recordHash) return Response.json({ error: "Concurrent publication produced a state fingerprint/exact-record hash conflict.", code: "IntegrityConflict" }, { status: 409 });
      return Response.json({ record: summary(raced), created: false });
    }
    return Response.json({ record: summary(inserted[0]), created: true }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Request body is not valid JSON." }, { status: 400 });
    return failure(error);
  }
}
