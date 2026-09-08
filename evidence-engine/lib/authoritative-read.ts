import { and, desc, eq, gt, isNull, lt, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { evaluationRecords, securityAliases } from "@/db/schema";
import {
  LONGITUDINAL_STATE_SCHEMA_VERSION,
  NO_AUTHORITATIVE_STATE,
  normalizeSecurityId,
  sha256Text,
} from "@/lib/longitudinal-state.mjs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type AuthoritativeReadResult = {
  status?: number;
  body: Record<string, unknown>;
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

export function summarizeAuthoritativeRecord(row: typeof evaluationRecords.$inferSelect) {
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
    resultId: row.id,
    securityId: row.securityId,
    tickerAtState: row.ticker,
    knownAt: row.knownAt,
    publishedAt: row.publishedAt,
    sourceMaxPublishedAt: row.sourceMaxPublishedAt,
    eventType: row.eventType,
    supersedesResultId: row.supersedesResultId,
    sourceManifestId: row.sourceManifestId,
    stateFingerprint: row.stateFingerprint,
    evaluationFingerprint: row.fingerprint,
    recordHash: row.recordHash,
    scoringStatus: row.scoringStatus,
    score: row.overallScore,
    coverage: {
      kind: "WeightedScoreability",
      weightedScoreabilityPercent: row.coveragePercent,
      includesFreshness: false,
    },
    freshness: {
      latestAnnualFilingFiledDate: row.filingDate,
      latestAnnualFilingAccession: row.accessionNumber,
      marketObservationDate: row.marketObservationDate,
      marketObservationId: row.marketObservationId,
      oldestContributingEvidenceDate: row.oldestEvidenceDate,
      sourceMaxPublishedAt: row.sourceMaxPublishedAt,
      ...(exactFreshness ?? {}),
    },
    versions: {
      engineVersion: row.engineVersion,
      publicationSchemaVersion: row.publicationSchemaVersion,
      canonicalRegistryVersion: row.canonicalRegistryVersion,
      calculationRegistryVersion: row.calculationRegistryVersion,
      aliasRegistryVersion: row.aliasRegistryVersion,
      scoringVersion: row.scoringVersion,
    },
    companyName: row.companyName,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
  };
}

export async function readExactAuthoritativeResult(id: string): Promise<AuthoritativeReadResult> {
  const db = getDb();
  const [row] = await db.select().from(evaluationRecords).where(eq(evaluationRecords.id, id)).limit(1);
  if (!row) return { status: 404, body: { error: "Evidence Result not found." } };
  const hash = await sha256Text(row.recordJson);
  if (hash !== row.recordHash) {
    return {
      status: 500,
      body: {
        error: "Immutable Evidence Result integrity verification failed.",
        code: "IntegrityConflict",
      },
    };
  }
  return {
    body: {
      record: {
        ...summarizeAuthoritativeRecord(row),
        exactRecord: JSON.parse(row.recordJson),
        integrity: { status: "Verified", algorithm: "SHA-256", recordHash: hash },
      },
    },
  };
}

export async function readAuthoritativeAsOf(url: URL): Promise<AuthoritativeReadResult> {
  const timestamp = isoValue(url.searchParams.get("asOf")?.trim(), "asOf");
  const securityParam = url.searchParams.get("securityId")?.trim();
  const ticker = url.searchParams.get("ticker")?.trim().toUpperCase();
  const db = getDb();
  let securityId = securityParam ? normalizeSecurityId(securityParam) : null;
  if (!securityId && ticker) {
    const aliases = await db.select().from(securityAliases).where(and(
      eq(securityAliases.ticker, ticker),
      lte(securityAliases.validFrom, timestamp),
      or(isNull(securityAliases.validTo), gt(securityAliases.validTo, timestamp)),
    )).limit(2);
    if (new Set(aliases.map((item) => item.securityId)).size === 1) securityId = aliases[0].securityId;
  }
  if (!securityId) return { body: { kind: NO_AUTHORITATIVE_STATE, asOf: timestamp, securityId: null } };
  const [row] = await db.select().from(evaluationRecords).where(and(
    eq(evaluationRecords.securityId, securityId),
    lte(evaluationRecords.knownAt, timestamp),
  )).orderBy(desc(evaluationRecords.knownAt), desc(evaluationRecords.publishedAt)).limit(1);
  if (!row) return { body: { kind: NO_AUTHORITATIVE_STATE, asOf: timestamp, securityId } };
  return {
    body: {
      kind: "AuthoritativeState",
      asOf: timestamp,
      securityId,
      record: summarizeAuthoritativeRecord(row),
    },
  };
}

export async function listAuthoritativeResults(url: URL): Promise<AuthoritativeReadResult> {
  const securityParam = url.searchParams.get("securityId")?.trim();
  const ticker = url.searchParams.get("ticker")?.trim().toUpperCase();
  const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;
  const cursor = url.searchParams.get("cursor")?.trim();
  const db = getDb();
  const baseWhere = securityParam
    ? eq(evaluationRecords.securityId, normalizeSecurityId(securityParam))
    : ticker
      ? eq(evaluationRecords.ticker, ticker)
      : undefined;
  const separator = cursor?.indexOf("|") ?? -1;
  const cursorPublishedAt = separator > 0 ? cursor?.slice(0, separator) : null;
  const cursorId = separator > 0 ? cursor?.slice(separator + 1) : null;
  const cursorWhere = cursorPublishedAt && cursorId
    ? or(
      lt(evaluationRecords.publishedAt, cursorPublishedAt),
      and(eq(evaluationRecords.publishedAt, cursorPublishedAt), lt(evaluationRecords.id, cursorId)),
    )
    : undefined;
  const where = baseWhere && cursorWhere ? and(baseWhere, cursorWhere) : baseWhere ?? cursorWhere;
  const rows = await db.select().from(evaluationRecords).where(where)
    .orderBy(desc(evaluationRecords.publishedAt), desc(evaluationRecords.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    body: {
      records: page.map(summarizeAuthoritativeRecord),
      count: page.length,
      nextCursor: rows.length > limit ? `${page.at(-1)?.publishedAt}|${page.at(-1)?.id}` : null,
      immutable: true,
      recordSchemaVersion: LONGITUDINAL_STATE_SCHEMA_VERSION,
    },
  };
}

export async function performAuthoritativeRead(request: Request): Promise<AuthoritativeReadResult> {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (id) return readExactAuthoritativeResult(id);
  if (url.searchParams.get("asOf")?.trim()) return readAuthoritativeAsOf(url);
  return listAuthoritativeResults(url);
}
