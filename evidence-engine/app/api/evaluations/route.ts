import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { evaluationRecords, securityAliases, sourceManifests } from "@/db/schema";
import { performAuthoritativeRead, summarizeAuthoritativeRecord } from "@/lib/authoritative-read";
import { LONGITUDINAL_STATE_SCHEMA_VERSION, createLongitudinalPublication, normalizeSecurityId, sha256Text, stableSerialize, verifyBearerAuthorization } from "@/lib/longitudinal-state.mjs";

export const runtime = "edge";
const MAX_RECORD_BYTES = 2_000_000;

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

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Evaluation state request failed.";
  const missing = message.includes("no such table") || message.includes("no column named") || message.includes("has no column named");
  return Response.json({ error: missing ? "The authoritative state migration has not been applied." : message }, { status: missing ? 503 : 400 });
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return unauthorized();
  try {
    const result = await performAuthoritativeRead(request);
    return Response.json(result.body, { status: result.status ?? 200 });
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
      return Response.json({ record: summarizeAuthoritativeRecord(existing), created: false });
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
      return Response.json({ record: summarizeAuthoritativeRecord(raced), created: false });
    }
    return Response.json({ record: summarizeAuthoritativeRecord(inserted[0]), created: true }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Request body is not valid JSON." }, { status: 400 });
    return failure(error);
  }
}
