import assert from "node:assert/strict";
import test from "node:test";

import {
  EVALUATION_RECORD_SCHEMA_VERSION,
  REPLAY_CONTRACT_VERSION,
  compareEvaluationSnapshots,
  currentVersionContext,
  replayEligibility,
  replayStoredEvaluation,
} from "../lib/evaluation-replay.mjs";
import {
  ENGINE_VERSION,
  evaluateInputs,
  microsoftFiscal2025,
} from "../lib/evidence-engine.mjs";

test("Release 6 publishes an explicit record and replay contract", () => {
  assert.equal(EVALUATION_RECORD_SCHEMA_VERSION, "1.0");
  assert.equal(REPLAY_CONTRACT_VERSION, "1.0.0");
  assert.equal(currentVersionContext().engineVersion, ENGINE_VERSION);
});

test("a current-context immutable snapshot replays to the exact fingerprint", async () => {
  const snapshot = await evaluateInputs(microsoftFiscal2025);
  const replay = await replayStoredEvaluation(snapshot);

  assert.equal(replay.status, "Reproduced");
  assert.equal(replay.eligibility.eligible, true);
  assert.equal(replay.comparison.fingerprintMatch, true);
  assert.equal(replay.comparison.metricChangeCount, 0);
  assert.equal(replay.comparison.scoringChanged, false);
  assert.notEqual(replay.replayed.generatedAt, undefined);
});

test("original-context replay blocks an unavailable recorded version", async () => {
  const snapshot = await evaluateInputs(microsoftFiscal2025);
  const priorContext = { ...snapshot, engineVersion: "4.0.0-browser" };
  const eligibility = replayEligibility(priorContext);
  const replay = await replayStoredEvaluation(priorContext);

  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.mismatches[0].key, "engineVersion");
  assert.equal(replay.status, "UnsupportedVersionContext");
  assert.equal(replay.replayed, null);
  assert.equal(replay.comparison, null);
});

test("comparison reports metric and score changes without altering the original", async () => {
  const original = await evaluateInputs(microsoftFiscal2025);
  const changed = await evaluateInputs({ ...microsoftFiscal2025, revenue: 300_000 });
  const originalText = JSON.stringify(original);
  const comparison = compareEvaluationSnapshots(original, changed);

  assert.equal(comparison.fingerprintMatch, false);
  assert.ok(comparison.metricChangeCount > 0);
  assert.ok(comparison.metricChanges.some((item) => item.id === "grossMargin"));
  assert.equal(JSON.stringify(original), originalText);
});
