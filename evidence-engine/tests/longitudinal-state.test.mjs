import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateInputs, microsoftFiscal2025 } from "../lib/evidence-engine.mjs";
import {
  NO_AUTHORITATIVE_STATE,
  createLongitudinalPublication,
  createSourceManifest,
  detectAnnualWork,
  detectProspectiveWork,
  normalizeSecurityId,
  reconcileGeneration,
  selectAuthoritativeState,
  sha256Text,
  stableSerialize,
  verifyBearerAuthorization,
} from "../lib/longitudinal-state.mjs";
import { IntegrityConflictError, appendImmutableRecord, queryAsOf } from "../lib/publication-store.mjs";

const authority = {
  securityId: "789019",
  knownAt: "2025-07-30T20:00:00.000Z",
  publishedAt: "2025-07-30T20:01:00.000Z",
  sourceMaxPublishedAt: "2025-07-30T00:00:00.000Z",
  eventType: "AnnualFilingAccepted",
};

async function fixture(inputChanges = {}, manifestChanges = {}) {
  const evaluation = await evaluateInputs({ ...microsoftFiscal2025, ...inputChanges });
  let sourceManifest = await createSourceManifest({
    evaluation, securityId: authority.securityId, acquiredAt: authority.knownAt,
    marketSource: { provider: "Synthetic fixture", acquiredAt: authority.knownAt, immutableReference: "fixture:market:2025-06-30" },
  });
  sourceManifest = { ...sourceManifest, ...manifestChanges };
  if (Object.keys(manifestChanges).length) {
    const unsigned = { ...sourceManifest }; delete unsigned.manifestId; delete unsigned.manifestHash;
    sourceManifest.manifestHash = await sha256Text(stableSerialize(unsigned));
    sourceManifest.manifestId = `esm_${sourceManifest.manifestHash}`;
  }
  return createLongitudinalPublication({ evaluation, sourceManifest, ...authority });
}

test("current score and deterministic evaluation output remain unchanged", async () => {
  const first = await evaluateInputs(microsoftFiscal2025);
  const second = await evaluateInputs(microsoftFiscal2025);
  assert.equal(first.scoring.overallScore, "83.70");
  assert.equal(first.scoring.coveragePercent, "96.00");
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.metrics, second.metrics);
});

test("authoritative state construction is deterministic with declared timestamps", async () => {
  const first = await fixture();
  const second = await fixture();
  assert.equal(first.stateFingerprint, second.stateFingerprint);
  assert.equal(first.publication.securityId, "sec-cik:0000789019");
  assert.equal(first.publication.coverage.kind, "WeightedScoreability");
  assert.equal(first.publication.coverage.includesFreshness, false);
});

test("exact serialization and record hash detect any publication change", async () => {
  const result = await fixture();
  assert.equal(await sha256Text(result.recordJson), result.recordHash);
  assert.notEqual(await sha256Text(`${result.recordJson} `), result.recordHash);
});

test("evidence dates, market dates, and source manifests participate in state identity", async () => {
  const baseline = await fixture();
  const evidence = structuredClone(microsoftFiscal2025.inputEvidence ?? {});
  evidence.revenue = { field: "revenue", filed: "2025-07-31", form: "10-K" };
  const changedEvidenceDate = await fixture({ inputEvidence: evidence });
  const changedMarketDate = await fixture({ marketObservationDate: "2025-06-27" });
  const changedManifest = await fixture({}, { governedResolutions: [{ field: "revenue", decision: { decision: "Accepted", reviewedAt: "2025-07-30T19:00:00Z" } }] });
  assert.notEqual(changedEvidenceDate.stateFingerprint, baseline.stateFingerprint);
  assert.notEqual(changedMarketDate.stateFingerprint, baseline.stateFingerprint);
  assert.notEqual(changedManifest.stateFingerprint, baseline.stateFingerprint);
});

test("append is idempotent and fingerprint/hash mismatch is an integrity failure", async () => {
  const records = [];
  const publication = await fixture();
  const row = { resultId: publication.publication.resultId, ...publication };
  assert.equal((await appendImmutableRecord(records, row)).created, true);
  assert.equal((await appendImmutableRecord(records, row)).created, false);
  const changedJson = `${row.recordJson} `;
  const changedHash = await sha256Text(changedJson);
  await assert.rejects(() => appendImmutableRecord(records, { ...row, recordJson: changedJson, recordHash: changedHash }), IntegrityConflictError);
  assert.equal(records.length, 1);
  assert.equal(Object.isFrozen(records[0]), true);
});

test("as-of selection never falls forward and has an explicit empty result", async () => {
  const first = await fixture();
  const second = await createLongitudinalPublication({ ...authority, evaluation: first.publication.evaluation, sourceManifest: first.publication.sourceManifest, knownAt: "2025-08-15T00:00:00Z", publishedAt: "2025-08-15T00:01:00Z", eventType: "ScheduledMarketObservation", supersedesResultId: first.publication.resultId });
  const records = [first.publication, second.publication];
  assert.equal(selectAuthoritativeState(records, { securityId: "789019", timestamp: "2025-08-01T00:00:00Z" }).record.resultId, first.publication.resultId);
  assert.equal(selectAuthoritativeState(records, { securityId: "789019", timestamp: "2025-01-01T00:00:00Z" }).kind, NO_AUTHORITATIVE_STATE);
  const aliases = [{ ticker: "MSFT", securityId: normalizeSecurityId("789019"), validFrom: "2025-07-30T20:00:00Z", validTo: null }];
  assert.equal(queryAsOf(records, aliases, { ticker: "msft", timestamp: "2025-08-01T00:00:00Z" }).record.securityId, normalizeSecurityId("789019"));
});

