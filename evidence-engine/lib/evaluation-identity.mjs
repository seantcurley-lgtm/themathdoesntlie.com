import { stableSerialize } from "./longitudinal-state.mjs";

function isEvaluation(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function removeEvidenceAcquisitionClock(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return;
  delete evidence.knownAt;
  for (const component of evidence.componentEvidence ?? []) removeEvidenceAcquisitionClock(component);
}

/**
 * Returns the governed evaluation identity while retaining acquisition clocks on
 * the source evaluation as descriptive audit metadata.
 */
export function canonicalEvaluationIdentity(evaluation) {
  if (!isEvaluation(evaluation)) throw new TypeError("An evaluation object is required for canonical identity.");
  const identity = structuredClone(evaluation);
  delete identity.generatedAt;
  delete identity.fingerprint;
  if (identity.inputs?.acquisition) delete identity.inputs.acquisition.acquiredAt;
  for (const evidence of Object.values(identity.inputs?.inputEvidence ?? {})) {
    removeEvidenceAcquisitionClock(evidence);
  }
  for (const metric of identity.metrics ?? []) {
    for (const lineage of metric?.lineage ?? []) removeEvidenceAcquisitionClock(lineage?.evidence);
  }
  return identity;
}

export function hasSameCanonicalEvaluationIdentity(left, right) {
  if (!isEvaluation(left) || !isEvaluation(right)) return false;
  return stableSerialize(canonicalEvaluationIdentity(left)) === stableSerialize(canonicalEvaluationIdentity(right));
}
