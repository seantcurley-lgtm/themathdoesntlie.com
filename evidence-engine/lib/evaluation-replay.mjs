import {
  ENGINE_VERSION,
  PUBLICATION_SCHEMA_VERSION,
  evaluateInputs,
} from "./evidence-engine.mjs";
import { SCORING_VERSION } from "./evidence-scoring.mjs";
import { ALIAS_REGISTRY_VERSION } from "./alias-registry.mjs";
import { CALCULATION_REGISTRY_VERSION } from "./calculation-registry.mjs";
import { CANONICAL_REGISTRY_VERSION } from "./canonical-registry.mjs";

export const EVALUATION_RECORD_SCHEMA_VERSION = "1.0";
export const REPLAY_CONTRACT_VERSION = "1.0.0";

const VERSION_FIELDS = Object.freeze([
  ["engineVersion", "Engine"],
  ["schemaVersion", "Publication schema"],
  ["canonicalRegistryVersion", "Canonical registry"],
  ["calculationRegistryVersion", "Calculation registry"],
  ["aliasRegistryVersion", "Alias registry"],
  ["scoringVersion", "Scoring policy"],
]);

export function currentVersionContext() {
  return {
    engineVersion: ENGINE_VERSION,
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    canonicalRegistryVersion: CANONICAL_REGISTRY_VERSION,
    calculationRegistryVersion: CALCULATION_REGISTRY_VERSION,
    aliasRegistryVersion: ALIAS_REGISTRY_VERSION,
    scoringVersion: SCORING_VERSION,
  };
}

export function snapshotVersionContext(snapshot) {
  return {
    engineVersion: snapshot?.engineVersion ?? null,
    schemaVersion: snapshot?.schemaVersion ?? null,
    canonicalRegistryVersion: snapshot?.canonicalRegistryVersion ?? null,
    calculationRegistryVersion: snapshot?.calculationRegistryVersion ?? null,
    aliasRegistryVersion: snapshot?.aliasRegistryVersion ?? null,
    scoringVersion: snapshot?.scoringVersion ?? snapshot?.scoring?.scoringVersion ?? null,
  };
}

export function replayEligibility(snapshot) {
  const recorded = snapshotVersionContext(snapshot);
  const available = currentVersionContext();
  const mismatches = VERSION_FIELDS.flatMap(([key, label]) =>
    recorded[key] === available[key]
      ? []
      : [{ key, label, recorded: recorded[key], available: available[key] }],
  );

  return {
    eligible: mismatches.length === 0,
    replayContractVersion: REPLAY_CONTRACT_VERSION,
    recorded,
    available,
    mismatches,
  };
}

function metricMap(snapshot) {
  return new Map((snapshot?.metrics ?? []).map((metric) => [metric.id, metric]));
}

function unavailableMap(snapshot) {
  return new Map((snapshot?.unavailableMetrics ?? []).map((metric) => [metric.id, metric]));
}

function metricState(snapshot, id) {
  const available = metricMap(snapshot).get(id);
  if (available) {
    return {
      id,
      name: available.name,
      status: "Available",
      value: available.value,
      unit: available.unit,
      reason: null,
    };
  }
  const unavailable = unavailableMap(snapshot).get(id);
  return {
    id,
    name: unavailable?.name ?? id,
    status: "Unavailable",
    value: null,
    unit: unavailable?.unit ?? null,
    reason: unavailable?.reason ?? "NotPublished",
  };
}

export function compareEvaluationSnapshots(original, candidate) {
  const ids = new Set([
    ...(original?.metrics ?? []).map((metric) => metric.id),
    ...(original?.unavailableMetrics ?? []).map((metric) => metric.id),
    ...(candidate?.metrics ?? []).map((metric) => metric.id),
    ...(candidate?.unavailableMetrics ?? []).map((metric) => metric.id),
  ]);

  const metricChanges = [...ids]
    .sort()
    .map((id) => {
      const before = metricState(original, id);
      const after = metricState(candidate, id);
      const changed =
        before.status !== after.status ||
        before.value !== after.value ||
        before.unit !== after.unit ||
        before.reason !== after.reason;
      return { id, name: before.name || after.name, changed, before, after };
    })
    .filter((item) => item.changed);

  const originalScore = original?.scoring?.overallScore ?? null;
  const candidateScore = candidate?.scoring?.overallScore ?? null;
  const originalTier = original?.scoring?.tier ?? null;
  const candidateTier = candidate?.scoring?.tier ?? null;

  return {
    fingerprintMatch: original?.fingerprint === candidate?.fingerprint,
    originalFingerprint: original?.fingerprint ?? null,
    candidateFingerprint: candidate?.fingerprint ?? null,
    metricChanges,
    metricChangeCount: metricChanges.length,
    scoringChanged: originalScore !== candidateScore || originalTier !== candidateTier,
    originalScore,
    candidateScore,
    originalTier,
    candidateTier,
    versionContextChanged:
      JSON.stringify(snapshotVersionContext(original)) !==
      JSON.stringify(snapshotVersionContext(candidate)),
  };
}

export async function replayStoredEvaluation(snapshot) {
  const eligibility = replayEligibility(snapshot);
  if (!eligibility.eligible) {
    return {
      status: "UnsupportedVersionContext",
      eligibility,
      replayed: null,
      comparison: null,
    };
  }

  const replayed = await evaluateInputs(snapshot.inputs);
  const comparison = compareEvaluationSnapshots(snapshot, replayed);
  return {
    status: comparison.fingerprintMatch ? "Reproduced" : "Diverged",
    eligibility,
    replayed,
    comparison,
  };
}

export async function compareStoredWithCurrent(snapshot) {
  const candidate = await evaluateInputs(snapshot.inputs);
  return {
    status: "Compared",
    candidate,
    comparison: compareEvaluationSnapshots(snapshot, candidate),
    recordedContext: snapshotVersionContext(snapshot),
    currentContext: currentVersionContext(),
  };
}