test("10-K detector enqueues changes only and generation reconciles partial failures", () => {
  const securities = [{ securityId: normalizeSecurityId("1"), latestAccession: "a2", marketObservationId: "m1" }, { securityId: normalizeSecurityId("2"), latestAccession: "b1", marketObservationId: "m1" }];
  const cursors = [{ securityId: normalizeSecurityId("1"), latestAccession: "a1", marketObservationId: "m1" }, { securityId: normalizeSecurityId("2"), latestAccession: "b1", marketObservationId: "m1" }];
  const work = detectAnnualWork({ securities, cursors });
  assert.equal(work[0].action, "Enqueue");
  assert.equal(work[0].eventType, "AnnualFilingAccepted");
  assert.equal(work[1].action, "NoChange");
  const manifest = reconcileGeneration({ generationId: "g1", universeIdentity: "fixture", universeHash: "u1", codeVersion: "c1", methodologyVersions: {}, startedAt: "2025-01-01T00:00:00Z", completedAt: "2025-01-01T00:01:00Z", marketObservation: {}, sourceManifestIds: ["s1"], events: [{ outcome: "Created", resultId: "r1" }, { outcome: "Reused", resultId: "r0" }, { outcome: "Failed", securityId: "sec-cik:0000000002", error: "SEC 503" }] });
  assert.equal(manifest.succeededCount, 2);
  assert.equal(manifest.failedCount, 1);
  assert.deepEqual(manifest.resultIdsReused, ["r0"]);
  assert.equal(manifest.failureEvents[0].error, "SEC 503");
});

test("prospective detector separates annual, quarterly, amendment, market, and source-mutation authority", () => {
  const securityId = normalizeSecurityId("1");
  const cursor = { securityId, latestAnnualAccession: "k1", latestQuarterlyAccession: "q1", latestQuarterlySourceHash: "h1", marketObservationId: "m1" };
  const base = { securityId, latestAnnualAccession: "k1", latestQuarterlyAccession: "q1", latestQuarterlyForm: "10-Q", latestQuarterlySourceHash: "h1", marketObservationId: "m1" };
  assert.equal(detectProspectiveWork({ securities: [base], cursors: [cursor] })[0].action, "NoChange");
  assert.equal(detectProspectiveWork({ securities: [{ ...base, latestQuarterlyAccession: "q2" }], cursors: [cursor] })[0].eventType, "QuarterlyFilingAccepted");
  assert.equal(detectProspectiveWork({ securities: [{ ...base, latestQuarterlyAccession: "qa2", latestQuarterlyForm: "10-Q/A" }], cursors: [cursor] })[0].eventType, "QuarterlyAmendmentAccepted");
  assert.equal(detectProspectiveWork({ securities: [{ ...base, latestQuarterlySourceHash: "changed" }], cursors: [cursor] })[0].action, "ReviewRequired");
  assert.equal(detectProspectiveWork({ securities: [{ ...base, marketObservationId: "m2" }], cursors: [cursor], marketCadenceDue: true })[0].eventType, "ScheduledMarketObservation");
  const newlyGoverningAnnual = { ...base, latestAnnualAccession: "k2", latestQuarterlyAccession: null, latestQuarterlyForm: null, latestQuarterlySourceHash: null };
  assert.equal(detectProspectiveWork({ securities: [newlyGoverningAnnual], cursors: [cursor] })[0].eventType, "AnnualFilingAccepted");
});

test("anonymous publication authorization is prohibited and missing secrets fail closed", async () => {
  const secret = "a".repeat(32);
  assert.equal(await verifyBearerAuthorization(null, secret), false);
  assert.equal(await verifyBearerAuthorization(`Bearer ${secret}`, undefined), false);
  assert.equal(await verifyBearerAuthorization("Bearer wrong", secret), false);
  assert.equal(await verifyBearerAuthorization(`Bearer ${secret}`, secret), true);
});

test("longitudinal publication remains limited to supported 10-K and 10-Q evidence", async () => {
  const baseline = await fixture();
  const sourceManifest = structuredClone(baseline.publication.sourceManifest);
  sourceManifest.sources[0].form = "8-K";
  delete sourceManifest.manifestId;
  delete sourceManifest.manifestHash;
  sourceManifest.manifestHash = await sha256Text(stableSerialize(sourceManifest));
  sourceManifest.manifestId = `esm_${sourceManifest.manifestHash}`;
  await assert.rejects(
    () => createLongitudinalPublication({ ...authority, evaluation: baseline.publication.evaluation, sourceManifest }),
    /supported Form 10-K, 10-Q, or 10-Q\/A/,
  );
});

test("deployment and scheduled publication controls remain explicit and default-off", async () => {
  const deployWorkflow = await readFile(new URL("../../.github/workflows/deploy-evidence-engine.yml", import.meta.url), "utf8");
  const generationWorkflow = await readFile(new URL("../../.github/workflows/evidence-engine-longitudinal.yml", import.meta.url), "utf8");
  assert.doesNotMatch(deployWorkflow, /\n\s+push:/);
  assert.match(deployWorkflow, /apply_authoritative_migration:[\s\S]*default: false/);
  assert.match(deployWorkflow, /if: \$\{\{ inputs\.apply_authoritative_migration == true \}\}/);
  assert.match(generationWorkflow, /if: \$\{\{ vars\.EVIDENCE_ENGINE_LONGITUDINAL_ENABLED == 'true' \}\}/);
});
