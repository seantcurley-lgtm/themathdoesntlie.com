import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { evaluationRecords } from "@/db/schema";
import { EVALUATION_RECORD_SCHEMA_VERSION } from "@/lib/evaluation-replay.mjs";

export const runtime = "edge";

const MAX_RECORD_BYTES = 2_000_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type EvaluationSnapshot = Record<string, unknown> & {
  schemaVersion: string;
  engineVersion: string;
  canonicalRegistryVersion: string;
  calculationRegistryVersion: string;
  aliasRegistryVersion: string;
  scoringVersion?: string;
  generatedAt: string;
  companyName: string;
  ticker: string;
  periodStart: string;
  periodEnd: string;
  fingerprint: string;
  inputs: Record<string, unknown>;
  metrics: Array<Record<string, unknown>>;
  unavailableMetrics: Array<Record<string, unknown>>;
  scoring?: {
    scoringVersion?: string;
    status?: string;
    overallScore?: string | null;
    tier?: string | null;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, maxLength = 512) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  if (value.length > maxLength) throw new Error(`${field} is too long.`);
  return value.trim();
}

function validateEvaluation(value: unknown): EvaluationSnapshot {
  if (!isObject(value)) throw new Error("evaluation must be an object.");
  requiredText(value.schemaVersion, "evaluation.schemaVersion", 32);
  requiredText(value.engineVersion, "evaluation.engineVersion", 80);
  requiredText(value.canonicalRegistryVersion, "evaluation.canonicalRegistryVersion", 80);
  requiredText(value.calculationRegistryVersion, "evaluation.calculationRegistryVersion", 80);
  requiredText(value.aliasRegistryVersion, "evaluation.aliasRegistryVersion", 80);
  requiredText(value.generatedAt, "evaluation.generatedAt", 80);
  requiredText(value.companyName, "evaluation.companyName", 200);
  requiredText(value.ticker, "evaluation.ticker", 20);
  requiredText(value.periodStart, "evaluation.periodStart", 20);
  requiredText(value.periodEnd, "evaluation.periodEnd", 20);
  requiredText(value.fingerprint, "evaluation.fingerprint", 128);
  if (!isObject(value.inputs)) throw new Error("evaluation.inputs is required.");
  if (!Array.isArray(value.metrics)) throw new Error("evaluation.metrics is required.");
  if (!Array.isArray(value.unavailableMetrics)) {
    throw new Error("evaluation.unavailableMetrics is required.");
  }
  return value as EvaluationSnapshot;
}

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function summary(row: typeof evaluationRecords.$inferSelect) {
  return {
    id: row.id,
    recordSchemaVersion: row.recordSchemaVersion,
    recordKind: row.recordKind,
    sourceRecordId: row.sourceRecordId,
    label: row.label,
    companyName: row.companyName,
    ticker: row.ticker,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    savedAt: row.savedAt,
    fingerprint: row.fingerprint,
    recordHash: row.recordHash,
    engineVersion: row.engineVersion,
    publicationSchemaVersion: row.publicationSchemaVersion,
    canonicalRegistryVersion: row.canonicalRegistryVersion,
    calculationRegistryVersion: row.calculationRegistryVersion,
    aliasRegistryVersion: row.aliasRegistryVersion,
    scoringVersion: row.scoringVersion,
    scoringStatus: row.scoringStatus,
    overallScore: row.overallScore,
    tier: row.tier,
    metricCount: row.metricCount,
    unavailableMetricCount: row.unavailableMetricCount,
  };
}

function errorResponse(error: unknown, fallback = "Evaluation record request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  const missingTable = message.includes("no such table") || message.includes("evaluation_records");
  return Response.json(
    {
      error: missingTable
        ? "The immutable evaluation store is not initialized for this release."
        : message,
    },
    { status: missingTable ? 503 : 400 },
  );
}

