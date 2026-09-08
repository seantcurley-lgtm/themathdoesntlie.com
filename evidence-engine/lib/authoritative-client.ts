export type AuthoritativeRecordSummary = {
  resultId: string;
  securityId: string;
  tickerAtState: string;
  knownAt: string;
  publishedAt: string;
  sourceManifestId: string;
  stateFingerprint: string;
  evaluationFingerprint: string;
  recordHash: string;
  scoringStatus: string;
  score: string | null;
  coverage: { weightedScoreabilityPercent: string };
  versions: Record<string, string>;
  companyName: string;
  periodStart: string;
  periodEnd: string;
};

export type AuthoritativeRecordDetail = AuthoritativeRecordSummary & {
  exactRecord: Record<string, unknown> & { evaluation: Record<string, unknown> };
  integrity: { status: string; algorithm: string; recordHash: string };
};

export class AuthoritativeReadError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "AuthoritativeReadError";
  }
}

async function readJson(url: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new AuthoritativeReadError(response.status, String(payload.code ?? "AuthoritativeReadFailed"), String(payload.error ?? "Authoritative results are unavailable."));
  }
  return payload;
}

export async function fetchAuthoritativeExactResult(resultId: string, fetchImpl: typeof fetch = fetch) {
  const payload = await readJson(`/api/authoritative-results?id=${encodeURIComponent(resultId)}`, fetchImpl);
  if (!payload.record || typeof payload.record !== "object") throw new AuthoritativeReadError(502, "InvalidAuthoritativeResponse", "The exact authoritative response is malformed.");
  const record = payload.record as AuthoritativeRecordDetail;
  if (!record.exactRecord?.evaluation || record.integrity?.status !== "Verified") {
    throw new AuthoritativeReadError(502, "InvalidAuthoritativeResponse", "The exact authoritative record was not integrity-verified.");
  }
  return record;
}

export async function loadCurrentAuthority(ticker: string, asOf: string, fetchImpl: typeof fetch = fetch) {
  const params = new URLSearchParams({ ticker: ticker.toUpperCase(), asOf });
  const state = await readJson(`/api/authoritative-results?${params}`, fetchImpl);
  if (state.kind === "NoAuthoritativeState") return { kind: "empty" as const, securityId: state.securityId as string | null };
  const summary = state.record as AuthoritativeRecordSummary | undefined;
  if (state.kind !== "AuthoritativeState" || !summary?.resultId) {
    throw new AuthoritativeReadError(502, "InvalidAuthoritativeResponse", "The authoritative-state response is malformed.");
  }
  return { kind: "authoritative" as const, record: await fetchAuthoritativeExactResult(summary.resultId, fetchImpl) };
}

export function parseAuthoritativeHistory(payload: unknown) {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { records?: unknown }).records)) {
    throw new AuthoritativeReadError(502, "InvalidAuthoritativeResponse", "The authoritative History response is malformed.");
  }
  const value = payload as { records: AuthoritativeRecordSummary[]; nextCursor?: unknown };
  if (value.records.some((record) => !record.resultId || !record.securityId || !record.recordHash)) {
    throw new AuthoritativeReadError(502, "InvalidAuthoritativeResponse", "An authoritative History record is malformed.");
  }
  return { records: value.records, nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null };
}

export function authoritativeDisplay(record: AuthoritativeRecordDetail) {
  const evaluation = record.exactRecord.evaluation as { inputs?: Record<string, unknown> };
  return {
    securityId: record.securityId,
    resultId: record.resultId,
    knownAt: record.knownAt,
    periodEnd: record.periodEnd,
    marketPrice: evaluation.inputs?.sharePrice,
    marketDate: evaluation.inputs?.marketObservationDate,
    coveragePercent: record.coverage.weightedScoreabilityPercent,
    scoreability: record.scoringStatus,
    score: record.score,
  };
}
