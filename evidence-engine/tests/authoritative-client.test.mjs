import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authoritativeDisplay, loadCurrentAuthority, parseAuthoritativeHistory } from "../lib/authoritative-client.ts";

const resultId = "eer_e04420a081bae82543bb07b58de433b3cb96cc0ee449655a73cb1ab98d2979ae";
const summary = {
  resultId, securityId: "sec-cik:0000320193", tickerAtState: "AAPL", knownAt: "2026-09-07T18:37:49.130Z", publishedAt: "2026-09-07T18:37:49.130Z",
  sourceManifestId: "esm_704dde4294ea33537b9fd87ff4d38869308b3291430258a50d9041283eec6a21", stateFingerprint: resultId.slice(4), evaluationFingerprint: "evaluation-fingerprint",
  recordHash: "8aba46368f56fda8037b9fa0b02323c37afd3937fe3abe71292b4a6c8bc72f7a", scoringStatus: "InsufficientCoverage", score: null,
  coverage: { weightedScoreabilityPercent: "73.50" }, versions: { engineVersion: "6.5.0" }, companyName: "Apple Inc.", periodStart: "2025-06-29", periodEnd: "2026-06-27",
};
const exactRecord = { evaluation: { ticker: "AAPL", companyName: "Apple Inc.", periodEnd: "2026-06-27", inputs: { sharePrice: 325.67, marketObservationDate: "2026-09-04" }, scoring: { status: "InsufficientCoverage", coveragePercent: "73.50", score: null } }, sourceManifestHash: "manifest-hash" };

test("authority-first adapter resolves as-of then opens the exact verified AAPL Result using GET only", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("asOf=")) return Response.json({ kind: "AuthoritativeState", securityId: summary.securityId, record: summary });
    return Response.json({ record: { ...summary, exactRecord, integrity: { status: "Verified", algorithm: "SHA-256", recordHash: summary.recordHash } } });
  };
  const result = await loadCurrentAuthority("AAPL", "2026-09-07T20:00:00.000Z", fakeFetch);
  assert.equal(result.kind, "authoritative");
  assert.equal(result.record.resultId, resultId);
  assert.equal(result.record.exactRecord.evaluation.inputs.sharePrice, 325.67);
  assert.equal(result.record.exactRecord.evaluation.scoring.coveragePercent, "73.50");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.init.method === "GET" && !Object.keys(call.init.headers).some((key) => key.toLowerCase() === "authorization")));
});

test("no authority returns an explicit empty state without exact-result or evaluation work", async () => {
  let calls = 0;
  const result = await loadCurrentAuthority("NONE", "2026-09-07T20:00:00.000Z", async () => { calls += 1; return Response.json({ kind: "NoAuthoritativeState", securityId: null }); });
  assert.deepEqual(result, { kind: "empty", securityId: null });
  assert.equal(calls, 1);
});

test("History adapter uses the deployed authoritative response contract and current identity fields", () => {
  const parsed = parseAuthoritativeHistory({ records: [summary], count: 1, nextCursor: null, immutable: true });
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].resultId, resultId);
  assert.equal(parsed.records[0].coverage.weightedScoreabilityPercent, "73.50");
});

test("AAPL authoritative display uses the stored witness coverage and scoreability without recalculation", () => {
  assert.deepEqual(authoritativeDisplay({ ...summary, exactRecord, integrity: { status: "Verified", algorithm: "SHA-256", recordHash: summary.recordHash } }), {
    securityId: "sec-cik:0000320193", resultId, knownAt: "2026-09-07T18:37:49.130Z", periodEnd: "2026-06-27",
    marketPrice: 325.67, marketDate: "2026-09-04", coveragePercent: "73.50", scoreability: "InsufficientCoverage", score: null,
  });
});

test("browser-facing code contains no publication-token reference or publication endpoint request", async () => {
  const sources = await Promise.all(["../lib/authoritative-client.ts", "../components/evaluation-history.tsx", "../components/evidence-workbench.tsx"].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const browserSource = sources.join("\n");
  assert.doesNotMatch(browserSource, /EVIDENCE_ENGINE_PUBLICATION_TOKEN|Authorization:\s*Bearer|fetch\(["']\/api\/evaluations["']/);
});