export async function GET(request: Request) {
  return Response.json(
    { error: "Cloud evaluation history is disabled in the public TMDL release." },
    { status: 403 },
  );

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    const db = getDb();

    if (id) {
      const [row] = await db
        .select()
        .from(evaluationRecords)
        .where(eq(evaluationRecords.id, id))
        .limit(1);
      if (!row) return Response.json({ error: "Evaluation record not found." }, { status: 404 });

      const recordHash = await sha256(row.recordJson);
      if (recordHash !== row.recordHash) {
        return Response.json(
          { error: "Evaluation record integrity verification failed." },
          { status: 500 },
        );
      }

      return Response.json({
        record: {
          ...summary(row),
          integrity: { status: "Verified", algorithm: "SHA-256", hash: recordHash },
          evaluation: JSON.parse(row.recordJson),
        },
      });
    }

    const ticker = url.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
    const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const where = ticker ? eq(evaluationRecords.ticker, ticker) : undefined;
    const rows = await db
      .select()
      .from(evaluationRecords)
      .where(where)
      .orderBy(desc(evaluationRecords.savedAt), desc(evaluationRecords.id))
      .limit(limit);

    return Response.json({
      records: rows.map(summary),
      count: rows.length,
      immutable: true,
      recordSchemaVersion: EVALUATION_RECORD_SCHEMA_VERSION,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  return Response.json(
    { error: "Anonymous immutable-record writes are disabled in the public TMDL release." },
    { status: 403 },
  );

  try {
    const body = await request.text();
    if (!body || new TextEncoder().encode(body).byteLength > MAX_RECORD_BYTES) {
      return Response.json(
        { error: `Evaluation record must be between 1 and ${MAX_RECORD_BYTES} bytes.` },
        { status: 413 },
      );
    }

    const payload = JSON.parse(body) as { evaluation?: unknown; label?: unknown };
    const evaluation = validateEvaluation(payload.evaluation);
    const recordJson = JSON.stringify(evaluation);
    const recordHash = await sha256(recordJson);
    const fingerprint = requiredText(evaluation.fingerprint, "evaluation.fingerprint", 128);
    const ticker = requiredText(evaluation.ticker, "evaluation.ticker", 20).toUpperCase();
    const label =
      typeof payload.label === "string" && payload.label.trim()
        ? payload.label.trim().slice(0, 160)
        : `${ticker} ${evaluation.periodEnd}`;
    const scoring = evaluation.scoring ?? {};
    const scoringVersion =
      evaluation.scoringVersion ?? scoring.scoringVersion ?? "unversioned";
    const db = getDb();
    const savedAt = new Date().toISOString();
    const id = `evr_${crypto.randomUUID().replaceAll("-", "")}`;

    const inserted = await db
      .insert(evaluationRecords)
      .values({
        id,
        recordSchemaVersion: EVALUATION_RECORD_SCHEMA_VERSION,
        recordKind: "evaluation",
        sourceRecordId: null,
        label,
        companyName: requiredText(evaluation.companyName, "evaluation.companyName", 200),
        ticker,
        periodStart: requiredText(evaluation.periodStart, "evaluation.periodStart", 20),
        periodEnd: requiredText(evaluation.periodEnd, "evaluation.periodEnd", 20),
        savedAt,
        fingerprint,
        recordHash,
        engineVersion: requiredText(evaluation.engineVersion, "evaluation.engineVersion", 80),
        publicationSchemaVersion: requiredText(
          evaluation.schemaVersion,
          "evaluation.schemaVersion",
          32,
        ),
        canonicalRegistryVersion: requiredText(
          evaluation.canonicalRegistryVersion,
          "evaluation.canonicalRegistryVersion",
          80,
        ),
        calculationRegistryVersion: requiredText(
          evaluation.calculationRegistryVersion,
          "evaluation.calculationRegistryVersion",
          80,
        ),
        aliasRegistryVersion: requiredText(
          evaluation.aliasRegistryVersion,
          "evaluation.aliasRegistryVersion",
          80,
        ),
        scoringVersion,
        scoringStatus: scoring.status ?? "Unavailable",
        overallScore: scoring.overallScore ?? null,
        tier: scoring.tier ?? null,
        metricCount: evaluation.metrics.length,
        unavailableMetricCount: evaluation.unavailableMetrics.length,
        recordJson,
      })
      .onConflictDoNothing({ target: evaluationRecords.fingerprint })
      .returning();

    if (inserted.length) {
      return Response.json({ record: summary(inserted[0]), created: true }, { status: 201 });
    }

    const [existing] = await db
      .select()
      .from(evaluationRecords)
      .where(and(eq(evaluationRecords.fingerprint, fingerprint)))
      .limit(1);
    return Response.json({ record: summary(existing), created: false });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body is not valid JSON." }, { status: 400 });
    }
    return errorResponse(error);
  }
}
